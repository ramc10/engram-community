#!/usr/bin/env node
/**
 * Installer for the native-messaging host manifest.
 *
 * Chrome discovers native hosts via a JSON manifest placed in a per-OS location,
 * pinned to the extension's origin. This writes that manifest pointing at the
 * installed host binary.
 *
 * Usage:
 *   engram-native-host-install <extension-id>
 *   engram-native-host-install <extension-id> --browser=chrome|chromium|edge|brave
 *
 * The extension id is shown on chrome://extensions (Developer mode). For an
 * unpacked/dev build the id differs from the published one — install with the id
 * you're actually running.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const HOST_NAME = 'com.engram.host';

interface BrowserPaths {
  [key: string]: { darwin: string; linux: string };
}

// Per-browser NativeMessagingHosts directory (user scope). Windows uses the
// registry instead and is handled separately below.
const BROWSER_DIRS: BrowserPaths = {
  chrome: {
    darwin: 'Library/Application Support/Google/Chrome/NativeMessagingHosts',
    linux: '.config/google-chrome/NativeMessagingHosts',
  },
  chromium: {
    darwin: 'Library/Application Support/Chromium/NativeMessagingHosts',
    linux: '.config/chromium/NativeMessagingHosts',
  },
  edge: {
    darwin: 'Library/Application Support/Microsoft Edge/NativeMessagingHosts',
    linux: '.config/microsoft-edge/NativeMessagingHosts',
  },
  brave: {
    darwin: 'Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts',
    linux: '.config/BraveSoftware/Brave-Browser/NativeMessagingHosts',
  },
};

function parseArgs(argv: string[]): { extensionId?: string; browser: string } {
  let extensionId: string | undefined;
  let browser = 'chrome';
  for (const arg of argv) {
    if (arg.startsWith('--browser=')) browser = arg.slice('--browser='.length);
    else if (!arg.startsWith('--')) extensionId = arg;
  }
  return { extensionId, browser };
}

function hostBinaryPath(): string {
  // The compiled host entry sits next to this installer in dist/.
  return path.join(__dirname, 'index.js');
}

function main(): void {
  const { extensionId, browser } = parseArgs(process.argv.slice(2));

  if (!extensionId) {
    console.error('Usage: engram-native-host-install <extension-id> [--browser=chrome|chromium|edge|brave]');
    process.exit(1);
  }

  const dirs = BROWSER_DIRS[browser];
  if (!dirs) {
    console.error(`Unknown browser "${browser}". Supported: ${Object.keys(BROWSER_DIRS).join(', ')}`);
    process.exit(1);
  }

  const platform = process.platform;
  if (platform === 'win32') {
    console.error(
      'Windows install is registry-based and not automated here.\n' +
        'Create the manifest below and add a registry key:\n' +
        `  HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${HOST_NAME}\n` +
        '  (Default) = <path to the manifest json>'
    );
  }

  const relDir = platform === 'darwin' ? dirs.darwin : dirs.linux;
  const targetDir = path.join(os.homedir(), relDir);
  fs.mkdirSync(targetDir, { recursive: true });

  const manifest = {
    name: HOST_NAME,
    description: 'Engram native messaging host — writes memories to the local MCP store.',
    path: hostBinaryPath(),
    type: 'stdio',
    allowed_origins: [`chrome-extension://${extensionId}/`],
  };

  const manifestPath = path.join(targetDir, `${HOST_NAME}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  // Ensure the host binary is executable.
  try {
    fs.chmodSync(hostBinaryPath(), 0o755);
  } catch {
    /* best effort */
  }

  console.log(`Installed native host manifest:\n  ${manifestPath}`);
  console.log(`  host binary: ${manifest.path}`);
  console.log(`  allowed origin: ${manifest.allowed_origins[0]}`);
}

main();
