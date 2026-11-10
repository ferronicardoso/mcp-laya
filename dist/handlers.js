import { buildQuestion, buildQuestionSet, validateText, } from './questions.js';
export const CALIBRATION_NOTE = 'Probabilities come from an uncalibrated model (temperature 1.0) and are systematically over-confident; use them to rank options, not as true likelihoods.';
function formatAnswer(id, a) {
    if (!a) {
        throw new Error(`The model returned no answer for question "${id}"`);
    }
    switch (a.type) {
        case 'choice':
            return {
                type: 'choice',
                choice: a.choice,
                probabilities: a.probabilities ?? {},
                confidence: a.answer_confidence ?? a.confidence ?? 0,
            };
        case 'score': {
            const probabilities = a.probabilities ?? {};
            const best = Object.entries(probabilities).sort((x, y) => y[1] - x[1])[0];
            return {
                type: 'score',
                score: a.score,
                level: best ? Number(best[0]) : Math.round(a.score),
                legend: a.legend ?? {},
                probabilities,
                confidence: a.answer_confidence ?? a.confidence ?? 0,
            };
        }
        case 'noul': {
            const probability = a.noul;
            return { type: 'noul', probability, answer: probability >= 0.5 };
        }
        default:
            throw new Error(`Unexpected answer type for question "${id}": ${String(a.type)}`);
    }
}
function usageSummary(result) {
    const u = result.usage ?? {};
    return {
        truncated: u.truncated === true,
        stateTokens: u.state_tokens,
        droppedTokens: u.state_tokens_dropped,
    };
}
function withExtras(payload, result, warnings) {
    const usage = usageSummary(result);
    const allWarnings = [...warnings];
    if (usage.truncated) {
        allWarnings.push(`The text was truncated by the model's token budget (${usage.droppedTokens ?? '?'} tokens dropped); the answer only reflects the beginning of the text.`);
    }
    return { ...payload, usage, ...(allWarnings.length > 0 ? { warnings: allWarnings } : {}) };
}
async function ask(engine, text, questions) {
    return engine.predict(text, questions);
}
export async function layaChoice(engine, params) {
    const text = validateText(params.text);
    const { def, warnings } = buildQuestion({ type: 'choice', question: params.question, options: params.options });
    const result = await ask(engine, text, { answer: def });
    return withExtras(formatAnswer('answer', result.answers['answer']), result, warnings);
}
export async function layaNoul(engine, params) {
    const text = validateText(params.text);
    const { def, warnings } = buildQuestion({ type: 'noul', question: params.question });
    const result = await ask(engine, text, { answer: def });
    return withExtras(formatAnswer('answer', result.answers['answer']), result, warnings);
}
export async function layaScore(engine, params) {
    const text = validateText(params.text);
    const { def, warnings } = buildQuestion({ type: 'score', question: params.question, levels: params.levels });
    const result = await ask(engine, text, { answer: def });
    return withExtras(formatAnswer('answer', result.answers['answer']), result, warnings);
}
export async function layaPredict(engine, params) {
    const text = validateText(params.text);
    const { questions, warnings } = buildQuestionSet(params.questions);
    const result = await ask(engine, text, questions);
    const answers = {};
    for (const id of Object.keys(questions)) {
        answers[id] = formatAnswer(id, result.answers[id]);
    }
    return withExtras({ answers }, result, warnings);
}
export async function layaStatus(engine) {
    return { ...(await engine.info()), calibration: CALIBRATION_NOTE };
}
//# sourceMappingURL=handlers.js.map