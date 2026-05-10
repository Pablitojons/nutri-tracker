/** Objectifs journaliers fixes (profil) */
export const NUTRITION_TARGETS = {
  kcal: 2000,
  protein: 140,
  carbs: 220,
  fat: 65,
};

export const MEAL_ORDER = ["breakfast", "lunch", "dinner", "snack"];

export const MEAL_LABELS = {
  breakfast: "Petit-déjeuner",
  lunch: "Déjeuner",
  dinner: "Dîner",
  snack: "Collation",
};

export const CONSTRAINT_OPTIONS = [
  { id: "vegetarian", label: "Végétarien" },
  { id: "vegan", label: "Végan" },
  { id: "gluten_free", label: "Sans gluten" },
  { id: "dairy_free", label: "Sans lactose" },
  { id: "nut_free", label: "Sans noix" },
  { id: "halal", label: "Halal" },
];
