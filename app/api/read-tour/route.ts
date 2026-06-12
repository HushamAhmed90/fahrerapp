import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: (process.env.OPENAI_API_KEY ?? "").split(/\s+/)[0],
});

export async function GET() {
  return NextResponse.json({
    success: true,
  });
}

export async function POST(request: Request) {
  try {
    const formData =
      await request.formData();

    const file = formData.get(
      "file"
    ) as File | null;

    if (!file) {
      return NextResponse.json({
        success: false,
        error:
          "Keine PDF-Datei gefunden",
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
                  "Lies diesen Tourenplan PDF und gib NUR JSON zurück. Format: " +
                  '[{"name":"","adresse":"","telefon":"","notiz":""}]',
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

    const data =
      JSON.parse(cleaned);

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