import type { Token, ASTNode, TypeNode, Loc } from './types.js';
import { TokenKind } from './types.js';

// 语法分析器类
export class Parser {
  tokens: Token[];
  i = 0;
  
  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  // 预览当前标记或指定偏移量的标记
  peek(n = 0) {
    return this.tokens[this.i + n] ?? this.tokens[this.tokens.length - 1];
  }
  
  // 如果标记匹配则消费它
  eatIf(kind: TokenKind, value?: string) {
    const t = this.peek();
    if (t.kind === kind && (value === undefined || t.value === value)) {
      this.i++;
      return t;
    }
    return null;
  }
  
  // 期望并消费特定标记
  expect(kind: TokenKind, value?: string) {
    const t = this.peek();
    if (t.kind === kind && (value === undefined || t.value === value)) {
      this.i++;
      return t;
    }
    throw new Error(`Parse Error at ${t.loc.start.line}:${t.loc.start.col} expected ${kind}${value ? ' ' + value : ''} got ${t.kind} ${t.value}`);
  }

  // 解析类型表达式
  parseType(): TypeNode | undefined {
    const collect: TypeNode[] = [];
    const first = this.peek();
    if (first.kind !== TokenKind.Identifier) 
      return undefined;

    collect.push({ kind: "Name", name: first.value });
    this.i++;

    while (this.peek().value === '|') {
      this.expect(TokenKind.Operator, '|');
      const t = this.peek();
      if (t.kind === TokenKind.Identifier) {
        collect.push({ kind: "Name", name: t.value });
        this.i++;
      } else {
        throw new Error(`Expected type name after '|' at ${t.loc.start.line}:${t.loc.start.col}`);
      }
    }
    return collect.length === 1 ? collect[0] : { kind: "Union", members: collect };
  }

  // 解析基本表达式
  parsePrimary(): ASTNode {
    const t = this.peek();
    if (t.kind === TokenKind.Number) {
      this.i++;
      return { type: "NumberLiteral", value: Number(t.value), loc: t.loc };
    }
    if (t.kind === TokenKind.String) {
      this.i++;
      return { type: "StringLiteral", value: t.value, loc: t.loc };
    }
    if (t.kind === TokenKind.Identifier) {
      this.i++;
      return { type: "Identifier", name: t.value, loc: t.loc };
    }
    if (t.value === '(') {
      this.expect(TokenKind.Punctuator, '(');
      const expr = this.parseExpression();
      this.expect(TokenKind.Punctuator, ')');
      return expr;
    }
    throw new Error(`Unexpected token ${t.kind} ${t.value} at ${t.loc.start.line}:${t.loc.start.col}`);
  }

  // 解析标识符后可能的类型参数：<T, U>
  parseTypeArgsIfAny(): TypeNode[] | undefined {
    if (this.peek().value !== '<') 
      return undefined;
    
    this.expect(TokenKind.Punctuator, '<');
    const out: TypeNode[] = [];
    while (this.peek().value !== '>') {
      const t = this.parseType();
      if (!t) 
        throw new Error(`Invalid type arg at ${this.peek().loc.start.line}:${this.peek().loc.start.col}`);
      out.push(t);
      if (this.peek().value === ',') 
        this.expect(TokenKind.Punctuator, ',');
      else 
        break;
    }
    this.expect(TokenKind.Punctuator, '>');
    return out;
  }

  // 解析函数调用或基本表达式
  parseCallOrPrimary(): ASTNode {
    let node = this.parsePrimary();
    while (true) {
      // 如果调用者是标识符并且下一个标记是 '<'，则允许类型参数
      if (this.peek().value === '<') {
        // 解析类型参数，只有当 '<' 后面很快跟着 '(' 时（为了简单起见，我们在这里允许）
        const typeArgs = this.parseTypeArgsIfAny();
        // 在我们的语言中，类型参数后面必须跟着调用括号（我们不支持独立的类型表达式）。
        if (this.peek().value !== '(') {
          throw new Error(`Type arguments must be followed by a call at ${this.peek().loc.start.line}:${this.peek().loc.start.col}`);
        }
        // 继续解析调用并包含 typeArgs
        const loc = this.peek().loc;
        this.expect(TokenKind.Punctuator, '(');
        const args: ASTNode[] = [];
        while (this.peek().value !== ')') {
          args.push(this.parseExpression());
          if (this.peek().value === ',') 
            this.expect(TokenKind.Punctuator, ',');
          else 
            break;
        }
        this.expect(TokenKind.Punctuator, ')');
        node = { type: "Call", callee: node, typeArgs, args, loc };
        continue;
      }

      if (this.peek().value === '(') {
        const loc = this.peek().loc;
        this.expect(TokenKind.Punctuator, '(');
        const args: ASTNode[] = [];
        while (this.peek().value !== ')') {
          args.push(this.parseExpression());
          if (this.peek().value === ',') 
            this.expect(TokenKind.Punctuator, ',');
          else 
            break;
        }
        this.expect(TokenKind.Punctuator, ')');
        node = { type: "Call", callee: node, args, loc };
        continue;
      }
      break;
    }
    return node;
  }

