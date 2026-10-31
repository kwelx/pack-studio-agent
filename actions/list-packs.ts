import { defineAction, defineActionErrors } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { z } from "zod";

import { listOwnedPacks } from "../server/pack-repo";

const errors = defineActionErrors("sign_in_required");

const outputSchema = z.object({
  packs: z.array(
    z.object({
      id: z.string(),
      brief: z.string(),
      title: z.string(),
      approvedCount: z.number().int(),
      updatedAt: z.string(),
    }),
  ),
});

export default defineAction({
  description:
    "List the signed-in user's packs, newest first, with each pack's title and approval count.",
  schema: z.object({
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(50)
      .default(50)
      .describe("Maximum packs to return, from 1 to 50. Defaults to 50."),
  }),
  outputSchema,
  errors,
  http: { method: "GET" },
  readOnly: true,
  mcpAnnotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
  },
  link: () => ({
    url: buildDeepLink({ view: "studio", to: "/studio" }),
    label: "Open Pack Studio",
  }),
  run: async ({ limit }, ctx) => {
    const ownerEmail = ctx?.userEmail?.trim();
    if (!ownerEmail) {
      return errors.noWrite("Sign in to list packs.", "sign_in_required", {
        statusCode: 401,
      });
    }
    const packs = await listOwnedPacks(ownerEmail, limit);
    return { packs };
  },
});
