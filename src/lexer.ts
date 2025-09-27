import { Token, TokenKind, Loc } from "./types.ts";

export class Lexer {
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

export function tokenize(src: string): Token[] {
  return Array.from(new Lexer(src).tokens());
}
