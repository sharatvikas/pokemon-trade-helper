"use client";

import { Input } from "@/components/ui/input";
import { Bell } from "lucide-react";

export type RuleType = "ABOVE" | "BELOW" | "MOVE_PCT";
export type RuleSource = "TCG" | "EBAY" | "BOTH";

export function rulePreview(type: RuleType, source: RuleSource, threshold: string) {
  const src = source === "TCG" ? "TCGPlayer" : source === "EBAY" ? "eBay" : "TCGPlayer or eBay";
  const val = parseFloat(threshold);
  if (!threshold || isNaN(val)) return "Set a threshold value to preview this rule";
  if (type === "ABOVE") return `Alert me when ${src} price rises above $${val.toFixed(2)}`;
  if (type === "BELOW") return `Alert me when ${src} price drops below $${val.toFixed(2)}`;
  return `Alert me when ${src} price moves ±${val}% from the last check`;
}

export function PillToggle<T extends string>({
  options,
  value,
  onChange,
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

export function RuleBuilder({
  type,
  setType,
  source,
  setSource,
  threshold,
  setThreshold,
}: {
  type: RuleType;
  setType: (v: RuleType) => void;
  source: RuleSource;
  setSource: (v: RuleSource) => void;
  threshold: string;
  setThreshold: (v: string) => void;
}) {
  const isMoveType = type === "MOVE_PCT";
  return (
    <div className="space-y-3">
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
            step={1}
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
      <div className="flex items-center gap-2 px-3.5 py-2.5 bg-[#f5f5f7] rounded-xl">
        <Bell className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        <p className="text-xs text-[#1d1d1f]">{rulePreview(type, source, threshold)}</p>
      </div>
    </div>
  );
}
