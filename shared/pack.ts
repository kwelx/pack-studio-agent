export const CARD_FIELDS = [
  "title",
  "theme",
  "palette",
  "level1",
  "level2",
  "level3",
] as const;

export type CardField = (typeof CARD_FIELDS)[number];
export type CardStatus = "draft" | "approved";

export interface PackCard {
  id: string;
  field: CardField;
  value: string;
  status: CardStatus;
  position: number;
}

export interface DraftCardValue {
  field: CardField;
  value: string;
  position: number;
}

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const PALETTES: readonly (readonly string[])[] = [
  ["#1c1917", "#faf7f2", "#c2410c", "#44403c", "#a8a29e"],
  ["#14213d", "#f7f4ef", "#e07a3d", "#3d405b", "#8d99ae"],
  ["#1f2933", "#f4f7f5", "#2f6f4e", "#5c6b73", "#c5a46e"],
  ["#24140f", "#fff8f3", "#9b3d3d", "#6b5b4b", "#d7c4b0"],
  ["#101418", "#f3f6f8", "#3d6f8c", "#5e6972", "#d2a15a"],
];

export function isCardField(value: string): value is CardField {
  return (CARD_FIELDS as readonly string[]).includes(value);
}

export function isCardStatus(value: string): value is CardStatus {
  return value === "draft" || value === "approved";
}

export function fieldLabel(field: CardField): string {
  switch (field) {
    case "title":
      return "Title";
    case "theme":
      return "Theme";
    case "palette":
      return "Palette";
    case "level1":
      return "Level 1";
    case "level2":
      return "Level 2";
    case "level3":
      return "Level 3";
    default: {
      const exhaustive: never = field;
      return exhaustive;
    }
  }
}

