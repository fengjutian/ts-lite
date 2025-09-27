import { describe, it, expect } from 'vitest';
import { parse } from '../src/parser';

describe('Parser', () => {
  it('parses simple variable declaration', () => {
    const ast = parse('let x = 10;');
    expect(ast.type).toBe('Program');
    expect(ast.body.length).toBeGreaterThan(0);
  });
});
