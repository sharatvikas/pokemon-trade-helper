import { prisma } from "@/lib/prisma";
import { getAllSets } from "@/lib/pokemontcg";
import { WantListClient } from "@/components/WantListClient";

export const dynamic = "force-dynamic";

export default async function WantListPage() {
  const [cards, sets] = await Promise.all([
    prisma.wantCard.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        priceSnapshots: { orderBy: { fetchedAt: "desc" }, take: 1 },
        alertRules: { where: { enabled: true } },
      },
    }),
    getAllSets().catch(() => []),
  ]);
  return <WantListClient initialCards={cards} sets={sets} />;
}
