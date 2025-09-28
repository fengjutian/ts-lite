# ts-lite

一个简单的 TypeScript 编译器实现，用于学习目的。

## 功能特性

- 词法分析（Lexer）：将源代码转换为标记流
- 语法分析（Parser）：构建抽象语法树（AST）
- 类型检查（TypeChecker）：进行类型验证，支持基本类型、联合类型和泛型
- 代码生成（CodeGen）：生成 JavaScript 代码（进行类型擦除）

## 安装

```bash
# 安装依赖
npm install

# 编译 TypeScript 代码
npm run build
```

## 使用方法

### 作为命令行工具

```bash
# 直接执行代码字符串
./dist/ts-lite.js "let x: number = 42; console.log(x);"

# 从文件读取代码
./dist/ts-lite.js --file path/to/file.ts
```

### 作为库使用

```javascript
import { run } from 'ts-lite';

// 运行代码
run('let x: number = 42;');
```

## 开发

```bash
# 运行开发服务器
npm start

# 运行测试
npm test
```

## 项目结构

```
src/
  ├── types.ts         # 类型定义
  ├── lexer.ts         # 词法分析器
  ├── parser.ts        # 语法分析器
  ├── typechecker.ts   # 类型检查器
  ├── codegen.ts       # 代码生成器
  ├── runner.ts        # 运行器，整合所有编译阶段
  ├── index.ts         # 库入口点
  └── ts-lite.ts       # 命令行工具入口点
```

## 支持的 TypeScript 特性

- 基本类型：`number`, `string`, `boolean`, `any`
- 联合类型：`number | string`
- 泛型：`function id<T>(x: T): T { return x; }`
- 函数声明和调用
- 变量声明和赋值
- 二元运算

## 限制

这是一个简化版的实现，有许多 TypeScript 特性不支持，例如：
- 类和接口
- 高级类型（如交叉类型、映射类型等）
- 模块系统
- 装饰器
- 类型断言
- 等其他高级特性

## 许可证

MIT