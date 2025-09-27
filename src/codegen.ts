import { ASTNode } from './schema.js';

export class CodeGen {
  private code: string[] = [];
  private indentLevel = 0;
  private indentSize = 2;

  generate(ast: ASTNode): string {
    this.code = [];
    this.indentLevel = 0;
    this.genNode(ast);
    return this.code.join('\n');
  }

  private indent() {
    this.indentLevel++;
  }

  private dedent() {
    this.indentLevel = Math.max(0, this.indentLevel - 1);
  }

  private emit(line: string) {
    const prefix = ' '.repeat(this.indentLevel * this.indentSize);
    this.code.push(prefix + line);
  }

  private genNode(node: ASTNode) {
    switch (node.type) {
      case 'Program':
        for (const stmt of node.body) {
          this.genNode(stmt);
          this.emit('');
        }
        break;
      case 'VarDecl':
        this.emit(`let ${node.name}`);
        if (node.init) {
          this.emit(' = ');
          this.genNode(node.init);
        }
        this.emit(';');
        break;
      case 'NumberLiteral':
        this.emit(node.value.toString());
        break;
      case 'StringLiteral':
        this.emit(`"${node.value}"`);
        break;
      case 'Identifier':
        this.emit(node.name);
        break;
      case 'Binary':
        this.emit('(');
        this.genNode(node.left);
        this.emit(` ${node.op} `);
        this.genNode(node.right);
        this.emit(')');
        break;
      case 'Call':
        this.genNode(node.callee);
        this.emit('(');
        if (node.args.length > 0) {
          this.genNode(node.args[0]);
          for (let i = 1; i < node.args.length; i++) {
            this.emit(', ');
            this.genNode(node.args[i]);
          }
        }
        this.emit(')');
        break;
      case 'FuncDecl':
        this.emit('function ' + node.name);
        if (node.typeParams && node.typeParams.length > 0) {
          this.emit('<' + node.typeParams.join(', ') + '>');
        }
        this.emit('(');
        if (node.params.length > 0) {
          this.emit(node.params[0].name);
          for (let i = 1; i < node.params.length; i++) {
            this.emit(', ' + node.params[i].name);
          }
        }
        this.emit(') {');
        this.indent();
        for (const stmt of node.body) {
          this.genNode(stmt);
        }
        this.dedent();
        this.emit('}');
        break;
      case 'Return':
        this.emit('return');
        if (node.expr) {
          this.emit(' ');
          this.genNode(node.expr);
        }
        this.emit(';');
        break;
    }
  }
}

export function generateCode(ast: ASTNode): string {
  const cg = new CodeGen();
  return cg.generate(ast);
}