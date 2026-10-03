import { evenlySpacedPositions, POSITION_STEP, positionBetween } from './position.js';

describe('positionBetween', () => {
  it('starts an empty column at 0', () => {
    expect(positionBetween(null, null)).toBe(0);
  });

  it('goes above the first card or below the last one', () => {
    expect(positionBetween(null, 10)).toBe(10 - POSITION_STEP);
    expect(positionBetween(10, null)).toBe(10 + POSITION_STEP);
  });

  it('goes halfway between two cards', () => {
    expect(positionBetween(0, 1024)).toBe(512);
  });

  it('signals renumbering when the neighbours are too close', () => {
    expect(positionBetween(1, 1 + 1e-9)).toBeNull();
  });

  it('can split the same gap many times before needing to renumber', () => {
    let after = POSITION_STEP;
    let splits = 0;
    while (positionBetween(0, after) !== null && splits < 100) {
      after = positionBetween(0, after)!;
      splits++;
    }
    expect(splits).toBeGreaterThan(25);
  });
});

describe('evenlySpacedPositions', () => {
  it('spaces cards by the step', () => {
    expect(evenlySpacedPositions(3)).toEqual([0, 1024, 2048]);
  });
});
