import { runMigrations } from "@agent-native/core/db";

export default runMigrations(
  [
    {
      version: 1,
      name: "pack-studio-tables",
      sql: `
        CREATE TABLE IF NOT EXISTS packs (
          id TEXT PRIMARY KEY,
          brief TEXT NOT NULL,
          owner_email TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS packs_owner_updated_idx
          ON packs (owner_email, updated_at);
        CREATE TABLE IF NOT EXISTS pack_cards (
          id TEXT PRIMARY KEY,
          pack_id TEXT NOT NULL,
          owner_email TEXT NOT NULL,
          field TEXT NOT NULL CHECK (field IN ('title', 'theme', 'palette', 'level1', 'level2', 'level3')),
          value TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('draft', 'approved')),
          position INTEGER NOT NULL CHECK (position >= 0 AND position < 6)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS pack_cards_pack_field
          ON pack_cards (pack_id, field);
        CREATE INDEX IF NOT EXISTS pack_cards_pack_position_idx
          ON pack_cards (pack_id, position);
        CREATE TABLE IF NOT EXISTS pack_events (
          id TEXT PRIMARY KEY,
          pack_id TEXT NOT NULL,
          owner_email TEXT NOT NULL,
          action TEXT NOT NULL,
          summary TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS pack_events_pack_created_idx
          ON pack_events (pack_id, created_at);
      `,
    },
  ],
  { table: "pack_studio_migrations" },
);
