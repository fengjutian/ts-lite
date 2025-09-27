import { describe, it, expect } from 'vitest';
import { tokenize } from '../src/lexer';

describe('Lexer', () => {
  it('tokenizes numbers, identifiers, operators', () => {
    const tokens = tokenize('let a = 42');
    expect(tokens.map(t => t.value)).toEqual(['let', 'a', '=', '42']);
  });

  it('skips // comments', () => {
    const tokens = tokenize('let a = 1 // comment');
    const vals = tokens.map(t => t.value);
    expect(vals).toContain('let');
    expect(vals).not.toContain('/');
  });

  it('handles /* block comments */', () => {
    const tokens = tokenize('let a = /* hi */ 2');
    expect(tokens.find(t => t.value === '2')).toBeTruthy();
  });

  it('recognizes => operator', () => {
    const tokens = tokenize('x => x + 1');
    expect(tokens.map(t => t.value)).toContain('=>');
  });
});
