import { describe, expect, it } from 'vitest';
import {
  contractDistribution,
  contractPool,
  levelFromXp,
  solveCaseWeights,
  tableEv,
  upgradeChanceBp,
  ECONOMY,
} from './economy';

describe('solveCaseWeights', () => {
  const entries = [
    { value: 25, weight: 30 },
    { value: 50, weight: 20 },
    { value: 110, weight: 20 },
    { value: 260, weight: 6 },
  ];

  it('solves exact EV for a 100 AP case at 88% RTP', () => {
    const solved = solveCaseWeights(entries, 0, 88);
    expect(solved).not.toBeNull();
    const ev = tableEv(entries.map((e, i) => ({ ...e, weight: solved![i]! })));
    expect(ev).toBeCloseTo(88, 5);
  });

  it('returns null when infeasible (buffer above target EV)', () => {
    // buffer value 300 > target 88 → negative weight → null
    const bad = [
      { value: 300, weight: 30 },
      { value: 500, weight: 5 },
    ];
    expect(solveCaseWeights(bad, 0, 88)).toBeNull();
  });

  it('keeps all weights positive', () => {
    const solved = solveCaseWeights(entries, 0, 88)!;
    solved.forEach((w) => expect(w).toBeGreaterThan(0));
  });
});

describe('upgradeChanceBp', () => {
  it('applies the 5% fee to the fair chance', () => {
    // fair 1000/5000 = 20% → 19% → 1900 bp
    expect(upgradeChanceBp(1000, 5000)).toBe(1900);
  });

  it('returns 0 when target is below 1.2× input', () => {
    expect(upgradeChanceBp(1000, 1100)).toBe(0);
  });

  it('clamps the floor at 1% and caps at fair×fee (min-target gate binds first)', () => {
    expect(upgradeChanceBp(100, 100_000)).toBe(ECONOMY.UPGRADE_MIN_CHANCE_BP);
    // 10000/12000 = 83.33% fair → ×0.95 = 79.17% (unreachable clamp is a safety net only)
    expect(upgradeChanceBp(10_000, 12_000)).toBe(7917);
  });

  it('guarantees negative player EV (house edge) in the unclamped mid-range', () => {
    for (let s = 100; s <= 5000; s += 250) {
      for (const mult of [1.5, 2, 3, 5, 8]) {
        const t = s * mult;
        const bp = upgradeChanceBp(s, t);
        const ev = (bp / 10_000) * t;
        expect(ev).toBeLessThanOrEqual(s); // player never has positive EV
      }
    }
  });
});

describe('contractDistribution', () => {
  const pool = [50, 120, 320, 700, 1500, 4200];

  it('hits the exact 81% EV target', () => {
    const probs = contractDistribution(pool, 1000);
    const ev = probs.reduce((a, p, i) => a + p * pool[i]!, 0);
    expect(ev).toBeCloseTo(810, 0);
  });

  it('probabilities sum to 1', () => {
    const probs = contractDistribution(pool, 400);
    expect(probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
  });

  it('all probabilities are finite and non-negative', () => {
    const probs = contractDistribution([25, 90, 7500], 2000);
    probs.forEach((p) => {
      expect(Number.isFinite(p)).toBe(true);
      expect(p).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('contractPool', () => {
  const catalogue = [25, 35, 50, 65, 90, 120, 320, 700, 1500, 4200, 7500].map((value) => ({ value }));

  it('selects items within [0.25S, 6S] when the band has enough items', () => {
    const idxs = contractPool(catalogue, 1000); // band [250, 6000]: 320, 700, 1500, 4200
    expect(idxs.length).toBeGreaterThanOrEqual(4);
    idxs.forEach((i) => {
      const v = catalogue[i]!.value;
      expect(v).toBeGreaterThanOrEqual(250);
      expect(v).toBeLessThanOrEqual(6000);
    });
  });

  it('falls back to a mixed band when the pool is too small', () => {
    const tiny = [{ value: 10 }, { value: 999_999 }];
    const idxs = contractPool(tiny, 500);
    expect(idxs.length).toBeGreaterThanOrEqual(2);
  });
});

describe('levelFromXp', () => {
  it('level 1 at 0 xp', () => {
    expect(levelFromXp(0).level).toBe(1);
  });

  it('monotonic levels', () => {
    let prev = 0;
    for (let xp = 0; xp <= 100_000; xp += 500) {
      const { level } = levelFromXp(xp);
      expect(level).toBeGreaterThanOrEqual(prev);
      prev = level;
    }
  });

  it('progress within [0,1]', () => {
    expect(levelFromXp(450).progress).toBeLessThanOrEqual(1);
    expect(levelFromXp(450).progress).toBeGreaterThanOrEqual(0);
  });
});
