/**
 * Chrome native-messaging framing.
 *
 * Each message is a 4-byte little-endian uint32 length header followed by that
 * many bytes of UTF-8 JSON. Chrome→host messages are capped at 1 MB; host→Chrome
 * at 64 MB.
 */

import type { Readable, Writable } from 'stream';

export interface BridgePayload {
  id: string;
  kind: string;
  conversationId: string;
  platform: string;
  role: string;
  text: string;
  timestamp: number;
  deviceId: string;
  tags: string[];
  keywords?: string[];
  context?: string;
}

/**
 * Read length-prefixed JSON messages from a stream, invoking `onMessage` for each.
 * Resolves when the stream ends.
 */
export function readMessages(
  input: Readable,
  onMessage: (msg: unknown) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0);

    input.on('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      // Drain as many complete messages as the buffer holds.
      while (buffer.length >= 4) {
        const len = buffer.readUInt32LE(0);
        if (buffer.length < 4 + len) break; // wait for the rest
        const body = buffer.subarray(4, 4 + len).toString('utf8');
        buffer = buffer.subarray(4 + len);
        try {
          onMessage(JSON.parse(body));
        } catch (err) {
          // Skip malformed frames rather than killing the host.
          console.error('[engram-host] Failed to parse message:', err);
        }
      }
    });

    input.on('end', () => resolve());
    input.on('error', reject);
  });
}

/** Write a single length-prefixed JSON message to a stream. */
export function writeMessage(output: Writable, msg: unknown): void {
  const body = Buffer.from(JSON.stringify(msg), 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  output.write(header);
  output.write(body);
}
