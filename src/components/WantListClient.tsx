"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Upload, Search, Loader2, ExternalLink, Link2, ChevronRight, AlertTriangle, Info } from "lucide-react";

type TcgCard = {
  id: string;
  name: string;
  number: string;
  set: { id: string; name: string };
  images: { small: string };
  tcgplayer?: {
    prices?: Record<string, { market?: number; low?: number }>;
  };
  scrydexPrice?: number; // fallback when pokemontcg.io has no price data
};

type TcgSet = {
  id: string;
  name: string;
  series: string;
  releaseDate: string;
  ptcgoCode: string | null;
};

type WantCard = {
  id: string;
  name: string;
  setName: string | null;
  cardNumber: string | null;
  imageUrl: string | null;
  notes: string | null;
  createdAt: Date;
  priceSnapshots: { tcgMarketPrice: number | null; ebayAvgSold: number | null }[];
  alertRules: { id: string }[];
};

type UrlResult = {
  cards: TcgCard[];
  identified?: { name: string | null; setName: string | null; confidence: string };
  source?: string;
  message?: string;
  error?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function cardHasPricing(card: TcgCard): boolean {
  const hasTcg = !!card.tcgplayer?.prices && Object.keys(card.tcgplayer.prices).length > 0;
  return hasTcg || card.scrydexPrice != null;
}

function getCardMarketPrice(card: TcgCard): number | null {
  const p = card.tcgplayer?.prices;
  if (p && Object.keys(p).length > 0) {
    const variant = p["holofoil"] ?? p["1stEditionHolofoil"] ?? p["normal"] ?? p["reverseHolofoil"] ?? Object.values(p)[0];
    const price = variant?.market ?? null;
    if (price != null) return price;
  }
  return card.scrydexPrice ?? null;
}

// ── Set Combobox ──────────────────────────────────────────────────────────────

function SetCombobox({
  sets,
  selectedId,
  onChange,
}: {
  sets: TcgSet[];
  selectedId: string;
  onChange: (id: string, name: string) => void;
}) {
  const [query, setQuery] = useState(
    selectedId ? (sets.find((s) => s.id === selectedId)?.name ?? "") : ""
  );
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync label when selectedId clears from outside
  useEffect(() => {
    if (!selectedId) setQuery("");
  }, [selectedId]);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const filtered = (
    query.trim()
      ? sets.filter(
          (s) =>
            s.name.toLowerCase().includes(query.toLowerCase()) ||
            s.series.toLowerCase().includes(query.toLowerCase())
        )
      : sets
  ).slice(0, 30);

  function select(s: TcgSet) {
    setQuery(s.name);
    onChange(s.id, s.name);
    setOpen(false);
  }

  function clear() {
    setQuery("");
    onChange("", "");
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6e6e73] pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (!e.target.value) onChange("", "");
          }}
          onFocus={() => setOpen(true)}
          placeholder="Filter by set (optional)…"
          className="pl-8 pr-16 rounded-xl border-black/[0.1] bg-white text-xs h-9 placeholder:text-[#9e9ea7]"
        />
        {selectedId && (
          <button
            onClick={clear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-medium text-[#6e6e73] hover:text-[#1d1d1f] px-1.5 py-0.5 rounded-md hover:bg-black/[0.06] transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {open && (
        <div className="absolute top-full mt-1 z-50 w-full bg-white border border-black/[0.08] rounded-xl shadow-xl max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-xs text-[#6e6e73] px-3 py-3">No sets found.</p>
          ) : (
            filtered.map((s) => {
              const hasPricing = !!s.ptcgoCode;
              return (
                <button
                  key={s.id}
                  onClick={() => select(s)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-black/[0.03] transition-colors text-xs ${
                    selectedId === s.id ? "bg-amber-50" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <span className="font-medium text-[#1d1d1f] truncate block">{s.name}</span>
                    <span className="text-[10px] text-[#6e6e73]">{s.series} · {s.releaseDate.slice(0, 7)}</span>
                  </div>
                  {!hasPricing && (
                    <span className="shrink-0 flex items-center gap-0.5 text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                      <Info className="w-2.5 h-2.5" /> No TCG price
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function WantListClient({
  initialCards,
  sets,
}: {
  initialCards: WantCard[];
  sets: TcgSet[];
}) {
  const router = useRouter();
  const [cards, setCards] = useState(initialCards);
  const [showAdd, setShowAdd] = useState(false);

  const [selectedTcg, setSelectedTcg] = useState<TcgCard | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Shared set filter (id + name) used across all three tabs
  const [filterSetId, setFilterSetId] = useState("");
  const [filterSetName, setFilterSetName] = useState("");

  const [urlInput, setUrlInput] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlResult, setUrlResult] = useState<UrlResult | null>(null);

  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<TcgCard[]>([]);
  const [searching, setSearching] = useState(false);
  const [manualName, setManualName] = useState("");

  const [images, setImages] = useState<File[]>([]);
  const [identifying, setIdentifying] = useState(false);
  const [identified, setIdentified] = useState<{ name: string | null; setName?: string; confidence?: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Set filter helpers ──────────────────────────────────────────────────────

  function handleSetChange(id: string, name: string) {
    setFilterSetId(id);
    setFilterSetName(name);
    // Clear previous results so the new filter applies on next search
    setSearchResults([]);
    setUrlResult(null);
    setSelectedTcg(null);
  }

  // ── Tab actions ─────────────────────────────────────────────────────────────

  async function handleUrlLookup() {
    const url = urlInput.trim();
    if (!url) return;
    setUrlLoading(true);
    setUrlResult(null);
    setSelectedTcg(null);
    try {
      const res = await fetch("/api/identify-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, setId: filterSetId || undefined, setName: filterSetName || undefined }),
      });
      const data: UrlResult = await res.json();
      setUrlResult(data);
      // Auto-select if exactly one card returned
      if ((data.cards ?? []).length === 1) setSelectedTcg(data.cards[0]);
    } finally {
      setUrlLoading(false);
    }
  }

  async function handleSearch() {
    if (searchQ.trim().length < 2) return;
    setSearching(true);
    setSearchResults([]);
    try {
      const params = new URLSearchParams({ q: searchQ });
      if (filterSetName.trim()) params.set("set", filterSetName.trim());
      const res = await fetch(`/api/search?${params}`);
      setSearchResults(await res.json());
    } finally {
      setSearching(false);
    }
  }

  async function handleIdentifyImages(files: File[]) {
    if (!files.length) return;
    setIdentifying(true);
    setIdentified([]);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("images", f));
      const res = await fetch("/api/identify", { method: "POST", body: fd });
      const results = await res.json();
      setIdentified(results);
      if (results[0]?.name) setSearchQ(results[0].name);
    } finally {
      setIdentifying(false);
    }
  }

  async function handleSearchFromImage() {
    if (!identified[0]?.name) return;
    setSearching(true);
    setSearchResults([]);
    try {
      const params = new URLSearchParams({ q: identified[0].name });
      if (filterSetName.trim()) params.set("set", filterSetName.trim());
      const res = await fetch(`/api/search?${params}`);
      setSearchResults(await res.json());
    } finally {
      setSearching(false);
    }
  }

  // ── Add card ────────────────────────────────────────────────────────────────

  async function handleAddCard() {
    const name = selectedTcg?.name ?? manualName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const body = {
        name,
        setName: selectedTcg?.set.name ?? identified[0]?.setName ?? undefined,
        setCode: selectedTcg?.set.id ?? undefined,
        cardNumber: selectedTcg?.number ?? undefined,
        tcgPlayerId: selectedTcg?.id ?? undefined,
        imageUrl: selectedTcg?.images.small ?? undefined,
        notes: notes || undefined,
      };
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setCards((prev) => [data, ...prev]);
        setShowAdd(false);
        resetForm();
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setUrlInput(""); setUrlResult(null);
    setSearchQ(""); setSearchResults([]);
    setFilterSetId(""); setFilterSetName("");
    setSelectedTcg(null); setManualName("");
    setNotes(""); setImages([]); setIdentified([]);
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this card from your want list?")) return;
    await fetch(`/api/cards/${id}`, { method: "DELETE" });
    setCards((prev) => prev.filter((c) => c.id !== id));
  }

  // ── Sub-components ───────────────────────────────────────────────────────────

  function CardPicker({ results, applySetFilter = true }: { results: TcgCard[]; applySetFilter?: boolean }) {
    const visible = (applySetFilter && filterSetId)
      ? results.filter((c) => c.set.id === filterSetId)
      : results;
    if (!visible.length) return null;
    return (
      <div className="mt-2 rounded-xl border border-black/[0.08] divide-y divide-black/[0.05] max-h-52 overflow-y-auto bg-white shadow-sm">
        {visible.map((r) => {
          const hasPricing = cardHasPricing(r);
          const marketPrice = getCardMarketPrice(r);
          return (
            <button
              key={r.id}
              onClick={() => setSelectedTcg(r)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-black/[0.02] transition-colors text-sm ${selectedTcg?.id === r.id ? "bg-amber-50" : ""}`}
            >
              <img src={r.images.small} alt={r.name} className="w-8 h-11 object-contain rounded-md shadow-sm" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-[#1d1d1f] truncate">{r.name}</div>
                <div className="text-[11px] text-[#6e6e73]">{r.set.name} · #{r.number}</div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {marketPrice != null ? (
                  <span className="text-[12px] font-semibold tabular-nums text-[#1d1d1f]">
                    ${marketPrice.toFixed(2)}
                  </span>
                ) : (
                  <span title="No TCGPlayer price data" className="flex items-center gap-0.5 text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                    <AlertTriangle className="w-2.5 h-2.5" /> No price
                  </span>
                )}
                {selectedTcg?.id === r.id && (
                  <span className="text-[10px] font-semibold text-amber-600">Selected</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  // Pricing warning shown below the selected card preview
  const selectedHasPricing = selectedTcg ? cardHasPricing(selectedTcg) : true;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between animate-fade-up">
        <div>
          <p className="text-[13px] font-medium text-amber-600 uppercase tracking-widest mb-1">Collection</p>
          <h1 className="text-4xl font-bold tracking-tight text-[#1d1d1f]" style={{ fontFamily: "var(--font-display)" }}>
            Want List
          </h1>
          <p className="text-[#6e6e73] text-sm mt-1.5">
            {cards.length} card{cards.length !== 1 ? "s" : ""} tracked
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="btn-amber flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold"
        >
          <Plus className="w-4 h-4" /> Add Card
        </button>
      </div>

      {/* Card grid */}
      {cards.length === 0 ? (
        <div className="glass-card rounded-3xl flex flex-col items-center justify-center py-20 text-center animate-fade-up">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mb-4 text-3xl shadow-sm">🃏</div>
          <p className="font-semibold text-[#1d1d1f] mb-1">Your want list is empty</p>
          <p className="text-[#6e6e73] text-sm mb-6">Add cards to start tracking prices and get alerts.</p>
          <button onClick={() => setShowAdd(true)} className="btn-amber px-5 py-2.5 rounded-full text-sm font-semibold text-white flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add your first card
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card, i) => {
            const snap = card.priceSnapshots[0];
            return (
              <div
                key={card.id}
                className="glass-card rounded-2xl overflow-hidden group animate-fade-up"
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3.5">
                    {card.imageUrl ? (
                      <img
                        src={card.imageUrl}
                        alt={card.name}
                        className="w-14 h-20 object-contain rounded-xl shadow-md group-hover:shadow-lg transition-shadow"
                      />
                    ) : (
                      <div className="w-14 h-20 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl flex items-center justify-center text-3xl shadow-sm">🃏</div>
                    )}
                    <div className="flex-1 min-w-0 pt-0.5">
                      <Link href={`/cards/${card.id}`} className="font-semibold text-[#1d1d1f] hover:text-amber-600 transition-colors truncate block">
                        {card.name}
                      </Link>
                      {card.setName && (
                        <p className="text-[11px] text-[#6e6e73] mt-0.5 truncate">
                          {card.setName}{card.cardNumber ? ` · #${card.cardNumber}` : ""}
                        </p>
                      )}
                      <div className="mt-3 space-y-1">
                        {snap?.tcgMarketPrice != null && (
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-[#6e6e73] font-medium">TCGPlayer</span>
                            <span className="text-[13px] font-semibold text-[#1d1d1f] tabular-nums">${snap.tcgMarketPrice.toFixed(2)}</span>
                          </div>
                        )}
                        {snap?.ebayAvgSold != null && (
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-[#6e6e73] font-medium">eBay avg</span>
                            <span className="text-[13px] font-semibold text-[#1d1d1f] tabular-nums">${snap.ebayAvgSold.toFixed(2)}</span>
                          </div>
                        )}
                        {!snap?.tcgMarketPrice && !snap?.ebayAvgSold && (
                          <p className="text-[11px] text-[#6e6e73]">No prices yet</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer row */}
                <div className="px-4 py-2.5 border-t border-black/[0.05] flex items-center justify-between">
                  {card.alertRules.length > 0 ? (
                    <span className="text-[11px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                      {card.alertRules.length} alert rule{card.alertRules.length !== 1 ? "s" : ""}
                    </span>
                  ) : (
                    <span />
                  )}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link href={`/cards/${card.id}`}>
                      <button className="w-7 h-7 rounded-lg hover:bg-black/[0.06] flex items-center justify-center transition-colors">
                        <ExternalLink className="w-3.5 h-3.5 text-[#6e6e73]" />
                      </button>
                    </Link>
                    <button
                      className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center transition-colors"
                      onClick={() => handleDelete(card.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Card Dialog */}
      <Dialog open={showAdd} onOpenChange={(o) => { setShowAdd(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border-0 shadow-2xl p-0 gap-0">
          <div className="px-6 pt-6 pb-4 border-b border-black/[0.06]">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight text-[#1d1d1f]" style={{ fontFamily: "var(--font-display)" }}>
                Add Card
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="px-6 py-5 space-y-4">
            <Tabs defaultValue="url">
              <TabsList className="w-full grid grid-cols-3 bg-black/[0.05] rounded-xl p-1 h-auto">
                {[
                  { value: "url", icon: Link2, label: "Paste Link" },
                  { value: "search", icon: Search, label: "Search" },
                  { value: "image", icon: Upload, label: "Image" },
                ].map(({ value, icon: Icon, label }) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="rounded-lg py-1.5 text-xs font-medium gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all"
                  >
                    <Icon className="w-3 h-3" /> {label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* Shared set filter — shown below the tab strip, above each tab's content */}
              <div className="mt-3">
                <SetCombobox sets={sets} selectedId={filterSetId} onChange={handleSetChange} />
              </div>

              {/* URL Tab */}
              <TabsContent value="url" className="space-y-3 mt-3">
                <p className="text-xs text-[#6e6e73]">
                  Paste a TCGPlayer, eBay, or any card listing URL.
                </p>
                <div className="flex gap-2">
                  <Input
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://www.tcgplayer.com/product/..."
                    onKeyDown={(e) => e.key === "Enter" && handleUrlLookup()}
                    className="rounded-xl border-black/[0.1] bg-white text-sm h-10"
                  />
                  <button
                    onClick={handleUrlLookup}
                    disabled={urlLoading || !urlInput.trim()}
                    className="h-10 w-10 rounded-xl bg-[#1d1d1f] text-white flex items-center justify-center shrink-0 hover:bg-[#3d3d3f] disabled:opacity-40 transition-colors"
                  >
                    {urlLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                </div>
                {urlResult && (
                  <div className="space-y-2">
                    {urlResult.error && <p className="text-xs text-red-500">{urlResult.error}</p>}
                    {urlResult.message && !urlResult.cards?.length && <p className="text-xs text-[#6e6e73]">{urlResult.message}</p>}
                    {urlResult.identified?.name && urlResult.source === "claude" && (
                      <p className="text-xs text-[#6e6e73]">
                        Identified: <span className="font-semibold text-[#1d1d1f]">{urlResult.identified.name}</span>
                        {urlResult.identified.setName && ` · ${urlResult.identified.setName}`}
                        <span className="ml-1 text-[#6e6e73]">({urlResult.identified.confidence})</span>
                      </p>
                    )}
                    {urlResult.source === "tcgplayer-id" && (
                      <p className="text-xs text-emerald-600 font-medium">✓ Matched directly from TCGPlayer</p>
                    )}
                    <CardPicker results={urlResult.cards ?? []} applySetFilter={false} />
                  </div>
                )}
              </TabsContent>

              {/* Search Tab */}
              <TabsContent value="search" className="space-y-3 mt-3">
                <div className="flex gap-2">
                  <Input
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                    placeholder="e.g. Charizard"
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="rounded-xl border-black/[0.1] bg-white text-sm h-10"
                  />
                  <button
                    onClick={handleSearch}
                    disabled={searching || searchQ.trim().length < 2}
                    className="h-10 w-10 rounded-xl bg-[#1d1d1f] text-white flex items-center justify-center shrink-0 hover:bg-[#3d3d3f] disabled:opacity-40 transition-colors"
                  >
                    {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </button>
                </div>
                {searchResults.length === 0 && !searching && searchQ.trim().length >= 2 && (
                  <p className="text-xs text-[#6e6e73]">No results — try a broader name or check the set spelling.</p>
                )}
                <CardPicker results={searchResults} />
              </TabsContent>

              {/* Image Tab */}
              <TabsContent value="image" className="space-y-3 mt-3">
                <div
                  className="border-2 border-dashed border-black/[0.1] rounded-2xl p-8 text-center cursor-pointer hover:border-amber-400/50 hover:bg-amber-50/30 transition-all"
                  onClick={() => fileRef.current?.click()}
                >
                  {images.length > 0 ? (
                    <div className="flex flex-wrap gap-2 justify-center">
                      {images.map((f, i) => (
                        <img key={i} src={URL.createObjectURL(f)} alt="" className="h-24 object-contain rounded-xl shadow-md" />
                      ))}
                    </div>
                  ) : (
                    <div className="text-[#6e6e73]">
                      <Upload className="w-8 h-8 mx-auto mb-2.5 text-amber-400" />
                      <p className="text-sm font-medium text-[#1d1d1f]">Drop images here</p>
                      <p className="text-xs mt-0.5">Collectr screenshots or card photos · Multiple files OK</p>
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => { const f = Array.from(e.target.files ?? []); setImages(f); handleIdentifyImages(f); }} />
                {identifying && (
                  <p className="text-xs text-[#6e6e73] flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin text-amber-500" /> Identifying cards…
                  </p>
                )}
                {identified.length > 0 && (
                  <div className="space-y-1.5">
                    {identified.map((r, i) => (
                      <p key={i} className="text-xs text-emerald-700">
                        {r.name ? `✓ ${r.name}${r.setName ? ` · ${r.setName}` : ""}` : "Could not identify card"}
                        {r.confidence && <span className="text-[#6e6e73] ml-1">({r.confidence})</span>}
                      </p>
                    ))}
                    {identified[0]?.name && (
                      <button onClick={handleSearchFromImage} disabled={searching}
                        className="text-xs text-amber-600 font-medium hover:text-amber-700 flex items-center gap-1">
                        Search for &quot;{identified[0].name}&quot;{filterSetName ? ` in ${filterSetName}` : ""} <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
                {searchResults.length > 0 && <CardPicker results={searchResults} />}
              </TabsContent>
            </Tabs>

            {/* Selected card preview */}
            {selectedTcg && (
              <div className="space-y-2">
                <div className="flex items-center gap-3.5 p-3.5 bg-amber-50 rounded-2xl border border-amber-100">
                  <img src={selectedTcg.images.small} alt={selectedTcg.name} className="w-12 h-16 object-contain rounded-lg shadow-md" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-[#1d1d1f]">{selectedTcg.name}</p>
                    <p className="text-xs text-[#6e6e73] mt-0.5">{selectedTcg.set.name} · #{selectedTcg.number}</p>
                  </div>
                  <button onClick={() => setSelectedTcg(null)} className="text-xs text-[#6e6e73] hover:text-[#1d1d1f] transition-colors px-2 py-1 rounded-lg hover:bg-black/[0.06]">
                    Clear
                  </button>
                </div>

                {/* No-pricing warning — only when neither source has a price */}
                {!selectedHasPricing && (
                  <div className="flex items-start gap-2.5 px-3.5 py-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">No price data found</p>
                      <p className="mt-0.5 text-amber-700">
                        This card has no pricing on TCGPlayer or Scrydex yet. It may not be listed for sale. You can still add it and check back later.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!selectedTcg && (
              <div>
                <Label className="text-xs text-[#6e6e73] font-medium mb-1.5 block">Or type name manually</Label>
                <Input value={manualName} onChange={(e) => setManualName(e.target.value)}
                  placeholder="Card name" className="rounded-xl border-black/[0.1] bg-white h-10 text-sm" />
              </div>
            )}

            <div>
              <Label className="text-xs text-[#6e6e73] font-medium mb-1.5 block">Notes (optional)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. PSA 10, 1st edition preferred…" rows={2}
                className="rounded-xl border-black/[0.1] bg-white text-sm resize-none" />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 flex justify-end gap-2.5">
            <button
              onClick={() => { setShowAdd(false); resetForm(); }}
              className="px-4 py-2 rounded-full text-sm font-medium text-[#6e6e73] hover:bg-black/[0.06] hover:text-[#1d1d1f] transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleAddCard}
              disabled={saving || (!selectedTcg && !manualName.trim())}
              className="btn-amber px-5 py-2 rounded-full text-sm font-semibold text-white flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Add to Want List
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
