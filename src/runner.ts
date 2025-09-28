import type { ASTNode } from './types.js';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { TypeChecker } from './typechecker.js';
import { CodeGen } from './codegen.js';
import { TypeErrorItem } from './types.js';

// 运行整个编译流程
export function run(src: string): { ast: ASTNode; errors: TypeErrorItem[]; js: string } {
  console.log('=== Source ===\n' + src);
  
  // 词法分析
  const lexer = new Lexer(src);
  const tokens = Array.from(lexer.tokens());
  
  // 语法分析
  const parser = new Parser(tokens);
  const ast = parser.parseProgram();
  
  // 类型检查
  const tc = new TypeChecker();
  tc.checkProgram(ast);
  if (tc.errors.length) {
    console.log('\n=== Type Errors ===');
    for (const e of tc.errors) {
      if (e.loc) 
        console.log(`Line ${e.loc.start.line}:${e.loc.start.col} - ${e.msg}`);
      else 
        console.log(e.msg);
    }
  } else {
    console.log('\n=== Type Check: OK ===');
  }
  
  // 代码生成
  const cg = new CodeGen();
  const js = cg.generate(ast);
  console.log('\n=== Emitted JS ===\n' + js);
  
  return { ast, errors: tc.errors, js };
}

// 好的示例代码
export const example = `
function id<T>(x: T): T { return x; }
let a = id(123);
let b = id<string>("hi");
let c: number | string;
c = 42;
c = "hello";
`;

// 坏的示例代码，展示联合类型/泛型错误
export const exampleBad = `
function id<T>(x: T): T { return x; }
let v: number | string;
v = true; // 应该报错

function foo<T>(x: T, y: T): T { return x; }
let z = foo(1, "s"); // 推断冲突 -> 当前允许但会警告参数不匹配
}`