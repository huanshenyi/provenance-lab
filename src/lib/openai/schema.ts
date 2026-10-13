import { z } from "zod";

/**
 * Response schema of `POST /v1/content_provenance_checks`.
 * https://developers.openai.com/api/docs/guides/content-provenance
 *
 * Known enum values are listed for documentation, but unknown strings are
 * accepted so that additive API changes do not break parsing.
 */

const KNOWN_VALIDATION_STATES = ["trusted", "valid", "invalid", "not_present"] as const;

export const outcomeSchema = z.enum(["detected", "not_detected"]);

const nullableString = z.string().nullable().optional().transform((v) => v ?? null);

export const c2paResultSchema = z.object({
  type: z.literal("c2pa"),
  outcome: outcomeSchema,
  validation_state: z
    .union([z.enum(KNOWN_VALIDATION_STATES), z.string()])
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  issuer: nullableString,
  model: nullableString,
  generated_at: nullableString,
});

export const synthIdResultSchema = z.object({
  type: z.literal("synthid"),
  outcome: outcomeSchema,
  model: nullableString,
  generated_at: nullableString,
});

/** Result types this app does not understand yet are kept but ignored. */
const unknownResultSchema = z
  .object({ type: z.string() })
  .loose()
  .refine((r) => r.type !== "c2pa" && r.type !== "synthid", {
    message: "Malformed c2pa/synthid result",
  });

export const provenanceResultSchema = z.union([
  c2paResultSchema,
  synthIdResultSchema,
  unknownResultSchema,
]);

export const contentProvenanceCheckSchema = z.object({
  object: z.literal("content_provenance_check"),
  created_at: z.number().int().nonnegative(),
  results: z.array(provenanceResultSchema),
});

export type C2paResult = z.infer<typeof c2paResultSchema>;
export type SynthIdResult = z.infer<typeof synthIdResultSchema>;
export type ContentProvenanceCheck = z.infer<typeof contentProvenanceCheckSchema>;

/** OpenAI error envelope: `{ "error": { "message": "...", "type": "...", "code": "..." } }`. */
export const openAIErrorSchema = z.object({
  error: z
    .object({
      message: z.string().optional(),
      type: z.string().nullable().optional(),
      code: z.string().nullable().optional(),
    })
    .loose(),
});
