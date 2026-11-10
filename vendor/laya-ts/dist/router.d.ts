import { type AnalyseResult } from "./lang.js";
import { type PredictOptions, type QuestionDef, type SystemOneResult } from "./agent.js";
import { type LongPredictOptions, type LongResult } from "./predict-long.js";
import { type DecideOptions, type DecideBatchOptions, type DecisionResult } from "./structured.js";
import { HookRegistry, type HookArg, type PredictHook } from "./hooks.js";
export declare const BUNDLE_REPO = "convaiinnovations/laya";
export interface ModelSpec {
    repo: string;
    subfolder: string | null;
}
export declare const DEFAULT_MODELS: Record<string, ModelSpec>;
export declare const STANDALONE_MODELS: Record<string, string>;
export type ModelName = "english" | "multilingual" | "typed-decisions";
export declare function normaliseName(name: string): ModelName;
export declare function matchTypedDecisionsWorkflow(questions: Record<string, unknown> | null | undefined): string | null;
export declare function englishFromCode(value: unknown): boolean | null;
/** Parity alias for the Python `_english_from_code` name. */
export declare const _englishFromCode: typeof englishFromCode;
export interface RouteDecision {
    model: ModelName;
    repo: string;
    reason: string;
    detection: AnalyseResult | null;
    workflow: string | null;
}
export type RoutedResult = SystemOneResult & {
    routing: RouteDecision;
};
export type RoutedLongResult = LongResult & {
    routing: RouteDecision;
};
export type RoutedLongPredictOptions = RouteOptions & LongPredictOptions;
export type LangGuess = string | null | undefined | ((state: unknown) => unknown);
export type AgentLoader = (name: ModelName, spec: ModelSpec) => unknown | Promise<unknown>;
export interface RouterOptions {
    models?: Record<string, string | ModelSpec | [string, string | null]>;
    device?: string | null;
    token?: string | null;
    maxLoaded?: number;
    max_loaded?: number;
    /** Fallback for unidentified text. Defaults to "multilingual", matching Python 0.4.0. */
    default?: string;
    autoTaskDetection?: boolean;
    auto_task_detection?: boolean;
    standaloneRepos?: boolean;
    standalone_repos?: boolean;
    preload?: boolean | string[];
    langGuess?: LangGuess;
    lang_guess?: LangGuess;
    loader?: AgentLoader;
    /** Optional hub revision (commit SHA/branch/tag) applied to every checkpoint load. */
    revision?: string | null;
    /** Per-model revision overrides, keyed by model name or alias. */
    revisions?: Record<string, string | null>;
    /** Per-model artifact SHA-256 digest maps, keyed by model name or alias. */
    sha256Digests?: Record<string, Record<string, string> | null> | null;
    /** Python-parity snake_case alias for `sha256Digests`. */
    sha256_digests?: Record<string, Record<string, string> | null> | null;
    hooks?: HookArg;
    onPredictStart?: PredictHook;
    onPredictEnd?: PredictHook;
    hooksRaise?: boolean;
    /**
     * Per-hook time limit in seconds, applied to every hook this Router waits for; null or absent
     * means no limit. Python's `Router(hooks_timeout=...)`, the same bound `Agent` applies.
     */
    hooksTimeout?: number | null;
    /** Python-parity snake_case alias for `hooksTimeout`. */
    hooks_timeout?: number | null;
}
export interface RouteOptions {
    model?: string | null;
    task?: string | null;
    lang?: string | null;
    langGuess?: LangGuess;
    lang_guess?: LangGuess;
    hooks?: HookArg;
    hooksRaise?: boolean;
}
/**
 * Per-call options for `Router.predictBatch` / `predictMany`; `Router.routeBatch` takes the
 * same bag less the threshold, as `RouteBatchOptions`.
 * `hooks`, `onPredictStart` and `onPredictEnd` are composed the same way as on `predict`:
 * `setDefaultHooks` defaults, then installed hooks, then this call's hooks.
 * `null`, `undefined` and `[]` add nothing.
 * `hooksRaise` overrides the Router's policy for this call, including `onRoute`.
 * The start and end callables apply to each request's predict lifecycle, not to routing.
 * `minConfidence` (Python's `min_confidence`, #361/#394) is the opt-in abstention threshold
 * `predict` takes: either a number in [0.0, 1.0] or a per-bucket map. Every request's answers
 * below it come back marked `low_confidence: true`, and each request's `onPredictEnd` hooks see
 * the mark. `null` or absent writes nothing, exactly as on `predict`.
 */
