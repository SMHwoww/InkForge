/**
 * 构建 Tauri Sidecar 后端可执行文件
 *
 * 流程：
 * 1. 使用 esbuild 将 api/ 目录打包为单个 CJS 文件
 * 2. 使用 @yao-pkg/pkg 将 CJS 文件编译为独立可执行文件
 * 3. 输出到 src-tauri/binaries/ 目录
 *
 * 用法：node scripts/build-sidecar.mjs [--target=win|mac|linux]
 */

import { build } from 'esbuild';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const apiDir = path.join(rootDir, 'api');
const outputDir = path.join(rootDir, 'src-tauri', 'binaries');
const bundlePath = path.join(outputDir, 'bundle.cjs');

// 解析命令行参数
const args = process.argv.slice(2);
const targetArg = args.find(a => a.startsWith('--target='));
const target = targetArg ? targetArg.split('=')[1] : 'win';

// 目标平台映射
const targetMap = {
  win: 'node18-win-x64',
  mac: 'node18-macos-x64',
  linux: 'node18-linux-x64',
};

const pkgTarget = targetMap[target] || targetMap.win;

// 确保输出目录存在
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('[1/2] 使用 esbuild 打包后端代码...');

try {
  await build({
    entryPoints: [path.join(apiDir, 'server.ts')],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    outfile: bundlePath,
    external: [
      // sql.js 需要原生模块，标记为外部依赖
      'sql.js',
      // 排除 Node.js 内置模块
      'better-sqlite3',
    ],
    loader: {
      '.ts': 'ts',
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
  });

  console.log('  -> 打包完成:', bundlePath);
} catch (err) {
  console.error('esbuild 打包失败:', err.message);
  process.exit(1);
}

console.log(`[2/2] 使用 pkg 编译为可执行文件 (${pkgTarget})...`);

try {
  const outputName = path.join(outputDir, `inkforge-backend`);
  execSync(
    `npx pkg "${bundlePath}" --targets ${pkgTarget} --output "${outputName}"`,
    { stdio: 'inherit', cwd: rootDir }
  );

  // 清理打包中间文件
  fs.unlinkSync(bundlePath);

  console.log('  -> Sidecar 构建成功！');
  console.log(`  输出目录: ${outputDir}`);
  console.log('  文件列表:');
  const files = fs.readdirSync(outputDir);
  files.forEach(f => console.log(`    - ${f}`));
} catch (err) {
  console.error('pkg 编译失败:', err.message);
  console.log('  提示：请确保已安装 @yao-pkg/pkg: npm install --save-dev @yao-pkg/pkg');
  process.exit(1);
}