// ---------- Tokens ----------
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
