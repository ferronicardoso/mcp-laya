/** Files `laya-ts` needs inside the model directory (produced by `export_onnx.py`). */
export declare const REQUIRED_MODEL_FILES: readonly ["encoder.onnx", "head.onnx", "tokenizer.json", "rl_agent_config.json"];
export interface LayaConfig {
    modelDir: string;
    /** Threads for ONNX Runtime (undefined = runtime default). */
    numThreads?: number;
    /** Load the model at startup instead of on the first call. */
    preload: boolean;
}
export declare function loadConfig(env?: NodeJS.ProcessEnv): LayaConfig;
//# sourceMappingURL=config.d.ts.map