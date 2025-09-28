

export type Pos = { line: number; col: number };

export type Loc = { start: Pos; end: Pos };

// ---------- Tokens ----------
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