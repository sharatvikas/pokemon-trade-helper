import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const files = formData.getAll("images") as File[];

  if (!files.length) {
    return NextResponse.json({ error: "No images provided" }, { status: 400 });
  }

  const results = await Promise.all(
    files.map(async (file) => {
      const bytes = await file.arrayBuffer();
      const base64 = Buffer.from(bytes).toString("base64");
      const mediaType = (file.type || "image/jpeg") as "image/jpeg" | "image/png" | "image/webp" | "image/gif";

      const message = await client.messages.create({
        model: "claude-opus-4-6",
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: base64 },
              },
              {
                type: "text",
                text: `Identify this Pokemon TCG card. Return ONLY a JSON object with these fields:
{
  "name": "card name (e.g. Charizard)",
  "setName": "set name (e.g. Base Set)",
  "setCode": "set code if visible (e.g. base1)",
  "cardNumber": "card number if visible (e.g. 4/102)",
  "confidence": "high | medium | low"
}
If you cannot identify the card, return { "name": null, "confidence": "low" }.`,
              },
            ],
          },
        ],
      });

      try {
        const text = message.content[0].type === "text" ? message.content[0].text : "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : { name: null, confidence: "low" };
      } catch {
        return { name: null, confidence: "low" };
      }
    })
  );

  return NextResponse.json(results);
}
