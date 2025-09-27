export interface Loc {
  start: { line: number; col: number };
  end: { line: number; col: number };
}

export enum TokenKind {
  Keyword,
  Identifier,
  Number,
  String,
  Operator,
  Punctuator,
  EOF,
}

export interface Token {
  kind: TokenKind;
  value: string;
  loc: Loc;
}

// AST 节点可按需扩展
export interface Program {
  type: "Program";
  body: any[];
}
