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

function generateDeviceId(): string {
  return `mcp-${crypto.randomUUID()}`;
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
    deviceId: generateDeviceId(),
  };
}
