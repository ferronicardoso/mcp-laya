import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChoiceCriteria,
  buildQuestion,
  buildQuestionSet,
  buildScoreLevels,
  validateText,
} from '../src/questions.js';

test('validateText trims and rejects empty / oversized text', () => {
  assert.equal(validateText('  oi  '), 'oi');
  assert.throws(() => validateText('   '), /text/);
  assert.throws(() => validateText(42), /text/);
  assert.throws(() => validateText('x'.repeat(200_001)), /too long/);
});

test('choice criteria: bare keys become a list', () => {
  const { criteria, count } = buildChoiceCriteria(['a', 'b']);
  assert.deepEqual(criteria, ['a', 'b']);
  assert.equal(count, 2);
});

test('choice criteria: partial descriptions become a dict, missing ones repeat the key', () => {
  const { criteria } = buildChoiceCriteria([{ key: 'financeiro', description: 'faturas' }, 'suporte']);
  assert.deepEqual(criteria, { financeiro: 'faturas', suporte: 'suporte' });
});

test('choice criteria: rejects fewer than 2, duplicates (case-insensitive) and bad items', () => {
  assert.throws(() => buildChoiceCriteria(['a']), /at least 2/);
  assert.throws(() => buildChoiceCriteria('a'), /array/);
  assert.throws(() => buildChoiceCriteria(['A', 'a']), /duplicate/);
  assert.throws(() => buildChoiceCriteria(['a', 3]), /string or an object/);
  assert.throws(() => buildChoiceCriteria(['a', { description: 'x' }]), /key/);
  assert.throws(() => buildChoiceCriteria(Array.from({ length: 101 }, (_, i) => `o${i}`)), /too many/);
});

test('score levels: bounds and non-empty entries', () => {
  assert.deepEqual(buildScoreLevels(['baixa', 'alta']), ['baixa', 'alta']);
  assert.throws(() => buildScoreLevels(['x']), /between/);
  assert.throws(() => buildScoreLevels(['x', ' ']), /levels\[1\]/);
  assert.throws(() => buildScoreLevels(undefined), /array/);
});

test('buildQuestion warns about more than 20 options', () => {
  const options = Array.from({ length: 21 }, (_, i) => `o${i}`);
  const { warnings } = buildQuestion({ type: 'choice', question: 'q', options });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /recommended/);
});

test('buildQuestion rejects an unknown type', () => {
  assert.throws(() => buildQuestion({ type: 'other' as never, question: 'q' }), /type/);
});

test('buildQuestionSet generates ids, keeps explicit ones and rejects duplicates', () => {
  const { questions } = buildQuestionSet([
    { type: 'noul', question: 'a?' },
    { id: 'dept', type: 'choice', question: 'b?', options: ['x', 'y'] },
  ]);
  assert.deepEqual(Object.keys(questions), ['q1', 'dept']);
  assert.throws(
    () =>
      buildQuestionSet([
        { id: 'a', type: 'noul', question: 'a?' },
        { id: 'a', type: 'noul', question: 'b?' },
      ]),
    /duplicated/
  );
  assert.throws(() => buildQuestionSet([]), /non-empty/);
  assert.throws(() => buildQuestionSet(Array.from({ length: 21 }, () => ({ type: 'noul', question: 'q' }))), /too many/);
});
