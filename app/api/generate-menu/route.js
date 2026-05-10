import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { parseGeminiJsonObject } from "@/lib/parseGeminiJson";

const MODEL = process.env.GEMINI_MODEL_NAME || "gemini-2.0-flash";

export async function POST(request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY manquant dans l’environnement." },
        { status: 500 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
    }

    const { constraints = [], notes = "" } = body;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL });

    const constraintsList = Array.isArray(constraints)
      ? constraints.filter(Boolean).join(", ")
      : "";

    const prompt = `Tu es un nutritionniste. Propose un menu pour UNE journée complète : petit-déjeuner, déjeuner, dîner, et une collation.

Objectifs journaliers pour la journée entière (approximatif) : ~2000 kcal, ~140g protéines, ~220g glucides, ~65g lipides. Répartis les repas de façon réaliste.

Contraintes alimentaires à respecter strictement : ${constraintsList || "aucune"}.
Notes et préférences : ${typeof notes === "string" ? notes : ""}

Réponds UNIQUEMENT avec un JSON valide, sans bloc markdown, format exact :
{"meals":[{"meal_type":"breakfast","items":[{"food_name":"texte","kcal":0,"protein":0,"carbs":0,"fat":0}]},{"meal_type":"lunch","items":[...]},{"meal_type":"dinner","items":[...]},{"meal_type":"snack","items":[...]}]}

meal_type doit être exactement : breakfast, lunch, dinner ou snack (anglais).
Chaque item représente un aliment ou sous-plat avec estimations nutritionnelles cohérentes.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const data = parseGeminiJsonObject(text);

    if (!data.meals || !Array.isArray(data.meals)) {
      return NextResponse.json(
        { error: "Format de menu invalide renvoyé par le modèle." },
        { status: 502 }
      );
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e.message || "Erreur lors de la génération du menu." },
      { status: 500 }
    );
  }
}
