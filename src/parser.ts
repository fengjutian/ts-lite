import { Token } from './types.ts';
import { TokenKind, TypeNode, ASTNode } from './schema.ts';

class Parser {
  tokens: Token[];
  i = 0;
  constructor(tokens: Token[]) { this.tokens = tokens; }

  peek(n = 0) { return this.tokens[this.i + n] ?? this.tokens[this.tokens.length - 1]; }
  eatIf(kind: TokenKind, value?: string) {
    const t = this.peek();
    if (t.kind === kind && (value === undefined || t.value === value)) { this.i++; return t; }
    return null;
  }
  expect(kind: TokenKind, value?: string) {
    const t = this.peek();
    if (t.kind === kind && (value === undefined || t.value === value)) { this.i++; return t; }
    throw new Error(`Parse Error at ${t.loc.start.line}:${t.loc.start.col} expected ${kind}${value ? " " + value : ""} got ${t.kind} ${t.value}`);
  }

  parseType(): TypeNode | undefined {
    const collect: TypeNode[] = [];
    const first = this.peek();
    if (first.kind !== TokenKind.Identifier) return undefined;

    collect.push({ kind: "Name", name: first.value });
    this.i++;

    while (this.peek().value === "|") {
        this.expect(TokenKind.Operator, "|");
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


  parsePrimary(): ASTNode {
    const t = this.peek();
    if (t.kind === TokenKind.Number) { this.i++; return { type: "NumberLiteral", value: Number(t.value), loc: t.loc }; }
    if (t.kind === TokenKind.String) { this.i++; return { type: "StringLiteral", value: t.value, loc: t.loc }; }
    if (t.kind === TokenKind.Identifier) { this.i++; return { type: "Identifier", name: t.value, loc: t.loc }; }
    if (t.value === "(") {
      this.expect(TokenKind.Punctuator, "(");
      const expr = this.parseExpression();
      this.expect(TokenKind.Punctuator, ")");
      return expr;
    }
    throw new Error(`Unexpected token ${t.kind} ${t.value} at ${t.loc.start.line}:${t.loc.start.col}`);
  }

  // parse optional type args after an identifier in a call site: <T, U>
  parseTypeArgsIfAny(): TypeNode[] | undefined {
    if (this.peek().value !== "<") return undefined;
    this.expect(TokenKind.Punctuator, "<");
    const out: TypeNode[] = [];
    while (this.peek().value !== ">") {
      const t = this.parseType();
      if (!t) throw new Error(`Invalid type arg at ${this.peek().loc.start.line}:${this.peek().loc.start.col}`);
      out.push(t);
      if (this.peek().value === ",") this.expect(TokenKind.Punctuator, ",");
      else break;
    }
    this.expect(TokenKind.Punctuator, ">");
    return out;
  }

  parseCallOrPrimary(): ASTNode {
    let node = this.parsePrimary();
    while (true) {
      // allow type args if the callee is an Identifier and next token is '<'
      if (this.peek().value === "<") {
        // parse type args only when it's followed by '(' soon (we'll allow here for simplicity)
        const typeArgs = this.parseTypeArgsIfAny();
        // attach to node by wrapping into a fake Call with zero args if no ( yet )? Simpler: store as part of Call when '(' encountered.
        // For our parser design, we will let typeArgs be consumed only if '(' follows; if not, we treat them as parse error.
        if (this.peek().value !== "(") {
          // type args must be followed by call parentheses in our tiny language (we won't support standalone type expressions).
          throw new Error(`Type arguments must be followed by a call at ${this.peek().loc.start.line}:${this.peek().loc.start.col}`);
        }
        // fallthrough to call parse and include typeArgs
        const loc = this.peek().loc;
        this.expect(TokenKind.Punctuator, "(");
        const args: ASTNode[] = [];
        while (this.peek().value !== ")") {
          args.push(this.parseExpression());
          if (this.peek().value === ",") this.expect(TokenKind.Punctuator, ",");
          else break;
        }
        this.expect(TokenKind.Punctuator, ")");
        node = { type: "Call", callee: node, typeArgs, args, loc };
        continue;
      }

      if (this.peek().value === "(") {
        const loc = this.peek().loc;
        this.expect(TokenKind.Punctuator, "(");
        const args: ASTNode[] = [];
        while (this.peek().value !== ")") {
          args.push(this.parseExpression());
          if (this.peek().value === ",") this.expect(TokenKind.Punctuator, ",");
          else break;
        }
        this.expect(TokenKind.Punctuator, ")");
        node = { type: "Call", callee: node, args, loc };
        continue;
      }
      break;
    }
    return node;
  }

  parseBinary(): ASTNode {
    let left = this.parseCallOrPrimary();
    while (this.peek().kind === TokenKind.Operator && ["+", "-", "*", "/", "|", "="].includes(this.peek().value)) {
      const op = this.peek().value; this.i++;
      const right = this.parseCallOrPrimary();
      left = { type: "Binary", op, left, right };
    }
    return left;
  }

  parseExpression(): ASTNode { return this.parseBinary(); }

  parseVarDecl(): ASTNode {
    const idTok = this.expect(TokenKind.Identifier);
    let typeAnn: TypeNode | undefined;
    if (this.peek().value === ":") { this.expect(TokenKind.Punctuator, ":"); typeAnn = this.parseType(); }
    let init: ASTNode | undefined;
    if (this.peek().value === "=") { this.expect(TokenKind.Operator, "="); init = this.parseExpression(); }
    this.expect(TokenKind.Punctuator, ";");
    return { type: "VarDecl", name: idTok.value, typeAnn, init, loc: idTok.loc };
  }

  parseFunction(): ASTNode {
    const nameTok = this.expect(TokenKind.Identifier);
    // optional type params like <T,U>
    let typeParams: string[] | undefined;
    if (this.peek().value === "<") {
      this.expect(TokenKind.Punctuator, "<");
      typeParams = [];
      while (this.peek().value !== ">") {
        const p = this.expect(TokenKind.Identifier);
        typeParams.push(p.value);
        if (this.peek().value === ",") this.expect(TokenKind.Punctuator, ",");
        else break;
      }
      this.expect(TokenKind.Punctuator, ">");
    }
    this.expect(TokenKind.Punctuator, "(");
    const params: { name: string; type?: TypeNode }[] = [];
    while (this.peek().value !== ")") {
      const p = this.expect(TokenKind.Identifier);
      let t: TypeNode | undefined;
      if (this.peek().value === ":") { this.expect(TokenKind.Punctuator, ":"); t = this.parseType(); }
      params.push({ name: p.value, type: t });
      if (this.peek().value === ",") this.expect(TokenKind.Punctuator, ",");
      else break;
    }
    this.expect(TokenKind.Punctuator, ")");
    let retType: TypeNode | undefined;
    if (this.peek().value === ":") { this.expect(TokenKind.Punctuator, ":"); retType = this.parseType(); }
    this.expect(TokenKind.Punctuator, "{");
    const body: ASTNode[] = [];
    while (this.peek().value !== "}") {
      if (this.peek().kind === TokenKind.Keyword && this.peek().value === "return") {
        const rt = this.peek(); this.expect(TokenKind.Keyword, "return");
        let expr: ASTNode | undefined;
        if (this.peek().value !== ";") expr = this.parseExpression();
        this.expect(TokenKind.Punctuator, ";");
        body.push({ type: "Return", expr, loc: rt.loc });
      } else if (this.peek().kind === TokenKind.Keyword && this.peek().value === "let") {
        this.expect(TokenKind.Keyword, "let");
        body.push(this.parseVarDecl());
      } else {
        const expr = this.parseExpression();
        if (this.peek().value === ";") this.expect(TokenKind.Punctuator, ";");
        body.push(expr);
      }
    }
    this.expect(TokenKind.Punctuator, "}");
    return { type: "FuncDecl", name: nameTok.value, typeParams, params, retType, body, loc: nameTok.loc };
  }

  parseProgram(): ASTNode {
    const body: ASTNode[] = [];
    while (this.peek().kind !== TokenKind.EOF) {
      if (this.peek().kind === TokenKind.Keyword && this.peek().value === "let") {
        this.expect(TokenKind.Keyword, "let");
        body.push(this.parseVarDecl());
        continue;
      }
      if (this.peek().kind === TokenKind.Keyword && this.peek().value === "function") {
        this.expect(TokenKind.Keyword, "function");
        body.push(this.parseFunction());
        continue;
      }
      // fallback: expression stmt
      const expr = this.parseExpression();
      if (this.peek().value === ";") this.expect(TokenKind.Punctuator, ";");
      body.push(expr);
    }
    return { type: "Program", body };
  }
}

export function parse(src: string) {
  const lexer = new (require('./lexer').Lexer)(src);
  const tokens = Array.from(lexer.tokens());
  return new Parser(tokens).parseProgram();
}
