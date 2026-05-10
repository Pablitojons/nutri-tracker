/** Extrait le premier bloc JSON objet d’un texte (réponses Gemini avec markdown ou texte libre). */
export function parseGeminiJsonObject(text) {
  if (!text || typeof text !== "string") {
    throw new Error("Réponse vide");
  }

  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();

  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Aucun JSON objet trouvé");
  }

  return JSON.parse(s.slice(start, end + 1));
}
