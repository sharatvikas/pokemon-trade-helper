import { NextRequest, NextResponse } from "next/server";
import { searchCards } from "@/lib/pokemontcg";
import { getScrydexPrice } from "@/lib/scrydex";

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  const q = params.get("q");
  const set = params.get("set") ?? undefined;
  if (!q || q.trim().length < 2) {
    return NextResponse.json({ error: "Query too short" }, { status: 400 });
  }
  const cards = await searchCards(q.trim(), set);

  // For cards with no pokemontcg.io price data, fetch from Scrydex in parallel
  const enriched = await Promise.all(
    cards.map(async (card) => {
      const hasPrices =
        card.tcgplayer?.prices && Object.keys(card.tcgplayer.prices).length > 0;
      if (hasPrices) return card;
      const scrydexPrice = await getScrydexPrice(card.id, card.name).catch(() => null);
      return scrydexPrice != null ? { ...card, scrydexPrice } : card;
    })
  );

  return NextResponse.json(enriched);
}
