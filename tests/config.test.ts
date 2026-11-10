import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig, REQUIRED_MODEL_FILES } from '../src/config.js';

function makeModelDir(files: readonly string[] = REQUIRED_MODEL_FILES): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'mcp-laya-test-'));
  for (const f of files) writeFileSync(path.join(dir, f), '');
  return dir;
}

test('loadConfig fails when LAYA_MODEL_DIR is missing or invalid', () => {
  assert.throws(() => loadConfig({}), /LAYA_MODEL_DIR environment variable is not set/);
  assert.throws(() => loadConfig({ LAYA_MODEL_DIR: '/nonexistent/laya' }), /nonexistent/);
  const file = path.join(makeModelDir(), 'head.onnx');
  assert.throws(() => loadConfig({ LAYA_MODEL_DIR: file }), /not a directory/);
});

test('loadConfig lists the missing model files', () => {
  const dir = makeModelDir(['tokenizer.json']);
  assert.throws(() => loadConfig({ LAYA_MODEL_DIR: dir }), /encoder\.onnx, head\.onnx, rl_agent_config\.json/);
});

test('loadConfig accepts a complete model dir and parses optional settings', () => {
  const dir = makeModelDir();
  const cfg = loadConfig({ LAYA_MODEL_DIR: dir, LAYA_NUM_THREADS: '4', LAYA_PRELOAD: 'TRUE' });
  assert.equal(cfg.modelDir, path.resolve(dir));
  assert.equal(cfg.numThreads, 4);
  assert.equal(cfg.preload, true);
  assert.equal(loadConfig({ LAYA_MODEL_DIR: dir }).preload, false);
  assert.throws(() => loadConfig({ LAYA_MODEL_DIR: dir, LAYA_NUM_THREADS: '0' }), /positive integer/);
});
