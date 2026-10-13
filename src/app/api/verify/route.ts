import { getProvenanceProvider } from "@/lib/provenance/provider";
import { createVerifyHandler } from "@/lib/provenance/verify-handler";
import { createRateLimiter } from "@/lib/rate-limit";

const limitPerMinute = Number(process.env.RATE_LIMIT_PER_MINUTE);

const handler = createVerifyHandler({
  getProvider: () => getProvenanceProvider(),
  rateLimiter: createRateLimiter({
    limit: Number.isFinite(limitPerMinute) && limitPerMinute > 0 ? limitPerMinute : 10,
    windowMs: 60_000,
  }),
});

export async function POST(request: Request): Promise<Response> {
  return handler(request);
}
