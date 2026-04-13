import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const history = await prisma.alertHistory.findMany({
    orderBy: { triggeredAt: "desc" },
    take: 100,
    include: {
      rule: {
        include: { card: { select: { id: true, name: true } } },
      },
    },
  });

  const rules = await prisma.alertRule.findMany({
    where: { enabled: true },
    include: { card: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Alerts</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {rules.length} active rule{rules.length !== 1 ? "s" : ""}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Active Rules</CardTitle>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No alert rules configured. Open a card to add rules.</p>
          ) : (
            <div className="divide-y divide-border">
              {rules.map((r: typeof rules[number]) => (
                <div key={r.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <Link href={`/cards/${r.card.id}`} className="font-medium text-sm hover:underline">
                      {r.card.name}
                    </Link>
                    <Badge variant={r.type === "ABOVE" ? "default" : r.type === "BELOW" ? "secondary" : "outline"}>
                      {r.type}
                    </Badge>
                    <span className="text-sm">
                      {r.type === "MOVE_PCT" ? `±${r.threshold}%` : `$${r.threshold.toFixed(2)}`}
                    </span>
                    <span className="text-xs text-muted-foreground">{r.source}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Alert History</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No alerts triggered yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {history.map((h: typeof history[number]) => (
                <div key={h.id} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-4">
                  <div>
                    <Link href={`/cards/${h.rule.card.id}`} className="font-medium text-sm hover:underline">
                      {h.rule.card.name}
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5">{h.message}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium tabular-nums">${h.priceValue.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(h.triggeredAt), "MMM d, HH:mm")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
