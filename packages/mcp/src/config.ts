/**
 * Configuration loading for Engram MCP server
 * Priority: env vars > config file (~/.engram/mcp-config.json) > defaults
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface EngramMcpConfig {
  storagePath: string;
  encryptionPassphrase?: string;
  enableEmbeddings: boolean;
  debug: boolean;
  deviceId: string;
}

interface ConfigFile {
  storagePath?: string;
  encryptionPassphrase?: string;
  enableEmbeddings?: boolean;
  debug?: boolean;
}

function getDefaultStoragePath(): string {
  return path.join(os.homedir(), '.engram', 'engram.db');
}

function getConfigFilePath(): string {
  return path.join(os.homedir(), '.engram', 'mcp-config.json');
}

function loadConfigFile(): ConfigFile {
  const configPath = getConfigFilePath();
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(raw) as ConfigFile;
    }
  } catch {
    // Config file doesn't exist or is invalid — use defaults
  }
  return {};
}

function getDeviceIdPath(): string {
  return path.join(os.homedir(), '.engram', 'device-id');
}

/**
 * Loads the persistent device ID from ~/.engram/device-id, creating it on
 * first run. A stable device ID is required for vector clock consistency —
 * regenerating it on every start would create a new logical device identity
 * and break causal ordering across restarts.
 */
function loadOrCreateDeviceId(): string {
  const deviceIdPath = getDeviceIdPath();

  // Ensure the directory exists before trying to read/write
  const dir = path.dirname(deviceIdPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  try {
    if (fs.existsSync(deviceIdPath)) {
      const stored = fs.readFileSync(deviceIdPath, 'utf-8').trim();
      if (stored && stored.startsWith('mcp-')) {
        return stored;
      }
    }
  } catch {
    // Fall through to generate a new one
  }

  // First run (or corrupted file) — generate and persist
  const newId = `mcp-${crypto.randomUUID()}`;
  fs.writeFileSync(deviceIdPath, newId, { encoding: 'utf-8', mode: 0o600 });
  return newId;
}

export function loadConfig(): EngramMcpConfig {
  const fileConfig = loadConfigFile();

  const storagePath =
    process.env.ENGRAM_STORAGE_PATH ||
    fileConfig.storagePath ||
    getDefaultStoragePath();

  // Ensure storage directory exists
  const storageDir = path.dirname(storagePath);
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  return {
    storagePath,
    encryptionPassphrase:
      process.env.ENGRAM_PASSPHRASE || fileConfig.encryptionPassphrase || undefined,
    enableEmbeddings:
      process.env.ENGRAM_ENABLE_EMBEDDINGS === 'true' ||
      fileConfig.enableEmbeddings ||
      false,
    debug: process.env.ENGRAM_DEBUG === 'true' || fileConfig.debug || false,
    deviceId: loadOrCreateDeviceId(),
  };
}
