// ============================================================
// CaseArena economy core — PURE functions (unit-tested).
//
// Design goal: the platform is structurally profitable ("контора в плюсе")
// WITHOUT deceiving players: every displayed percentage is the real one.
// The edge comes from three honest sinks:
//   1. Cases  — each case has target RTP < 100% (e.g. 88% → 12% house edge).
//   2. Upgrade — win chance = fair chance × (1 − fee), fee = 5%.
//   3. Contracts — expected output value = 81% of input value.
//   4. Sell-back — items sell to the system for 30% of reference value.
// ============================================================

export const ECONOMY = {
  /** Sell-back rate: system buys items for 30% of their reference value. */
  SELL_RATE: 0.3,
  /** Upgrade fee applied to the fair chance. */
  UPGRADE_FEE: 0.05,
  /** Upgrade requires target >= input * this factor. */
  UPGRADE_MIN_TARGET_FACTOR: 1.2,
  /** Upgrade chance clamps, in basis points. */
  UPGRADE_MIN_CHANCE_BP: 100, // 1%
  UPGRADE_MAX_CHANCE_BP: 9200, // 92%
  /** Contract expected return relative to input value. */
  CONTRACT_TARGET_RTP: 0.81,
  /** Contract input constraints. */
  CONTRACT_MIN_INPUTS: 3,
  CONTRACT_MAX_INPUTS: 5,
  /** Max input cost accepted for contracts (pool safety bound). */
  CONTRACT_MAX_INPUT_COST: 20_000,
  /** Contract outcome pool bounds relative to input cost. */
  CONTRACT_POOL_MIN_FACTOR: 0.25,
  CONTRACT_POOL_MAX_FACTOR: 6,
  /** XP rewards. */
  XP: { CASE_OPEN: 5, UPGRADE: 8, CONTRACT: 10, DAILY: 15 },
  /** Welcome bonus in Arena Points. */
  WELCOME_BONUS: 2500,
} as const;

export interface WeightedValue {
  value: number;
  weight: number;
}

/** EV of a weighted value table (weights need not be normalized). */
export function tableEv(entries: WeightedValue[]): number {
  const total = entries.reduce((a, e) => a + e.weight, 0);
  if (total <= 0) return 0;
  return entries.reduce((a, e) => a + e.value * e.weight, 0) / total;
}

/**
 * Solve the weight of the "buffer" entry so that the exact table EV === targetEv.
 * The buffer entry must be cheaper than targetEv (its weight absorbs the surplus).
 * Returns adjusted weights array (same order), or null when infeasible.
 */
export function solveCaseWeights(entries: WeightedValue[], bufferIndex: number, targetEv: number): number[] | null {
  const rest = entries.filter((_, i) => i !== bufferIndex);
  const vB = entries[bufferIndex]!.value;
  const wRest = rest.reduce((a, e) => a + e.weight, 0);
  const sRest = rest.reduce((a, e) => a + e.value * e.weight, 0);

  const num = targetEv * wRest - sRest;
  const den = vB - targetEv;
  if (den === 0) return null;
  const wB = num / den;
  if (wB <= 0 || !Number.isFinite(wB)) return null;

  return entries.map((_, i) => (i === bufferIndex ? wB : entries[i]!.weight));
}

/**
 * Upgrade win chance in basis points. Fair chance = input/target,
 * fee reduces it. Clamped to [1%, 92%].
 */
export function upgradeChanceBp(
  inputCost: number,
  targetValue: number,
  fee: number = ECONOMY.UPGRADE_FEE,
  minFactor: number = ECONOMY.UPGRADE_MIN_TARGET_FACTOR,
): number {
  if (targetValue < inputCost * minFactor) return 0;
  const fair = inputCost / targetValue;
  const withFee = fair * (1 - fee);
  const bp = Math.round(withFee * 10_000);
  return Math.max(ECONOMY.UPGRADE_MIN_CHANCE_BP, Math.min(ECONOMY.UPGRADE_MAX_CHANCE_BP, bp));
}

/**
 * Contract distribution: weights ∝ value^(−alpha). EV(alpha) is monotonic
 * decreasing in alpha, so binary-search alpha to hit target EV exactly.
 * Returns normalized probabilities aligned with the pool.
 */
export function contractDistribution(
  poolValues: number[],
  inputCost: number,
  targetRtp: number = ECONOMY.CONTRACT_TARGET_RTP,
): number[] {
  const n = poolValues.length;
  const target = inputCost * targetRtp;
  if (n === 0) return [];

  const evAt = (alpha: number): number => {
    let sw = 0;
    let swv = 0;
    for (const v of poolValues) {
      const w = Math.pow(v, -alpha);
      sw += w;
      swv += w * v;
    }
    return swv / sw;
  };

  // EV is decreasing in alpha; bounds chosen wide (values are positive).
  let lo = 0.01;
  let hi = 6;
  const evLo = evAt(lo); // max EV (favors expensive)
  const evHi = evAt(hi); // min EV (favors cheap)

  let alpha: number;
  if (target >= evLo) {
    alpha = lo; // cannot reach target even at cheapest weighting → cap at lo
  } else if (target <= evHi) {
    alpha = hi; // cannot reach target even at cheapest-outcomes weighting
  } else {
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      const ev = evAt(mid);
      if (ev > target) lo = mid;
      else hi = mid;
    }
    alpha = (lo + hi) / 2;
  }

  const weights = poolValues.map((v) => Math.pow(v, -alpha));
  const total = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => w / total);
}

/** Build the contract outcome pool (indices into the item catalogue are resolved by caller). */
export function contractPool(
  items: { value: number }[],
  inputCost: number,
  minFactor = ECONOMY.CONTRACT_POOL_MIN_FACTOR,
  maxFactor = ECONOMY.CONTRACT_POOL_MAX_FACTOR,
): number[] {
  const lo = inputCost * minFactor;
  const hi = inputCost * maxFactor;
  const inBand = items.map((it, i) => ({ i, v: it.value })).filter((x) => x.v >= lo && x.v <= hi);
  if (inBand.length >= 4) return inBand.map((x) => x.i);
  // Fallback: mix of cheapest 4 and most expensive 4 available.
  const sorted = items.map((it, i) => ({ i, v: it.value })).sort((a, b) => a.v - b.v);
  const set = new Set<number>([...sorted.slice(0, 4).map((x) => x.i), ...sorted.slice(-4).map((x) => x.i)]);
  return [...set];
}

// ---------- XP / levels ----------

/** Cumulative XP needed to reach level L is 400 * (L-1)^2 (level 1 at 0 XP). */
export function xpForLevel(level: number): number {
  return 400 * (level - 1) * (level - 1);
}

export interface LevelInfo {
  level: number;
  into: number;
  need: number;
  progress: number; // 0..1
}

export function levelFromXp(xp: number): LevelInfo {
  const level = Math.floor(Math.sqrt(Math.max(0, xp) / 400)) + 1;
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const into = xp - base;
  const need = next - base;
  return { level, into, need, progress: need > 0 ? Math.min(1, into / need) : 0 };
}
