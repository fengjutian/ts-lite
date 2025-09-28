// 代码生成器类（进行类型擦除）
export class CodeGen {
    // 生成 JavaScript 代码
    generate(node) {
        switch (node.type) {
            case "Program":
                return node.body.map(n => this.generate(n)).join('\n');
            case "VarDecl": {
                const init = node.init ? ` = ${this.generate(node.init)}` : '';
                return `let ${node.name}${init};`;
            }
            case "NumberLiteral":
                return String(node.value);
            case "StringLiteral":
                return JSON.stringify(node.value);
            case "Identifier":
                return node.name;
            case "Binary":
                return `${this.generate(node.left)} ${node.op} ${this.generate(node.right)}`;
            case "Call": {
                const typeArgs = node.typeArgs && node.typeArgs.length > 0 ?
                    `/*<${node.typeArgs.map(t => t.kind === "Name" ? t.name : "?").join(',')}>*/` : '';
                return `${this.generate(node.callee)}${typeArgs}(${node.args.map(a => this.generate(a)).join(', ')})`;
            }
            case "FuncDecl": {
                const params = node.params.map(p => p.name).join(', ');
                const body = node.body.map(s => this.generate(s)).join('\n');
                return `function ${node.name}(${params}) {\n${this.indent(body)}\n}`;
            }
            case "Return":
                return `return ${node.expr ? this.generate(node.expr) : ''};`;
            default:
                return '/* unsupported */';
        }
    }
    // 缩进代码
    indent(s) {
        return s.split('\n').map(l => l ? '  ' + l : '').join('\n');
    }
}
