/** Deterministic PRNG so the demo workspace is identical on every seed. */
export function createRandom(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    // mulberry32
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const rng = {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    float: (min: number, max: number, digits = 1) => Number((next() * (max - min) + min).toFixed(digits)),
    chance: (p: number) => next() < p,
    pick: <T>(items: readonly T[]): T => {
      if (items.length === 0) throw new Error('pick() from empty list');
      return items[Math.floor(next() * items.length)]!;
    },
    pickSome: <T>(items: readonly T[], min: number, max: number): T[] => {
      const count = Math.min(items.length, rng.int(min, max));
      return rng.shuffle(items).slice(0, count);
    },
    shuffle: <T>(items: readonly T[]): T[] => {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j]!, copy[i]!];
      }
      return copy;
    },
    weighted: <T>(entries: ReadonlyArray<readonly [T, number]>): T => {
      const total = entries.reduce((sum, [, w]) => sum + w, 0);
      let roll = next() * total;
      for (const [value, weight] of entries) {
        roll -= weight;
        if (roll <= 0) return value;
      }
      return entries[entries.length - 1]![0];
    },
  };
  return rng;
}

export type Random = ReturnType<typeof createRandom>;
