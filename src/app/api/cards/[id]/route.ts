import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const UpdateSchema = z.object({
  notes: z.string().optional(),
  setName: z.string().optional(),
  cardNumber: z.string().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const card = await prisma.wantCard.findUnique({
    where: { id },
    include: {
      priceSnapshots: { orderBy: { fetchedAt: "desc" }, take: 50 },
      alertRules: true,
    },
  });
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(card);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const card = await prisma.wantCard.update({ where: { id }, data: parsed.data });
  return NextResponse.json(card);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.wantCard.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
