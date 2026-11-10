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
    reliability?: RawReliability;
    [k: string]: unknown;
}
/** Report produced by laya-ts' OptionStabilityHook for a choice answer. */
export interface RawReliability {
    soft_stability: number | null;
    stability: number | null;
    n_variants: number;
    distinct_choices: string[];
    variant_choices: Record<string, string | null>;
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
export interface PredictCallOptions {
    /** Re-ask every choice question with reordered / relabeled options and report whether the answer holds. */
    checkStability?: boolean;
}
export interface DecisionEngine {
    predict(text: string, questions: Record<string, LayaQuestionDef>, options?: PredictCallOptions): Promise<RawResult>;
    info(): Promise<ModelInfo>;
}
interface LayaAgentLike {
    predict(state: unknown, questions: Record<string, LayaQuestionDef>, options?: {
        hooks?: unknown[];
    }): Promise<RawResult>;
}
/**
 * Lazily loads the ONNX model on first use and serializes predictions
 * (a single CPU-bound session; concurrent requests simply queue).
 */
export declare class LayaEngine implements DecisionEngine {
    private readonly config;
    private agent?;
    private loadMs?;
    private queue;
    constructor(config: LayaConfig);
    /** Starts (or awaits) the model load. */
    load(): Promise<LayaAgentLike>;
    predict(text: string, questions: Record<string, LayaQuestionDef>, options?: PredictCallOptions): Promise<RawResult>;
    info(): Promise<ModelInfo>;
}
export {};
//# sourceMappingURL=engine.d.ts.map