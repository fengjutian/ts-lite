export var TokenKind;
(function (TokenKind) {
    TokenKind[TokenKind["Keyword"] = 0] = "Keyword";
    TokenKind[TokenKind["Identifier"] = 1] = "Identifier";
    TokenKind[TokenKind["Number"] = 2] = "Number";
    TokenKind[TokenKind["String"] = 3] = "String";
    TokenKind[TokenKind["Operator"] = 4] = "Operator";
    TokenKind[TokenKind["Punctuator"] = 5] = "Punctuator";
    TokenKind[TokenKind["EOF"] = 6] = "EOF";
})(TokenKind || (TokenKind = {}));
