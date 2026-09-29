import { Injectable } from '@nestjs/common';
import { randomBytes, randomInt, createHash } from 'node:crypto';

export const UINT32_SPAN = 0x1_0000_0000; // 2^32

/**
 * Central, cryptographically secure RNG for ALL server game logic.
 * Never use Math.random() for rewards — every roll is auditable:
 * we store the hex seed and the raw uint32 roll next to each outcome.
 */
@Injectable()
export class RandomService {
  /** Uniform uint32 in [0, 2^32). */
  nextUint32(): number {
    // randomInt is exclusive of the upper bound → [0, 2^32 - 1] covers the range.
    return randomInt(0, UINT32_SPAN - 1);
  }

  /** Fresh hex seed for audit records. */
  seedHex(bytes = 8): string {
    return randomBytes(bytes).toString('hex');
  }

  sha256(input: string): string {
    return createHash('sha256').update(input).digest('hex');
  }

  /**
   * Weighted pick. `roll` is a uniform uint32; weights need not be normalized.
   * Returns the index of the chosen entry.
   */
  pickWeightedIndex(weights: number[], roll: number): number {
    const total = weights.reduce((a, b) => a + b, 0);
    if (total <= 0) throw new Error('pickWeightedIndex: total weight must be > 0');
    let threshold = (roll / UINT32_SPAN) * total;
    for (let i = 0; i < weights.length; i++) {
      threshold -= weights[i]!;
      if (threshold < 0) return i;
    }
    return weights.length - 1;
  }
}
