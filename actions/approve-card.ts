import { defineAction, defineActionErrors } from "@agent-native/core/action";
import type { WriteReceipt } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { z } from "zod";

import { approvePackCard } from "../server/pack-repo";
import { fieldLabel } from "../shared/pack";
import { writePackSchema } from "../shared/pack-contract";

const errors = defineActionErrors(
  "sign_in_required",
  "pack_not_found",
  "card_not_found",
);

export default defineAction({
  description:
    "Mark one card approved. Export stays closed until all six cards are approved. Approving does not publish the pack.",
  schema: z.object({
    id: z.string().min(1).describe("Pack id"),
    cardId: z.string().min(1).describe("Card id from get-pack"),
  }),
  outputSchema: writePackSchema,
  errors,
  mcpAnnotations: {
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: true,
  },
  link: ({ result }) => ({
    url: buildDeepLink({
      view: "studio",
      to: `/studio/${encodeURIComponent(result.id)}`,
      params: { packId: result.id },
    }),
    label: "Open pack",
  }),
  run: async ({ id, cardId }, ctx) => {
    const ownerEmail = ctx?.userEmail?.trim();
    if (!ownerEmail) {
      return errors.noWrite("Sign in to approve a card.", "sign_in_required", {
        statusCode: 401,
      });
    }
    const result = await approvePackCard({
      ownerEmail,
      id,
      cardId,
    });
    if (result.kind !== "updated" && result.kind !== "unchanged") {
      return errors.noWrite(
        result.kind === "missing_pack" ? "Pack not found." : "Card not found.",
        result.kind === "missing_pack" ? "pack_not_found" : "card_not_found",
        { statusCode: 404 },
      );
    }
    const approved = result.card.status === "approved";
    const _receipt: WriteReceipt = {
      changed: result.kind === "updated",
      verified: approved,
      summary: approved
        ? `Approved ${fieldLabel(result.card.field)}. ${result.snapshot.approvedCount} of 6 cards are approved.`
        : `Could not approve ${fieldLabel(result.card.field)}.`,
      subject: id,
      checks: [
        {
          id: "card-approved",
          ok: approved,
          detail: `${result.snapshot.approvedCount} of 6`,
        },
      ],
    };
    return {
      ...result.snapshot,
      message: _receipt.summary,
      _receipt,
    };
  },
});
