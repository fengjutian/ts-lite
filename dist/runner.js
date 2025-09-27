import { tokenize } from './lexer.ts';
import { Parser } from './parser.ts';
import { typeCheck } from './typechecker.ts';
import { generateCode } from './codegen.js';
export function run(source) {
    const tokens = tokenize(source);
    const ast = new Parser(tokens).parseProgram();
    const errors = typeCheck(ast);
    const js = generateCode(ast);
    return { tokens, ast, errors, js };
}
