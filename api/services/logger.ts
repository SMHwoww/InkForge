import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// __dirname is a CJS global in esbuild builds; undefined in ESM dev
declare var __dirname: string | undefined;

// INKFORGE_BUNDLED is injected by esbuild define at build time.
// In production (SEA executable), place data alongside the executable.
declare const INKFORGE_BUNDLED: boolean | undefined;

const currentDirname = typeof __dirname !== 'undefined'
  ? __dirname
  : path.dirname(fileURLToPath(import.meta.url));

const logsDir = typeof INKFORGE_BUNDLED !== 'undefined'
  ? path.join(path.dirname(process.execPath), 'logs')
  : path.join(currentDirname, '..', '..', 'logs');

// Ensure logs directory exists
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

function getLogFilePath(type: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return path.join(logsDir, `${type}-${date}.log`);
}

function formatLogEntry(level: string, message: string, details?: unknown): string {
  const timestamp = new Date().toISOString();
  let entry = `[${timestamp}] [${level}] ${message}`;
  if (details) {
    if (details instanceof Error) {
      entry += `\n  Error: ${details.message}`;
      if (details.stack) {
        entry += `\n  Stack:\n    ${details.stack.split('\n').join('\n    ')}`;
      }
    } else if (typeof details === 'object') {
      entry += `\n  Details: ${JSON.stringify(details, null, 2)}`;
    } else {
      entry += `\n  Details: ${String(details)}`;
    }
  }
  return entry + '\n';
}

export function logError(service: string, message: string, error?: unknown): void {
  try {
    const entry = formatLogEntry('ERROR', `[${service}] ${message}`, error);
    fs.appendFileSync(getLogFilePath('error'), entry, 'utf-8');
  } catch {
    // Fallback to console if file logging fails
    console.error(`[Logger] Failed to write error log: ${message}`);
  }
}

export function logWarn(service: string, message: string, details?: unknown): void {
  try {
    const entry = formatLogEntry('WARN', `[${service}] ${message}`, details);
    fs.appendFileSync(getLogFilePath('warn'), entry, 'utf-8');
  } catch {
    console.warn(`[Logger] Failed to write warn log: ${message}`);
  }
}

export function logInfo(service: string, message: string, details?: unknown): void {
  try {
    const entry = formatLogEntry('INFO', `[${service}] ${message}`, details);
    fs.appendFileSync(getLogFilePath('info'), entry, 'utf-8');
  } catch {
    console.log(`[Logger] Failed to write info log: ${message}`);
  }
}