import { TokenKind } from './types.js';
// 词法分析器类
export class Lexer {
    src;
    idx = 0;
    constructor(src) {
        this.src = src;
    }
    // 预览当前字符或指定偏移量的字符
    peek(n = 0) {
        return this.src[this.idx + n] ?? '';
    }
    // 读取并移动到下一个字符
    nextChar() {
        const ch = this.src[this.idx++] ?? '';
        return ch;
    }
    // 创建位置范围对象
    makeLoc(startIdx, endIdx) {
        const sub = this.src.slice(0, startIdx);
        const startLine = (sub.match(/\n/g) || []).length + 1;
        const startCol = startLine === 1 ? sub.length + 1 : sub.slice(sub.lastIndexOf('\n') + 1).length + 1;
        const sub2 = this.src.slice(0, endIdx);
        const endLine = (sub2.match(/\n/g) || []).length + 1;
        const endCol = endLine === 1 ? sub2.length + 1 : sub2.slice(sub2.lastIndexOf('\n') + 1).length + 1;
        return {
            start: { line: startLine, col: startCol },
            end: { line: endLine, col: endCol }
        };
    }
    // 判断字符是否为字母
    isAlpha(ch) {
        return /[A-Za-z_]/.test(ch);
    }
    // 判断字符是否为数字
    isDigit(ch) {
        return /[0-9]/.test(ch);
    }
    // 判断字符是否为字母或数字
    isAlphaNum(ch) {
        return this.isAlpha(ch) || this.isDigit(ch);
    }
    // 生成词法单元序列
    *tokens() {
        const kw = new Set(['let', 'function', 'return', 'type']);
        while (this.idx < this.src.length) {
            const start = this.idx;
            let ch = this.peek();
            // 空白字符
            if (/\s/.test(ch)) {
                this.nextChar();
                continue;
            }
            // 双字符运算符检查必须在单字符运算符处理之前
            const two = this.peek(0) + this.peek(1);
            if (two === '=>') {
                this.nextChar();
                this.nextChar();
                const loc = this.makeLoc(start, this.idx);
                yield { kind: TokenKind.Operator, value: '=>', loc };
                continue;
            }
            // 注释：必须在将 '/' 视为运算符之前检查
            if (ch === '/') {
                if (this.peek(1) === '/') {
                    // 单行注释：消费直到换行符（但保留换行符供外部循环处理）
                    this.nextChar(); // 消费第一个 '/' 字符
                    this.nextChar(); // 消费第二个 '/' 字符
                    while (this.peek() && this.peek() !== '\n')
                        this.nextChar();
                    continue; // 跳过注释
                }
                else if (this.peek(1) === '*') {
                    // 多行注释
                    this.nextChar(); // '/' 字符
                    this.nextChar(); // '*' 字符
                    while (this.idx < this.src.length) {
                        if (this.peek() === '*' && this.peek(1) === '/') {
                            this.nextChar();
                            this.nextChar();
                            break;
                        }
                        this.nextChar();
                    }
                    continue; // 跳过注释
                }
            }
            // 标点符号（将 < 和 > 视为类型参数的标点符号）
            if ('(){}:;,[].<>'.includes(ch)) {
                this.nextChar();
                const loc = this.makeLoc(start, this.idx);
                yield { kind: TokenKind.Punctuator, value: ch, loc };
                continue;
            }
            // 单字符运算符（注意 '/' 只有在不是注释的情况下才在这里处理）
            if ('=+-*/|'.includes(ch)) {
                this.nextChar();
                const loc = this.makeLoc(start, this.idx);
                yield { kind: TokenKind.Operator, value: ch, loc };
                continue;
            }
            // 标识符 / 关键字
            if (this.isAlpha(ch)) {
                let s = '';
                while (this.isAlphaNum(this.peek()))
                    s += this.nextChar();
                const loc = this.makeLoc(start, this.idx);
                yield { kind: kw.has(s) ? TokenKind.Keyword : TokenKind.Identifier, value: s, loc };
                continue;
            }
            // 数字
            if (this.isDigit(ch)) {
                let s = '';
                while (this.isDigit(this.peek()))
                    s += this.nextChar();
                if (this.peek() === '.') {
                    s += this.nextChar();
                    while (this.isDigit(this.peek()))
                        s += this.nextChar();
                }
                const loc = this.makeLoc(start, this.idx);
                yield { kind: TokenKind.Number, value: s, loc };
                continue;
            }
            // 字符串
            if (ch === '"' || ch === "'") {
                const quote = this.nextChar();
                let s = '';
                while (this.peek() && this.peek() !== quote) {
                    if (this.peek() === '\\') {
                        this.nextChar();
                        s += this.nextChar();
                    }
                    else {
                        s += this.nextChar();
                    }
                }
                if (this.peek() === quote)
                    this.nextChar();
                const loc = this.makeLoc(start, this.idx);
                yield { kind: TokenKind.String, value: s, loc };
                continue;
            }
            // 未知字符 -> 跳过单个字符
            this.nextChar();
        }
        // EOF 标记
        const eofLoc = this.makeLoc(this.idx, this.idx);
        yield { kind: TokenKind.EOF, value: '', loc: eofLoc };
    }
}
