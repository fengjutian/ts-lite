// myts-lite-advanced-full.ts
// Minimal TypeScript-like language (single file)
// Features: lexer, parser, AST, type checker with Union Types and basic Generics, and type-erasing CodeGen.
// Run: npx ts-node myts-lite-advanced-full.ts

type Pos = { line: number; col: number };
type Loc = { start: Pos; end: Pos };

// ---------- Tokens ----------
enum TokenKind {
  Identifier = "Identifier",
  Number = "Number",
  String = "String",
  Keyword = "Keyword",
  Punctuator = "Punctuator",
  Operator = "Operator",
  EOF = "EOF",
}

interface Token {
  kind: TokenKind;
  value: string;
  loc: Loc;
}

// ---------- Lexer ----------
class Lexer {
  src: string;
  idx = 0;
  constructor(src: string) { this.src = src; }

  peek(n = 0) { return this.src[this.idx + n] ?? ""; }
  nextChar() {
    const ch = this.src[this.idx++] ?? "";
    return ch;
  }

  makeLoc(startIdx: number, endIdx: number): Loc {
    const sub = this.src.slice(0, startIdx);
    const startLine = (sub.match(/\n/g) || []).length + 1;
    const startCol = startLine === 1 ? sub.length + 1 : sub.slice(sub.lastIndexOf("\n") + 1).length + 1;
    const sub2 = this.src.slice(0, endIdx);
    const endLine = (sub2.match(/\n/g) || []).length + 1;
    const endCol = endLine === 1 ? sub2.length + 1 : sub2.slice(sub2.lastIndexOf("\n") + 1).length + 1;
    return { start: { line: startLine, col: startCol }, end: { line: endLine, col: endCol } };
  }

  isAlpha(ch: string) { return /[A-Za-z_]/.test(ch); }
  isDigit(ch: string) { return /[0-9]/.test(ch); }
  isAlphaNum(ch: string) { return this.isAlpha(ch) || this.isDigit(ch); }

  *tokens(): Generator<Token> {
    const kw = new Set(["let", "function", "return", "type"]);
    while (this.idx < this.src.length) {
      const start = this.idx;
      let ch = this.peek();
      // whitespace
      if (/\s/.test(ch)) { this.nextChar(); continue; }

      // two-char operator check MUST come before single-char operator handling
      const two = this.peek(0) + this.peek(1);
      if (two === "=>") { this.nextChar(); this.nextChar(); const loc = this.makeLoc(start, this.idx); yield { kind: TokenKind.Operator, value: "=>", loc }; continue; }

      // comments: must check before treating '/' as operator
      if (ch === "/") {
        if (this.peek(1) === "/") {
          // single-line comment: consume until newline (but keep newline for outer loop)
          this.nextChar(); // consume '/'
          this.nextChar(); // consume second '/'
          while (this.peek() && this.peek() !== "\n") this.nextChar();
          continue; // skip comment
        } else if (this.peek(1) === "*") {
          // block comment
          this.nextChar(); // '/'
          this.nextChar(); // '*'
          while (this.idx < this.src.length) {
            if (this.peek() === "*" && this.peek(1) === "/") { this.nextChar(); this.nextChar(); break; }
            this.nextChar();
          }
          continue; // skip comment
        }
      }

      // punctuation (treat < and > as punctuators for type args)
      if ("(){}:;,[].<>".includes(ch)) {
        this.nextChar();
        const loc = this.makeLoc(start, this.idx);
        yield { kind: TokenKind.Punctuator, value: ch, loc };
        continue;
      }

      // operator single-char (note '/' handled here only if not a comment)
      if ("=+-*/|".includes(ch)) {
        this.nextChar();
        const loc = this.makeLoc(start, this.idx);
        yield { kind: TokenKind.Operator, value: ch, loc };
        continue;
      }

      // identifier / keyword
      if (this.isAlpha(ch)) {
        let s = "";
        while (this.isAlphaNum(this.peek())) s += this.nextChar();
        const loc = this.makeLoc(start, this.idx);
        yield { kind: kw.has(s) ? TokenKind.Keyword : TokenKind.Identifier, value: s, loc };
        continue;
      }

      // number
      if (this.isDigit(ch)) {
        let s = "";
        while (this.isDigit(this.peek())) s += this.nextChar();
        if (this.peek() === ".") { s += this.nextChar(); while (this.isDigit(this.peek())) s += this.nextChar(); }
        const loc = this.makeLoc(start, this.idx);
        yield { kind: TokenKind.Number, value: s, loc };
        continue;
      }

      // string
      if (ch === '"' || ch === "'") {
        const quote = this.nextChar();
        let s = "";
        while (this.peek() && this.peek() !== quote) {
          if (this.peek() === "\\") { this.nextChar(); s += this.nextChar(); }
          else s += this.nextChar();
        }
        if (this.peek() === quote) this.nextChar();
        const loc = this.makeLoc(start, this.idx);
        yield { kind: TokenKind.String, value: s, loc };
        continue;
      }

      // unknown -> skip single char (could also throw)
      this.nextChar();
    }
    const eofLoc = this.makeLoc(this.idx, this.idx);
    yield { kind: TokenKind.EOF, value: "", loc: eofLoc };
  }



}

