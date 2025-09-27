import { describe, it, expect } from 'vitest';
import { run } from '../src/runner';

describe('TypeChecker', () => {
  it('flags type mismatch', () => {
    const code = `
      function id<T>(x: T): T { return x; }
      let v: number;
      v = "oops";
    `;
    const result = run(code);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
