import { defineAction, defineActionErrors } from "@agent-native/core/action";
import type { WriteReceipt } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { z } from "zod";

import { editPackCard, readPack } from "../server/pack-repo";
import { fieldLabel, normalizeCardValue } from "../shared/pack";
import { writePackSchema } from "../shared/pack-contract";

const errors = defineActionErrors(
  "sign_in_required",
  "pack_not_found",
  "card_not_found",
  "invalid_card",
);

export default defineAction({
  description:
    "Replace one card value. A changed value returns that card to draft. Palette is 3 to 5 comma-separated hex colors. A level is 'Name — goal'. Does not publish.",
  schema: z.object({
    id: z.string().min(1).describe("Pack id from draft-pack or list-packs"),
    cardId: z.string().min(1).describe("Card id from get-pack"),
    value: z
      .string()
      .min(1)
      .max(500)
      .describe(
        "New card text. Title up to 80 characters, theme up to 240, palette as hex colors, level as 'Name — goal'.",
      ),
  }),
  outputSchema: writePackSchema,
  errors,
  mcpAnnotations: {
    readOnlyHint: false,
    destructiveHint: true,
    openWorldHint: false,
  },
  link: ({ result }) => ({
    url: buildDeepLink({
      view: "studio",
      to: `/studio/${encodeURIComponent(result.id)}`,
      params: { packId: result.id },
    }),
    label: "Open pack",
  }),
  run: async ({ id, cardId, value }, ctx) => {
    const ownerEmail = ctx?.userEmail?.trim();
    if (!ownerEmail) {
      return errors.noWrite("Sign in to edit a card.", "sign_in_required", {
        statusCode: 401,
      });
    }
    const current = await readPack(id, ownerEmail);
    if (!current) {
      return errors.noWrite("Pack not found.", "pack_not_found", {
        statusCode: 404,
      });
    }
    const card = current.cards.find((item) => item.id === cardId);
    if (!card) {
      return errors.noWrite("Card not found.", "card_not_found", {
        statusCode: 404,
      });
    }
    const normalized = normalizeCardValue(card.field, value);
    if (!normalized.ok) {
      return errors.noWrite(normalized.message, "invalid_card", {
        statusCode: 400,
      });
    }
    const nextValue = normalized.value;
    const result = await editPackCard({
      ownerEmail,
      id,
      cardId,
      value: nextValue,
    });
    if (result.kind !== "updated" && result.kind !== "unchanged") {
      return errors.noWrite(
        result.kind === "missing_pack" ? "Pack not found." : "Card not found.",
        result.kind === "missing_pack" ? "pack_not_found" : "card_not_found",
        { statusCode: 404 },
      );
    }
    const saved = result.card;
    const matches = saved.value === nextValue;
    const _receipt: WriteReceipt = {
      changed: result.kind === "updated",
      verified: matches,
      summary:
        result.kind === "updated"
          ? `Updated ${fieldLabel(saved.field)} and returned it to draft.`
          : `${fieldLabel(saved.field)} was already that text.`,
      subject: id,
      checks: [{ id: "card-value", ok: matches, detail: saved.status }],
    };
    return {
      ...result.snapshot,
      message: _receipt.summary,
      _receipt,
    };
  },
});
