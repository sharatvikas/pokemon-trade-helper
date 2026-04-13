import { prisma } from "@/lib/prisma";
import { DashboardClient } from "@/components/DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const cards = await prisma.wantCard.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      priceSnapshots: {
        orderBy: { fetchedAt: "desc" },
        take: 2,
      },
      alertRules: { where: { enabled: true } },
    },
  });

  const lastPoll =
    cards.length > 0
      ? cards.reduce((latest: Date, c: typeof cards[number]) => {
          const snap = c.priceSnapshots[0];
          if (!snap) return latest;
          return snap.fetchedAt > latest ? snap.fetchedAt : latest;
        }, new Date(0))
      : null;

  return <DashboardClient cards={cards} lastPoll={lastPoll} />;
}