// ---------- AST Types ----------
type TypeNode =
  | { kind: "Name"; name: string }
  | { kind: "Union"; members: TypeNode[] }
  | { kind: "Var"; name: string };

type ASTNode =
  | { type: "Program"; body: ASTNode[] }
  | { type: "VarDecl"; name: string; typeAnn?: TypeNode; init?: ASTNode; loc?: Loc }
  | { type: "FuncDecl"; name: string; typeParams?: string[]; params: { name: string; type?: TypeNode }[]; retType?: TypeNode; body: ASTNode[]; loc?: Loc }
  | { type: "Return"; expr?: ASTNode; loc?: Loc }
  | { type: "Binary"; op: string; left: ASTNode; right: ASTNode; loc?: Loc }
  | { type: "Call"; callee: ASTNode; typeArgs?: TypeNode[]; args: ASTNode[]; loc?: Loc }
  | { type: "Identifier"; name: string; loc?: Loc }
  | { type: "NumberLiteral"; value: number; loc?: Loc }
  | { type: "StringLiteral"; value: string; loc?: Loc };

// ---------- Parser ----------
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

// ---------- Type System ----------
type Type =
  | { tag: "number" }
  | { tag: "string" }
  | { tag: "boolean" }
  | { tag: "any" }
  | { tag: "var"; name: string } // generic type parameter like T
  | { tag: "union"; types: Type[] }
  | { tag: "func"; params: Type[]; ret: Type; typeParams?: string[] };

const NUMBER: Type = { tag: "number" };
const STRING: Type = { tag: "string" };
const BOOLEAN: Type = { tag: "boolean" };
const ANY: Type = { tag: "any" };

function typeToString(t: Type): string {
  switch (t.tag) {
    case "number": return "number";
    case "string": return "string";
    case "boolean": return "boolean";
    case "any": return "any";
    case "var": return t.name;
    case "union": return t.types.map(typeToString).join(" | ");
    case "func": return `<${t.typeParams?.join(",") ?? ""}>(${t.params.map(typeToString).join(",")})=>${typeToString(t.ret)}`;
  }
}

// Convert TypeNode -> Type, with generics producing var types
function typeFromNode(node?: TypeNode, typeParamNames?: Set<string>): Type {
  if (!node) return ANY;
  if (node.kind === "Name") {
    if (node.name === "number") return NUMBER;
    if (node.name === "string") return STRING;
    if (node.name === "boolean") return BOOLEAN;
    // treat unknown as any unless it's a type param
    if (typeParamNames && typeParamNames.has(node.name)) return { tag: "var", name: node.name };
    return ANY;
  }
  if (node.kind === "Var") {
    if (typeParamNames && typeParamNames.has(node.name)) return { tag: "var", name: node.name };
    return ANY;
  }
  if (node.kind === "Union") {
    return { tag: "union", types: node.members.map(m => typeFromNode(m, typeParamNames)) };
  }
  return ANY;
}

