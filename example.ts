// 简单的 TypeScript 示例代码

// 变量声明和类型注解
let x: number = 42;
let y: string = "Hello, TypeScript!";
let z: boolean = true;

// 函数声明和泛型
export function identity<T>(value: T): T {
  return value;
}

// 联合类型
function processValue(value: number | string): void {
  if (typeof(value) === 'number') {
    console.log(`Processing number: ${value}`);
  } else {
    console.log(`Processing string: ${value}`);
  }
}

// 二元运算
let result: number = x + 8;

// 函数调用
const num = identity(100);
const str = identity("TypeScript");

processValue(num);
processValue(str);

console.log(`Result: ${result}`);