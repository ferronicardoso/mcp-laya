import type { DecisionEngine, RawResult } from './engine.js';
import { type OptionInput } from './questions.js';
export declare const CALIBRATION_NOTE = "Probabilities come from an uncalibrated model (temperature 1.0) and are systematically over-confident; use them to rank options, not as true likelihoods.";
export interface ChoiceOutput {
    type: 'choice';
    choice: string;
    probabilities: Record<string, number>;
    confidence: number;
}
export interface ScoreOutput {
    type: 'score';
    /** Expected level (0-based index into `legend`), fractional. */
    score: number;
    /** Most probable level (0-based). */
    level: number;
    legend: Record<string, string>;
    probabilities: Record<string, number>;
    confidence: number;
}
export interface NoulOutput {
    type: 'noul';
    /** Probability that the statement is true. */
    probability: number;
    answer: boolean;
}
export type AnswerOutput = ChoiceOutput | ScoreOutput | NoulOutput;
declare function usageSummary(result: RawResult): {
    truncated: boolean;
    stateTokens?: number;
    droppedTokens?: number;
};
export declare function layaChoice(engine: DecisionEngine, params: {
    text: string;
    question: string;
    options: OptionInput[];
}): Promise<ChoiceOutput & {
    usage: ReturnType<typeof usageSummary>;
    warnings?: string[];
}>;
export declare function layaNoul(engine: DecisionEngine, params: {
    text: string;
    question: string;
}): Promise<NoulOutput & {
    usage: ReturnType<typeof usageSummary>;
    warnings?: string[];
}>;
export declare function layaScore(engine: DecisionEngine, params: {
    text: string;
    question: string;
    levels: string[];
}): Promise<ScoreOutput & {
    usage: ReturnType<typeof usageSummary>;
    warnings?: string[];
}>;
export declare function layaPredict(engine: DecisionEngine, params: {
    text: string;
    questions: unknown;
}): Promise<{
    answers: Record<string, AnswerOutput>;
} & {
    usage: ReturnType<typeof usageSummary>;
    warnings?: string[];
}>;
export declare function layaStatus(engine: DecisionEngine): Promise<{
    calibration: string;
    modelDir: string;
    loaded: boolean;
    loadMs?: number;
    maxLen?: number;
    headMaxLen?: number;
    encoder?: string;
    temperature?: unknown;
}>;
export {};
//# sourceMappingURL=handlers.d.ts.map