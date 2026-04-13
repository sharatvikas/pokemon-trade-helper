import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pollSingleCard } from "@/lib/pricePoller";
import { z } from "zod";

const CreateCardSchema = z.object({
  name: z.string().min(1),
  setName: z.string().optional(),
  setCode: z.string().optional(),
  cardNumber: z.string().optional(),
  tcgPlayerId: z.string().optional(),
  imageUrl: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  const cards = await prisma.wantCard.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      priceSnapshots: {
        orderBy: { fetchedAt: "desc" },
        take: 2,
      },
      alertRules: { where: { enabled: true } },
    },
  });
  return NextResponse.json(cards);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = CreateCardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const card = await prisma.wantCard.create({ data: parsed.data });

  // Fetch prices immediately so the card shows costs right away
  try {
    await pollSingleCard(card.id);
  } catch (err) {
    console.error("Initial price fetch failed for new card:", err);
  }

  // Return the card with its fresh snapshot
  const cardWithSnapshot = await prisma.wantCard.findUnique({
    where: { id: card.id },
    include: {
      priceSnapshots: { orderBy: { fetchedAt: "desc" }, take: 2 },
      alertRules: { where: { enabled: true } },
    },
  });

  return NextResponse.json(cardWithSnapshot, { status: 201 });
}
