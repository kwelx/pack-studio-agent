import { and, asc, desc, eq, inArray } from "drizzle-orm";

import {
  fieldLabel,
  isCardField,
  isCardStatus,
  prepareExport,
  renderPackHtml,
  type CardField,
  type PackCard,
} from "../shared/pack";
import { getDb } from "./db/index.js";
import { packCards, packEvents, packs } from "./db/schema.js";

export interface PackSnapshot {
  id: string;
  brief: string;
  updatedAt: string;
  approvedCount: number;
  cards: PackCard[];
}

export interface PackListItem {
  id: string;
  brief: string;
  title: string;
  approvedCount: number;
  updatedAt: string;
}

export interface PackEventRow {
  id: string;
  action: string;
  summary: string;
  createdAt: string;
}

function clip(value: string, max = 80): string {
  const flat = value.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1)}…`;
}

function toCard(row: typeof packCards.$inferSelect): PackCard {
  if (!isCardField(row.field) || !isCardStatus(row.status)) {
    throw new Error("Stored pack card has an unexpected field or status.");
  }
  return {
    id: row.id,
    field: row.field,
    value: row.value,
    status: row.status,
    position: row.position,
  };
}

function snapshot(
  pack: typeof packs.$inferSelect,
  cards: PackCard[],
): PackSnapshot {
  return {
    id: pack.id,
    brief: pack.brief,
    updatedAt: pack.updatedAt,
    approvedCount: cards.filter((card) => card.status === "approved").length,
    cards,
  };
}

export async function createPack(input: {
  ownerEmail: string;
  brief: string;
  cards: { field: CardField; value: string; position: number }[];
}): Promise<PackSnapshot> {
  const now = new Date().toISOString();
  const packId = crypto.randomUUID();
  const cardRows = input.cards.map((card) => ({
    id: crypto.randomUUID(),
    packId,
    ownerEmail: input.ownerEmail,
    field: card.field,
    value: card.value,
    status: "draft" as const,
    position: card.position,
  }));

  await getDb().transaction(async (tx) => {
    await tx.insert(packs).values({
      id: packId,
      brief: input.brief,
      ownerEmail: input.ownerEmail,
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(packCards).values(cardRows);
    await tx.insert(packEvents).values({
      id: crypto.randomUUID(),
      packId,
      ownerEmail: input.ownerEmail,
      action: "draft-pack",
      summary: `Drafted 6 cards for “${clip(input.brief, 60)}”.`,
      createdAt: now,
    });
  });

  return snapshot(
    {
      id: packId,
      brief: input.brief,
      ownerEmail: input.ownerEmail,
      createdAt: now,
      updatedAt: now,
    },
    cardRows.map(toCard),
  );
}

async function lockPack(
  tx: Pick<ReturnType<typeof getDb>, "select">,
  id: string,
  ownerEmail: string,
) {
  const [pack] = await tx
    .select()
    .from(packs)
    .where(and(eq(packs.id, id), eq(packs.ownerEmail, ownerEmail)))
    .limit(1)
    .for("update");
  return pack;
}

export async function editPackCard(input: {
  ownerEmail: string;
  id: string;
  cardId: string;
  value: string;
}): Promise<
  | { kind: "missing_pack" }
  | { kind: "missing_card" }
  | { kind: "unchanged"; card: PackCard; snapshot: PackSnapshot }
  | { kind: "updated"; card: PackCard; snapshot: PackSnapshot }
> {
  return getDb().transaction(async (tx) => {
    const pack = await lockPack(tx, input.id, input.ownerEmail);
    if (!pack) return { kind: "missing_pack" as const };
    const [row] = await tx
      .select()
      .from(packCards)
      .where(
        and(
          eq(packCards.id, input.cardId),
          eq(packCards.packId, input.id),
          eq(packCards.ownerEmail, input.ownerEmail),
        ),
      )
      .limit(1);
    if (!row) return { kind: "missing_card" as const };
    const current = toCard(row);
    if (current.value === input.value) {
      const cards = await readCards(tx, input.id, input.ownerEmail);
      return {
        kind: "unchanged" as const,
        card: current,
        snapshot: snapshot(pack, cards),
      };
    }
    const now = new Date().toISOString();
    await tx
      .update(packCards)
      .set({ value: input.value, status: "draft" })
      .where(eq(packCards.id, input.cardId));
    await tx.update(packs).set({ updatedAt: now }).where(eq(packs.id, input.id));
    await tx.insert(packEvents).values({
      id: crypto.randomUUID(),
      packId: input.id,
      ownerEmail: input.ownerEmail,
      action: "edit-card",
      summary: `Edited ${fieldLabel(current.field)} to “${clip(input.value)}” and returned it to draft.`,
      createdAt: now,
    });
    const saved = { ...current, value: input.value, status: "draft" as const };
    const cards = (await readCards(tx, input.id, input.ownerEmail)).map((card) =>
      card.id === saved.id ? saved : card,
    );
    return {
      kind: "updated" as const,
      card: saved,
      snapshot: snapshot({ ...pack, updatedAt: now }, cards),
    };
  });
}

export async function approvePackCard(input: {
  ownerEmail: string;
  id: string;
  cardId: string;
}): Promise<
  | { kind: "missing_pack" }
  | { kind: "missing_card" }
  | { kind: "unchanged"; card: PackCard; snapshot: PackSnapshot }
  | { kind: "updated"; card: PackCard; snapshot: PackSnapshot }
> {
  return getDb().transaction(async (tx) => {
    const pack = await lockPack(tx, input.id, input.ownerEmail);
    if (!pack) return { kind: "missing_pack" as const };
    const [row] = await tx
      .select()
      .from(packCards)
      .where(
        and(
          eq(packCards.id, input.cardId),
          eq(packCards.packId, input.id),
          eq(packCards.ownerEmail, input.ownerEmail),
        ),
      )
      .limit(1);
    if (!row) return { kind: "missing_card" as const };
    const current = toCard(row);
    if (current.status === "approved") {
      const cards = await readCards(tx, input.id, input.ownerEmail);
      return {
        kind: "unchanged" as const,
        card: current,
        snapshot: snapshot(pack, cards),
      };
    }
    const now = new Date().toISOString();
    await tx
      .update(packCards)
      .set({ status: "approved" })
      .where(eq(packCards.id, input.cardId));
    await tx.update(packs).set({ updatedAt: now }).where(eq(packs.id, input.id));
    await tx.insert(packEvents).values({
      id: crypto.randomUUID(),
      packId: input.id,
      ownerEmail: input.ownerEmail,
      action: "approve-card",
      summary: `Approved ${fieldLabel(current.field)}.`,
      createdAt: now,
    });
    const saved = { ...current, status: "approved" as const };
    const cards = (await readCards(tx, input.id, input.ownerEmail)).map((card) =>
      card.id === saved.id ? saved : card,
    );
    return {
      kind: "updated" as const,
      card: saved,
      snapshot: snapshot({ ...pack, updatedAt: now }, cards),
    };
  });
}

export async function readPack(
  id: string,
  ownerEmail: string,
): Promise<PackSnapshot | undefined> {
  const [pack] = await getDb()
    .select()
    .from(packs)
    .where(and(eq(packs.id, id), eq(packs.ownerEmail, ownerEmail)))
    .limit(1);
  if (!pack) return undefined;
  const cards = await readCards(getDb(), id, ownerEmail);
  return snapshot(pack, cards);
}

export async function listOwnedPacks(
  ownerEmail: string,
  limit: number,
): Promise<PackListItem[]> {
  const rows = await getDb()
    .select()
    .from(packs)
    .where(eq(packs.ownerEmail, ownerEmail))
    .orderBy(desc(packs.updatedAt))
    .limit(limit);
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const cards = await getDb()
    .select()
    .from(packCards)
    .where(
      and(eq(packCards.ownerEmail, ownerEmail), inArray(packCards.packId, ids)),
    );
  return rows.map((pack) => {
    const mine = cards.filter((card) => card.packId === pack.id).map(toCard);
    const title = mine.find((card) => card.field === "title")?.value ?? pack.brief;
    return {
      id: pack.id,
      brief: pack.brief,
      title,
      approvedCount: mine.filter((card) => card.status === "approved").length,
      updatedAt: pack.updatedAt,
    };
  });
}

export async function listPackEventRows(
  id: string,
  ownerEmail: string,
  limit: number,
): Promise<PackEventRow[] | undefined> {
  const pack = await readPack(id, ownerEmail);
  if (!pack) return undefined;
  const rows = await getDb()
    .select()
    .from(packEvents)
    .where(
      and(eq(packEvents.packId, id), eq(packEvents.ownerEmail, ownerEmail)),
    )
    .orderBy(asc(packEvents.createdAt))
    .limit(limit);
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    summary: row.summary,
    createdAt: row.createdAt,
  }));
}

export async function exportApprovedPack(input: {
  ownerEmail: string;
  id: string;
}): Promise<
  | { kind: "missing_pack" }
  | {
      kind: "blocked";
      errorCode: "cards_not_approved" | "invalid_card";
      message: string;
      draftFields: CardField[];
    }
  | { kind: "exported"; filename: string; html: string }
> {
  return getDb().transaction(async (tx) => {
    const pack = await lockPack(tx, input.id, input.ownerEmail);
    if (!pack) return { kind: "missing_pack" as const };
    const cards = await readCards(tx, input.id, input.ownerEmail);
    const prepared = prepareExport(cards);
    if (!prepared.ok) {
      return {
        kind: "blocked" as const,
        errorCode: prepared.errorCode,
        message: prepared.message,
        draftFields: prepared.draftFields,
      };
    }
    const html = renderPackHtml(prepared);
    const now = new Date().toISOString();
    await tx.insert(packEvents).values({
      id: crypto.randomUUID(),
      packId: input.id,
      ownerEmail: input.ownerEmail,
      action: "export-pack",
      summary: `Exported ${prepared.filename}. Nothing was published.`,
      createdAt: now,
    });
    await tx.update(packs).set({ updatedAt: now }).where(eq(packs.id, input.id));
    return {
      kind: "exported" as const,
      filename: prepared.filename,
      html,
    };
  });
}

type QueryDb = Pick<ReturnType<typeof getDb>, "select">;

async function readCards(
  db: QueryDb,
  id: string,
  ownerEmail: string,
): Promise<PackCard[]> {
  const rows = await db
    .select()
    .from(packCards)
    .where(and(eq(packCards.packId, id), eq(packCards.ownerEmail, ownerEmail)))
    .orderBy(asc(packCards.position));
  return rows.map(toCard);
}
