import { describe, expect, it } from 'vitest';
import {
  BATTLE_RULES,
  caseForRound,
  computeWinner,
  entryCost,
  inviteCodeValid,
  type ParticipantScore,
} from './battle-util';

describe('caseForRound', () => {
  it('cycles cases across rounds', () => {
    const slugs = ['a', 'b', 'c'];
    expect(caseForRound(slugs, 1)).toBe('a');
    expect(caseForRound(slugs, 2)).toBe('b');
    expect(caseForRound(slugs, 3)).toBe('c');
    expect(caseForRound(slugs, 4)).toBe('a');
    expect(caseForRound(slugs, 7)).toBe('a');
  });
});

describe('computeWinner', () => {
  const t0 = new Date('2026-01-01T00:00:00Z');
  const t1 = new Date('2026-01-01T00:00:01Z');

  it('highest total value wins', () => {
    const scores: ParticipantScore[] = [
      { userId: 'a', totalValue: 100, joinedAt: t0 },
      { userId: 'b', totalValue: 300, joinedAt: t1 },
      { userId: 'c', totalValue: 200, joinedAt: t0 },
    ];
    expect(computeWinner(scores)).toBe('b');
  });

  it('tie is broken by earliest join (deterministic)', () => {
    const scores: ParticipantScore[] = [
      { userId: 'late', totalValue: 500, joinedAt: t1 },
      { userId: 'early', totalValue: 500, joinedAt: t0 },
    ];
    expect(computeWinner(scores)).toBe('early');
  });

  it('empty battle has no winner', () => {
    expect(computeWinner([])).toBeNull();
  });
});

describe('entryCost', () => {
  it('sums every round with case cycling', () => {
    const cases = [{ price: 100 }, { price: 250 }];
    expect(entryCost(cases, 1)).toBe(100);
    expect(entryCost(cases, 2)).toBe(350);
    expect(entryCost(cases, 4)).toBe(700); // 100+250+100+250
  });

  it('zero for empty case list', () => {
    expect(entryCost([], 3)).toBe(0);
  });
});

describe('inviteCodeValid', () => {
  it('accepts 4-8 uppercase alnum', () => {
    expect(inviteCodeValid('AB12')).toBe(true);
    expect(inviteCodeValid('X9Y8Z7')).toBe(true);
  });

  it('rejects bad formats', () => {
    expect(inviteCodeValid('ab12')).toBe(false);
    expect(inviteCodeValid('ABC')).toBe(false);
    expect(inviteCodeValid('TOOLONGCODE')).toBe(false);
  });
});

describe('rules', () => {
  it('player and round bounds match the spec', () => {
    expect(BATTLE_RULES.MIN_PLAYERS).toBe(2);
    expect(BATTLE_RULES.MAX_PLAYERS).toBe(4);
    expect(BATTLE_RULES.MIN_ROUNDS).toBe(1);
    expect(BATTLE_RULES.MAX_ROUNDS).toBe(10);
  });
});
