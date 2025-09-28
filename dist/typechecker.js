import { ANY, NUMBER, STRING, BOOLEAN, TypeErrorItem } from './types.js';
// 将类型对象转换为字符串表示
export function typeToString(t) {
    switch (t.tag) {
        case "number": return "number";
        case "string": return "string";
        case "boolean": return "boolean";
        case "any": return "any";
        case "var": return t.name;
        case "union": return t.types.map(typeToString).join(" | ");
        case "func": return `<${t.typeParams?.join(",") ?? ""}>(${t.params.map(typeToString).join(",")})=>${typeToString(t.ret)}`;
    }
}
// 将 TypeNode 转换为 Type，泛型产生 var 类型
export function typeFromNode(node, typeParamNames) {
    if (!node)
        return ANY;
    if (node.kind === "Name") {
        if (node.name === "number")
            return NUMBER;
        if (node.name === "string")
            return STRING;
        if (node.name === "boolean")
            return BOOLEAN;
        // 除非它是类型参数，否则将未知类型视为 any
        if (typeParamNames && typeParamNames.has(node.name))
            return { tag: "var", name: node.name };
        return ANY;
    }
    if (node.kind === "Var") {
        if (typeParamNames && typeParamNames.has(node.name))
            return { tag: "var", name: node.name };
        return ANY;
    }
    if (node.kind === "Union") {
        return { tag: "union", types: node.members.map(m => typeFromNode(m, typeParamNames)) };
    }
    return ANY;
}
// 使用映射替换泛型类型变量
export function substituteGenerics(t, map) {
    if (!t)
        return ANY;
    if (t.tag === "var")
        return map.get(t.name) ?? ANY;
    if (t.tag === "union")
        return { tag: "union", types: t.types.map(x => substituteGenerics(x, map)) };
    if (t.tag === "func") {
        // 不替换函数自己的类型参数
        return {
            tag: "func",
            params: t.params.map(p => substituteGenerics(p, map)),
            ret: substituteGenerics(t.ret, map),
            typeParams: t.typeParams
        };
    }
    return t;
}
// 支持联合类型和泛型的兼容性检查（vars 被视为灵活的）
export function isCompatible(a, b) {
    if (!a || !b)
        return false;
    if (b.tag === "any" || a.tag === "any")
        return true;
    if (b.tag === "union") {
        // 如果目标是联合类型，源必须与至少一个成员兼容
        return b.types.some(bt => isCompatible(a, bt));
    }
    if (a.tag === "union") {
        // 源联合类型：每个成员必须与目标兼容
        return a.types.every(at => isCompatible(at, b));
    }
    if (a.tag === "var" || b.tag === "var") {
        // 泛型参数 — 视为兼容（我们将依靠推理来特化）
        return true;
    }
    if (a.tag === "func" && b.tag === "func") {
        if ((a.params.length !== b.params.length))
            return false;
        for (let i = 0; i < a.params.length; i++) {
            // 逆变参数：目标参数必须与源参数兼容才能安全赋值
            if (!isCompatible(b.params[i], a.params[i]))
                return false;
        }
        return isCompatible(a.ret, b.ret);
    }
    return a.tag === b.tag;
}
// 类型检查器类（支持联合类型和基本泛型）
export class TypeChecker {
    errors = [];
    globals = new Map(); // 全局函数/值类型
    // 检查整个程序
    checkProgram(prog) {
        if (prog.type !== "Program")
            throw new Error("expected program");
        // 预声明函数名称，以便递归/提升工作
        for (const node of prog.body) {
            if (node.type === "FuncDecl") {
                // 暂时为 params/ret 默认 any；我们将在 checkNode 中优化
                const t = { tag: "func", params: node.params.map(_ => ANY), ret: ANY, typeParams: node.typeParams };
                this.globals.set(node.name, t);
            }
        }
        for (const node of prog.body)
            this.checkNode(node, new Map());
    }
    // 检查单个节点并返回其类型
    checkNode(node, env) {
        switch (node.type) {
            case "Program":
                throw new Error("not expected");
            case "VarDecl": {
                let t;
                if (node.typeAnn) {
                    t = typeFromNode(node.typeAnn, new Set());
                }
                else if (node.init) {
                    t = this.checkNode(node.init, env) ?? ANY;
                }
                else
                    t = ANY;
                env.set(node.name, t);
                return t;
            }
            case "NumberLiteral":
                return NUMBER;
            case "StringLiteral":
                return STRING;
            case "Identifier": {
                if (env.has(node.name))
                    return env.get(node.name);
                if (this.globals.has(node.name))
                    return this.globals.get(node.name);
                this.errors.push(new TypeErrorItem(`Undefined identifier '${node.name}'`, node.loc));
                return ANY;
            }
            case "Binary": {
                const L = this.checkNode(node.left, env) ?? ANY;
                const R = this.checkNode(node.right, env) ?? ANY;
                if (node.op === '+') {
                    if (L.tag === "number" && R.tag === "number")
                        return NUMBER;
                    if (L.tag === "string" && R.tag === "string")
                        return STRING;
                    // 如果涉及联合类型，尝试兼容组合
                    if (L.tag === "union" || R.tag === "union") {
                        // 如果任何组合产生有效的 +（string|string 或 number|number）则允许
                        // 简单方法：如果两种类型都是 number 的子集或 string 的子集 => 确定
                        const leftIsNumberish = (L.tag === "number") || (L.tag === "union" && L.types.every(t => t.tag === "number"));
                        const rightIsNumberish = (R.tag === "number") || (R.tag === "union" && R.types.every(t => t.tag === "number"));
                        const leftIsStringish = (L.tag === "string") || (L.tag === "union" && L.types.every(t => t.tag === "string"));
                        const rightIsStringish = (R.tag === "string") || (R.tag === "union" && R.types.every(t => t.tag === "string"));
                        if ((leftIsNumberish && rightIsNumberish))
                            return NUMBER;
                        if ((leftIsStringish && rightIsStringish))
                            return STRING;
                    }
                    this.errors.push(new TypeErrorItem(`Incompatible operands for '+' : ${typeToString(L)} and ${typeToString(R)}`, node.loc));
                    return ANY;
                }
                if (["-", "*", "/", "<", ">"].includes(node.op)) {
                    if (L.tag === "number" && R.tag === "number")
                        return NUMBER;
                    this.errors.push(new TypeErrorItem(`Operator '${node.op}' expects numbers, got ${typeToString(L)} and ${typeToString(R)}`, node.loc));
                    return ANY;
                }
                if (node.op === '=') {
                    // 视为相等性，返回布尔值
                    return BOOLEAN;
                }
                return ANY;
            }
            case "Call": {
                const calleeType = this.checkNode(node.callee, env) ?? ANY;
                const argTypes = node.args.map(a => this.checkNode(a, env) ?? ANY);
                if (calleeType.tag === "func") {
                    let fnType = calleeType;
                    if (calleeType.typeParams && calleeType.typeParams.length > 0) {
                        const subst = new Map();
                        if (node.typeArgs && node.typeArgs.length > 0) {
                            for (let i = 0; i < calleeType.typeParams.length; i++) {
                                const name = calleeType.typeParams[i];
                                const argNode = node.typeArgs[i];
                                const t = argNode ? typeFromNode(argNode) : ANY;
                                subst.set(name, t);
                            }
                        }
                        else {
                            // 从参数类型推断泛型类型
                            for (let i = 0; i < Math.min(calleeType.params.length, argTypes.length); i++) {
                                const pType = calleeType.params[i];
                                const aType = argTypes[i];
                                if (pType.tag === "var")
                                    subst.set(pType.name, aType);
                            }
                        }
                        fnType = substituteGenerics(calleeType, subst);
                    }
                    if (argTypes.length !== fnType.params.length) {
                        this.errors.push(new TypeErrorItem(`Function expected ${fnType.params.length} args but got ${argTypes.length}`, node.loc));
                    }
                    else {
                        for (let i = 0; i < Math.min(argTypes.length, fnType.params.length); i++) {
                            if (!isCompatible(argTypes[i], fnType.params[i])) {
                                this.errors.push(new TypeErrorItem(`Argument ${i + 1} type ${typeToString(argTypes[i])} not compatible with parameter type ${typeToString(fnType.params[i])}`, node.loc));
                            }
                        }
                    }
                    return fnType.ret;
                }
                this.errors.push(new TypeErrorItem(`Called object is not a function (${typeToString(calleeType)})`, node.loc));
                return ANY;
            }
            case "FuncDecl": {
                // 准备本地环境
                const local = new Map();
                const typeParamSet = new Set(node.typeParams ?? []);
                // 参数类型：转换 TypeNode -> Type，尊重类型参数
                const paramTypes = node.params.map(p => p.type ? typeFromNode(p.type, typeParamSet) : ANY);
                // 返回类型
                let retType = node.retType ? typeFromNode(node.retType, typeParamSet) : ANY;
                // 将参数设置到本地环境中
                for (let i = 0; i < node.params.length; i++) {
                    local.set(node.params[i].name, paramTypes[i]);
                }
                // 检查函数体；如果未标注，允许推断返回类型
                for (const stmt of node.body) {
                    if (stmt.type === "Return") {
                        const r = stmt.expr ? this.checkNode(stmt.expr, local) : ANY;
                        if (node.retType) {
                            if (!isCompatible(r, retType)) {
                                this.errors.push(new TypeErrorItem(`Return type ${typeToString(r)} not assignable to function return type ${typeToString(retType)}`, stmt.loc));
                            }
                        }
                        else {
                            // 将第一个找到的返回值类型作为推断的返回类型（简单实现）
                            if (r.tag)
                                retType = r;
                        }
                    }
                    else {
                        this.checkNode(stmt, local);
                    }
                }
                // 在全局中注册函数类型（包含其 typeParams 名称）
                const fnType = {
                    tag: "func",
                    params: paramTypes,
                    ret: retType,
                    typeParams: node.typeParams
                };
                this.globals.set(node.name, fnType);
                return fnType;
            }
            case "Return":
                return node.expr ? this.checkNode(node.expr, env) : ANY;
            default:
                return ANY;
        }
    }
}