  // 解析二元表达式
  parseBinary(): ASTNode {
    let left = this.parseCallOrPrimary();
    while (this.peek().kind === TokenKind.Operator && ['+', '-', '*', '/', '|', '='].includes(this.peek().value)) {
      const op = this.peek().value;
      this.i++;
      const right = this.parseCallOrPrimary();
      left = { type: "Binary", op, left, right };
    }
    return left;
  }

  // 解析表达式（在我们的语言中，表达式就是二元表达式）
  parseExpression(): ASTNode {
    return this.parseBinary();
  }

  // 解析变量声明
  parseVarDecl(): ASTNode {
    const idTok = this.expect(TokenKind.Identifier);
    let typeAnn: TypeNode | undefined;
    if (this.peek().value === ':') {
      this.expect(TokenKind.Punctuator, ':');
      typeAnn = this.parseType();
    }
    let init: ASTNode | undefined;
    if (this.peek().value === '=') {
      this.expect(TokenKind.Operator, '=');
      init = this.parseExpression();
    }
    this.expect(TokenKind.Punctuator, ';');
    return { type: "VarDecl", name: idTok.value, typeAnn, init, loc: idTok.loc };
  }

  // 解析函数定义
  parseFunction(): ASTNode {
    const nameTok = this.expect(TokenKind.Identifier);
    // 可选的类型参数，如 <T,U>
    let typeParams: string[] | undefined;
    if (this.peek().value === '<') {
      this.expect(TokenKind.Punctuator, '<');
      typeParams = [];
      while (this.peek().value !== '>') {
        const p = this.expect(TokenKind.Identifier);
        typeParams.push(p.value);
        if (this.peek().value === ',') 
          this.expect(TokenKind.Punctuator, ',');
        else 
          break;
      }
      this.expect(TokenKind.Punctuator, '>');
    }
    this.expect(TokenKind.Punctuator, '(');
    const params: { name: string; type?: TypeNode }[] = [];
    while (this.peek().value !== ')') {
      const p = this.expect(TokenKind.Identifier);
      let t: TypeNode | undefined;
      if (this.peek().value === ':') {
        this.expect(TokenKind.Punctuator, ':');
        t = this.parseType();
      }
      params.push({ name: p.value, type: t });
      if (this.peek().value === ',') 
        this.expect(TokenKind.Punctuator, ',');
      else 
        break;
    }
    this.expect(TokenKind.Punctuator, ')');
    let retType: TypeNode | undefined;
    if (this.peek().value === ':') {
      this.expect(TokenKind.Punctuator, ':');
      retType = this.parseType();
    }
    this.expect(TokenKind.Punctuator, '{');
    const body: ASTNode[] = [];
    while (this.peek().value !== '}') {
      if (this.peek().kind === TokenKind.Keyword && this.peek().value === 'return') {
        const rt = this.peek();
        this.expect(TokenKind.Keyword, 'return');
        let expr: ASTNode | undefined;
        if (this.peek().value !== ';') 
          expr = this.parseExpression();
        this.expect(TokenKind.Punctuator, ';');
        body.push({ type: "Return", expr, loc: rt.loc });
      } else if (this.peek().kind === TokenKind.Keyword && this.peek().value === 'let') {
        this.expect(TokenKind.Keyword, 'let');
        body.push(this.parseVarDecl());
      } else {
        const expr = this.parseExpression();
        if (this.peek().value === ';') 
          this.expect(TokenKind.Punctuator, ';');
        body.push(expr);
      }
    }
    this.expect(TokenKind.Punctuator, '}');
    return { type: "FuncDecl", name: nameTok.value, typeParams, params, retType, body, loc: nameTok.loc };
  }

  // 解析整个程序
  parseProgram(): ASTNode {
    const body: ASTNode[] = [];
    while (this.peek().kind !== TokenKind.EOF) {
      if (this.peek().kind === TokenKind.Keyword && this.peek().value === 'let') {
        this.expect(TokenKind.Keyword, 'let');
        body.push(this.parseVarDecl());
        continue;
      }
      if (this.peek().kind === TokenKind.Keyword && this.peek().value === 'function') {
        this.expect(TokenKind.Keyword, 'function');
        body.push(this.parseFunction());
        continue;
      }
      // 后备：表达式语句
      const expr = this.parseExpression();
      if (this.peek().value === ';') 
        this.expect(TokenKind.Punctuator, ';');
      body.push(expr);
    }
    return { type: "Program", body };
  }
}