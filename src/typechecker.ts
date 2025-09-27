import { TypeErrorItem, Type, ASTNode, ANY, TypeNode, NUMBER, STRING, BOOLEAN } from './schema.js';

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

export class TypeChecker {
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

export function typeCheck(ast: ASTNode) {
  const tc = new TypeChecker();
  tc.checkProgram(ast);
  return tc.errors;
}
