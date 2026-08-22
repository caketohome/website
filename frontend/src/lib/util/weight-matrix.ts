/**
 * CakeToHome — Authoritative Product Weight Option & Pricing Matrix Utilities
 * Provides strongly typed normalization, parsing, validation, and numerical sorting for cake weight variants.
 */

export interface ProductWeightOption {
  id: string;
  weight_id?: string;
  product_id?: string;
  weight_name: string;
  weight_value: number;
  weight_unit: "kg" | "g";
  normalized_grams: number;
  selling_price: number;
  mrp: number;
  cost_price: number;
  prep_time_minutes: number;
  is_enabled: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Parses and normalizes any user-entered weight string into canonical unit, value, and grams.
 * Examples:
 *   "0.75 kg"  -> { name: "0.75 kg", value: 0.75, unit: "kg", grams: 750 }
 *   "750 g"    -> { name: "750 g",   value: 750,  unit: "g",  grams: 750 }
 *   "1 kg"     -> { name: "1 kg",    value: 1,    unit: "kg", grams: 1000 }
 *   "1.5kg"    -> { name: "1.5 kg",  value: 1.5,  unit: "kg", grams: 1500 }
 *   "250gm"    -> { name: "250 g",   value: 250,  unit: "g",  grams: 250 }
 *   "2 k.g."   -> { name: "2 kg",    value: 2,    unit: "kg", grams: 2000 }
 */
export function parseAndNormalizeWeight(rawInput: string): {
  weight_name: string;
  weight_value: number;
  weight_unit: "kg" | "g";
  normalized_grams: number;
} {
  const trimmed = String(rawInput || "").trim().toLowerCase();
  if (!trimmed) {
    return {
      weight_name: "1 kg",
      weight_value: 1,
      weight_unit: "kg",
      normalized_grams: 1000,
    };
  }

  // Regex matches: number + optional unit (kg, g, gm, grams, etc.)
  const match = trimmed.match(/^([\d.]+)\s*(kg|k\.g\.|kilo|kilos|g|gm|gms|gram|grams)?$/i);
  if (match) {
    let val = parseFloat(match[1]);
    if (isNaN(val) || val <= 0) val = 1;

    const rawUnit = (match[2] || "").toLowerCase();
    const isGramUnit = rawUnit.startsWith("g") && !rawUnit.startsWith("k");

    if (isGramUnit || (val >= 100 && !rawUnit)) {
      const grams = Math.round(val);
      if (grams >= 1000) {
        const kgVal = grams / 1000;
        const displayKg = kgVal % 1 === 0 ? kgVal.toFixed(0) : kgVal.toString();
        return {
          weight_name: `${displayKg} kg`,
          weight_value: kgVal,
          weight_unit: "kg",
          normalized_grams: grams,
        };
      }
      return {
        weight_name: `${grams} g`,
        weight_value: grams,
        weight_unit: "g",
        normalized_grams: grams,
      };
    } else {
      const grams = Math.round(val * 1000);
      const displayVal = val % 1 === 0 ? val.toFixed(0) : val.toString();
      return {
        weight_name: `${displayVal} kg`,
        weight_value: val,
        weight_unit: "kg",
        normalized_grams: grams,
      };
    }
  }

  // Fallback for descriptive custom labels (e.g. "Family Size 2kg")
  const numMatch = trimmed.match(/([\d.]+)/);
  const val = numMatch ? parseFloat(numMatch[1]) : 1;
  const isGram = trimmed.includes("g") && !trimmed.includes("kg");
  const grams = isGram ? Math.round(val) : Math.round(val * 1000);

  return {
    weight_name: rawInput.trim(),
    weight_value: val,
    weight_unit: isGram ? "g" : "kg",
    normalized_grams: isNaN(grams) || grams <= 0 ? 1000 : grams,
  };
}

/**
 * Deterministically sorts weight option rows numerically by normalized grams (ascending).
 */
export function sortWeightOptions<T extends { normalized_grams?: number; weight_name?: string; sort_order?: number }>(
  weights: T[]
): T[] {
  return [...weights].sort((a, b) => {
    const gramsA = a.normalized_grams ?? parseAndNormalizeWeight(a.weight_name || "").normalized_grams;
    const gramsB = b.normalized_grams ?? parseAndNormalizeWeight(b.weight_name || "").normalized_grams;
    return gramsA - gramsB;
  });
}

/**
 * Suggests the next logical standard weight size given a list of already existing weight sizes.
 * Standard progression: 0.5 kg -> 0.75 kg -> 1 kg -> 1.5 kg -> 2 kg -> 2.5 kg -> 3 kg -> 3.5 kg -> 4 kg -> 5 kg
 */
export function getNextSuggestedWeight(existingWeights: Array<{ weight_name?: string; normalized_grams?: number }>): {
  name: string;
  price: number;
} {
  const existingGrams = new Set(
    existingWeights.map((w) => w.normalized_grams ?? parseAndNormalizeWeight(w.weight_name || "").normalized_grams)
  );

  const standardLadder: Array<{ grams: number; name: string; priceFactor: number }> = [
    { grams: 500, name: "0.5 kg", priceFactor: 0.85 },
    { grams: 750, name: "0.75 kg", priceFactor: 0.95 },
    { grams: 1000, name: "1 kg", priceFactor: 1.0 },
    { grams: 1500, name: "1.5 kg", priceFactor: 1.45 },
    { grams: 2000, name: "2 kg", priceFactor: 1.85 },
    { grams: 2500, name: "2.5 kg", priceFactor: 2.3 },
    { grams: 3000, name: "3 kg", priceFactor: 2.75 },
    { grams: 3500, name: "3.5 kg", priceFactor: 3.2 },
    { grams: 4000, name: "4 kg", priceFactor: 3.65 },
    { grams: 5000, name: "5 kg", priceFactor: 4.5 },
  ];

  for (const step of standardLadder) {
    if (!existingGrams.has(step.grams)) {
      return { name: step.name, price: Math.round(599 * step.priceFactor) };
    }
  }

  // If all standard ladder sizes are used, add +1 kg to the max existing weight
  const maxGrams = Math.max(0, ...Array.from(existingGrams));
  const nextKg = (maxGrams + 1000) / 1000;
  return {
    name: `${nextKg} kg`,
    price: Math.round(599 * (nextKg * 0.9)),
  };
}

/**
 * Creates canonical default weight matrix for a product when none exist.
 */
export function createDefaultWeightMatrix(productId: string, basePrice: number = 649): ProductWeightOption[] {
  const price = Math.max(100, Number(basePrice) || 649);
  const tiers = [
    { name: "0.5 kg", grams: 500, factor: 0.85 },
    { name: "1 kg", grams: 1000, factor: 1.0 },
    { name: "1.5 kg", grams: 1500, factor: 1.45 },
    { name: "2 kg", grams: 2000, factor: 1.85 },
  ];

  return tiers.map((t, idx) => {
    const sellPrice = Math.round(price * t.factor);
    const parsed = parseAndNormalizeWeight(t.name);
    return {
      id: `wp_${productId}_${t.grams}`,
      weight_id: `wp_${productId}_${t.grams}`,
      product_id: productId,
      weight_name: t.name,
      weight_value: parsed.weight_value,
      weight_unit: parsed.weight_unit,
      normalized_grams: t.grams,
      selling_price: sellPrice,
      mrp: Math.round(sellPrice * 1.25),
      cost_price: Math.round(sellPrice * 0.45),
      prep_time_minutes: t.grams > 1000 ? 120 : 60,
      is_enabled: true,
      sort_order: idx + 1,
    };
  });
}
