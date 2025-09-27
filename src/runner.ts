import { tokenize } from './lexer.ts';
import { Parser } from './parser.ts';
import { typeCheck } from './typechecker.ts';

export function run(source: string) {
  const tokens = tokenize(source);
  const ast = new Parser(tokens).parseProgram();
  const errors = typeCheck(ast);
  return { tokens, ast, errors };
}
