import { describe, expect, it } from "vitest";

import {
  CARD_FIELDS,
  draftCardValues,
  escapeHtml,
  filenameForTitle,
  normalizeCardValue,
  prepareExport,
  renderPackHtml,
  type PackCard,
} from "../shared/pack";

function approved(cards: PackCard[]): PackCard[] {
  return cards.map((card) => ({ ...card, status: "approved" }));
}

function cardsFromDraft(theme: string): PackCard[] {
  return draftCardValues(theme).map((card, index) => ({
    id: `card-${index}`,
    field: card.field,
    value: card.value,
    status: "draft",
    position: card.position,
  }));
}

describe("draft packs", () => {
  it("creates exactly six cards in field order", () => {
    const cards = draftCardValues("Tide pools");
    expect(cards.map((card) => card.field)).toEqual([...CARD_FIELDS]);
    expect(cards).toHaveLength(6);
    for (const card of cards) {
      expect(normalizeCardValue(card.field, card.value).ok).toBe(true);
    }
  });
});

describe("export gate", () => {
  it("refuses while any card is still a draft", () => {
    const cards = cardsFromDraft("Tide pools");
    cards[0] = { ...cards[0], status: "approved" };
    const result = prepareExport(cards);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errorCode).toBe("cards_not_approved");
    expect(result.draftFields).toEqual([
      "theme",
      "palette",
      "level1",
      "level2",
      "level3",
    ]);
    expect(result.message).toContain("still need approval");
  });

  it("uses a singular verb when one card is still a draft", () => {
    const cards = approved(cardsFromDraft("Moss"));
    const level3 = cards[5];
    if (!level3) throw new Error("missing level 3");
    cards[5] = { ...level3, status: "draft" };
    const result = prepareExport(cards);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toBe(
      "Level 3 still needs approval. Export stays closed until every card is approved.",
    );
  });

  it("renders escaped html only after every card is approved", () => {
    const cards = approved(cardsFromDraft("Tide pools"));
    cards[0] = {
      ...cards[0],
      value: `Fish & <script>alert("x")</script>`,
    };
    const prepared = prepareExport(cards);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const html = renderPackHtml(prepared);
    expect(html).toContain("Fish &amp; &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("default-src 'none'");
    expect(prepared.filename).toBe("fish-script-alert-x-script.html");
  });

  it("rejects a palette that is not hex colors", () => {
    const cards = approved(cardsFromDraft("Moss"));
    cards[2] = {
      ...cards[2],
      value: "#fff; } body { background: url(javascript:alert(1))",
    };
    const result = prepareExport(cards);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errorCode).toBe("invalid_card");
    expect(result.draftFields).toEqual(["palette"]);
  });
});

describe("card values", () => {
  it("canonicalizes a palette and a hyphenated level", () => {
    expect(normalizeCardValue("palette", "#fff,#000,#abc")).toEqual({
      ok: true,
      value: "#fff, #000, #abc",
    });
    expect(normalizeCardValue("level1", "Warm-up - Name one detail")).toEqual({
      ok: true,
      value: "Warm-up — Name one detail",
    });
  });

  it("builds a filename from the title without path characters", () => {
    expect(filenameForTitle("../../etc/passwd")).toBe("etc-passwd.html");
    expect(filenameForTitle("   ")).toBe("pack.html");
    expect(escapeHtml(`a<b>"c"&d`)).toBe("a&lt;b&gt;&quot;c&quot;&amp;d");
  });
});