export function fieldHint(field: CardField): string {
  switch (field) {
    case "title":
      return "Plain text, up to 80 characters.";
    case "theme":
      return "Plain text, up to 240 characters.";
    case "palette":
      return "Three to five hex colors, separated by commas.";
    case "level1":
    case "level2":
    case "level3":
      return "Name — goal. Example: Warm-up — Name one detail.";
    default: {
      const exhaustive: never = field;
      return exhaustive;
    }
  }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function filenameForTitle(title: string): string {
  const slug = title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${slug || "pack"}.html`;
}

function collapse(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function paletteForTheme(theme: string): string[] {
  let hash = 0;
  for (const char of theme) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  const palette = PALETTES[hash % PALETTES.length];
  return palette ? [...palette] : ["#1c1917", "#faf7f2", "#c2410c"];
}

export function parsePalette(
  value: string,
): { ok: true; colors: string[] } | { ok: false } {
  const colors = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (colors.length < 3 || colors.length > 5) return { ok: false };
  if (!colors.every((color) => HEX_COLOR.test(color))) return { ok: false };
  return { ok: true, colors };
}

export function normalizeCardValue(
  field: CardField,
  raw: string,
): { ok: true; value: string } | { ok: false; message: string } {
  switch (field) {
    case "title": {
      const value = collapse(raw);
      if (value.length < 1 || value.length > 80) {
        return { ok: false, message: "Title needs 1 to 80 characters." };
      }
      return { ok: true, value };
    }
    case "theme": {
      const value = collapse(raw);
      if (value.length < 1 || value.length > 240) {
        return { ok: false, message: "Theme needs 1 to 240 characters." };
      }
      return { ok: true, value };
    }
    case "palette": {
      const parsed = parsePalette(raw);
      if (!parsed.ok) {
        return {
          ok: false,
          message:
            "Palette needs 3 to 5 hex colors, like #1c1917, #faf7f2, #c2410c.",
        };
      }
      return { ok: true, value: parsed.colors.join(", ") };
    }
    case "level1":
    case "level2":
    case "level3": {
      const value = collapse(raw);
      const parsed = splitLevel(value);
      if (!parsed || parsed.name.length > 40 || parsed.goal.length > 180) {
        return {
          ok: false,
          message:
            "A level needs a name and a goal separated by — , like Warm-up — Name one detail.",
        };
      }
      return { ok: true, value: `${parsed.name} — ${parsed.goal}` };
    }
    default: {
      const exhaustive: never = field;
      return exhaustive;
    }
  }
}

export function splitLevel(
  value: string,
): { name: string; goal: string } | null {
  const em = value.indexOf(" — ");
  const hyphen = em >= 0 ? -1 : value.indexOf(" - ");
  const index = em >= 0 ? em : hyphen;
  if (index < 0) return null;
  const name = value.slice(0, index).trim();
  const goal = value.slice(index + 3).trim();
  if (!name || !goal) return null;
  return { name, goal };
}

export function draftCardValues(theme: string): DraftCardValue[] {
  const clean = collapse(theme);
  const palette = paletteForTheme(clean).join(", ");
  const levels: readonly (readonly [CardField, string, string])[] = [
    ["level1", "Warm-up", `Notice one ${clean} detail and name it.`],
    ["level2", "Build", `Make a small ${clean} study with three choices.`],
    ["level3", "Show", `Finish a tiny ${clean} piece someone else can try.`],
  ];
  return [
    { field: "title", value: `${clean} Pack`.slice(0, 80), position: 0 },
    { field: "theme", value: clean, position: 1 },
    { field: "palette", value: palette, position: 2 },
    ...levels.map(([field, name, goal], index) => ({
      field,
      value: `${name} — ${goal}`.slice(0, 220),
      position: index + 3,
    })),
  ];
}

export interface ExportLevel {
  field: "level1" | "level2" | "level3";
  name: string;
  goal: string;
}

export interface PreparedPack {
  title: string;
  theme: string;
  palette: string[];
  levels: ExportLevel[];
  cards: PackCard[];
  filename: string;
}

export type ExportBlock = {
  ok: false;
  errorCode: "cards_not_approved" | "invalid_card";
  message: string;
  draftFields: CardField[];
};

export function prepareExport(
  cards: PackCard[],
): ({ ok: true } & PreparedPack) | ExportBlock {
  const byField = new Map(cards.map((card) => [card.field, card]));
  const missing = CARD_FIELDS.filter((field) => !byField.has(field));
  if (missing.length > 0 || cards.length !== CARD_FIELDS.length) {
    return {
      ok: false,
      errorCode: "invalid_card",
      message: "This pack is missing one of its six cards.",
      draftFields: missing,
    };
  }

  const ordered = CARD_FIELDS.map((field) => byField.get(field)!);
  const draftFields = ordered
    .filter((card) => card.status !== "approved")
    .map((card) => card.field);
  if (draftFields.length > 0) {
    const labels = new Intl.ListFormat("en", { type: "conjunction" }).format(
      draftFields.map((field) => fieldLabel(field)),
    );
    const verb = draftFields.length === 1 ? "needs" : "need";
    return {
      ok: false,
      errorCode: "cards_not_approved",
      message: `${labels} still ${verb} approval. Export stays closed until every card is approved.`,
      draftFields,
    };
  }

  const normalized: PackCard[] = [];
  for (const card of ordered) {
    const next = normalizeCardValue(card.field, card.value);
    if (!next.ok) {
      return {
        ok: false,
        errorCode: "invalid_card",
        message: `${fieldLabel(card.field)}: ${next.message}`,
        draftFields: [card.field],
      };
    }
    normalized.push({ ...card, value: next.value });
  }

  const title = normalized[0]?.value ?? "";
  const theme = normalized[1]?.value ?? "";
  const palette = parsePalette(normalized[2]?.value ?? "");
  if (!palette.ok) {
    return {
      ok: false,
      errorCode: "invalid_card",
      message: "Palette needs 3 to 5 hex colors before it can be exported.",
      draftFields: ["palette"],
    };
  }

  const levels: ExportLevel[] = [];
  for (const field of ["level1", "level2", "level3"] as const) {
    const card = normalized.find((item) => item.field === field);
    const parsed = card ? splitLevel(card.value) : null;
    if (!card || !parsed) {
      return {
        ok: false,
        errorCode: "invalid_card",
        message: `${fieldLabel(field)} needs a name and a goal.`,
        draftFields: [field],
      };
    }
    levels.push({ field, name: parsed.name, goal: parsed.goal });
  }

  return {
    ok: true,
    title,
    theme,
    palette: palette.colors,
    levels,
    cards: normalized,
    filename: filenameForTitle(title),
  };
}

export function renderPackHtml(pack: PreparedPack): string {
  const swatches = pack.palette
    .map(
      (color) =>
        `<span class="swatch" style="background:${escapeHtml(color)}"></span>`,
    )
    .join("");
  const levels = pack.levels
    .map(
      (level) =>
        `<article class="level"><h3>${escapeHtml(level.name)}</h3><p>${escapeHtml(level.goal)}</p></article>`,
    )
    .join("");
  const cards = pack.cards
    .map(
      (card) =>
        `<li><span>${escapeHtml(fieldLabel(card.field))}</span> ${escapeHtml(card.value)}</li>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:;">
  <title>${escapeHtml(pack.title)}</title>
  <style>
    body { margin: 0; background: #f4f1ea; color: #1c1917; font-family: Georgia, "Iowan Old Style", Palatino, serif; }
    main { max-width: 40rem; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; }
    h1 { font-size: 2.4rem; line-height: 1.1; font-weight: 500; margin: 0 0 0.75rem; }
    .theme { font-size: 1.15rem; line-height: 1.5; margin: 0 0 1.5rem; }
    .swatches { display: flex; gap: 0.5rem; margin: 0 0 2rem; }
    .swatch { width: 2.5rem; height: 2.5rem; border-radius: 999px; border: 1px solid rgba(28, 25, 23, 0.2); }
    .levels { display: grid; gap: 0.75rem; }
    .level { background: #fffdf8; border: 1px solid rgba(28, 25, 23, 0.12); border-radius: 0.75rem; padding: 0.9rem 1rem; }
    .level h3 { margin: 0 0 0.35rem; font-size: 1rem; }
    .level p { margin: 0; line-height: 1.45; }
    .cards { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid rgba(28, 25, 23, 0.15); }
    .cards h2 { font-size: 0.8rem; letter-spacing: 0.08em; text-transform: uppercase; font-family: system-ui, sans-serif; }
    ol { padding-left: 1.1rem; }
    li { margin: 0.35rem 0; }
    li span { font-family: system-ui, sans-serif; font-size: 0.75rem; letter-spacing: 0.04em; text-transform: uppercase; }
    footer { margin-top: 2rem; font-family: system-ui, sans-serif; font-size: 0.8rem; color: #57534e; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(pack.title)}</h1>
    <p class="theme">${escapeHtml(pack.theme)}</p>
    <div class="swatches">${swatches}</div>
    <section class="levels">${levels}</section>
    <section class="cards">
      <h2>Approved cards</h2>
      <ol>${cards}</ol>
    </section>
    <footer>Exported from Pack Studio after every card was approved. This file is a static preview, not a store listing.</footer>
  </main>
</body>
</html>`;
}
