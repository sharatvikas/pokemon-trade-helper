import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const AlertRuleSchema = z.object({
  type: z.enum(["ABOVE", "BELOW", "MOVE_PCT"]),
  source: z.enum(["TCG", "EBAY", "BOTH"]),
  threshold: z.number().positive(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rules = await prisma.alertRule.findMany({
    where: { cardId: id },
    include: { history: { orderBy: { triggeredAt: "desc" }, take: 5 } },
  });
  return NextResponse.json(rules);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = AlertRuleSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const rule = await prisma.alertRule.create({ data: { cardId: id, ...parsed.data } });
  return NextResponse.json(rule, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: cardId } = await params;
  const { searchParams } = new URL(req.url);
  const ruleId = searchParams.get("ruleId");
  if (!ruleId) return NextResponse.json({ error: "ruleId required" }, { status: 400 });
  await prisma.alertRule.delete({ where: { id: ruleId, cardId } });
  return NextResponse.json({ ok: true });
}
