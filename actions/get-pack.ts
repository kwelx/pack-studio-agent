import { defineAction, defineActionErrors } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { z } from "zod";

import { readPack } from "../server/pack-repo";
import { packSnapshotSchema } from "../shared/pack-contract";

const errors = defineActionErrors("sign_in_required", "pack_not_found");

export default defineAction({
  description:
    "Read one pack owned by the signed-in user, including its six cards and how many are approved.",
  schema: z.object({
    id: z.string().min(1).describe("Pack id"),
  }),
  outputSchema: packSnapshotSchema,
  errors,
  http: { method: "GET" },
  readOnly: true,
  mcpAnnotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
  },
  link: ({ args }) => ({
    url: buildDeepLink({
      view: "studio",
      to: `/studio/${encodeURIComponent(args.id)}`,
      params: { packId: args.id },
    }),
    label: "Open pack",
  }),
  run: async ({ id }, ctx) => {
    const ownerEmail = ctx?.userEmail?.trim();
    if (!ownerEmail) {
      return errors.noWrite("Sign in to read a pack.", "sign_in_required", {
        statusCode: 401,
      });
    }
    const pack = await readPack(id, ownerEmail);
    if (!pack || pack.cards.length !== 6) {
      return errors.noWrite(
        "Pack not found.",
        "pack_not_found",
        { statusCode: 404 },
      );
    }
    return pack;
  },
});
