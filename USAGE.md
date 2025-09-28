# ts-lite 命令行工具使用指南

本指南详细介绍如何安装、构建和使用 `ts-lite.ts` 命令行工具来编译和运行 TypeScript 代码。

## 一、安装和构建

### 1. 安装依赖

在使用 ts-lite 工具前，需要先安装项目依赖：

```bash
npm install
```

### 2. 编译项目

将 TypeScript 代码编译成 JavaScript：

```bash
npm run build
```

编译后的文件将生成在 `dist/` 目录中。

## 二、使用方法

`ts-lite.ts` 命令行工具支持两种主要的使用方式：

### 方式一：直接执行编译后的 JavaScript 文件

编译后，可以直接运行生成的 `dist/ts-lite.js` 文件：

#### 1. 直接执行代码字符串

```bash
./dist/ts-lite.js "let x: number = 42; console.log(x);"
```

或者通过 npm bin 命令：

```bash
npx ts-lite "let x: number = 42; console.log(x);"
```

#### 2. 从文件读取代码

```bash
./dist/ts-lite.js --file example.ts
```

### 方式二：在开发模式下直接运行 TypeScript 文件

无需编译，可以使用项目提供的 npm 脚本直接运行 TypeScript 源码：

#### 1. 使用项目提供的 npm start 脚本

```bash
# 直接运行工具，不带参数
npm start

# 运行工具并传入代码字符串参数
npm start -- "let x: number = 42; console.log(x);"

# 运行工具并指定文件路径
npm start -- --file example.ts
```

这种方式使用了特殊的 Node.js 导入方式来注册 ts-node/esm 加载器，可以直接运行 TypeScript 文件。

## 三、命令行参数说明

`ts-lite.ts` 支持以下命令行参数：

- **无参数**：显示使用帮助信息
- **代码字符串**：直接执行提供的 TypeScript 代码字符串
- `--file <path>`：从指定的文件中读取并执行 TypeScript 代码

## 四、工具执行流程

当你运行 `ts-lite.ts` 工具时，它会执行以下步骤：

1. **解析命令行参数**：确定是直接执行代码字符串还是从文件读取
2. **词法分析**：使用 `Lexer` 类将源代码转换为标记流
3. **语法分析**：使用 `Parser` 类构建抽象语法树（AST）
4. **类型检查**：使用 `TypeChecker` 类进行类型验证
5. **代码生成**：使用 `CodeGen` 类生成 JavaScript 代码（进行类型擦除）
6. **输出结果**：显示源代码、类型检查结果和生成的 JavaScript 代码

## 五、输出示例

运行 `ts-lite.ts` 后，你将看到类似以下的输出：

```
=== Source ===
let x: number = 42;
console.log(x);

=== Type Check: OK ===

=== Emitted JS ===
let x = 42;
console.log(x);
```

如果存在类型错误，将会在 "Type Errors" 部分显示错误信息。

## 六、常见问题解答

### 1. 为什么直接使用 `ts-node src/ts-lite.ts` 会出错？

这是因为项目使用了 ES 模块格式（`"type": "module"`），直接使用 ts-node 运行会遇到扩展名错误。需要使用项目提供的 npm 脚本或特殊的 Node.js 导入方式。

### 2. 如何调试 ts-lite 工具？

项目提供了调试脚本：

```bash
npm run debug
```

这会启动 Node.js 调试器，你可以使用 Chrome DevTools 或其他调试工具连接进行调试。

### 3. ts-lite 支持哪些 TypeScript 特性？

- 基本类型：`number`, `string`, `boolean`, `any`
- 联合类型：`number | string`
- 泛型：`function id<T>(x: T): T { return x; }`
- 函数声明和调用
- 变量声明和赋值
- 二元运算

注意：这是一个简化版的实现，不支持类、接口、高级类型等复杂特性。

## 七、示例

### 简单表达式

```bash
npm start -- "let x: number = 42; let y: string = \"Hello\"; console.log(x, y);"
```

### 使用泛型

```bash
npm start -- "function identity<T>(value: T): T { return value; } let num = identity(100); let str = identity(\"TypeScript\");"
```

### 使用示例文件

创建一个 `example.ts` 文件，然后运行：

```bash
npm start -- --file example.ts
```

## 八、注意事项

1. ts-lite 是一个教学目的的简化版编译器，不适合用于生产环境
2. 代码中使用的类型注解会在生成的 JavaScript 代码中被擦除
3. 类型检查功能有限，可能无法捕获所有类型错误
4. 如需更完整的 TypeScript 功能，请使用官方的 TypeScript 编译器