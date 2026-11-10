/**
 * Validation and translation of tool arguments into Laya question definitions.
 * Pure functions, no model involved — everything here is unit-testable.
 */
export const MAX_TEXT_CHARS = 200_000;
export const MAX_QUESTIONS = 20;
/** Above this, the checkpoint README says accuracy falls off sharply. */
export const RECOMMENDED_MAX_OPTIONS = 20;
export const MAX_OPTIONS = 100;
export const MIN_SCORE_LEVELS = 2;
export const MAX_SCORE_LEVELS = 10;
function requireNonEmptyString(value, label) {
    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`${label} must be a non-empty string`);
    }
    return value.trim();
}
export function validateText(text) {
    const value = requireNonEmptyString(text, 'text');
    if (value.length > MAX_TEXT_CHARS) {
        throw new Error(`text is too long (${value.length} chars, max ${MAX_TEXT_CHARS})`);
    }
    return value;
}
/**
 * Builds the `criteria` of a choice question.
 * - No descriptions at all -> list of keys.
 * - Some descriptions -> dict; options without description repeat their own key
 *   (same convention as the .NET proof of concept).
 */
export function buildChoiceCriteria(options, label = 'options') {
    if (!Array.isArray(options)) {
        throw new Error(`${label} must be an array with at least 2 options`);
    }
    if (options.length < 2) {
        throw new Error(`${label} needs at least 2 options (got ${options.length})`);
    }
    if (options.length > MAX_OPTIONS) {
        throw new Error(`${label} has too many options (${options.length}, max ${MAX_OPTIONS})`);
    }
    const parsed = options.map((opt, i) => {
        if (typeof opt === 'string') {
            return { key: requireNonEmptyString(opt, `${label}[${i}]`), description: undefined };
        }
        if (typeof opt === 'object' && opt !== null && !Array.isArray(opt)) {
            const o = opt;
            const key = requireNonEmptyString(o.key, `${label}[${i}].key`);
            let description;
            if (o.description !== undefined && o.description !== null) {
                description = requireNonEmptyString(o.description, `${label}[${i}].description`);
            }
            return { key, description };
        }
        throw new Error(`${label}[${i}] must be a string or an object { key, description? }`);
    });
    const seen = new Set();
    for (const { key } of parsed) {
        const norm = key.toLowerCase();
        if (seen.has(norm)) {
            throw new Error(`${label} has duplicate key: "${key}" (keys are compared case-insensitively)`);
        }
        seen.add(norm);
    }
    if (parsed.every((p) => p.description === undefined)) {
        return { criteria: parsed.map((p) => p.key), count: parsed.length };
    }
    const criteria = {};
    for (const p of parsed) {
        criteria[p.key] = p.description ?? p.key;
    }
    return { criteria, count: parsed.length };
}
export function buildScoreLevels(levels, label = 'levels') {
    if (!Array.isArray(levels)) {
        throw new Error(`${label} must be an array of level descriptions, lowest level first`);
    }
    if (levels.length < MIN_SCORE_LEVELS || levels.length > MAX_SCORE_LEVELS) {
        throw new Error(`${label} needs between ${MIN_SCORE_LEVELS} and ${MAX_SCORE_LEVELS} levels (got ${levels.length})`);
    }
    return levels.map((l, i) => requireNonEmptyString(l, `${label}[${i}]`));
}
export function buildQuestion(spec, label = 'question') {
    const instructions = requireNonEmptyString(spec.question, `${label}.question`);
    const warnings = [];
    switch (spec.type) {
        case 'choice': {
            const { criteria, count } = buildChoiceCriteria(spec.options, `${label}.options`);
            if (count > RECOMMENDED_MAX_OPTIONS) {
                warnings.push(`${label}: ${count} options exceeds the recommended ${RECOMMENDED_MAX_OPTIONS}; accuracy drops sharply with large option sets.`);
            }
            return { def: { type: 'choice', instructions, criteria }, warnings };
        }
        case 'score':
            return {
                def: { type: 'score', instructions, criteria: buildScoreLevels(spec.levels, `${label}.levels`) },
                warnings,
            };
        case 'noul':
            return { def: { type: 'noul', instructions }, warnings };
        default:
            throw new Error(`${label}.type must be one of "choice", "score", "noul" (got ${JSON.stringify(spec.type)})`);
    }
}
/** Builds a keyed set of questions for `laya_predict`. */
export function buildQuestionSet(specs) {
    if (!Array.isArray(specs) || specs.length === 0) {
        throw new Error('questions must be a non-empty array');
    }
    if (specs.length > MAX_QUESTIONS) {
        throw new Error(`too many questions (${specs.length}, max ${MAX_QUESTIONS})`);
    }
    const questions = {};
    const warnings = [];
    specs.forEach((raw, i) => {
        if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
            throw new Error(`questions[${i}] must be an object`);
        }
        const spec = raw;
        const id = spec.id === undefined || spec.id === null
            ? `q${i + 1}`
            : requireNonEmptyString(spec.id, `questions[${i}].id`);
        if (Object.prototype.hasOwnProperty.call(questions, id)) {
            throw new Error(`questions[${i}].id is duplicated: "${id}"`);
        }
        const built = buildQuestion(spec, `questions[${i}]`);
        questions[id] = built.def;
        warnings.push(...built.warnings);
    });
    return { questions, warnings };
}
//# sourceMappingURL=questions.js.map