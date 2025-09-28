#!/usr/bin/env node
import { run } from './runner.js';
// 处理命令行参数
async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.log('Usage: ts-lite <code> or ts-lite --file <path>');
        console.log('Example: ts-lite "let x: number = 42;"');
        process.exit(0);
    }
    if (args[0] === '--file' && args.length > 1) {
        // 从文件读取代码
        try {
            const fs = await import('fs/promises');
            const filePath = args[1];
            const code = await fs.readFile(filePath, 'utf-8');
            run(code);
        }
        catch (error) {
            console.error('Error reading file:', error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    }
    else {
        // 直接执行命令行中的代码
        const code = args.join(' ');
        run(code);
    }
}
main().catch((err) => {
    console.error('Error:', err instanceof Error ? err.message : String(err));
    process.exit(1);
});
