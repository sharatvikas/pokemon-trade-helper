"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip,
  ResponsiveContainer, Legend, Area, AreaChart,
} from "recharts";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Bell, ArrowLeft, TrendingUp, TrendingDown, Pencil, Check, X } from "lucide-react";
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

// ── Shared rule builder UI ─────────────────────────────────────────────────────

type RuleType = "ABOVE" | "BELOW" | "MOVE_PCT";
type RuleSource = "TCG" | "EBAY" | "BOTH";

function rulePreview(type: RuleType, source: RuleSource, threshold: string) {
  const src = source === "TCG" ? "TCGPlayer" : source === "EBAY" ? "eBay" : "TCGPlayer or eBay";
  const val = parseFloat(threshold);
  if (!threshold || isNaN(val)) return "Set a threshold value to preview this rule";
  if (type === "ABOVE") return `Alert me when ${src} price rises above $${val.toFixed(2)}`;
  if (type === "BELOW") return `Alert me when ${src} price drops below $${val.toFixed(2)}`;
  return `Alert me when ${src} price moves ±${val}% from the last check`;
}

function PillToggle<T extends string>({
  options, value, onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
            value === o.value
              ? "bg-[#1d1d1f] text-white shadow-sm"
              : "bg-black/[0.05] text-[#6e6e73] hover:bg-black/[0.09] hover:text-[#1d1d1f]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function RuleBuilder({
  type, setType, source, setSource, threshold, setThreshold,
}: {
  type: RuleType; setType: (v: RuleType) => void;
  source: RuleSource; setSource: (v: RuleSource) => void;
  threshold: string; setThreshold: (v: string) => void;
}) {
  const isMoveType = type === "MOVE_PCT";
  return (
    <div className="space-y-3">
      {/* Type toggle */}
      <div>
        <p className="text-[11px] font-semibold text-[#6e6e73] uppercase tracking-wider mb-2">Condition</p>
        <PillToggle
          value={type}
          onChange={setType}
          options={[
            { value: "BELOW", label: "Price drops below" },
            { value: "ABOVE", label: "Price rises above" },
            { value: "MOVE_PCT", label: "% Move" },
          ]}
        />
      </div>

      {/* Source toggle */}
      <div>
        <p className="text-[11px] font-semibold text-[#6e6e73] uppercase tracking-wider mb-2">Source</p>
        <PillToggle
          value={source}
          onChange={setSource}
          options={[
            { value: "TCG", label: "TCGPlayer" },
            { value: "EBAY", label: "eBay" },
            { value: "BOTH", label: "Both" },
          ]}
        />
      </div>

      {/* Threshold input */}
      <div>
        <p className="text-[11px] font-semibold text-[#6e6e73] uppercase tracking-wider mb-2">
          {isMoveType ? "Movement threshold (%)" : "Target price ($)"}
        </p>
        <div className="relative max-w-[180px]">
          {!isMoveType && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-[#6e6e73]">$</span>
          )}
          <Input
            type="number"
            min={0}
            step={isMoveType ? 1 : 0.01}
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            placeholder={isMoveType ? "10" : "25.00"}
            className={`h-10 text-sm font-medium rounded-xl border-black/[0.12] bg-white focus:border-amber-400 focus:ring-amber-400/20 ${!isMoveType ? "pl-7" : ""}`}
          />
          {isMoveType && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-[#6e6e73]">%</span>
          )}
        </div>
      </div>

      {/* Live preview sentence */}
      <div className="flex items-center gap-2 px-3.5 py-2.5 bg-[#f5f5f7] rounded-xl">
        <Bell className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        <p className="text-xs text-[#1d1d1f]">{rulePreview(type, source, threshold)}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function pctChange(cur: number | null, prv: number | null) {
  if (!cur || !prv || prv === 0) return null;
  return ((cur - prv) / prv) * 100;
}

export function CardDetailClient({ card }: { card: CardDetail }) {
  const router = useRouter();
  const [alerts, setAlerts] = useState(card.alertRules);

  // New rule form state
  const [newType, setNewType] = useState<RuleType>("BELOW");
  const [newSource, setNewSource] = useState<RuleSource>("TCG");
  const [newThreshold, setNewThreshold] = useState("");
  const [savingAlert, setSavingAlert] = useState(false);

  // Inline edit state — keyed by rule id
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState<RuleType>("BELOW");
  const [editSource, setEditSource] = useState<RuleSource>("TCG");
  const [editThreshold, setEditThreshold] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

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

  function startEdit(rule: AlertRule) {
    setEditingId(rule.id);
    setEditType(rule.type as RuleType);
    setEditSource(rule.source as RuleSource);
    setEditThreshold(String(rule.threshold));
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(ruleId: string) {
    const t = parseFloat(editThreshold);
    if (isNaN(t) || t <= 0) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/cards/${card.id}/alerts?ruleId=${ruleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: editType, source: editSource, threshold: t }),
      });
      if (res.ok) {
        const updated = await res.json();
        setAlerts((prev) => prev.map((r) => r.id === ruleId ? { ...r, ...updated } : r));
        setEditingId(null);
      }
    } finally {
      setSavingEdit(false);
    }
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

        {/* Existing rules */}
        {alerts.length > 0 ? (
          <div className="space-y-2 mb-5">
            {alerts.map((rule) =>
              editingId === rule.id ? (
                /* ── Inline edit form ── */
                <div key={rule.id} className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-3">
                  <RuleBuilder
                    type={editType} setType={setEditType}
                    source={editSource} setSource={setEditSource}
                    threshold={editThreshold} setThreshold={setEditThreshold}
                  />
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => saveEdit(rule.id)}
                      disabled={savingEdit || !editThreshold}
                      className="btn-amber flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold text-white disabled:opacity-40"
                    >
                      <Check className="w-3 h-3" /> {savingEdit ? "Saving…" : "Save"}
                    </button>
                    <button onClick={cancelEdit} className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-[#6e6e73] hover:bg-black/[0.06] transition-colors">
                      <X className="w-3 h-3" /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Rule display row ── */
                <div key={rule.id} className="flex items-center justify-between px-3.5 py-3 bg-[#f5f5f7] rounded-xl group">
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
                    <span className="text-xs text-[#6e6e73]">
                      via {rule.source === "TCG" ? "TCGPlayer" : rule.source === "EBAY" ? "eBay" : "Both"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEdit(rule)}
                      className="w-7 h-7 rounded-lg hover:bg-black/[0.08] flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                      title="Edit rule"
                    >
                      <Pencil className="w-3 h-3 text-[#6e6e73]" />
                    </button>
                    <button
                      onClick={() => deleteAlert(rule.id)}
                      className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete rule"
                    >
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        ) : (
          <p className="text-sm text-[#6e6e73] mb-4">No alert rules yet. Add one below.</p>
        )}

        {/* Add rule */}
        <div className="border-t border-black/[0.06] pt-4 space-y-4">
          <p className="text-xs font-semibold text-[#6e6e73] uppercase tracking-wider">New Rule</p>
          <RuleBuilder
            type={newType} setType={setNewType}
            source={newSource} setSource={setNewSource}
            threshold={newThreshold} setThreshold={setNewThreshold}
          />
          <button
            onClick={addAlert}
            disabled={savingAlert || !newThreshold}
            className="btn-amber flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" /> {savingAlert ? "Adding…" : "Add Rule"}
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
