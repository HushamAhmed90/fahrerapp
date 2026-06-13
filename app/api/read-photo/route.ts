import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const openai = new OpenAI({
      apiKey: (process.env.OPENAI_API_KEY ?? "").trim().split(/\s+/)[0],
    });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ success: false, error: "Kein Bild" });

    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const mimeType = file.type || "image/jpeg";

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Du siehst einen handgeschriebenen Lieferplan (Tourenplan) eines deutschen Blumengeschäfts.
Extrahiere ALLE Lieferungen und gib NUR ein JSON-Array zurück.

Format:
[{"order":1,"name":"Empfängername oder Firmenname","adresse":"vollständige Straße und Ort","telefon":"","notiz":"Bemerkungen z.B. Strauß, Gesteck, Fleurop, Uhrzeit"}]

Regeln:
- Leere Zeilen ignorieren
- Datum aus der Überschrift als Kontext nutzen
- Adresse so vollständig wie möglich
- Notiz: Lieferzeit + Produktart + Sonderwünsche
- NUR JSON, kein Text davor oder danach`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
                detail: "high",
              },
            },
          ],
        },
      ],
      max_tokens: 2000,
    });

    const text = response.choices[0]?.message?.content || "[]";
    const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const data = JSON.parse(cleaned);

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: String(error) });
  }
}
