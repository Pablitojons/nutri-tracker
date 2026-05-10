import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { parseGeminiJsonObject } from "@/lib/parseGeminiJson";

const MODEL = process.env.GEMINI_MODEL_NAME || "gemini-2.0-flash";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY manquant dans l’environnement." },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("image");
    if (!file || typeof file === "string") {
      return NextResponse.json(
        { error: "Champ image manquant ou invalide." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "image/jpeg";
    const base64 = buffer.toString("base64");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL });

    const prompt = `Tu analyses une photo d’étiquette nutritionnelle, d’emballage alimentaire ou d’un plat.
Extrais une ou plusieurs entrées alimentaires avec les meilleures estimations possibles.

Réponds UNIQUEMENT avec un JSON valide, sans bloc markdown :
{"items":[{"food_name":"nom ou description courte","kcal":0,"protein":0,"carbs":0,"fat":0,"meal_type":"snack"}]}

Règles :
- Si plusieurs produits/aliments distincts sont visibles, ajoute plusieurs objets dans "items".
- Si une valeur est absente ou illisible, mets 0.
- meal_type : breakfast | lunch | dinner | snack selon ton jugement du contexte, sinon snack.`;

    const result = await model.generateContent([
      { inlineData: { mimeType, data: base64 } },
      { text: prompt },
    ]);

    const text = result.response.text();
    const data = parseGeminiJsonObject(text);

    if (!data.items || !Array.isArray(data.items)) {
      return NextResponse.json(
        { error: "Analyse invalide renvoyée par le modèle." },
        { status: 502 }
      );
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e.message || "Erreur lors de l’analyse de l’image." },
      { status: 500 }
    );
  }
}
