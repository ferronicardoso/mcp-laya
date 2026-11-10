import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { LayaConfig } from './config.js';
import type { LayaQuestionDef } from './questions.js';

/** Minimal view of what `laya-ts` returns, so handlers do not depend on its types. */
export interface RawAnswer {
  type: 'choice' | 'score' | 'noul';
  choice?: string;
  score?: number;
  noul?: number;
  probabilities?: Record<string, number>;
  legend?: Record<string, string>;
  confidence?: number;
  answer_confidence?: number;
  [k: string]: unknown;
}

export interface RawResult {
  answers: Record<string, RawAnswer>;
  usage?: {
    truncated?: boolean;
    state_tokens?: number;
    state_tokens_dropped?: number;
    truncated_questions?: string[];
    [k: string]: unknown;
  };
}

export interface ModelInfo {
  modelDir: string;
  loaded: boolean;
  loadMs?: number;
  maxLen?: number;
  headMaxLen?: number;
  encoder?: string;
  temperature?: unknown;
}

export interface DecisionEngine {
  predict(text: string, questions: Record<string, LayaQuestionDef>): Promise<RawResult>;
  info(): Promise<ModelInfo>;
}

interface LayaAgentLike {
  predict(state: unknown, questions: Record<string, LayaQuestionDef>): Promise<RawResult>;
}

/**
 * Lazily loads the ONNX model on first use and serializes predictions
 * (a single CPU-bound session; concurrent requests simply queue).
 */
export class LayaEngine implements DecisionEngine {
  private agent?: Promise<LayaAgentLike>;
  private loadMs?: number;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly config: LayaConfig) {}

  /** Starts (or awaits) the model load. */
  load(): Promise<LayaAgentLike> {
    if (!this.agent) {
      this.agent = (async () => {
        // Vendored build of laya-ts (not an npm dependency; see README, "About vendor/laya-ts").
        const { Agent } = await import('../vendor/laya-ts/dist/index.js');
        const started = Date.now();
        const agent = (await Agent.load(this.config.modelDir, {
          numThreads: this.config.numThreads,
        })) as unknown as LayaAgentLike;
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

  async predict(text: string, questions: Record<string, LayaQuestionDef>): Promise<RawResult> {
    const run = async () => {
      const agent = await this.load();
      return agent.predict(text, questions);
    };
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => undefined);
    return result;
  }

  async info(): Promise<ModelInfo> {
    const info: ModelInfo = {
      modelDir: this.config.modelDir,
      loaded: this.agent !== undefined && this.loadMs !== undefined,
      loadMs: this.loadMs,
    };
    try {
      const cfg = JSON.parse(
        await readFile(path.join(this.config.modelDir, 'rl_agent_config.json'), 'utf8')
      ) as { max_len?: number; head_max_len?: number; encoder?: string; temperature?: unknown };
      info.maxLen = cfg.max_len;
      info.headMaxLen = cfg.head_max_len;
      info.encoder = cfg.encoder;
      info.temperature = cfg.temperature;
    } catch {
      // config is informational only
    }
    return info;
  }
}
