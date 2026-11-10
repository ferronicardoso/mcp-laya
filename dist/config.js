import { statSync } from 'node:fs';
import path from 'node:path';
/** Files `laya-ts` needs inside the model directory (produced by `export_onnx.py`). */
export const REQUIRED_MODEL_FILES = [
    'encoder.onnx',
    'head.onnx',
    'tokenizer.json',
    'rl_agent_config.json',
];
function isFile(p) {
    try {
        return statSync(p).isFile();
    }
    catch {
        return false;
    }
}
export function loadConfig(env = process.env) {
    const raw = env.LAYA_MODEL_DIR;
    if (!raw || raw.trim() === '') {
        throw new Error('LAYA_MODEL_DIR environment variable is not set. Set it to the directory with the ONNX export of a Laya checkpoint (see README: "Preparing the model").');
    }
    const modelDir = path.resolve(raw);
    let stats;
    try {
        stats = statSync(modelDir);
    }
    catch {
        throw new Error(`LAYA_MODEL_DIR points to a nonexistent path: ${modelDir}`);
    }
    if (!stats.isDirectory()) {
        throw new Error(`LAYA_MODEL_DIR is not a directory: ${modelDir}`);
    }
    const missing = REQUIRED_MODEL_FILES.filter((f) => !isFile(path.join(modelDir, f)));
    if (missing.length > 0) {
        throw new Error(`LAYA_MODEL_DIR (${modelDir}) is missing: ${missing.join(', ')}. ` +
            'It must contain the ONNX export of the checkpoint, not the raw Hugging Face download (see README: "Preparing the model").');
    }
    let numThreads;
    if (env.LAYA_NUM_THREADS !== undefined && env.LAYA_NUM_THREADS.trim() !== '') {
        const n = Number(env.LAYA_NUM_THREADS);
        if (!Number.isInteger(n) || n < 1) {
            throw new Error(`LAYA_NUM_THREADS must be a positive integer, got: ${env.LAYA_NUM_THREADS}`);
        }
        numThreads = n;
    }
    const preload = ['1', 'true', 'yes'].includes((env.LAYA_PRELOAD ?? '').trim().toLowerCase());
    return { modelDir, numThreads, preload };
}
//# sourceMappingURL=config.js.map