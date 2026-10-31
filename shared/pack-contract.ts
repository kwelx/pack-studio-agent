import { z } from "zod";

import { CARD_FIELDS } from "./pack";

export const cardSchema = z.object({
  id: z.string(),
  field: z.enum(CARD_FIELDS),
  value: z.string(),
  status: z.enum(["draft", "approved"]),
  position: z.number().int(),
});

export const packSnapshotSchema = z.object({
  id: z.string(),
  brief: z.string(),
  updatedAt: z.string(),
  approvedCount: z.number().int(),
  cards: z.array(cardSchema).length(6),
});

export const receiptSchema = z.object({
  changed: z.boolean(),
  verified: z.union([z.boolean(), z.literal("unverified")]),
  summary: z.string(),
  subject: z.string().optional(),
  checks: z
    .array(
      z.object({
        id: z.string(),
        ok: z.boolean(),
        detail: z.string().optional(),
      }),
    )
    .optional(),
});

export const writePackSchema = packSnapshotSchema.extend({
  message: z.string(),
  _receipt: receiptSchema,
});
