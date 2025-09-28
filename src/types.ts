// 位置和范围类型
export interface Pos {
  line: number;
  col: number;
}

export interface Loc {
  start: Pos;
  end: Pos;
}

// Token类型定义
export enum TokenKind {
  Identifier = "Identifier",
  Number = "Number",
  String = "String",
  Keyword = "Keyword",
  Punctuator = "Punctuator",
  Operator = "Operator",
  EOF = "EOF",
}

export interface Token {
  kind: TokenKind;
  value: string;
  loc: Loc;
}

// AST节点类型 - 类型节点
export type TypeNode = 
  | { kind: "Name"; name: string }
  | { kind: "Union"; members: TypeNode[] }
  | { kind: "Var"; name: string };

// AST节点类型 - 语法节点
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

// 类型系统类型
export type Type = 
  | { tag: "number" }
  | { tag: "string" }
  | { tag: "boolean" }
  | { tag: "any" }
  | { tag: "var"; name: string } // 泛型类型参数，如 T
  | { tag: "union"; types: Type[] }
  | { tag: "func"; params: Type[]; ret: Type; typeParams?: string[] };

// 预定义类型常量
export const NUMBER: Type = { tag: "number" };
export const STRING: Type = { tag: "string" };
export const BOOLEAN: Type = { tag: "boolean" };
export const ANY: Type = { tag: "any" };

// 类型错误类
export class TypeErrorItem {
  msg: string;
  loc?: Loc;
  constructor(msg: string, loc?: Loc) { this.msg = msg; this.loc = loc; }
}