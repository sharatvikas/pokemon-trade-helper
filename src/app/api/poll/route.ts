import { NextResponse } from "next/server";
import { pollAllCardPrices } from "@/lib/pricePoller";

export async function POST() {
  const result = await pollAllCardPrices();
  return NextResponse.json(result);
}
