// Pure battle helpers (unit-tested without a database).

export const BATTLE_STATES = ['WAITING', 'RUNNING', 'FINISHED', 'CANCELLED'] as const;
export type BattleState = (typeof BATTLE_STATES)[number];

export const BATTLE_RULES = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 4,
  MIN_ROUNDS: 1,
  MAX_ROUNDS: 10,
  ROUND_PAUSE_MS: 700,
  MAX_CASE_SLOTS: 5,
} as const;

/** Round r (1-based) uses cases[(r-1) % cases.length]. */
export function caseForRound(slugs: string[], roundNo: number): string {
  return slugs[(roundNo - 1) % slugs.length]!;
}

export interface ParticipantScore {
  userId: string;
  totalValue: number;
  joinedAt: Date;
}

/**
 * Winner: max total value; ties broken by earliest join (deterministic).
 */
export function computeWinner(scores: ParticipantScore[]): string | null {
  if (scores.length === 0) return null;
  return scores.reduce((best, s) => {
    if (s.totalValue > best.totalValue) return s;
    if (s.totalValue === best.totalValue && s.joinedAt < best.joinedAt) return s;
    return best;
  }, scores[0]!).userId;
}

/** Entry cost per player: sum of every round's case price. */
export function entryCost(cases: { price: number }[], rounds: number): number {
  if (cases.length === 0) return 0;
  let sum = 0;
  for (let r = 1; r <= rounds; r++) {
    const c = cases[(r - 1) % cases.length]!;
    sum += c.price;
  }
  return sum;
}

export function inviteCodeValid(code: string): boolean {
  return /^[A-Z0-9]{4,8}$/.test(code);
}
