import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ success: true });
}

export async function POST(request: Request) {
  try {
    const openai = new OpenAI({
      apiKey: (process.env.OPENAI_API_KEY ?? "").trim().split(/\s+/)[0],
    });

    const formData = await request.formData();

    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({
        success: false,
        error: "Keine PDF-Datei gefunden",
      });
    }

    const uploadedFile =
      await openai.files.create({
        file,
        purpose: "assistants",
      });

    const response =
      await openai.responses.create({
        model: "gpt-4.1-mini",

        input: [
          {
            role: "user",

            content: [
              {
                type: "input_text",

                text:
                  "Lies diesen Tourenplan PDF und gib NUR ein JSON-Array zurück, EXAKT in der Reihenfolge wie im PDF (nach der # Spalte sortiert). Ignoriere die letzte Zeile wenn sie 'Endziel' enthält. Format: " +
                  '[{"order":1,"name":"Kundenname oder leer","adresse":"vollständige Adresse","telefon":"","notiz":""}]. Gib NUR das JSON zurück, kein Text davor oder danach.',
              },

              {
                type: "input_file",

                file_id:
                  uploadedFile.id,
              },
            ],
          },
        ],
      });

    const text =
      response.output_text || "[]";

    const cleaned = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const raw = JSON.parse(cleaned);
    // sort by order field if present, then strip it — admin saves index as order
    const data = Array.isArray(raw)
      ? [...raw].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
      : raw;

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    });
  }
}