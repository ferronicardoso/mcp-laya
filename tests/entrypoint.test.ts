import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { REQUIRED_MODEL_FILES } from '../src/config.js';

// Regression: launched through a symlink (npm bin, linked folders), the server used to
// exit silently because process.argv[1] (link path) != import.meta.url (real path).
test('server starts and answers initialize when launched through a symlink', { timeout: 20_000 }, async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'mcp-laya-entry-'));
  const modelDir = path.join(tmp, 'model');
  await import('node:fs').then((fs) => fs.mkdirSync(modelDir));
  for (const f of REQUIRED_MODEL_FILES) writeFileSync(path.join(modelDir, f), '');

  // dist-test/tests/entrypoint.test.js -> dist-test/src/index.js
  const realEntry = path.resolve(import.meta.dirname, '..', 'src', 'index.js');
  const link = path.join(tmp, 'mcp-laya-link.js');
  symlinkSync(realEntry, link);

  const child = spawn(process.execPath, [link], {
    env: { ...process.env, LAYA_MODEL_DIR: modelDir, MCP_TRANSPORT: 'stdio' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  try {
    const reply = new Promise<string>((resolve, reject) => {
      let out = '';
      child.stdout.on('data', (d) => {
        out += d;
        if (out.includes('\n')) resolve(out);
      });
      child.on('exit', (code) => reject(new Error(`server exited early (code ${code}) without replying`)));
    });
    child.stdin.write(
      JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'initialize',
        params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 't', version: '1' } },
      }) + '\n'
    );
    assert.match(await reply, /"serverInfo":\{"name":"mcp-laya"/);
  } finally {
    child.kill();
  }
});
