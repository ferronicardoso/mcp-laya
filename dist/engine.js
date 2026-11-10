import { readFile } from 'node:fs/promises';
import path from 'node:path';
/**
 * Lazily loads the ONNX model on first use and serializes predictions
 * (a single CPU-bound session; concurrent requests simply queue).
 */
export class LayaEngine {
    config;
    agent;
    loadMs;
    queue = Promise.resolve();
    constructor(config) {
        this.config = config;
    }
    /** Starts (or awaits) the model load. */
    load() {
        if (!this.agent) {
            this.agent = (async () => {
                // Vendored build of laya-ts (not an npm dependency; see README, "About vendor/laya-ts").
                const { Agent } = await import('../vendor/laya-ts/dist/index.js');
                const started = Date.now();
                const agent = (await Agent.load(this.config.modelDir, {
                    numThreads: this.config.numThreads,
                }));
                this.loadMs = Date.now() - started;
                return agent;
            })();
            // A failed load must be retried on the next call, not cached forever.
            this.agent.catch(() => {
                this.agent = undefined;
            });
        }
        return this.agent;
    }
    async predict(text, questions, options) {
        const run = async () => {
            const agent = await this.load();
            if (options?.checkStability) {
                const { OptionStabilityHook } = await import('../vendor/laya-ts/dist/index.js');
                // Uncalibrated on purpose (accept/escalate null): we report the raw signal, not a decision.
                const hook = new OptionStabilityHook({ accept: null, escalate: null, variants: 'fast' });
                return agent.predict(text, questions, { hooks: [hook] });
            }
            return agent.predict(text, questions);
        };
        const result = this.queue.then(run, run);
        this.queue = result.catch(() => undefined);
        return result;
    }
    async info() {
        const info = {
            modelDir: this.config.modelDir,
            loaded: this.agent !== undefined && this.loadMs !== undefined,
            loadMs: this.loadMs,
        };
        try {
            const cfg = JSON.parse(await readFile(path.join(this.config.modelDir, 'rl_agent_config.json'), 'utf8'));
            info.maxLen = cfg.max_len;
            info.headMaxLen = cfg.head_max_len;
            info.encoder = cfg.encoder;
            info.temperature = cfg.temperature;
        }
        catch {
            // config is informational only
        }
        return info;
    }
}
//# sourceMappingURL=engine.js.map