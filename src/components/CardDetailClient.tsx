"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip,
  ResponsiveContainer, Legend, Area, AreaChart,
} from "recharts";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Bell, ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import Link from "next/link";

type AlertRule = {
  id: string;
  type: string;
  source: string;
  threshold: number;
  enabled: boolean;
  history: { id: string; triggeredAt: Date; message: string; priceValue: number }[];
};

type PriceSnapshot = {
  id: string;
  tcgMarketPrice: number | null;
  tcgLowPrice: number | null;
  ebayAvgSold: number | null;
  ebayLastSold: number | null;
  fetchedAt: Date;
};

type CardDetail = {
  id: string;
  name: string;
  setName: string | null;
  cardNumber: string | null;
  imageUrl: string | null;
  notes: string | null;
  tcgPlayerId: string | null;
  priceSnapshots: PriceSnapshot[];
  alertRules: AlertRule[];
};

function pctChange(cur: number | null, prv: number | null) {
  if (!cur || !prv || prv === 0) return null;
  return ((cur - prv) / prv) * 100;
}

export function CardDetailClient({ card }: { card: CardDetail }) {
  const router = useRouter();
  const [alerts, setAlerts] = useState(card.alertRules);
  const [newType, setNewType] = useState<"ABOVE" | "BELOW" | "MOVE_PCT">("BELOW");
  const [newSource, setNewSource] = useState<"TCG" | "EBAY" | "BOTH">("TCG");
  const [newThreshold, setNewThreshold] = useState("");
  const [savingAlert, setSavingAlert] = useState(false);

  const chartData = card.priceSnapshots.map((s) => ({
    date: format(new Date(s.fetchedAt), "MMM d"),
    TCGPlayer: s.tcgMarketPrice,
    eBay: s.ebayAvgSold,
  }));

  const latest = card.priceSnapshots[card.priceSnapshots.length - 1];
  const prev = card.priceSnapshots[card.priceSnapshots.length - 2];

  const priceStats = [
    { label: "TCGPlayer Market", value: latest?.tcgMarketPrice, prev: prev?.tcgMarketPrice },
    { label: "TCGPlayer Low", value: latest?.tcgLowPrice, prev: prev?.tcgLowPrice },
    { label: "eBay Avg Sold", value: latest?.ebayAvgSold, prev: prev?.ebayAvgSold },
    { label: "eBay Last Sold", value: latest?.ebayLastSold, prev: prev?.ebayLastSold },
  ];

  async function addAlert() {
    const t = parseFloat(newThreshold);
    if (isNaN(t) || t <= 0) return;
    setSavingAlert(true);
    try {
      const res = await fetch(`/api/cards/${card.id}/alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: newType, source: newSource, threshold: t }),
      });
      if (res.ok) {
        const rule = await res.json();
        setAlerts((prev) => [...prev, { ...rule, history: [] }]);
        setNewThreshold("");
      }
    } finally {
      setSavingAlert(false);
    }
  }

  async function deleteAlert(ruleId: string) {
    await fetch(`/api/cards/${card.id}/alerts?ruleId=${ruleId}`, { method: "DELETE" });
    setAlerts((prev) => prev.filter((r) => r.id !== ruleId));
  }

  async function deleteCard() {
    if (!confirm(`Remove "${card.name}" from your want list?`)) return;
    await fetch(`/api/cards/${card.id}`, { method: "DELETE" });
    router.push("/want-list");
  }

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex items-center gap-4 animate-fade-up">
        <Link href="/want-list">
          <button className="w-8 h-8 rounded-xl bg-white border border-black/[0.08] shadow-sm flex items-center justify-center hover:shadow-md transition-all">
            <ArrowLeft className="w-4 h-4 text-[#1d1d1f]" />
          </button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-[#1d1d1f]" style={{ fontFamily: "var(--font-display)" }}>
            {card.name}
          </h1>
          {card.setName && (
            <p className="text-[#6e6e73] text-sm mt-0.5">
              {card.setName}{card.cardNumber ? ` · #${card.cardNumber}` : ""}
            </p>
          )}
        </div>
        <button
          onClick={deleteCard}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium text-red-500 hover:bg-red-50 border border-red-100 transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" /> Remove
        </button>
      </div>

      {/* Card image + price stats */}
      <div className="flex gap-5 animate-fade-up animate-fade-up-1">
        {card.imageUrl && (
          <div className="shrink-0">
            <img
              src={card.imageUrl}
              alt={card.name}
              className="w-32 rounded-2xl shadow-xl ring-1 ring-black/[0.06]"
            />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 flex-1">
          {priceStats.map(({ label, value, prev: p }) => {
            const pct = pctChange(value ?? null, p ?? null);
            const isUp = pct !== null && pct > 0;
            return (
              <div key={label} className="glass-card rounded-2xl p-4 transition-all duration-300">
                <p className="text-[11px] font-semibold text-[#6e6e73] uppercase tracking-wider">{label}</p>
                <p className="text-2xl font-bold text-[#1d1d1f] mt-1.5 tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
                  {value != null ? `$${value.toFixed(2)}` : <span className="text-[#6e6e73] text-lg">—</span>}
                </p>
                {pct !== null && (
                  <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold mt-1 px-1.5 py-0.5 rounded-full ${isUp ? "badge-up" : "badge-down"}`}>
                    {isUp ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                    {isUp ? "+" : ""}{pct.toFixed(1)}%
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Price chart */}
      <div className="glass-card rounded-2xl p-5 animate-fade-up animate-fade-up-2">
        <h2 className="text-base font-semibold text-[#1d1d1f] mb-4" style={{ fontFamily: "var(--font-display)" }}>
          Price History
        </h2>
        {chartData.length < 2 ? (
          <div className="h-44 flex flex-col items-center justify-center text-center">
            <p className="text-[#6e6e73] text-sm">Not enough data yet.</p>
            <p className="text-[#6e6e73] text-xs mt-1">Refresh prices from the dashboard to start tracking.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="tcgGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="ebayGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6e6e73" }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 11, fill: "#6e6e73" }} tickLine={false} axisLine={false} width={50} />
              <ChartTooltip
                formatter={(v) => typeof v === "number" ? `$${v.toFixed(2)}` : v}
                contentStyle={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
              <Area type="monotone" dataKey="TCGPlayer" stroke="#f59e0b" strokeWidth={2} fill="url(#tcgGrad)" dot={false} connectNulls />
              <Area type="monotone" dataKey="eBay" stroke="#3b82f6" strokeWidth={2} fill="url(#ebayGrad)" dot={false} connectNulls />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Alert rules */}
      <div className="glass-card rounded-2xl p-5 animate-fade-up animate-fade-up-3">
        <h2 className="text-base font-semibold text-[#1d1d1f] mb-4 flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
          <Bell className="w-4 h-4 text-amber-500" /> Alert Rules
        </h2>

        {alerts.length > 0 ? (
          <div className="space-y-2 mb-5">
            {alerts.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between px-3.5 py-2.5 bg-[#f5f5f7] rounded-xl">
                <div className="flex items-center gap-2.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                    rule.type === "ABOVE" ? "bg-emerald-100 text-emerald-700" :
                    rule.type === "BELOW" ? "bg-amber-100 text-amber-700" :
                    "bg-blue-100 text-blue-700"
                  }`}>
                    {rule.type === "MOVE_PCT" ? "MOVE" : rule.type}
                  </span>
                  <span className="text-sm font-semibold text-[#1d1d1f]">
                    {rule.type === "MOVE_PCT" ? `±${rule.threshold}%` : `$${rule.threshold.toFixed(2)}`}
                  </span>
                  <span className="text-xs text-[#6e6e73]">via {rule.source}</span>
                </div>
                <button onClick={() => deleteAlert(rule.id)} className="w-6 h-6 rounded-lg hover:bg-red-50 flex items-center justify-center transition-colors">
                  <Trash2 className="w-3 h-3 text-red-400" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#6e6e73] mb-4">No alert rules yet.</p>
        )}

        {/* Add rule */}
        <div className="border-t border-black/[0.06] pt-4">
          <p className="text-xs font-semibold text-[#6e6e73] uppercase tracking-wider mb-3">Add Rule</p>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div>
              <Label className="text-[11px] text-[#6e6e73] mb-1 block">Type</Label>
              <Select value={newType} onValueChange={(v) => setNewType(v as typeof newType)}>
                <SelectTrigger className="h-8 text-xs rounded-lg border-black/[0.1]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BELOW">Price Below</SelectItem>
                  <SelectItem value="ABOVE">Price Above</SelectItem>
                  <SelectItem value="MOVE_PCT">% Move</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] text-[#6e6e73] mb-1 block">Source</Label>
              <Select value={newSource} onValueChange={(v) => setNewSource(v as typeof newSource)}>
                <SelectTrigger className="h-8 text-xs rounded-lg border-black/[0.1]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TCG">TCGPlayer</SelectItem>
                  <SelectItem value="EBAY">eBay</SelectItem>
                  <SelectItem value="BOTH">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] text-[#6e6e73] mb-1 block">
                {newType === "MOVE_PCT" ? "Threshold (%)" : "Price ($)"}
              </Label>
              <Input
                type="number" min={0} step={newType === "MOVE_PCT" ? 1 : 0.01}
                value={newThreshold} onChange={(e) => setNewThreshold(e.target.value)}
                placeholder={newType === "MOVE_PCT" ? "10" : "25.00"}
                className="h-8 text-xs rounded-lg border-black/[0.1]"
              />
            </div>
          </div>
          <button
            onClick={addAlert}
            disabled={savingAlert || !newThreshold}
            className="btn-amber flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" /> Add Rule
          </button>
        </div>

        {/* Alert history */}
        {alerts.some((r) => r.history.length > 0) && (
          <div className="border-t border-black/[0.06] pt-4 mt-4">
            <p className="text-xs font-semibold text-[#6e6e73] uppercase tracking-wider mb-3">Recent Triggers</p>
            <div className="space-y-2">
              {alerts.flatMap((r) => r.history)
                .sort((a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime())
                .slice(0, 10)
                .map((h) => (
                  <div key={h.id} className="flex items-center justify-between text-xs py-1.5 border-b border-black/[0.04] last:border-0">
                    <span className="text-[#6e6e73]">{format(new Date(h.triggeredAt), "MMM d, HH:mm")}</span>
                    <span className="text-[#1d1d1f]">{h.message}</span>
                    <span className="font-semibold tabular-nums text-[#1d1d1f]">${h.priceValue.toFixed(2)}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {card.notes && (
        <div className="glass-card rounded-2xl p-4 animate-fade-up">
          <p className="text-xs font-semibold text-[#6e6e73] uppercase tracking-wider mb-1.5">Notes</p>
          <p className="text-sm text-[#1d1d1f]">{card.notes}</p>
        </div>
      )}
    </div>
  );
}
