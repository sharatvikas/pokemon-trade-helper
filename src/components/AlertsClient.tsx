"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Bell, Trash2, Pencil, Check, X, ChevronRight, ExternalLink } from "lucide-react";
import { RuleBuilder, type RuleType, type RuleSource } from "@/components/RuleBuilder";

type AlertRule = {
  id: string;
  type: string;
  source: string;
  threshold: number;
  enabled: boolean;
  card: { id: string; name: string; imageUrl: string | null; setName: string | null };
};

type AlertHistory = {
  id: string;
  message: string;
  priceValue: number;
  triggeredAt: Date;
  rule: {
    card: { id: string; name: string };
  };
};

export function AlertsClient({
  initialRules,
  history,
}: {
  initialRules: AlertRule[];
  history: AlertHistory[];
}) {
  const [rules, setRules] = useState(initialRules);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState<RuleType>("BELOW");
  const [editSource, setEditSource] = useState<RuleSource>("TCG");
  const [editThreshold, setEditThreshold] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  function startEdit(rule: AlertRule) {
    setEditingId(rule.id);
    setEditType(rule.type as RuleType);
    setEditSource(rule.source as RuleSource);
    setEditThreshold(String(rule.threshold));
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(rule: AlertRule) {
    const t = parseFloat(editThreshold);
    if (isNaN(t) || t <= 0) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/cards/${rule.card.id}/alerts?ruleId=${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: editType, source: editSource, threshold: t }),
      });
      if (res.ok) {
        const updated = await res.json();
        setRules((prev) =>
          prev.map((r) => (r.id === rule.id ? { ...r, ...updated } : r))
        );
        setEditingId(null);
      }
    } finally {
      setSavingEdit(false);
    }
  }

  async function deleteRule(rule: AlertRule) {
    if (!confirm(`Delete this alert rule for "${rule.card.name}"?`)) return;
    await fetch(`/api/cards/${rule.card.id}/alerts?ruleId=${rule.id}`, { method: "DELETE" });
    setRules((prev) => prev.filter((r) => r.id !== rule.id));
    if (editingId === rule.id) setEditingId(null);
  }

  const typeLabel: Record<string, string> = {
    ABOVE: "ABOVE",
    BELOW: "BELOW",
    MOVE_PCT: "MOVE",
  };

  const typeColor: Record<string, string> = {
    ABOVE: "bg-emerald-100 text-emerald-700",
    BELOW: "bg-amber-100 text-amber-700",
    MOVE_PCT: "bg-blue-100 text-blue-700",
  };

  const sourceLabel: Record<string, string> = {
    TCG: "TCGPlayer",
    EBAY: "eBay",
    BOTH: "Both",
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-fade-up">
        <p className="text-[13px] font-medium text-amber-600 uppercase tracking-widest mb-1">Monitoring</p>
        <h1 className="text-4xl font-bold tracking-tight text-[#1d1d1f]" style={{ fontFamily: "var(--font-display)" }}>
          Alerts
        </h1>
        <p className="text-[#6e6e73] text-sm mt-1.5">
          {rules.length} active rule{rules.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Active rules */}
      <div className="glass-card rounded-2xl p-5 animate-fade-up animate-fade-up-1">
        <h2 className="text-base font-semibold text-[#1d1d1f] mb-4 flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
          <Bell className="w-4 h-4 text-amber-500" /> Active Rules
        </h2>

        {rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-[#6e6e73] text-sm mb-3">No alert rules yet.</p>
            <Link href="/want-list" className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700">
              Go to Want List to add cards and rules <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {rules.map((rule) =>
              editingId === rule.id ? (
                /* Inline edit */
                <div key={rule.id} className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-4">
                  {/* Card link at top of edit form */}
                  <Link
                    href={`/cards/${rule.card.id}`}
                    className="flex items-center gap-2 text-xs font-medium text-amber-600 hover:text-amber-700 transition-colors"
                  >
                    {rule.card.imageUrl && (
                      <img src={rule.card.imageUrl} alt={rule.card.name} className="w-6 h-8 object-contain rounded" />
                    )}
                    {rule.card.name}
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                  <RuleBuilder
                    type={editType} setType={setEditType}
                    source={editSource} setSource={setEditSource}
                    threshold={editThreshold} setThreshold={setEditThreshold}
                  />
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => saveEdit(rule)}
                      disabled={savingEdit || !editThreshold}
                      className="btn-amber flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold text-white disabled:opacity-40"
                    >
                      <Check className="w-3 h-3" /> {savingEdit ? "Saving…" : "Save"}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-[#6e6e73] hover:bg-black/[0.06] transition-colors"
                    >
                      <X className="w-3 h-3" /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* Rule row */
                <div key={rule.id} className="flex items-center gap-3 px-3.5 py-3 bg-[#f5f5f7] rounded-xl group">
                  {/* Card image */}
                  {rule.card.imageUrl ? (
                    <img src={rule.card.imageUrl} alt={rule.card.name} className="w-7 h-10 object-contain rounded-md shadow-sm shrink-0" />
                  ) : (
                    <div className="w-7 h-10 bg-amber-50 rounded-md flex items-center justify-center text-sm shrink-0">🃏</div>
                  )}

                  {/* Card name link */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/cards/${rule.card.id}`}
                      className="text-sm font-semibold text-[#1d1d1f] hover:text-amber-600 transition-colors truncate block"
                    >
                      {rule.card.name}
                    </Link>
                    {rule.card.setName && (
                      <p className="text-[11px] text-[#6e6e73] truncate">{rule.card.setName}</p>
                    )}
                  </div>

                  {/* Rule badge */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${typeColor[rule.type] ?? "bg-gray-100 text-gray-600"}`}>
                      {typeLabel[rule.type] ?? rule.type}
                    </span>
                    <span className="text-sm font-semibold text-[#1d1d1f] tabular-nums">
                      {rule.type === "MOVE_PCT" ? `±${rule.threshold}%` : `$${rule.threshold.toFixed(2)}`}
                    </span>
                    <span className="text-xs text-[#6e6e73]">
                      {sourceLabel[rule.source] ?? rule.source}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Link href={`/cards/${rule.card.id}`}>
                      <button className="w-7 h-7 rounded-lg hover:bg-black/[0.08] flex items-center justify-center transition-colors" title="Go to card">
                        <ExternalLink className="w-3 h-3 text-[#6e6e73]" />
                      </button>
                    </Link>
                    <button
                      onClick={() => startEdit(rule)}
                      className="w-7 h-7 rounded-lg hover:bg-black/[0.08] flex items-center justify-center transition-colors"
                      title="Edit rule"
                    >
                      <Pencil className="w-3 h-3 text-[#6e6e73]" />
                    </button>
                    <button
                      onClick={() => deleteRule(rule)}
                      className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center transition-colors"
                      title="Delete rule"
                    >
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Alert history */}
      <div className="glass-card rounded-2xl p-5 animate-fade-up animate-fade-up-2">
        <h2 className="text-base font-semibold text-[#1d1d1f] mb-4" style={{ fontFamily: "var(--font-display)" }}>
          Recent Triggers
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-[#6e6e73]">No alerts triggered yet.</p>
        ) : (
          <div className="space-y-1">
            {history.map((h) => (
              <div key={h.id} className="flex items-center gap-3 py-2.5 border-b border-black/[0.04] last:border-0">
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/cards/${h.rule.card.id}`}
                    className="text-sm font-semibold text-[#1d1d1f] hover:text-amber-600 transition-colors"
                  >
                    {h.rule.card.name}
                  </Link>
                  <p className="text-[11px] text-[#6e6e73] mt-0.5 truncate">{h.message}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-semibold tabular-nums text-[#1d1d1f]">${h.priceValue.toFixed(2)}</span>
                  <span className="text-[11px] text-[#6e6e73] w-24 text-right">{format(new Date(h.triggeredAt), "MMM d, HH:mm")}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
