/**
 * Scrydex price fallback
 *
 * pokemontcg.io sometimes lacks TCGPlayer price data for new or Japanese sets.
 * Scrydex (scrydex.com) embeds chart price series directly in its HTML and
 * covers these cards, so we scrape it as a fallback.
 *
 * URL pattern: https://scrydex.com/pokemon/cards/{name-slug}/{card-id}
 */

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9\s-]/g, "")    // remove special chars
    .trim()
    .replace(/\s+/g, "-");
}

/**
 * Returns the latest market price from Scrydex for a given card.
 * Extracts the most recent value from the embedded chart data series.
 * Returns null if the card isn't found or has no data.
 */
export async function getScrydexPrice(
  cardId: string,
  cardName: string
): Promise<number | null> {
  const slug = toSlug(cardName);
  const url = `https://scrydex.com/pokemon/cards/${slug}/${cardId}`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PokeTrade/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const html = await res.text();

    // Scrydex embeds chart data as arrays of [date, price] pairs in JSON form.
    // Pattern: [["2026-04-01",21.99],["2026-04-02",22.50],...]
    const seriesRegex =
      /\[(\["20\d\d-\d\d-\d\d",[\d.]+\](?:,\["20\d\d-\d\d-\d\d",[\d.]+\])*)\]/g;

    let latestPrice: number | null = null;
    let latestDate = "";

    for (const match of html.matchAll(seriesRegex)) {
      try {
        const pairs: [string, number][] = JSON.parse(`[${match[1]}]`);
        const last = pairs[pairs.length - 1];
        if (last && last[0] > latestDate) {
          latestDate = last[0];
          latestPrice = last[1];
        }
      } catch {
        // skip malformed entries
      }
    }

    return latestPrice;
  } catch {
    return null;
  }
}
