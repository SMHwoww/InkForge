/**
 * 构建 Tauri Sidecar 后端可执行文件
 *
 * 流程：
 * 1. 使用 esbuild 将 api/ 目录打包为单个 CJS 文件（含内联 WASM）
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

console.log('[1/3] 使用 esbuild 打包后端代码...');

// 读取 sql.js WASM 文件并 Base64 编码，注入到构建中
const wasmPath = path.join(rootDir, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
const wasmBase64 = fs.readFileSync(wasmPath).toString('base64');

try {
  await build({
    entryPoints: [path.join(apiDir, 'server.ts')],
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    outfile: bundlePath,
    external: [
      // better-sqlite3 是原生模块，不需要打包
      'better-sqlite3',
    ],
    loader: {
      '.ts': 'ts',
    },
    define: {
      'INKFORGE_BUNDLED': 'true',
      'INKFORGE_WASM_BASE64': JSON.stringify(wasmBase64),
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
  });

  console.log('  -> 打包完成:', bundlePath);
} catch (err) {
  console.error('esbuild 打包失败:', err.message);
  process.exit(1);
}

// 使用 Node.js SEA 创建独立可执行文件
// 参考: https://nodejs.org/api/single-executable-applications.html
console.log('[2/3] 生成 Node.js SEA blob...');

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

console.log('[3/3] 创建可执行文件...');

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
