import { describe, expect, it, vi } from "vitest";
import { createMockProvenanceProvider } from "@/lib/provenance/mock-provider";
import { getProvenanceProvider } from "@/lib/provenance/provider";
import { verifyResponseSchema, type ProvenanceProvider } from "@/lib/provenance/types";
import { createVerifyHandler } from "@/lib/provenance/verify-handler";
import { createRateLimiter } from "@/lib/rate-limit";
import { JPEG_HEADER, makeFile, PNG_HEADER } from "./fixtures";

function setup(provider: ProvenanceProvider = createMockProvenanceProvider({ delayMs: 0 }), limit = 100) {
  const verifySpy = vi.spyOn(provider, "verify");
  const handler = createVerifyHandler({
    getProvider: () => provider,
    rateLimiter: createRateLimiter({ limit, windowMs: 60_000 }),
  });
  return { handler, verifySpy };
}

function upload(file: File | string | null, headers: Record<string, string> = {}): Request {
  const form = new FormData();
  if (file !== null) form.append("file", file);
  return new Request("http://localhost/api/verify", { method: "POST", body: form, headers });
}

async function body(response: Response) {
  return verifyResponseSchema.parse(await response.json());
}

describe("POST /api/verify", () => {
  it("returns a normalized report for a valid image", async () => {
    const { handler } = setup();
    const response = await handler(upload(makeFile(PNG_HEADER, "image/png", "a.png")));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const json = await body(response);
    expect(json.ok).toBe(true);
    if (json.ok) {
      expect(json.report.provider.mode).toBe("mock");
      expect(json.report.signals.map((s) => s.kind)).toEqual(["synthid", "c2pa"]);
    }
  });

  it("rejects requests without a file", async () => {
    const { handler, verifySpy } = setup();
    const response = await handler(upload(null));
    expect(response.status).toBe(400);
    expect(await body(response)).toMatchObject({ ok: false, error: { code: "invalid_request" } });
    expect(verifySpy).not.toHaveBeenCalled();
  });

  it("rejects unsupported MIME types", async () => {
    const { handler, verifySpy } = setup();
    const response = await handler(upload(makeFile([0x47, 0x49, 0x46], "image/gif", "a.gif")));
    expect(response.status).toBe(415);
    expect(verifySpy).not.toHaveBeenCalled();
  });

  it("rejects files whose content does not match the declared type", async () => {
    const { handler, verifySpy } = setup();
    const response = await handler(upload(makeFile(JPEG_HEADER, "image/png", "fake.png")));
    expect(response.status).toBe(415);
    expect(await body(response)).toMatchObject({ ok: false, error: { code: "unsupported_file_type" } });
    expect(verifySpy).not.toHaveBeenCalled();
  });

  it("rejects oversized requests from Content-Length before parsing", async () => {
    const { handler, verifySpy } = setup();
    const request = new Request("http://localhost/api/verify", {
      method: "POST",
      body: "x",
      headers: { "content-type": "multipart/form-data; boundary=x", "content-length": String(60 * 1024 * 1024) },
    });
    const response = await handler(request);
    expect(response.status).toBe(413);
    expect(verifySpy).not.toHaveBeenCalled();
  });

  it("rejects oversized files", async () => {
    const { handler } = setup();
    const big = makeFile(PNG_HEADER, "image/png", "big.png", 50 * 1024 * 1024);
    const response = await handler(upload(big));
    expect(response.status).toBe(413);
  });

  it("maps provider errors to error responses (no fabricated results)", async () => {
    const { handler } = setup(createMockProvenanceProvider({ delayMs: 0, scenario: "error_no_access" }));
    const response = await handler(upload(makeFile(PNG_HEADER, "image/png")));
    expect(response.status).toBe(502);
    const json = await body(response);
    expect(json).toMatchObject({ ok: false, error: { code: "no_access", upstreamStatus: 404 } });
    expect("report" in json).toBe(false);
  });

  it("forwards Retry-After on upstream rate limits", async () => {
    const { handler } = setup(createMockProvenanceProvider({ delayMs: 0, scenario: "error_rate_limited" }));
    const response = await handler(upload(makeFile(PNG_HEADER, "image/png")));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("30");
  });

  it("applies the per-client rate limit", async () => {
    const { handler, verifySpy } = setup(undefined, 2);
    const send = () => handler(upload(makeFile(PNG_HEADER, "image/png"), { "x-forwarded-for": "203.0.113.7" }));
    expect((await send()).status).toBe(200);
    expect((await send()).status).toBe(200);
    const limited = await send();
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(verifySpy).toHaveBeenCalledTimes(2);
  });

  it("hides unexpected errors behind a generic message", async () => {
    const provider: ProvenanceProvider = {
      id: "broken",
      name: "Broken",
      mode: "live",
      verify: async () => {
        throw new Error("secret internal detail");
      },
    };
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { handler } = setup(provider);
    const response = await handler(upload(makeFile(PNG_HEADER, "image/png")));
    const json = await body(response);
    expect(response.status).toBe(502);
    expect(JSON.stringify(json)).not.toContain("secret internal detail");
    errorSpy.mockRestore();
  });
});

describe("getProvenanceProvider", () => {
  it("does not fall back to mock data when the API key is missing", () => {
    expect(() => getProvenanceProvider({})).toThrowError(/OPENAI_API_KEY/);
  });

  it("selects the mock provider explicitly", () => {
    const provider = getProvenanceProvider({ PROVENANCE_PROVIDER: "mock", PROVENANCE_MOCK_SCENARIO: "not_detected" });
    expect(provider.mode).toBe("mock");
  });

  it("selects the OpenAI provider when configured", () => {
    const provider = getProvenanceProvider({ OPENAI_API_KEY: "sk-test" });
    expect(provider).toMatchObject({ id: "openai", mode: "live" });
  });
});
