import { getCachedBarcode, setCachedBarcode } from '../lib/barcodeCache';
import { ingredients } from '../data/ingredients';
import { fuzzyMatch } from '../utils/fuzzyMatch';
import { BarcodeCacheEntry } from '../types';

const BASE_URL = 'https://world.openfoodfacts.org/api/v0/product';
const MATCH_THRESHOLD = 0.70;

export interface BarcodeResult {
  barcode: string;
  productName: string;
  brands?: string;
  matchedIngredientId: string | null;
  matchedIngredientName: string | null;
  confidence: number;
  fromCache: boolean;
}

interface OpenFoodFactsProduct {
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  categories?: string;
}

interface OpenFoodFactsResponse {
  status: number;
  product?: OpenFoodFactsProduct;
}

function extractProductName(product: OpenFoodFactsProduct): string {
  return (
    product.product_name_en?.trim() ||
    product.product_name?.trim() ||
    ''
  );
}

function findBestIngredientMatch(
  productName: string,
  brands: string,
): { id: string; name: string; score: number } | null {
  // Build candidate strings to match against
  const searchTerms = [productName];
  if (brands) {
    searchTerms.push(`${brands} ${productName}`);
  }
  // Strip common packaging words for a cleaner match
  const stripped = productName
    .replace(/\b(organic|free range|free-range|british|uk|fresh|frozen|ready|meal|pack|bag|tin|can|jar)\b/gi, '')
    .trim();
  if (stripped && stripped !== productName) searchTerms.push(stripped);

  let bestId = '';
  let bestName = '';
  let bestScore = 0;

  for (const term of searchTerms) {
    for (const ing of ingredients) {
      const score = fuzzyMatch(term, ing.name);
      if (score > bestScore) {
        bestScore = score;
        bestId = ing.id;
        bestName = ing.name;
      }
    }
  }

  if (bestScore >= MATCH_THRESHOLD) {
    return { id: bestId, name: bestName, score: bestScore };
  }
  return null;
}

export async function lookupBarcode(barcode: string): Promise<BarcodeResult> {
  // Check cache first
  const cached = await getCachedBarcode(barcode);
  if (cached) {
    const match = cached.matchedIngredientId
      ? ingredients.find((i) => i.id === cached.matchedIngredientId)
      : null;
    return {
      barcode,
      productName: cached.productName,
      matchedIngredientId: cached.matchedIngredientId ?? null,
      matchedIngredientName: match?.name ?? null,
      confidence: cached.matchedIngredientId ? MATCH_THRESHOLD : 0,
      fromCache: true,
    };
  }

  // Fetch from Open Food Facts
  let productName = '';
  let brands = '';
  let matchedIngredientId: string | null = null;
  let matchedIngredientName: string | null = null;
  let confidence = 0;

  try {
    const response = await fetch(`${BASE_URL}/${barcode}.json`, {
      headers: { 'User-Agent': 'FamilyDinnerTimePlanner/1.0' },
    });

    if (response.ok) {
      const json = (await response.json()) as OpenFoodFactsResponse;

      if (json.status === 1 && json.product) {
        productName = extractProductName(json.product);
        brands = json.product.brands?.trim() ?? '';

        if (productName) {
          const bestMatch = findBestIngredientMatch(productName, brands);
          if (bestMatch) {
            matchedIngredientId = bestMatch.id;
            matchedIngredientName = bestMatch.name;
            confidence = bestMatch.score;
          }
        }
      }
    }
  } catch (error) {
    console.warn('[openFoodFacts] lookup error:', error);
  }

  // Cache the result (even failed lookups, so we don't hammer the API)
  const cacheEntry: BarcodeCacheEntry = {
    barcode,
    productName: productName || `Unknown product (${barcode})`,
    matchedIngredientId: matchedIngredientId ?? undefined,
    cachedAt: new Date().toISOString(),
  };
  await setCachedBarcode(cacheEntry);

  return {
    barcode,
    productName: productName || `Unknown product (${barcode})`,
    brands: brands || undefined,
    matchedIngredientId,
    matchedIngredientName,
    confidence,
    fromCache: false,
  };
}
