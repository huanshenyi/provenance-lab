import { describe, expect, it, vi } from "vitest";
import { createOpenAIProvenanceProvider, parseRetryAfter } from "@/lib/openai/provenance";
import { ProvenanceError } from "@/lib/provenance/types";
import { DETECTED_RESPONSE, makeFile, PNG_HEADER } from "./fixtures";

const file = () => makeFile(PNG_HEADER, "image/png", "sample.png");

function providerWith(fetchImpl: typeof fetch, timeoutMs?: number) {
  return createOpenAIProvenanceProvider({
    apiKey: "sk-test",
    baseUrl: "https://api.example.test/v1/",
    timeoutMs,
    fetch: fetchImpl,
  });
}

async function expectError(promise: Promise<unknown>, code: string) {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ProvenanceError);
  expect((error as ProvenanceError).code).toBe(code);
  return error as ProvenanceError;
}

describe("OpenAI provenance provider", () => {
  it("sends the file as multipart/form-data with the API key and normalizes the result", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json(DETECTED_RESPONSE));
    const report = await providerWith(fetchMock).verify(file());

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.test/v1/content_provenance_checks");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer sk-test");
    const body = init?.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect((body.get("file") as File).name).toBe("sample.png");

    expect(report.provider).toEqual({ id: "openai", name: "OpenAI Content Provenance", mode: "live" });
    expect(report.overall).toBe("detected");
    expect(report.raw).toEqual(DETECTED_RESPONSE);
    expect(report.checkedAt).toBe(new Date(DETECTED_RESPONSE.created_at * 1000).toISOString());
  });

  it.each([
    [400, "rejected_by_provider"],
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "no_access"],
    [500, "upstream_error"],
    [503, "upstream_error"],
  ])("maps HTTP %i to %s", async (status, code) => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({ error: { message: "upstream says no", type: "invalid_request_error" } }, { status }),
    );
    const error = await expectError(providerWith(fetchMock).verify(file()), code);
    expect(error.upstreamStatus).toBe(status);
  });

  it("includes the upstream message for rejected files", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({ error: { message: "Unsupported file" } }, { status: 400 }),
    );
    const error = await expectError(providerWith(fetchMock).verify(file()), "rejected_by_provider");
    expect(error.message).toContain("Unsupported file");
  });

  it("passes through Retry-After on 429", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () => new Response("{}", { status: 429, headers: { "Retry-After": "12" } }),
    );
    const error = await expectError(providerWith(fetchMock).verify(file()), "rate_limited");
    expect(error.retryAfter).toBe(12);
  });

  it("times out slow requests", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    await expectError(providerWith(fetchMock, 20).verify(file()), "timeout");
  });

  it("reports network failures", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => {
      throw new TypeError("fetch failed");
    });
    await expectError(providerWith(fetchMock).verify(file()), "network_error");
  });

  it("rejects responses that do not match the schema instead of guessing", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json({ object: "content_provenance_check" }));
    await expectError(providerWith(fetchMock).verify(file()), "invalid_response");
  });

  it("rejects non-JSON responses", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response("<html>", { status: 200 }));
    await expectError(providerWith(fetchMock).verify(file()), "invalid_response");
  });
});

describe("parseRetryAfter", () => {
  it("parses seconds and HTTP dates", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(parseRetryAfter("5", now)).toBe(5);
    expect(parseRetryAfter("Thu, 01 Jan 2026 00:00:30 GMT", now)).toBe(30);
    expect(parseRetryAfter(null, now)).toBeNull();
    expect(parseRetryAfter("soon", now)).toBeNull();
  });
});
