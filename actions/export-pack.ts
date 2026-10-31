import { defineAction, defineActionErrors } from "@agent-native/core/action";
import type { WriteReceipt } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { z } from "zod";

import { exportApprovedPack } from "../server/pack-repo";
import { receiptSchema } from "../shared/pack-contract";

const errors = defineActionErrors(
  "sign_in_required",
  "pack_not_found",
  "cards_not_approved",
  "invalid_card",
);

const outputSchema = z.object({
  id: z.string(),
  filename: z.string(),
  html: z.string(),
  message: z.string(),
  _receipt: receiptSchema,
});

export default defineAction({
  description:
    "Build a static HTML preview for a pack only when all six cards are approved. Refuses with cards_not_approved and the draft field names otherwise. Does not publish to a store.",
  schema: z.object({
    id: z.string().min(1).describe("Pack id"),
  }),
  outputSchema,
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
  run: async ({ id }, ctx) => {
    const ownerEmail = ctx?.userEmail?.trim();
    if (!ownerEmail) {
      return errors.noWrite("Sign in to export a pack.", "sign_in_required", {
        statusCode: 401,
      });
    }
    const result = await exportApprovedPack({
      ownerEmail,
      id,
    });
    if (result.kind === "missing_pack") {
      return errors.noWrite("Pack not found.", "pack_not_found", {
        statusCode: 404,
      });
    }
    if (result.kind === "blocked") {
      return errors.noWrite(result.message, result.errorCode, {
        statusCode: 409,
        details: { draftFields: result.draftFields },
      });
    }
    const filename = result.filename;
    const html = result.html;
    const safe =
      html.includes("default-src 'none'") &&
      !html.includes("<script") &&
      filename.endsWith(".html");
    const _receipt: WriteReceipt = {
      changed: true,
      verified: safe,
      summary: safe
        ? `Exported ${filename}. Nothing was published.`
        : `Export file for ${id} failed the HTML safety check.`,
      subject: id,
      checks: [{ id: "static-html", ok: safe, detail: filename }],
    };
    return {
      id,
      filename,
      html,
      message: _receipt.summary,
      _receipt,
    };
  },
});
