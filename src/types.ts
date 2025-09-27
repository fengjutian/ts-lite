export interface Loc { start: { line: number; col: number }; end: { line: number; col: number } }

export enum TokenKind { Keyword, Identifier, Number, String, Operator, Punctuator, EOF }

export interface Token { kind: TokenKind; value: string; loc: Loc }