// Substitute generic type vars using map
function substituteGenerics(t: Type, map: Map<string, Type>): Type {
  if (!t) return ANY;
  if (t.tag === "var") return map.get(t.name) ?? ANY;
  if (t.tag === "union") return { tag: "union", types: t.types.map(x => substituteGenerics(x, map)) };
  if (t.tag === "func") {
    // don't substitute the function's own type params
    return { tag: "func", params: t.params.map(p => substituteGenerics(p, map)), ret: substituteGenerics(t.ret, map), typeParams: t.typeParams };
  }
  return t;
}

// Compatibility check with support for unions and generics (vars considered flexible)
function isCompatible(a: Type, b: Type): boolean {
  if (!a || !b) return false;
  if (b.tag === "any" || a.tag === "any") return true;
  if (b.tag === "union") {
    // if target is union, source must be compatible with at least one member
    return b.types.some(bt => isCompatible(a, bt));
  }
  if (a.tag === "union") {
    // source union: every member must be compatible with target
    return a.types.every(at => isCompatible(at, b));
  }
  if (a.tag === "var" || b.tag === "var") {
    // generic param — treat as compatible (we'll rely on inference to specialize)
    return true;
  }
  if (a.tag === "func" && b.tag === "func") {
    if ((a.params.length !== b.params.length)) return false;
    for (let i = 0; i < a.params.length; i++) {
      // contravariant params: target param must be compatible with source param for safe assignment
      if (!isCompatible(b.params[i], a.params[i])) return false;
    }
    return isCompatible(a.ret, b.ret);
  }
  return a.tag === b.tag;
}

class TypeErrorItem {
  msg: string;
  loc?: Loc;
  constructor(msg: string, loc?: Loc) { this.msg = msg; this.loc = loc; }
}

// ---------- Type Checker (with union & basic generics) ----------
class TypeChecker {
  errors: TypeErrorItem[] = [];
  globals = new Map<string, Type>(); // function / value types globally

  checkProgram(prog: ASTNode) {
    if (prog.type !== "Program") throw new Error("expected program");
    // pre-declare function names so recursion/hoisting works
    for (const node of prog.body) {
      if (node.type === "FuncDecl") {
        // params/ret default to any for now; we'll refine in checkNode
        const t: Type = { tag: "func", params: node.params.map(_ => ANY), ret: ANY, typeParams: node.typeParams };
        this.globals.set(node.name, t);
      }
    }
    for (const node of prog.body) this.checkNode(node, new Map());
  }

