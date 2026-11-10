import type { OptionStats } from "./common.js";
import type { Agent, QuestionDef, SystemAnswer, PredictOptions } from "./agent.js";
import type { HookArg, PredictContext, PredictHook } from "./hooks.js";
export interface LongWindow {
    index: number;
    token_start: number;
    token_end: number;
    count: number;
}
export type LongAnswer = SystemAnswer & {
    window?: LongWindow;
};
/** Long scans sum numeric usage, including boolean truncation flags. */
export interface LongUsage {
    input_tokens: number;
    output_tokens: number;
    windows: number;
    state_tokens?: number;
    state_tokens_dropped?: number;
    truncated?: boolean | number;
    truncated_questions?: string[];
    options?: Record<string, OptionStats>;
    [key: string]: unknown;
}
export interface LongResult {
    model: string;
    answers: Record<string, LongAnswer>;
    usage: LongUsage;
}
export interface LongPredictOptions {
    window?: number | null;
    stride?: number | null;
    aggregate?: "auto";
    batchSize?: number | null;
    lang?: string | null;
    hooks?: HookArg;
    onPredictStart?: PredictHook;
    onPredictEnd?: PredictHook;
    hooksRaise?: boolean;
    hooksTimeout?: number | null;
}
/** Validate values supplied by hooks without widening ordinary prediction types. */
export declare function validateLongResult(value: unknown, label?: string, requireWindows?: boolean): asserts value is LongResult;
/** Cache results are copied; counting a skipped scan must not mutate the caller's cache. */
export declare function skippedLongResult(value: unknown): LongResult;
export declare function validateLongOptions(opts: LongPredictOptions): void;
export declare function isLongCall(opts: PredictOptions): boolean;
/** The short public systemOne path returns just the first result; retain its final count. */
export declare function finishLongResults(opts: PredictOptions, ctx: PredictContext): void;
/** Internal dispatcher boundary: record inference results before any end hook can edit them. */
export declare function recordLongResults(opts: PredictOptions, ctx: PredictContext): void;
export declare function predictLong(agent: Agent, state: unknown, questions: Record<string, QuestionDef>, opts: LongPredictOptions): Promise<LongResult>;
