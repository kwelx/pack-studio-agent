# Pack Studio

Co-build a small digital pack with an agent, and approve every card before it ships.

Pack Studio is an [Agent-Native](https://www.agent-native.com/docs) workspace. A person and the agent share four write actions:

| Action | What it does |
| --- | --- |
| `draft-pack` | Creates six draft cards: title, theme, palette, and three levels. |
| `edit-card` | Replaces one card. A changed value returns that card to draft. |
| `approve-card` | Marks one card approved. |
| `export-pack` | Returns a static HTML page only when every card is approved. |

The React desk and the agent call those same actions. Export escapes text, allows only hex colors in the palette, and does not upload anything to a store.

This is an entry for the [Builder.io Agent-Native Hackathon](https://www.builder.io/hackathon). The form description is in [SUBMISSION.md](SUBMISSION.md). Deadline: November 9, 2026, 11:59 PM PT (November 10, 2026, 2:59 AM ET).

## Pre-existing work

The app shell, auth, chat, and Agent-Native runtime come from the Chat template in `@agent-native/core` 0.222.2 (`npx @agent-native/core create --standalone --template chat`). The pack schema, actions, studio UI, HTML export, and tests were written for this hackathon. No third-party images are included.

## Setup

Requires Node.js 22.22 or newer and pnpm (Corepack provides the version in `package.json`).

```bash
corepack enable
pnpm install
pnpm dev
```

Open the URL printed by `pnpm dev` (it starts at port 8080 and moves up if that port is taken). On the welcome screen, choose **Continue as local dev**. You do not need an account for local development.

Local data is stored in PGlite at `data/pglite`. That directory is gitignored. Production needs a hosted Postgres `DATABASE_URL` and a stable `BETTER_AUTH_SECRET`. See `.env.example`. Do not commit secrets.

The proof desk works without a model provider. Agent chat needs a provider key, which you can add from the in-app settings screen or through the environment variables documented by Agent-Native. Leave keys out of the repository.

## Demo flow

1. Start the app and continue as local dev. You land on `/studio`, an empty desk.
2. Type a theme such as `Tide pools` and press **Draft 6 cards**. The desk opens six cards, all marked draft, and the action log records `draft-pack`.
3. Change Level 3 and press **Save**. The card returns to draft if it had been approved, and the log records `edit-card` with the new text.
4. Approve five cards. Press **Export static page**. The action refuses and names the card that is still a draft. No HTML preview appears.
5. Approve the last card. Press **Export static page** again. A sandboxed preview appears, and **Download HTML** saves the static page.
6. Optional, with a model key connected: press **Ask the agent to revise level 3**. The agent sidebar calls `edit-card` on that card. The desk and the action log show the same edit, and the card is draft again until you approve it.

Nothing in this flow publishes the pack.

## Tests

```bash
pnpm test
```

The tests cover the six-card draft, the approval gate, HTML escaping, and palette rejection. They do not need a database or a model key.

## Deploy later

This repository does not deploy itself. When you want a public URL, Agent-Native can build a Cloudflare Worker. From the app directory, with `DATABASE_URL` pointing at hosted Postgres:

```bash
pnpm migrate:production
NITRO_PRESET=cloudflare_module pnpm build
```

Save `DATABASE_URL` and `BETTER_AUTH_SECRET` with Wrangler, then deploy the generated config:

```bash
npx wrangler deploy --config .output/server/wrangler.json
```

The official steps are at [agent-native.com/docs/cloudflare](https://www.agent-native.com/docs/cloudflare/). Node, Docker, Vercel, and Netlify are also supported. PGlite is for local development only.

## License

[MIT](LICENSE)
