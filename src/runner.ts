import { tokenize } from './lexer.js';
import { parse } from './parser.js';
import { typeCheck } from './typechecker.js';
import { generateCode } from './codegen.js';
import { ASTNode } from './schema.js';

export function run(source: string): { tokens: any[]; ast: ASTNode; errors: any[]; js: string } {
  const tokens = tokenize(source);
  const ast = parse(source);
  const errors = typeCheck(ast);
  const js = generateCode(ast);
  return { tokens, ast, errors, js };
}