  checkNode(node: ASTNode, env: Map<string, Type>): Type | undefined {
    switch (node.type) {
      case "Program": throw new Error("not expected");
      case "VarDecl": {
        let t: Type;
        if (node.typeAnn) {
          t = typeFromNode(node.typeAnn, new Set());
        } else if (node.init) {
          t = this.checkNode(node.init, env) ?? ANY;
        } else t = ANY;
        env.set(node.name, t);
        return t;
      }
      case "NumberLiteral": return NUMBER;
      case "StringLiteral": return STRING;
      case "Identifier": {
        if (env.has(node.name)) return env.get(node.name)!;
        if (this.globals.has(node.name)) return this.globals.get(node.name)!;
        this.errors.push(new TypeErrorItem(`Undefined identifier '${node.name}'`, node.loc));
        return ANY;
      }
      case "Binary": {
        const L = this.checkNode(node.left, env) ?? ANY;
        const R = this.checkNode(node.right, env) ?? ANY;
        if (node.op === "+") {
          if (L.tag === "number" && R.tag === "number") return NUMBER;
          if (L.tag === "string" && R.tag === "string") return STRING;
          // if union involved, try compatible combos
          if (L.tag === "union" || R.tag === "union") {
            // if any combination yields valid + (string|string or number|number) allow
            // simple approach: if both types are subsets of number or subsets of string => ok
            const leftIsNumberish = (L.tag === "number") || (L.tag === "union" && L.types.every(t => t.tag === "number"));
            const rightIsNumberish = (R.tag === "number") || (R.tag === "union" && R.types.every(t => t.tag === "number"));
            const leftIsStringish = (L.tag === "string") || (L.tag === "union" && L.types.every(t => t.tag === "string"));
            const rightIsStringish = (R.tag === "string") || (R.tag === "union" && R.types.every(t => t.tag === "string"));
            if ((leftIsNumberish && rightIsNumberish)) return NUMBER;
            if ((leftIsStringish && rightIsStringish)) return STRING;
          }
          this.errors.push(new TypeErrorItem(`Incompatible operands for '+' : ${typeToString(L)} and ${typeToString(R)}`, node.loc));
          return ANY;
        }
        if (["-", "*", "/","<",">"].includes(node.op)) {
          if (L.tag === "number" && R.tag === "number") return NUMBER;
          this.errors.push(new TypeErrorItem(`Operator '${node.op}' expects numbers, got ${typeToString(L)} and ${typeToString(R)}`, node.loc));
          return ANY;
        }
        if (node.op === "=") {
          // treat as equality, return boolean
          return BOOLEAN;
        }
        return ANY;
      }
      case "Call": {
        const calleeType = this.checkNode(node.callee, env) ?? ANY;
        const argTypes = node.args.map(a => this.checkNode(a, env) ?? ANY);

        if (calleeType.tag === "func") {
          let fnType = calleeType as Extract<Type, { tag: "func" }>;
          if (calleeType.typeParams && calleeType.typeParams.length > 0) {
            const subst = new Map<string, Type>();
            if (node.typeArgs && node.typeArgs.length > 0) {
              for (let i = 0; i < calleeType.typeParams!.length; i++) {
                const name = calleeType.typeParams![i];
                const argNode = node.typeArgs[i];
                const t = argNode ? typeFromNode(argNode) : ANY;
                subst.set(name, t);
              }
            } else {
              for (let i = 0; i < Math.min(calleeType.params.length, argTypes.length); i++) {
                const pType = calleeType.params[i];
                const aType = argTypes[i];
                if (pType.tag === "var") subst.set(pType.name, aType);
              }
            }
            fnType = substituteGenerics(calleeType, subst) as Extract<Type, { tag: "func" }>;
          }
          if (argTypes.length !== fnType.params.length) {
            this.errors.push(new TypeErrorItem(`Function expected ${fnType.params.length} args but got ${argTypes.length}`, node.loc));
          } else {
            for (let i = 0; i < Math.min(argTypes.length, fnType.params.length); i++) {
              if (!isCompatible(argTypes[i], fnType.params[i])) {
                this.errors.push(new TypeErrorItem(`Argument ${i+1} type ${typeToString(argTypes[i])} not compatible with parameter type ${typeToString(fnType.params[i])}`, node.loc));
              }
            }
          }
          return fnType.ret;
        }
        this.errors.push(new TypeErrorItem(`Called object is not a function (${typeToString(calleeType)})`, node.loc));
        return ANY;
      }
      case "FuncDecl": {
        // prepare local env
        const local = new Map<string, Type>();
        const typeParamSet = new Set<string>(node.typeParams ?? []);
        // parameter types: convert TypeNode -> Type, respecting type params
        const paramTypes: Type[] = node.params.map(p => p.type ? typeFromNode(p.type, typeParamSet) : ANY);
        // return type
        let retType: Type = node.retType ? typeFromNode(node.retType, typeParamSet) : ANY;

        // set params into local
        for (let i = 0; i < node.params.length; i++) {
          local.set(node.params[i].name, paramTypes[i]);
        }

        // check body; allow inference of return type if not annotated
        for (const stmt of node.body) {
          if (stmt.type === "Return") {
            const r = stmt.expr ? this.checkNode(stmt.expr, local) : ANY;
            if (node.retType) {
              if (!isCompatible(r as Type, retType)) {
                this.errors.push(new TypeErrorItem(`Return type ${typeToString(r as Type)} not assignable to function return type ${typeToString(retType)}`, stmt.loc));
              }
            } else {
              // infer return type as the first return found (simple)
              if ((r as Type).tag) retType = r as Type;
            }
          } else {
            this.checkNode(stmt, local);
          }
        }

        // register function type in globals (with its typeParams names)
        const fnType: Type = { tag: "func", params: paramTypes, ret: retType, typeParams: node.typeParams };
        this.globals.set(node.name, fnType);
        return fnType;
      }
      case "Return": return node.expr ? this.checkNode(node.expr, env) : ANY;
      default:
        return ANY;
    }
  }
}

