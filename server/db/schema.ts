import { integer, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

export const packs = pgTable("packs", {
  id: text("id").primaryKey(),
  brief: text("brief").notNull(),
  ownerEmail: text("owner_email").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const packCards = pgTable(
  "pack_cards",
  {
    id: text("id").primaryKey(),
    packId: text("pack_id").notNull(),
    ownerEmail: text("owner_email").notNull(),
    field: text("field", {
      enum: ["title", "theme", "palette", "level1", "level2", "level3"],
    }).notNull(),
    value: text("value").notNull(),
    status: text("status", { enum: ["draft", "approved"] }).notNull(),
    position: integer("position").notNull(),
  },
  (table) => [uniqueIndex("pack_cards_pack_field").on(table.packId, table.field)],
);

export const packEvents = pgTable("pack_events", {
  id: text("id").primaryKey(),
  packId: text("pack_id").notNull(),
  ownerEmail: text("owner_email").notNull(),
  action: text("action").notNull(),
  summary: text("summary").notNull(),
  createdAt: text("created_at").notNull(),
});
