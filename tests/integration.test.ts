import { describe, it, expect } from 'vitest';
import { run } from '../src/runner';

describe('Integration', () => {
  it('runs good example without crash', () => {
    const code = `
      function id<T>(x: T): T { return x; }
      let a = id(123);
      let b = id<string>("hi");
    `;
    const { errors } = run(code);
    expect(errors).toHaveLength(0);
  });
});