// ---------- CodeGen (type erasure) ----------
class CodeGen {
  generate(node: ASTNode): string {
    switch (node.type) {
      case "Program": return node.body.map(n => this.generate(n)).join("\n");
      case "VarDecl": {
        const init = node.init ? ` = ${this.generate(node.init)}` : "";
        return `let ${node.name}${init};`;
      }
      case "NumberLiteral": return String(node.value);
      case "StringLiteral": return JSON.stringify(node.value);
      case "Identifier": return node.name;
      case "Binary": return `${this.generate(node.left)} ${node.op} ${this.generate(node.right)}`;
      case "Call": {
        const typeArgs = node.typeArgs && node.typeArgs.length > 0 ? `/*<${node.typeArgs.map(t => t.kind === "Name" ? t.name : "?" ).join(",")}>*/` : "";
        return `${this.generate(node.callee)}(${node.args.map(a => this.generate(a)).join(", ")})`;
      }
      case "FuncDecl": {
        const params = node.params.map(p => p.name).join(", ");
        const body = node.body.map(s => this.generate(s)).join("\n");
        return `function ${node.name}(${params}) {\n${this.indent(body)}\n}`;
      }
      case "Return": return `return ${node.expr ? this.generate(node.expr) : ""};`;
      default: return "/* unsupported */";
    }
  }
  indent(s: string) { return s.split("\n").map(l => l ? "  " + l : "").join("\n"); }
}

// ---------- Examples & Runner ----------
const example = `
function id<T>(x: T): T { return x; }
let a = id(123);
let b = id<string>("hi");
let c: number | string;
c = 42;
c = "hello";
`;

// bad example to show union/generic failure
const exampleBad = `
function id<T>(x: T): T { return x; }
let v: number | string;
v = true; // should error

function foo<T>(x: T, y: T): T { return x; }
let z = foo(1, "s"); // inference conflict -> currently permissive but will warn on param mismatch
`;

function run(src: string) {
  console.log("=== Source ===\n" + src);
  const lexer = new Lexer(src);
  const tokens = Array.from(lexer.tokens());
  // parse
  const parser = new Parser(tokens);
  const ast = parser.parseProgram();
  // typecheck
  const tc = new TypeChecker();
  tc.checkProgram(ast);
  if (tc.errors.length) {
    console.log("\n=== Type Errors ===");
    for (const e of tc.errors) {
      if (e.loc) console.log(`Line ${e.loc.start.line}:${e.loc.start.col} - ${e.msg}`);
      else console.log(e.msg);
    }
  } else {
    console.log("\n=== Type Check: OK ===");
  }
  // codegen
  const cg = new CodeGen();
  const js = cg.generate(ast);
  console.log("\n=== Emitted JS ===\n" + js);
  return { ast, errors: tc.errors, js };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("\n--- Running good example ---");
  run(example);
  console.log("\n--- Running bad example ---");
  run(exampleBad);
}
