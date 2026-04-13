// eBay Finding API — completed/sold listings
// Requires EBAY_APP_ID in env

const FINDING_API = "https://svcs.ebay.com/services/search/FindingService/v1";

export interface EbaySoldResult {
  avgPrice: number | null;
  lastSoldPrice: number | null;
  listingCount: number;
  listings: { title: string; price: number; soldDate: string; url: string }[];
}

export async function getEbaySoldListings(cardName: string): Promise<EbaySoldResult> {
  const appId = process.env.EBAY_APP_ID;
  if (!appId) {
    return { avgPrice: null, lastSoldPrice: null, listingCount: 0, listings: [] };
  }

  const keywords = `${cardName} Pokemon card`;
  const params = new URLSearchParams({
    "OPERATION-NAME": "findCompletedItems",
    "SERVICE-VERSION": "1.0.0",
    "SECURITY-APPNAME": appId,
    "RESPONSE-DATA-FORMAT": "JSON",
    "REST-PAYLOAD": "",
    keywords,
    "itemFilter(0).name": "SoldItemsOnly",
    "itemFilter(0).value": "true",
    "itemFilter(1).name": "Category",
    "itemFilter(1).value": "2536", // Trading Card Games
    "sortOrder": "EndTimeSoonest",
    "paginationInput.entriesPerPage": "20",
  });

  try {
    const res = await fetch(`${FINDING_API}?${params.toString()}`);
    if (!res.ok) return { avgPrice: null, lastSoldPrice: null, listingCount: 0, listings: [] };

    const data = await res.json();
    const items =
      data?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item ?? [];

    if (!items.length) return { avgPrice: null, lastSoldPrice: null, listingCount: 0, listings: [] };

    const listings = items.map((item: Record<string, unknown>) => {
      const sellingStatus = item.sellingStatus as Record<string, unknown>[] | undefined;
      const price = parseFloat(
        (sellingStatus?.[0]?.currentPrice as Record<string, unknown>[])?.[0]?.__value__ as string ?? "0"
      );
      const listingInfo = item.listingInfo as Record<string, unknown>[] | undefined;
      const endTime = (listingInfo?.[0]?.endTime as string[])?.[0] ?? "";
      const viewItemURL = item.viewItemURL as string[] | undefined;
      return {
        title: (item.title as string[])?.[0] ?? "",
        price,
        soldDate: endTime,
        url: viewItemURL?.[0] ?? "",
      };
    });

    const prices = listings.map((l: { price: number }) => l.price).filter((p: number) => p > 0);
    const avgPrice = prices.length ? prices.reduce((a: number, b: number) => a + b, 0) / prices.length : null;
    const lastSoldPrice = prices[0] ?? null;

    return { avgPrice, lastSoldPrice, listingCount: items.length, listings };
  } catch {
    return { avgPrice: null, lastSoldPrice: null, listingCount: 0, listings: [] };
  }
}
