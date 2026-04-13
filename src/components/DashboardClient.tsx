"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { TrendingUp, TrendingDown, RefreshCw, Bell, LayoutList, Sparkles, ChevronRight } from "lucide-react";

type PriceSnapshot = {
  tcgMarketPrice: number | null;
  ebayAvgSold: number | null;
  fetchedAt: Date;
};
type AlertRule = { id: string; type: string; threshold: number; source: string };
type WantCard = {
  id: string;
  name: string;
  setName: string | null;
  cardNumber: string | null;
  imageUrl: string | null;
  priceSnapshots: PriceSnapshot[];
  alertRules: AlertRule[];
};

function priceDelta(cur: number | null, prev: number | null) {
  if (!cur || !prev || prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}

function PriceChip({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-[#6e6e73] text-xs">—</span>;
  const isUp = pct > 0;
  const big = Math.abs(pct) >= 10;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${
      big
        ? isUp ? "badge-up-big" : "badge-down-big"
        : isUp ? "badge-up" : "badge-down"
    }`}>
      {isUp ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
      {isUp ? "+" : ""}{pct.toFixed(1)}%
    </span>
  );
}

export function DashboardClient({ cards, lastPoll }: { cards: WantCard[]; lastPoll: Date | null }) {
  const router = useRouter();
  const [polling, setPolling] = useState(false);
  const [pollResult, setPollResult] = useState<{ updated: number; alerts: number } | null>(null);

  async function handlePoll() {
    setPolling(true);
    setPollResult(null);
    try {
      const res = await fetch("/api/poll", { method: "POST" });
      setPollResult(await res.json());
      router.refresh();
    } finally {
      setPolling(false);
    }
  }

  const bigMoveCards = cards.filter((c) => {
    const [cur, prev] = c.priceSnapshots;
    const pct = priceDelta(cur?.tcgMarketPrice ?? null, prev?.tcgMarketPrice ?? null);
    return pct !== null && Math.abs(pct) >= 10;
  });

  const snaps = cards.map((c) => c.priceSnapshots[0]).filter(Boolean);
  const totalTcg = snaps.some((s) => s.tcgMarketPrice)
    ? snaps.reduce((sum, s) => sum + (s.tcgMarketPrice ?? 0), 0)
    : null;

  const stats = [
    { label: "Cards Tracked", value: cards.length, icon: LayoutList, delay: "" },
    { label: "Active Alerts", value: cards.reduce((n, c) => n + c.alertRules.length, 0), icon: Bell, delay: "animate-fade-up-1" },
    { label: "List Total Value", value: totalTcg != null ? `$${totalTcg.toFixed(2)}` : "—", icon: Sparkles, delay: "animate-fade-up-2" },
    { label: "Big Movers (>10%)", value: bigMoveCards.length, icon: TrendingUp, delay: "animate-fade-up-3" },
  ];

  return (
    <div className="space-y-8">
      {/* Hero header */}
      <div className="flex items-end justify-between animate-fade-up">
        <div>
          <p className="text-[13px] font-medium text-amber-600 uppercase tracking-widest mb-1">Overview</p>
          <h1 className="text-4xl font-bold tracking-tight text-[#1d1d1f]" style={{ fontFamily: "var(--font-display)" }}>
            Dashboard
          </h1>
          <p className="text-[#6e6e73] text-sm mt-1.5">
            {lastPoll && lastPoll.getTime() > 0
              ? `Updated ${formatDistanceToNow(lastPoll, { addSuffix: true })}`
              : "No prices fetched yet — hit refresh to start"}
          </p>
        </div>
        <button
          onClick={handlePoll}
          disabled={polling}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-[#1d1d1f] text-white shadow-sm hover:bg-[#3d3d3f] active:scale-95 transition-all duration-150 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${polling ? "animate-spin" : ""}`} />
          {polling ? "Fetching…" : "Refresh Prices"}
        </button>
      </div>

      {/* Poll result banner */}
      {pollResult && (
        <div className="animate-fade-up rounded-2xl bg-emerald-50 border border-emerald-100 px-5 py-3.5 text-sm text-emerald-800 flex items-center gap-2.5">
          <span className="text-emerald-500 text-base">✓</span>
          Updated {pollResult.updated} card{pollResult.updated !== 1 ? "s" : ""}.{" "}
          {pollResult.alerts > 0
            ? `${pollResult.alerts} alert${pollResult.alerts !== 1 ? "s" : ""} triggered — check your email.`
            : "No alerts triggered."}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, delay }) => (
          <div key={label} className={`glass-card rounded-2xl p-5 animate-fade-up ${delay} transition-all duration-300`}>
            <div className="flex items-start justify-between mb-3">
              <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
                <Icon className="w-4 h-4 text-amber-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-[#1d1d1f] tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
              {value}
            </div>
            <div className="text-[12px] text-[#6e6e73] mt-0.5 font-medium">{label}</div>
          </div>
        ))}
      </div>

      {/* Want list table */}
      <div className="animate-fade-up animate-fade-up-2">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#1d1d1f]" style={{ fontFamily: "var(--font-display)" }}>
            Want List
          </h2>
          <Link
            href="/want-list"
            className="flex items-center gap-1 text-[13px] font-medium text-amber-600 hover:text-amber-700 transition-colors"
          >
            Manage <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="glass-card rounded-2xl overflow-hidden">
          {cards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mb-3">
                <span className="text-2xl">🃏</span>
              </div>
              <p className="text-[#1d1d1f] font-medium mb-1">No cards yet</p>
              <p className="text-[#6e6e73] text-sm mb-4">Add cards to your want list to start tracking prices.</p>
              <Link
                href="/want-list"
                className="btn-amber px-4 py-2 rounded-full text-sm font-medium text-white"
              >
                Add your first card
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/[0.06]">
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#6e6e73] uppercase tracking-wider">Card</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#6e6e73] uppercase tracking-wider">TCGPlayer</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#6e6e73] uppercase tracking-wider">eBay Avg</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#6e6e73] uppercase tracking-wider">TCG Δ</th>
                  <th className="text-right px-5 py-3 text-[11px] font-semibold text-[#6e6e73] uppercase tracking-wider">eBay Δ</th>
                </tr>
              </thead>
              <tbody>
                {cards.map((card, i) => {
                  const [cur, prev] = card.priceSnapshots;
                  const tcgPct = priceDelta(cur?.tcgMarketPrice ?? null, prev?.tcgMarketPrice ?? null);
                  const ebayPct = priceDelta(cur?.ebayAvgSold ?? null, prev?.ebayAvgSold ?? null);
                  const bigMove = (tcgPct !== null && Math.abs(tcgPct) >= 10) || (ebayPct !== null && Math.abs(ebayPct) >= 10);
                  return (
                    <tr
                      key={card.id}
                      className={`border-b border-black/[0.04] last:border-0 hover:bg-black/[0.02] transition-colors group ${bigMove ? "big-move-row" : ""}`}
                      style={{ animationDelay: `${i * 0.03}s` }}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          {card.imageUrl ? (
                            <img src={card.imageUrl} alt={card.name} className="w-7 h-9 object-contain rounded-md" />
                          ) : (
                            <div className="w-7 h-9 bg-amber-50 rounded-md flex items-center justify-center text-xs">🃏</div>
                          )}
                          <div>
                            <Link href={`/cards/${card.id}`} className="font-medium text-[#1d1d1f] hover:text-amber-600 transition-colors">
                              {card.name}
                            </Link>
                            {card.setName && (
                              <p className="text-[11px] text-[#6e6e73] mt-0.5">{card.setName}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-medium text-[#1d1d1f]">
                        {cur?.tcgMarketPrice != null ? `$${cur.tcgMarketPrice.toFixed(2)}` : <span className="text-[#6e6e73]">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-medium text-[#1d1d1f]">
                        {cur?.ebayAvgSold != null ? `$${cur.ebayAvgSold.toFixed(2)}` : <span className="text-[#6e6e73]">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-right"><PriceChip pct={tcgPct} /></td>
                      <td className="px-5 py-3.5 text-right"><PriceChip pct={ebayPct} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
