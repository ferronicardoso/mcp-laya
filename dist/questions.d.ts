/**
 * Validation and translation of tool arguments into Laya question definitions.
 * Pure functions, no model involved — everything here is unit-testable.
 */
export type QuestionType = 'choice' | 'score' | 'noul';
/** An option is either a bare key or a key with a description (descriptions help the model). */
export type OptionInput = string | {
    key: string;
    description?: string;
};
export interface QuestionSpec {
    /** Identifier used to key the answer. Auto-generated when omitted. */
    id?: string;
    type: QuestionType;
    question: string;
    options?: OptionInput[];
    levels?: string[];
}
/** Shape expected by `laya-ts` (`Agent.predict`). */
export interface LayaQuestionDef {
    type: QuestionType;
    instructions: string;
    criteria?: string[] | Record<string, string>;
}
export declare const MAX_TEXT_CHARS = 200000;
export declare const MAX_QUESTIONS = 20;
/** Above this, the checkpoint README says accuracy falls off sharply. */
export declare const RECOMMENDED_MAX_OPTIONS = 20;
export declare const MAX_OPTIONS = 100;
export declare const MIN_SCORE_LEVELS = 2;
export declare const MAX_SCORE_LEVELS = 10;
export interface BuiltQuestions {
    questions: Record<string, LayaQuestionDef>;
    warnings: string[];
}
export declare function validateText(text: unknown): string;
/**
 * Builds the `criteria` of a choice question.
 * - No descriptions at all -> list of keys.
 * - Some descriptions -> dict; options without description repeat their own key
 *   (same convention as the .NET proof of concept).
 */
export declare function buildChoiceCriteria(options: unknown, label?: string): {
    criteria: string[] | Record<string, string>;
    count: number;
};
export declare function buildScoreLevels(levels: unknown, label?: string): string[];
export declare function buildQuestion(spec: QuestionSpec, label?: string): {
    def: LayaQuestionDef;
    warnings: string[];
};
/** Builds a keyed set of questions for `laya_predict`. */
export declare function buildQuestionSet(specs: unknown): BuiltQuestions;
//# sourceMappingURL=questions.d.ts.map