/**
 * 构建 Tauri Sidecar 后端可执行文件
 *
 * 流程：
 * 1. 使用 esbuild 将 api/ 目录打包为单个 CJS 文件
 * 2. 使用 Node.js SEA (Single Executable Application) 编译为独立可执行文件
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
const seaConfigPath = path.join(outputDir, 'sea-config.json');
const blobPath = path.join(outputDir, 'sea-prep.blob');

// 解析命令行参数
const args = process.argv.slice(2);
const targetArg = args.find(a => a.startsWith('--target='));
const target = targetArg ? targetArg.split('=')[1] : 'win';

const isWin = target === 'win';

// Tauri 根据 externalBin 基础名自动拼接 Rust 目标三元组来查找 sidecar
// 例如 binaries/inkforge-backend → binaries/inkforge-backend-x86_64-unknown-linux-gnu
const targetTriples = {
  win: 'x86_64-pc-windows-msvc',
  linux: 'x86_64-unknown-linux-gnu',
  mac: 'aarch64-apple-darwin',
};
const ext = isWin ? '.exe' : '';
const outputExeName = `inkforge-backend-${targetTriples[target]}${ext}`;
const outputPath = path.join(outputDir, outputExeName);

// 确保输出目录存在
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('[1/4] 复制原生模块到 binaries/lib/ ...');

// better-sqlite3 是原生 C++ 模块，Node.js SEA 的 embedderRequire 无法加载。
// 解法：将模块复制到 binaries/lib/node_modules/，然后通过 createRequire
// （在 SEA 中仍可访问文件系统模块）在运行时加载。
const libDir = path.join(outputDir, 'lib', 'node_modules');
const nativeModules = ['better-sqlite3', 'bindings', 'file-uri-to-path'];
for (const mod of nativeModules) {
  const src = path.join(rootDir, 'node_modules', mod);
  const dest = path.join(libDir, mod);
  if (fs.existsSync(src)) {
    fs.cpSync(src, dest, { recursive: true });
    console.log(`  -> 复制 ${mod} 到 ${dest}`);
  } else {
    console.warn(`  ⚠ 未找到 ${src}，跳过`);
  }
}

// 为 createRequire 创建锚点文件（仅用于模块路径解析，无需实际内容）
fs.writeFileSync(path.join(outputDir, 'lib', '_sea_loader.js'), '// anchor for createRequire\n');

console.log('[2/4] 使用 esbuild 打包后端代码...');

try {
  await build({
    entryPoints: [path.join(apiDir, 'server.ts')],
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    outfile: bundlePath,
    // better-sqlite3 不再作为 external —— 由下方的 nativeModulePlugin 拦截
    external: [],
    loader: {
      '.ts': 'ts',
    },
    define: {
      'INKFORGE_BUNDLED': 'true',
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    plugins: [
      {
        name: 'native-module-loader',
        setup(build) {
          // 拦截所有对 better-sqlite3 的 require/import
          // 替换为 createRequire 加载器（兼容 Node.js SEA）
          build.onResolve({ filter: /^better-sqlite3$/ }, (args) => ({
            path: args.path,
            namespace: 'native-module',
          }));

          build.onLoad({ filter: /.*/, namespace: 'native-module' }, () => ({
            contents: `
// SEA-compatible: 用 createRequire 从文件系统加载原生模块
// embedderRequire 只能解析 built-in 模块，但 createRequire 可访问磁盘
const { createRequire } = require('node:module');
const path = require('path');
const req = createRequire(path.join(path.dirname(process.execPath), 'lib', '_sea_loader.js'));
module.exports = req('better-sqlite3');
`,
            loader: 'js',
          }));
        },
      },
    ],
  });

  console.log('  -> 打包完成:', bundlePath);
} catch (err) {
  console.error('esbuild 打包失败:', err.message);
  process.exit(1);
}

// 使用 Node.js SEA 创建独立可执行文件
// 参考: https://nodejs.org/api/single-executable-applications.html
console.log('[3/4] 生成 Node.js SEA blob...');

const seaConfig = {
  main: bundlePath,
  output: blobPath,
  disableExperimentalSEAWarning: true,
};

fs.writeFileSync(seaConfigPath, JSON.stringify(seaConfig, null, 2));

try {
  execSync(`node --experimental-sea-config "${seaConfigPath}"`, {
    stdio: 'inherit',
    cwd: outputDir,
  });
  console.log('  -> SEA blob 生成完成');
} catch (err) {
  console.error('SEA blob 生成失败:', err.message);
  process.exit(1);
}

console.log('[4/4] 创建可执行文件...');

try {
  // 复制当前系统 Node.js 二进制文件
  const nodeBinary = process.execPath;
  fs.copyFileSync(nodeBinary, outputPath);

  // 将 SEA blob 注入到可执行文件中
  const sentinelFuse = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';
  execSync(
    `npx postject "${outputPath}" NODE_SEA_BLOB "${blobPath}" --sentinel-fuse ${sentinelFuse}`,
    { stdio: 'inherit', cwd: rootDir }
  );

  // macOS: 重新签名
  if (target === 'mac') {
    try {
      execSync(`codesign --sign - "${outputPath}"`, { stdio: 'inherit' });
    } catch {
      // 签名失败不是致命错误（跨平台构建 macOS 目标时会遇到）
      console.log('  提示：macOS 代码签名跳过（可能在非 macOS 平台上构建）');
    }
  }

  // 清理中间文件
  fs.unlinkSync(bundlePath);
  fs.unlinkSync(seaConfigPath);
  fs.unlinkSync(blobPath);

  console.log('  -> Sidecar 构建成功！');
  console.log(`  输出: ${outputPath}`);
} catch (err) {
  console.error('可执行文件创建失败:', err.message);
  process.exit(1);
}
