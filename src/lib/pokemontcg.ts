// pokemontcg.io v2 API — no key required, includes TCGPlayer market prices

export interface TcgSet {
  id: string;
  name: string;
  series: string;
  releaseDate: string;
  total: number;
  ptcgoCode: string | null; // present on English sets; proxy for "has TCGPlayer pricing"
}

export interface TcgCard {
  id: string;
  name: string;
  number: string;
  set: { id: string; name: string };
  images: { small: string; large: string };
  tcgplayer?: {
    url: string;
    prices?: {
      holofoil?: { market: number; low: number };
      normal?: { market: number; low: number };
      reverseHolofoil?: { market: number; low: number };
      "1stEditionHolofoil"?: { market: number; low: number };
    };
  };
}

const BASE = "https://api.pokemontcg.io/v2";

export async function searchCards(query: string, setFilter?: string): Promise<TcgCard[]> {
  // Single-word queries get a wildcard suffix ("Charizard" → matches VMAX, EX, etc.)
  // Multi-word queries must use exact phrase quotes ("Meowth ex*" is a Lucene 400 error)
  const words = query.trim().split(/\s+/);
  const nameClause = words.length === 1 ? `name:${query}*` : `name:"${query}"`;
  let qStr = nameClause;
  if (setFilter && setFilter.trim()) {
    qStr += ` set.name:"${setFilter.trim()}"`;
  }
  const q = encodeURIComponent(qStr);
  const res = await fetch(`${BASE}/cards?q=${q}&pageSize=20&select=id,name,number,set,images,tcgplayer`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`pokemontcg.io search failed: ${res.status}`);
  const data = await res.json();
  return data.data ?? [];
}

export async function getCardById(id: string): Promise<TcgCard | null> {
  const res = await fetch(`${BASE}/cards/${id}`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.data ?? null;
}

export async function getAllSets(): Promise<TcgSet[]> {
  const res = await fetch(
    `${BASE}/sets?orderBy=-releaseDate&pageSize=250&select=id,name,series,releaseDate,total,ptcgoCode`,
    { next: { revalidate: 86400 } } // cache 24 h
  );
  if (!res.ok) throw new Error(`pokemontcg.io sets failed: ${res.status}`);
  const data = await res.json();
  return data.data ?? [];
}

export function extractTcgPrices(card: TcgCard): { market: number | null; low: number | null } {
  const prices = card.tcgplayer?.prices;
  if (!prices) return { market: null, low: null };
  // prefer holofoil > normal > reverseHolofoil > 1stEdition
  const variant =
    prices.holofoil ??
    prices["1stEditionHolofoil"] ??
    prices.normal ??
    prices.reverseHolofoil;
  if (!variant) return { market: null, low: null };
  return {
    market: variant.market ?? null,
    low: variant.low ?? null,
  };
}
