import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { DecisionEngine, RawResult } from '../src/engine.js';
import type { LayaQuestionDef } from '../src/questions.js';
import { layaChoice, layaNoul, layaPredict, layaScore, layaStatus } from '../src/handlers.js';

function fakeEngine(result: RawResult) {
  const calls: Array<{ text: string; questions: Record<string, LayaQuestionDef> }> = [];
  const engine: DecisionEngine = {
    async predict(text, questions) {
      calls.push({ text, questions });
      return result;
    },
    async info() {
      return { modelDir: '/m', loaded: true, maxLen: 1024 };
    },
  };
  return { engine, calls };
}

test('layaChoice sends a choice question and formats the answer', async () => {
  const { engine, calls } = fakeEngine({
    answers: {
      answer: {
        type: 'choice', choice: 'financeiro',
        probabilities: { financeiro: 0.9, suporte: 0.1 }, confidence: 0.5, answer_confidence: 0.9,
      },
    },
    usage: { truncated: false, state_tokens: 10 },
  });
  const out = await layaChoice(engine, { text: 'cobrança em duplicidade', question: 'Setor?', options: ['financeiro', 'suporte'] });
  assert.equal(out.choice, 'financeiro');
  assert.equal(out.confidence, 0.9);
  assert.deepEqual(calls[0].questions.answer, { type: 'choice', instructions: 'Setor?', criteria: ['financeiro', 'suporte'] });
  assert.equal(out.usage.truncated, false);
  assert.equal(out.warnings, undefined);
});

test('layaNoul reports probability and a boolean answer', async () => {
  const { engine } = fakeEngine({ answers: { answer: { type: 'noul', noul: 0.97 } } });
  const out = await layaNoul(engine, { text: 't', question: 'Ameaça cancelar?' });
  assert.equal(out.probability, 0.97);
  assert.equal(out.answer, true);
});

test('layaScore reports expected score and most probable level', async () => {
  const { engine, calls } = fakeEngine({
    answers: {
      answer: {
        type: 'score', score: 1.86, legend: { '0': 'baixa', '1': 'média', '2': 'alta' },
        probabilities: { '0': 0.01, '1': 0.12, '2': 0.87 }, confidence: 0.6, answer_confidence: 0.87,
      },
    },
  });
  const out = await layaScore(engine, { text: 't', question: 'Urgência?', levels: ['baixa', 'média', 'alta'] });
  assert.equal(out.level, 2);
  assert.equal(out.score, 1.86);
  assert.deepEqual(calls[0].questions.answer.criteria, ['baixa', 'média', 'alta']);
});

test('layaPredict keys answers by question id and surfaces truncation warnings', async () => {
  const { engine } = fakeEngine({
    answers: {
      dept: { type: 'choice', choice: 'a', probabilities: { a: 0.8, b: 0.2 }, answer_confidence: 0.8 },
      q2: { type: 'noul', noul: 0.1 },
    },
    usage: { truncated: true, state_tokens_dropped: 50 },
  });
  const out = await layaPredict(engine, {
    text: 't',
    questions: [
      { id: 'dept', type: 'choice', question: 'x?', options: ['a', 'b'] },
      { type: 'noul', question: 'y?' },
    ],
  });
  assert.deepEqual(Object.keys(out.answers), ['dept', 'q2']);
  assert.equal(out.answers.q2.type, 'noul');
  assert.match(out.warnings?.[0] ?? '', /truncated/);
});

test('handlers validate input before touching the engine', async () => {
  const { engine, calls } = fakeEngine({ answers: {} });
  await assert.rejects(() => layaChoice(engine, { text: '', question: 'q', options: ['a', 'b'] }), /text/);
  await assert.rejects(() => layaChoice(engine, { text: 't', question: 'q', options: ['a'] }), /at least 2/);
  assert.equal(calls.length, 0);
});

test('handlers fail clearly when the model omits an answer', async () => {
  const { engine } = fakeEngine({ answers: {} });
  await assert.rejects(() => layaNoul(engine, { text: 't', question: 'q?' }), /no answer/);
});

test('layaStatus includes the calibration caveat', async () => {
  const { engine } = fakeEngine({ answers: {} });
  const out = await layaStatus(engine);
  assert.equal(out.loaded, true);
  assert.match(out.calibration, /uncalibrated/);
});
