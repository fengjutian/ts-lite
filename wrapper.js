#!/usr/bin/env node
import fs from 'fs/promises';
import { run } from './src/runner.js';

// 简单的包装脚本，用于演示如何从文件读取代码
async function main() {
  try {
    console.log('Reading file basic-example.ts...');
    const code = await fs.readFile('./basic-example.ts', 'utf-8');
    console.log('File content:', code);
    console.log('Running code...');
    const result = run(code);
    console.log('Run completed successfully');
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
  }
}

main();