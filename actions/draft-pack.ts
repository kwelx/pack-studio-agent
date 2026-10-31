import { defineAction, defineActionErrors } from "@agent-native/core/action";
import type { WriteReceipt } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { z } from "zod";

import { createPack } from "../server/pack-repo";
import { draftCardValues, normalizeCardValue } from "../shared/pack";
import { writePackSchema } from "../shared/pack-contract";

const errors = defineActionErrors("sign_in_required", "invalid_card");

export default defineAction({
  description:
    "Create a private draft pack with exactly six cards (title, theme, palette, level1, level2, level3), all status draft. Does not publish or export.",
  schema: z.object({
    theme: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .describe("Short theme for the pack, 1 to 80 characters, such as Tide pools"),
  }),
  outputSchema: writePackSchema,
  errors,
  mcpAnnotations: {
    readOnlyHint: false,
    destructiveHint: false,
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
  run: async ({ theme }, ctx) => {
    const ownerEmail = ctx?.userEmail?.trim();
    if (!ownerEmail) {
      return errors.noWrite("Sign in to draft a pack.", "sign_in_required", {
        statusCode: 401,
      });
    }
    const cards = draftCardValues(theme);
    for (const card of cards) {
      const normalized = normalizeCardValue(card.field, card.value);
      if (!normalized.ok) {
        return errors.noWrite(normalized.message, "invalid_card", {
          statusCode: 400,
        });
      }
      card.value = normalized.value;
    }
    const snapshot = await createPack({
      ownerEmail,
      brief: theme,
      cards,
    });
    const _receipt: WriteReceipt = {
      changed: true,
      verified: snapshot.cards.length === 6,
      summary: `Drafted pack ${snapshot.id} with 6 cards.`,
      subject: snapshot.id,
      checks: [
        {
          id: "six-cards",
          ok: snapshot.cards.length === 6,
          detail: `${snapshot.cards.length} cards`,
        },
      ],
    };
    return {
      ...snapshot,
      message: "Drafted 6 cards. Nothing is approved or published.",
      _receipt,
    };
  },
});
