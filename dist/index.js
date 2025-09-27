#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { run } from './runner.js';
const path = process.argv[2];
const code = readFileSync(path, 'utf8');
const result = run(code);
console.log(JSON.stringify(result, null, 2));
