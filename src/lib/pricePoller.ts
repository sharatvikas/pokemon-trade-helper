import { prisma } from "./prisma";
import { getCardById, extractTcgPrices } from "./pokemontcg";
import { getEbaySoldListings } from "./ebay";
import { getScrydexPrice } from "./scrydex";
import { sendAlertEmail, AlertEmailPayload } from "./email";

export async function pollSingleCard(cardId: string): Promise<void> {
  const card = await prisma.wantCard.findUnique({
    where: { id: cardId },
    include: { alertRules: { where: { enabled: true } }, priceSnapshots: { orderBy: { fetchedAt: "desc" }, take: 1 } },
  });
  if (!card) return;

  let tcgMarket: number | null = null;
  let tcgLow: number | null = null;

  if (card.tcgPlayerId) {
    const tcgCard = await getCardById(card.tcgPlayerId);
    if (tcgCard) {
      const prices = extractTcgPrices(tcgCard);
      tcgMarket = prices.market;
      tcgLow = prices.low;
    }
    // Fallback: if pokemontcg.io has no price data (new/Japanese sets), try Scrydex
    if (tcgMarket === null) {
      tcgMarket = await getScrydexPrice(card.tcgPlayerId, card.name);
    }
  }

  const ebay = await getEbaySoldListings(card.name);

  await prisma.priceSnapshot.create({
    data: {
      cardId: card.id,
      tcgMarketPrice: tcgMarket,
      tcgLowPrice: tcgLow,
      ebayAvgSold: ebay.avgPrice,
      ebayLastSold: ebay.lastSoldPrice,
      ebayListingCount: ebay.listingCount,
    },
  });
}

export async function pollAllCardPrices(): Promise<{ updated: number; alerts: number }> {
  const cards = await prisma.wantCard.findMany({
    include: {
      alertRules: { where: { enabled: true } },
      priceSnapshots: {
        orderBy: { fetchedAt: "desc" },
        take: 1,
      },
    },
  });

  const pendingAlerts: AlertEmailPayload[] = [];
  let updated = 0;

  for (const card of cards) {
    try {
      let tcgMarket: number | null = null;
      let tcgLow: number | null = null;

      if (card.tcgPlayerId) {
        const tcgCard = await getCardById(card.tcgPlayerId);
        if (tcgCard) {
          const prices = extractTcgPrices(tcgCard);
          tcgMarket = prices.market;
          tcgLow = prices.low;
        }
        // Fallback: pokemontcg.io lacks prices for new/Japanese sets — try Scrydex
        if (tcgMarket === null) {
          tcgMarket = await getScrydexPrice(card.tcgPlayerId, card.name);
        }
      }

      const ebay = await getEbaySoldListings(card.name);

      const snapshot = await prisma.priceSnapshot.create({
        data: {
          cardId: card.id,
          tcgMarketPrice: tcgMarket,
          tcgLowPrice: tcgLow,
          ebayAvgSold: ebay.avgPrice,
          ebayLastSold: ebay.lastSoldPrice,
          ebayListingCount: ebay.listingCount,
        },
      });

      updated++;

      // Check alert rules
      const prev = card.priceSnapshots[0];
      for (const rule of card.alertRules) {
        const currentPrice =
          rule.source === "TCG"
            ? tcgMarket
            : rule.source === "EBAY"
            ? ebay.avgPrice
            : tcgMarket ?? ebay.avgPrice;

        if (currentPrice == null) continue;

        let triggered = false;
        let message = "";
        let changePercent: number | null = null;

        if (rule.type === "ABOVE" && currentPrice >= rule.threshold) {
          triggered = true;
          message = `Price crossed above $${rule.threshold.toFixed(2)}`;
        } else if (rule.type === "BELOW" && currentPrice <= rule.threshold) {
          triggered = true;
          message = `Price dropped below $${rule.threshold.toFixed(2)}`;
        } else if (rule.type === "MOVE_PCT" && prev) {
          const prevPrice =
            rule.source === "TCG"
              ? prev.tcgMarketPrice
              : rule.source === "EBAY"
              ? prev.ebayAvgSold
              : prev.tcgMarketPrice ?? prev.ebayAvgSold;

          if (prevPrice && prevPrice > 0) {
            changePercent = ((currentPrice - prevPrice) / prevPrice) * 100;
            if (Math.abs(changePercent) >= rule.threshold) {
              triggered = true;
              message = `Price moved ${changePercent > 0 ? "+" : ""}${changePercent.toFixed(1)}% (threshold: ±${rule.threshold}%)`;
            }
          }
        }

        if (triggered) {
          await prisma.alertHistory.create({
            data: {
              ruleId: rule.id,
              message,
              priceValue: currentPrice,
            },
          });
          pendingAlerts.push({
            cardName: card.name,
            message,
            tcgPrice: tcgMarket,
            ebayPrice: ebay.avgPrice,
            changePercent,
          });
        }
      }

      // Always alert on >10% move even without explicit rules
      if (prev) {
        const prevTcg = prev.tcgMarketPrice;
        const prevEbay = prev.ebayAvgSold;
        if (tcgMarket && prevTcg && prevTcg > 0) {
          const pct = ((tcgMarket - prevTcg) / prevTcg) * 100;
          if (Math.abs(pct) >= 10 && !card.alertRules.some((r: { type: string; source: string }) => r.type === "MOVE_PCT" && r.source === "TCG")) {
            pendingAlerts.push({
              cardName: card.name,
              message: `TCGPlayer price moved ${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`,
              tcgPrice: tcgMarket,
              ebayPrice: ebay.avgPrice,
              changePercent: pct,
            });
          }
        }
        if (ebay.avgPrice && prevEbay && prevEbay > 0) {
          const pct = ((ebay.avgPrice - prevEbay) / prevEbay) * 100;
          if (Math.abs(pct) >= 10 && !card.alertRules.some((r: { type: string; source: string }) => r.type === "MOVE_PCT" && r.source === "EBAY")) {
            pendingAlerts.push({
              cardName: card.name,
              message: `eBay avg sold price moved ${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`,
              tcgPrice: tcgMarket,
              ebayPrice: ebay.avgPrice,
              changePercent: pct,
            });
          }
        }
      }
    } catch (err) {
      console.error(`Price poll failed for card ${card.name}:`, err);
    }
  }

  if (pendingAlerts.length > 0) {
    try {
      await sendAlertEmail(pendingAlerts);
    } catch (err) {
      console.error("Failed to send alert email:", err);
    }
  }

  return { updated, alerts: pendingAlerts.length };
}
