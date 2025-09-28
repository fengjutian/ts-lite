// 导入主要模块
import { run, example, exampleBad } from './runner.js';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { TypeChecker } from './typechecker.js';
import { CodeGen } from './codegen.js';
import * as Types from './types.js';
// 导出主要功能供外部使用
export { 
// 运行函数
run, 
// 主要类
Lexer, Parser, TypeChecker, CodeGen, 
// 示例代码
example, exampleBad, 
// 所有类型
Types };
// 当直接通过 Node.js 执行此文件时运行示例
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('\n--- Running good example ---');
    run(example);
    console.log('\n--- Running bad example ---');
    run(exampleBad);
}
