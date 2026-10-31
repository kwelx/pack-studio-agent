import { getOrgContext } from "@agent-native/core/org";
import {
  createAgentChatPlugin,
  loadActionsFromStaticRegistry,
} from "@agent-native/core/server";

import actionsRegistry from "../../.generated/actions-registry.js";

const INITIAL_TOOL_NAMES = [
  "view-screen",
  "navigate",
  "draft-pack",
  "get-pack",
  "list-packs",
  "edit-card",
  "approve-card",
  "export-pack",
  "list-pack-events",
];

export default createAgentChatPlugin({
  appId: "pack-studio",
  actions: loadActionsFromStaticRegistry(actionsRegistry),
  mcp: { connectorCatalog: [], appApprovalPage: true },
  initialToolNames: INITIAL_TOOL_NAMES,
  resolveOrgId: async (event) => (await getOrgContext(event)).orgId,
  systemPrompt: `You are the Pack Studio agent. You help draft a small digital pack on /studio. You never publish it.

A pack has exactly six cards: title, theme, palette, level1, level2, level3. draft-pack creates them as drafts. edit-card replaces one card and returns it to draft when the text changes. Palette values are 3 to 5 hex colors separated by commas. Level values use "Name — goal". approve-card marks one card approved. Only approve a card when the person asks you to approve that specific card. export-pack returns static HTML and refuses with cards_not_approved until every card is approved. Do not claim a pack shipped, and do not invent a store upload.

Read get-pack before you describe what is approved. After a write, read it again and report the card text and status you observed. Navigation uses view "studio" and packId when a pack is open.`,
});