export interface PredictBatchOptions {
    hooks?: HookArg;
    onPredictStart?: PredictHook;
    onPredictEnd?: PredictHook;
    hooksRaise?: boolean;
    minConfidence?: PredictOptions["minConfidence"];
    /** Python parity alias for minConfidence. */
    min_confidence?: PredictOptions["min_confidence"];
}
/**
 * What `Router.routeBatch` takes: `PredictBatchOptions` without the abstention threshold.
 * Routing runs no inference, so there is nothing there for a threshold to gate, and Python's
 * `route_batch` takes no `min_confidence` either. The type says so, rather than letting
 * `router.routeBatch(requests, { minConfidence: 0.8 })` read like a request for gating that
 * silently asked for none.
 */
export type RouteBatchOptions = Omit<PredictBatchOptions, "minConfidence" | "min_confidence">;
/** One item of a Router.predictBatch/routeBatch batch: state, questions, route and budget overrides. */
export interface BatchRequest {
    state: unknown;
    questions: Record<string, QuestionDef>;
    model?: string | null;
    task?: string | null;
    lang?: string | null;
    langGuess?: LangGuess;
    lang_guess?: LangGuess;
    /** Per-request token budgets; null = agent config. Start hooks may override them. */
    maxLen?: number | null;
    headMaxLen?: number | null;
}
/** Turn `LAYA_SHA256_DIGESTS` into per-checkpoint digest maps when it names models. */
export declare function digestsFromEnv(models: Record<string, unknown>): Record<string, Record<string, string> | null>;
export declare const _digestsFromEnv: typeof digestsFromEnv;
export declare const _digests_from_env: typeof digestsFromEnv;
export declare class Router extends HookRegistry {
    hooksRaise: boolean;
    hooksTimeout: number | null;
    models: Record<string, ModelSpec>;
    device: string | null;
    token: string | null | undefined;
    revision: string | null;
    revisions: Partial<Record<ModelName, string | null>>;
    sha256Digests: Record<string, Record<string, string> | null>;
    get sha256_digests(): Record<string, Record<string, string> | null>;
    maxLoaded: number;
    default: ModelName;
    autoTaskDetection: boolean;
    langGuess: LangGuess;
    loader: AgentLoader | null;
    _agents: Map<string, unknown>;
    _order: string[];
    private readonly _loading;
    constructor(opts?: RouterOptions);
    /** `hooksTimeout` in the milliseconds `dispatchAsync` races against; null starts no timer. */
    private get hooksTimeoutMs();
    load(name: string): Promise<unknown>;
    _touch(key: string): void;
    /** Drop least-recently-used agents until `maxLoaded` holds. Returns evicted names. */
    _evict(): string[];
    attach(name: string, agent: unknown): unknown;
    preload(names?: string[]): Promise<this>;
    unload(name?: string | null): void;
    get loaded(): string[];
    _resolveHint(hint: LangGuess, state: unknown): boolean | null;
    /**
     * Decide which checkpoint to use, then let `onRoute` hooks observe or replace the decision.
     *
     * `ctx.decision` is the RouteDecision; a hook may replace it (for example to pin a
     * checkpoint) and the replacement is what gets returned and used. `opts.hooks` are
     * per-call hooks, appended after any installed on the Router.
     */
    route(state: unknown, questions?: Record<string, unknown> | null, opts?: RouteOptions): RouteDecision;
    /** Decide which checkpoint to use, without loading, running, or hooking anything. */
    _route(state: unknown, questions?: Record<string, unknown> | null, opts?: RouteOptions): RouteDecision;
    /**
     * Route, then answer every question in one forward pass on the chosen checkpoint.
     *
     * The result is the usual systemOne payload plus a `routing` key recording the decision.
     * Router-level `onPredictStart` / `onPredictEnd` hooks wrap the whole route+infer call and
     * see `ctx.decision`; see hooks.ts.
     */
    predict(state: unknown, questions: Record<string, QuestionDef>, opts?: RouteOptions & PredictOptions): Promise<RoutedResult>;
    /** Route the document once, then scan it using the selected Agent's window budget. */
    predictLong(state: unknown, questions: Record<string, QuestionDef>, opts?: RoutedLongPredictOptions): Promise<RoutedLongResult>;
    private _predict;
    /**
     * Answer `state` against a JSON schema (or explicit `opts.questions`) and return typed
     * values — see `structured.ts`. Routing options (`model`, `task`, ...) are forwarded to
     * `predict`.
     */
    decide(state: unknown, schema: unknown, opts: DecideOptions & RouteOptions & PredictOptions & {
        returnDetails: true;
    }): Promise<DecisionResult>;
    decide(state: unknown, schema?: unknown, opts?: DecideOptions & RouteOptions & PredictOptions): Promise<Record<string, unknown>>;
    /**
     * Answer many states against one schema in one batched call (Python `Router.decide_batch` parity).
     * Requests route per state and evaluate through `predictBatch` (grouped forward passes, results
     * in input order). See `structured.ts`.
     */
    decideBatch(states: unknown[], schema: unknown, opts: DecideBatchOptions & RouteOptions & PredictOptions & {
        returnDetails: true;
    }): Promise<DecisionResult[]>;
    decideBatch(states: unknown[], schema?: unknown, opts?: DecideBatchOptions & RouteOptions & PredictOptions): Promise<Record<string, unknown>[]>;
    systemOne(state: unknown, questions: Record<string, QuestionDef>, opts?: RouteOptions & PredictOptions): Promise<RoutedResult>;
    /**
     * Route many requests in one call (Python `Router.route_batch` parity). Every request is
     * validated before anything loads, so a malformed batch fails fast. Entries keep input
     * order; routing is deterministic, so repeated batches route identically.
     */
    routeBatch(requests: BatchRequest[], opts?: RouteBatchOptions): RouteDecision[];
    /**
     * Route and run many requests in one call (Python `Router.predict_batch` parity).
     * Requests are routed first, then grouped by checkpoint so each loaded Agent scores its
     * requests in as few forward passes as possible; results are restored to input order.
     * The group key is the resolved checkpoint, so an `onRoute` pin that spells it as an alias
     * ("ml") shares the canonical group's pass instead of splitting into a second forward pass.
     * Requests routed to the same checkpoint still split into separate `predictBatch` calls
     * when their question schemas differ (order-sensitively), when per-request start hooks
     * set different maxLen/headMaxLen overrides, or — for an agent carrying
     * `lang_temperatures` — when their languages differ: each request's effective language
     * (an explicit `lang`, otherwise the detected non-English one) is forwarded so the
     * batched path scores exactly like `predict`.
     *
     * Router-level predict hooks run per request: each request gets its own PredictContext
     * carrying `decision`; `onPredictStart` may rewrite a request or `ctx.skip()` it, and
     * `onPredictEnd` runs once per started request even when the batch fails.
     * `opts.hooks`, `opts.onPredictStart` and `opts.onPredictEnd` are composed the way `predict`
     * composes them: `setDefaultHooks` defaults, then installed hooks, then this call's hooks.
     * `null` and `[]` add nothing. `hooks`
     * also run `onRoute`. `opts.hooksRaise` overrides the Router's policy for this call, the way
     * `predict` uses `opts.hooksRaise ?? this.hooksRaise`.
     * `opts.minConfidence` (or `min_confidence`) is the abstention threshold `predict` takes, and it
     * gates this call the same way: validated on the entry line, before anything routes or loads,
     * and applied to every request's answers before its `onPredictEnd` runs. A batch is not a
     * second-class entry point for it -- an audit hook on either path sees the same marker.
     */
    predictBatch(requests: BatchRequest[], batchSize?: number | null, opts?: PredictBatchOptions): Promise<RoutedResult[]>;
    /** Alias of predictBatch, mirroring Python's `Router.predict_many`. */
    predictMany(requests: BatchRequest[], batchSize?: number | null, opts?: PredictBatchOptions): Promise<RoutedResult[]>;
    /**
     * Run onPredictEnd for every started per-request context and raise the first hook
     * failure, if any. Elapsed and usage are stamped on every context before any end hook
     * runs, so one request's end hooks never inflate another request's elapsed time.
     *
     * The end hooks run in REVERSE start order, because every request started before any
     * ended: a hook that opens something in start and closes it in end (a tracing span, an
     * `AsyncLocalStorage` frame, an in-flight counter) must unwind the last one first, or it
     * closes the wrong frame and every request after the first inherits a corrupted context.
     * Python's `Router.predict_batch` ends its contexts the same way and says so
     * (`laya/router.py::_end_contexts`).
     */
    private _endContexts;
}
