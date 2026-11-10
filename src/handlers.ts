import type { DecisionEngine, RawAnswer, RawResult } from './engine.js';
import {
  buildQuestion,
  buildQuestionSet,
  validateText,
  type LayaQuestionDef,
  type OptionInput,
} from './questions.js';

export const CALIBRATION_NOTE =
  'Probabilities come from an uncalibrated model (temperature 1.0) and are systematically over-confident; use them to rank options, not as true likelihoods.';

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

function formatAnswer(id: string, a: RawAnswer | undefined): AnswerOutput {
  if (!a) {
    throw new Error(`The model returned no answer for question "${id}"`);
  }
  switch (a.type) {
    case 'choice':
      return {
        type: 'choice',
        choice: a.choice as string,
        probabilities: a.probabilities ?? {},
        confidence: a.answer_confidence ?? a.confidence ?? 0,
      };
    case 'score': {
      const probabilities = a.probabilities ?? {};
      const best = Object.entries(probabilities).sort((x, y) => y[1] - x[1])[0];
      return {
        type: 'score',
        score: a.score as number,
        level: best ? Number(best[0]) : Math.round(a.score as number),
        legend: a.legend ?? {},
        probabilities,
        confidence: a.answer_confidence ?? a.confidence ?? 0,
      };
    }
    case 'noul': {
      const probability = a.noul as number;
      return { type: 'noul', probability, answer: probability >= 0.5 };
    }
    default:
      throw new Error(`Unexpected answer type for question "${id}": ${String((a as RawAnswer).type)}`);
  }
}

function usageSummary(result: RawResult): { truncated: boolean; stateTokens?: number; droppedTokens?: number } {
  const u = result.usage ?? {};
  return {
    truncated: u.truncated === true,
    stateTokens: u.state_tokens,
    droppedTokens: u.state_tokens_dropped,
  };
}

function withExtras<T extends object>(
  payload: T,
  result: RawResult,
  warnings: string[]
): T & { usage: ReturnType<typeof usageSummary>; warnings?: string[] } {
  const usage = usageSummary(result);
  const allWarnings = [...warnings];
  if (usage.truncated) {
    allWarnings.push(
      `The text was truncated by the model's token budget (${usage.droppedTokens ?? '?'} tokens dropped); the answer only reflects the beginning of the text.`
    );
  }
  return { ...payload, usage, ...(allWarnings.length > 0 ? { warnings: allWarnings } : {}) };
}

async function ask(
  engine: DecisionEngine,
  text: string,
  questions: Record<string, LayaQuestionDef>
): Promise<RawResult> {
  return engine.predict(text, questions);
}

export async function layaChoice(
  engine: DecisionEngine,
  params: { text: string; question: string; options: OptionInput[] }
) {
  const text = validateText(params.text);
  const { def, warnings } = buildQuestion({ type: 'choice', question: params.question, options: params.options });
  const result = await ask(engine, text, { answer: def });
  return withExtras(formatAnswer('answer', result.answers['answer']) as ChoiceOutput, result, warnings);
}

export async function layaNoul(engine: DecisionEngine, params: { text: string; question: string }) {
  const text = validateText(params.text);
  const { def, warnings } = buildQuestion({ type: 'noul', question: params.question });
  const result = await ask(engine, text, { answer: def });
  return withExtras(formatAnswer('answer', result.answers['answer']) as NoulOutput, result, warnings);
}

export async function layaScore(
  engine: DecisionEngine,
  params: { text: string; question: string; levels: string[] }
) {
  const text = validateText(params.text);
  const { def, warnings } = buildQuestion({ type: 'score', question: params.question, levels: params.levels });
  const result = await ask(engine, text, { answer: def });
  return withExtras(formatAnswer('answer', result.answers['answer']) as ScoreOutput, result, warnings);
}

export async function layaPredict(engine: DecisionEngine, params: { text: string; questions: unknown }) {
  const text = validateText(params.text);
  const { questions, warnings } = buildQuestionSet(params.questions);
  const result = await ask(engine, text, questions);
  const answers: Record<string, AnswerOutput> = {};
  for (const id of Object.keys(questions)) {
    answers[id] = formatAnswer(id, result.answers[id]);
  }
  return withExtras({ answers }, result, warnings);
}

export async function layaStatus(engine: DecisionEngine) {
  return { ...(await engine.info()), calibration: CALIBRATION_NOTE };
}
