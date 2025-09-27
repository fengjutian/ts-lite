#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { run } from './runner.js';

function main() {
  const path = process.argv[2];
  if (!path) {
    console.error('Usage: ts-lite <file>');
    process.exit(1);
  }
  try {
    const code = readFileSync(path, 'utf8');
    const result = run(code);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { run } from './runner.js';
export * from './lexer.js';
export * from './parser.js';
export * from './typechecker.js';
export * from './codegen.js';
export * from './schema.js';