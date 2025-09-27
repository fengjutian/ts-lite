export class TypeErrorItem {
    msg;
    loc;
    constructor(msg, loc) { this.msg = msg; this.loc = loc; }
}
export const NUMBER = { tag: "number" };
export const STRING = { tag: "string" };
export const BOOLEAN = { tag: "boolean" };
export const ANY = { tag: "any" };
export var TokenKind;
(function (TokenKind) {
    TokenKind["Identifier"] = "Identifier";
    TokenKind["Number"] = "Number";
    TokenKind["String"] = "String";
    TokenKind["Keyword"] = "Keyword";
    TokenKind["Punctuator"] = "Punctuator";
    TokenKind["Operator"] = "Operator";
    TokenKind["EOF"] = "EOF";
})(TokenKind || (TokenKind = {}));
