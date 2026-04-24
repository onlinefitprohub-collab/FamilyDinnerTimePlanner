/**
 * Levenshtein-distance-based fuzzy matching.
 * Returns a similarity score between 0 (completely different) and 1 (identical).
 */

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Returns a similarity score between 0–1.
 * 1.0 = identical strings, 0.0 = completely different.
 * Case-insensitive.
 */
export function fuzzyMatch(query: string, target: string): number {
  const a = query.toLowerCase().trim();
  const b = target.toLowerCase().trim();

  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const distance = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return 1 - distance / maxLen;
}

/**
 * Finds the best matching string from a list of candidates.
 * Returns null if no candidate scores >= 0.3.
 */
export function findBestMatch(
  query: string,
  candidates: string[],
): { match: string; score: number; index: number } | null {
  let bestScore = 0;
  let bestIndex = -1;

  for (let i = 0; i < candidates.length; i++) {
    const score = fuzzyMatch(query, candidates[i]);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  if (bestIndex === -1 || bestScore < 0.3) return null;

  return {
    match: candidates[bestIndex],
    score: bestScore,
    index: bestIndex,
  };
}
