import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { CardDetailClient } from "@/components/CardDetailClient";

export const dynamic = "force-dynamic";

export default async function CardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const card = await prisma.wantCard.findUnique({
    where: { id },
    include: {
      priceSnapshots: { orderBy: { fetchedAt: "asc" }, take: 90 },
      alertRules: { include: { history: { orderBy: { triggeredAt: "desc" }, take: 10 } } },
    },
  });
  if (!card) notFound();
  return <CardDetailClient card={card} />;
}
