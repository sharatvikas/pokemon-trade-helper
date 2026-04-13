import { prisma } from "@/lib/prisma";
import { AlertsClient } from "@/components/AlertsClient";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const [rules, history] = await Promise.all([
    prisma.alertRule.findMany({
      where: { enabled: true },
      include: {
        card: { select: { id: true, name: true, imageUrl: true, setName: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.alertHistory.findMany({
      orderBy: { triggeredAt: "desc" },
      take: 100,
      include: {
        rule: {
          include: { card: { select: { id: true, name: true } } },
        },
      },
    }),
  ]);

  return <AlertsClient initialRules={rules} history={history} />;
}
