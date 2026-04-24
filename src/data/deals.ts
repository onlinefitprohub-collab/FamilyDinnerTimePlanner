import { Deal } from '../types';

/**
 * Active deals at UK supermarkets.
 *
 * HOW TO ADD A NEW DEAL:
 * 1. Find the ingredientId from src/data/ingredients.ts
 * 2. Add a new object to the `deals` array below following the same structure
 * 3. Set validUntil to the deal end date in ISO format (e.g. "2025-06-30")
 * 4. Set dealLabel to the supermarket's promotional label (e.g. "Clubcard Price")
 * 5. Save the file — the app will automatically pick up the new deal
 */
export const deals: Deal[] = [
  {
    ingredientId: 'beef-mince-500g',
    supermarket: 'Asda',
    originalPrice: 3.65,
    dealPrice: 2.99,
    dealLabel: 'Rollback',
    validUntil: '2025-05-31',
  },
  {
    ingredientId: 'chicken-thighs-800g',
    supermarket: 'Lidl',
    originalPrice: 3.89,
    dealPrice: 2.99,
    dealLabel: 'Special Buy',
    validUntil: '2025-05-15',
  },
  {
    ingredientId: 'cheddar-cheese-400g',
    supermarket: 'Tesco',
    originalPrice: 3.00,
    dealPrice: 2.25,
    dealLabel: 'Clubcard Price',
    validUntil: '2025-05-20',
  },
  {
    ingredientId: 'tinned-tomatoes-400g',
    supermarket: 'Aldi',
    originalPrice: 0.33,
    dealPrice: 0.25,
    dealLabel: 'Super 6',
    validUntil: '2025-05-31',
  },
  {
    ingredientId: 'pork-sausages-8pack',
    supermarket: "Sainsbury's",
    originalPrice: 2.75,
    dealPrice: 2.00,
    dealLabel: 'Taste the Difference Deal',
    validUntil: '2025-05-10',
  },
  {
    ingredientId: 'spaghetti-500g',
    supermarket: 'Morrisons',
    originalPrice: 0.75,
    dealPrice: 0.55,
    dealLabel: 'More Card Price',
    validUntil: '2025-05-25',
  },
  {
    ingredientId: 'plain-yoghurt-500g',
    supermarket: 'Asda',
    originalPrice: 1.05,
    dealPrice: 0.79,
    dealLabel: 'Price Lock',
    validUntil: '2025-06-30',
  },
];

/** Returns all deals that are still valid today. */
export function getActiveDeals(): Deal[] {
  const today = new Date().toISOString().split('T')[0];
  return deals.filter((d) => d.validUntil >= today);
}

/** Returns all active deals for a specific ingredient. */
export function getDealsForIngredient(ingredientId: string): Deal[] {
  const today = new Date().toISOString().split('T')[0];
  return deals.filter(
    (d) => d.ingredientId === ingredientId && d.validUntil >= today,
  );
}
