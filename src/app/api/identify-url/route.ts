import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { searchCards, getCardById, TcgCard } from "@/lib/pokemontcg";
import { getScrydexPrice } from "@/lib/scrydex";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── TCGPlayer URL parser ──────────────────────────────────────────────────────
// Handles:
//   https://www.tcgplayer.com/product/123456/pokemon-...
//   https://tcgplayer.com/product/123456
function extractTcgPlayerProductId(url: string): string | null {
  const match = url.match(/tcgplayer\.com\/product\/(\d+)/i);
  return match?.[1] ?? null;
}

// ── pokemontcg.io URL parser ──────────────────────────────────────────────────
// Handles: https://pokemontcg.io/... or api.pokemontcg.io/v2/cards/xy1-1
function extractPokemonTcgCardId(url: string): string | null {
  const match = url.match(/pokemontcg\.io\/[^/]*\/cards?\/([a-z0-9]+-\d+)/i);
  return match?.[1] ?? null;
}

// ── Fetch page text (titles + meta + visible text) ───────────────────────────
async function fetchPageSummary(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; PokeTrade/1.0)" },
    signal: AbortSignal.timeout(8000),
  });
  const html = await res.text();

  // Pull title, meta description, og:title, og:description, h1s
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? "";
  const ogTitle = html.match(/property="og:title"[^>]*content="([^"]+)"/i)?.[1] ?? "";
  const ogDesc = html.match(/property="og:description"[^>]*content="([^"]+)"/i)?.[1] ?? "";
  const metaDesc = html.match(/name="description"[^>]*content="([^"]+)"/i)?.[1] ?? "";
  const h1s = [...html.matchAll(/<h1[^>]*>([^<]+)<\/h1>/gi)].map((m) => m[1]).join(" | ");

  return [title, ogTitle, ogDesc, metaDesc, h1s].filter(Boolean).join("\n").slice(0, 1500);
}

// ── Claude: identify card from page text ─────────────────────────────────────
async function identifyFromText(pageText: string, sourceUrl: string): Promise<{
  name: string | null;
  setName: string | null;
  cardNumber: string | null;
  confidence: "high" | "medium" | "low";
}> {
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: `From this webpage content, identify the Pokemon TCG card being shown.

URL: ${sourceUrl}
Content:
${pageText}

Return ONLY a JSON object:
{
  "name": "card name (e.g. Charizard)",
  "setName": "set name if visible (e.g. Base Set) or null",
  "cardNumber": "card number if visible (e.g. 4/102) or null",
  "confidence": "high | medium | low"
}

If this is not about a specific Pokemon TCG card, return { "name": null, "setName": null, "cardNumber": null, "confidence": "low" }.`,
      },
    ],
  });

  try {
    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch {
    // fall through
  }
  return { name: null, setName: null, cardNumber: null, confidence: "low" };
}

// ── Price enrichment ──────────────────────────────────────────────────────────
// Adds scrydexPrice to any card that has no pokemontcg.io price data

async function enrichPrices(cards: TcgCard[]): Promise<(TcgCard & { scrydexPrice?: number })[]> {
  return Promise.all(
    cards.map(async (card) => {
      const hasPrices =
        card.tcgplayer?.prices && Object.keys(card.tcgplayer.prices).length > 0;
      if (hasPrices) return card;
      const scrydexPrice = await getScrydexPrice(card.id, card.name).catch(() => null);
      return scrydexPrice != null ? { ...card, scrydexPrice } : card;
    })
  );
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { url } = await req.json();
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  // 1. Direct pokemontcg.io card ID in URL
  const directId = extractPokemonTcgCardId(url);
  if (directId) {
    const card = await getCardById(directId);
    if (card) {
      const cards = await enrichPrices([card]);
      return NextResponse.json({ cards, source: "pokemontcg-direct" });
    }
  }

  // 2. TCGPlayer product URL — look up by productId in pokemontcg.io
  const tcgProductId = extractTcgPlayerProductId(url);
  if (tcgProductId) {
    try {
      const res = await fetch(
        `https://api.pokemontcg.io/v2/cards?q=tcgplayer.productId:${tcgProductId}&pageSize=5`
      );
      const data = await res.json();
      if (data.data?.length) {
        const cards = await enrichPrices(data.data);
        return NextResponse.json({ cards, source: "tcgplayer-id" });
      }
    } catch {
      // fall through to Claude
    }
  }

  // 3. Any other URL — fetch page and ask Claude to identify the card
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set — cannot identify from URL" }, { status: 503 });
  }

  try {
    const pageText = await fetchPageSummary(parsedUrl.toString());
    const identified = await identifyFromText(pageText, url);

    if (!identified.name || identified.confidence === "low") {
      return NextResponse.json({
        cards: [],
        identified,
        source: "claude",
        message: "Could not identify a specific card from that URL.",
      });
    }

    // Search pokemontcg.io — pass the identified set name as a filter when available
    const cards = await searchCards(identified.name, identified.setName ?? undefined);

    // If set filter returned nothing, fall back to a broader search without it
    const raw = cards.length === 0 && identified.setName
      ? await searchCards(identified.name)
      : cards;

    const results = await enrichPrices(raw);
    return NextResponse.json({ cards: results, identified, source: "claude" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed to fetch URL: ${msg}` }, { status: 500 });
  }
}
