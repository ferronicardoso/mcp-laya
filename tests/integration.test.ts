import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';
import { LayaEngine } from '../src/engine.js';
import { layaChoice, layaNoul, layaPredict } from '../src/handlers.js';

// Runs the real model; skipped unless LAYA_MODEL_DIR points to an ONNX export.
const skip = process.env.LAYA_MODEL_DIR ? false : 'LAYA_MODEL_DIR not set';

test('real model: classifies a Portuguese billing email', { skip, timeout: 120_000 }, async () => {
  const engine = new LayaEngine(loadConfig());
  const text =
    'Olá, fomos cobrados duas vezes pelo mês de março. Solicito o estorno da cobrança duplicada hoje, caso contrário cancelaremos o nosso plano.';

  const choice = await layaChoice(engine, {
    text,
    question: 'Qual departamento deve tratar esta solicitação?',
    options: [
      { key: 'financeiro', description: 'faturas, pagamentos, estornos' },
      { key: 'tecnico', description: 'defeitos, indisponibilidades, erros de sistema' },
      { key: 'comercial', description: 'preços, novos contratos' },
    ],
  });
  assert.equal(choice.choice, 'financeiro');

  const noul = await layaNoul(engine, { text, question: 'O usuário ameaça cancelar ou deixar o serviço?' });
  assert.equal(noul.answer, true);

  const batch = await layaPredict(engine, {
    text,
    questions: [
      { id: 'dept', type: 'choice', question: 'Qual setor?', options: ['financeiro', 'tecnico'] },
      { id: 'urgencia', type: 'score', question: 'Qual a urgência?', levels: ['sem urgência', 'em breve', 'crítico'] },
    ],
  });
  assert.equal(batch.answers.dept.type, 'choice');
  assert.equal(batch.answers.urgencia.type, 'score');
});
