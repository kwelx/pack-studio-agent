import { defineAction, defineActionErrors } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { z } from "zod";

import { listPackEventRows } from "../server/pack-repo";

const errors = defineActionErrors("sign_in_required", "pack_not_found");

const outputSchema = z.object({
  id: z.string(),
  events: z.array(
    z.object({
      id: z.string(),
      action: z.string(),
      summary: z.string(),
      createdAt: z.string(),
    }),
  ),
});

export default defineAction({
  description:
    "Read the action log for one pack, oldest first. Each entry is a draft, edit, approval, or export performed through the shared actions.",
  schema: z.object({
    id: z.string().min(1).describe("Pack id"),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(50)
      .default(40)
      .describe("Maximum events to return, from 1 to 50. Defaults to 40."),
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
  link: ({ args }) => ({
    url: buildDeepLink({
      view: "studio",
      to: `/studio/${encodeURIComponent(args.id)}`,
      params: { packId: args.id },
    }),
    label: "Open pack",
  }),
  run: async ({ id, limit }, ctx) => {
    const ownerEmail = ctx?.userEmail?.trim();
    if (!ownerEmail) {
      return errors.noWrite("Sign in to read the action log.", "sign_in_required", {
        statusCode: 401,
      });
    }
    const events = await listPackEventRows(id, ownerEmail, limit);
    if (!events) {
      return errors.noWrite("Pack not found.", "pack_not_found", {
        statusCode: 404,
      });
    }
    return { id, events };
  },
});
