
export type Pos = { line: number; col: number };


export type Loc = { start: Pos; end: Pos };

export class TypeErrorItem {
  msg: string;
  loc?: Loc;
  constructor(msg: string, loc?: Loc) { this.msg = msg; this.loc = loc; }
}

export type Type =
  | { tag: "number" }
  | { tag: "string" }
  | { tag: "boolean" }
  | { tag: "any" }
  | { tag: "var"; name: string } // generic type parameter like T
  | { tag: "union"; types: Type[] }
  | { tag: "func"; params: Type[]; ret: Type; typeParams?: string[] };

export type TypeNode =
  | { kind: "Name"; name: string }
  | { kind: "Union"; members: TypeNode[] }
  | { kind: "Var"; name: string };

export type ASTNode =
  | { type: "Program"; body: ASTNode[] }
  | { type: "VarDecl"; name: string; typeAnn?: TypeNode; init?: ASTNode; loc?: Loc }
  | { type: "FuncDecl"; name: string; typeParams?: string[]; params: { name: string; type?: TypeNode }[]; retType?: TypeNode; body: ASTNode[]; loc?: Loc }
  | { type: "Return"; expr?: ASTNode; loc?: Loc }
  | { type: "Binary"; op: string; left: ASTNode; right: ASTNode; loc?: Loc }
  | { type: "Call"; callee: ASTNode; typeArgs?: TypeNode[]; args: ASTNode[]; loc?: Loc }
  | { type: "Identifier"; name: string; loc?: Loc }
  | { type: "NumberLiteral"; value: number; loc?: Loc }
  | { type: "StringLiteral"; value: string; loc?: Loc };

export const NUMBER: Type = { tag: "number" };
export const STRING: Type = { tag: "string" };
export const BOOLEAN: Type = { tag: "boolean" };
export const ANY: Type = { tag: "any" };

export enum TokenKind {
  Identifier = "Identifier",
  Number = "Number",
  String = "String",
  Keyword = "Keyword",
  Punctuator = "Punctuator",
  Operator = "Operator",
  EOF = "EOF",
}

