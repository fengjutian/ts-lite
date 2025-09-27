import { Token, TokenKind, Loc } from "./types.ts";

export class Lexer {
  private idx = 0;
  private line = 1;
  private col = 1;
  constructor(private src: string) {}

  private peek(n = 0): string {
    return this.src[this.idx + n] ?? "";
  }
  private nextChar(): string {
    const ch = this.src[this.idx++] ?? "";
    if (ch === "\n") { this.line++; this.col = 1; } else { this.col++; }
    return ch;
  }
  private makeLoc(start: number, end: number): Loc {
    return { start: { line: this.line, col: this.col - (end - start) }, end: { line: this.line, col: this.col } };
  }
  private isAlpha(c: string) { return /[a-zA-Z_]/.test(c); }
  private isAlphaNum(c: string) { return /[a-zA-Z0-9_]/.test(c); }
  private isDigit(c: string) { return /[0-9]/.test(c); }

  *tokens(): Generator<Token> {
    const kw = new Set(["let", "function", "return", "type"]);
    while (this.idx < this.src.length) {
      const start = this.idx;
      let ch = this.peek();

      if (/\s/.test(ch)) { this.nextChar(); continue; }

      // two-char operator
      const two = this.peek(0) + this.peek(1);
      if (two === "=>") {
        this.nextChar(); this.nextChar();
        yield { kind: TokenKind.Operator, value: "=>", loc: this.makeLoc(start, this.idx) };
        continue;
      }

      // comments
      if (ch === "/") {
        if (this.peek(1) === "/") {
          this.nextChar(); this.nextChar();
          while (this.peek() && this.peek() !== "\n") this.nextChar();
          continue;
        } else if (this.peek(1) === "*") {
          this.nextChar(); this.nextChar();
          while (this.idx < this.src.length) {
            if (this.peek() === "*" && this.peek(1) === "/") { this.nextChar(); this.nextChar(); break; }
            this.nextChar();
          }
          continue;
        }
      }

      if ("(){}:;,[].<>".includes(ch)) {
        this.nextChar();
        yield { kind: TokenKind.Punctuator, value: ch, loc: this.makeLoc(start, this.idx) };
        continue;
      }

      if ("=+-*/|".includes(ch)) {
        this.nextChar();
        yield { kind: TokenKind.Operator, value: ch, loc: this.makeLoc(start, this.idx) };
        continue;
      }

      if (this.isAlpha(ch)) {
        let s = "";
        while (this.isAlphaNum(this.peek())) s += this.nextChar();
        yield { kind: kw.has(s) ? TokenKind.Keyword : TokenKind.Identifier, value: s, loc: this.makeLoc(start, this.idx) };
        continue;
      }

      if (this.isDigit(ch)) {
        let s = "";
        while (this.isDigit(this.peek())) s += this.nextChar();
        if (this.peek() === ".") { s += this.nextChar(); while (this.isDigit(this.peek())) s += this.nextChar(); }
        yield { kind: TokenKind.Number, value: s, loc: this.makeLoc(start, this.idx) };
        continue;
      }

      if (ch === '"' || ch === "'") {
        const quote = this.nextChar();
        let s = "";
        while (this.peek() && this.peek() !== quote) {
          if (this.peek() === "\\") { this.nextChar(); s += this.nextChar(); }
          else s += this.nextChar();
        }
        if (this.peek() === quote) this.nextChar();
        yield { kind: TokenKind.String, value: s, loc: this.makeLoc(start, this.idx) };
        continue;
      }

      this.nextChar(); // skip unknown
    }
    yield { kind: TokenKind.EOF, value: "", loc: this.makeLoc(this.idx, this.idx) };
  }
}

export function tokenize(src: string): Token[] {
  return Array.from(new Lexer(src).tokens());
}
