const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

const { isValidDate, parsePositiveId, validateMovement, validateUser } = require('../server');

test('valida datas reais no formato ISO', () => {
  assert.equal(isValidDate('2026-02-28'), true);
  assert.equal(isValidDate('2026-02-29'), false);
  assert.equal(isValidDate('28/02/2026'), false);
});

test('valida identificadores positivos', () => {
  assert.equal(parsePositiveId('10'), 10);
  assert.equal(parsePositiveId('0'), null);
  assert.equal(parsePositiveId('abc'), null);
});

test('valida movimentações e rejeita valores inválidos', () => {
  const result = validateMovement({
    tipo: 'gasto',
    descricao: 'Mercado',
    categoria: 'Alimentação',
    pessoa: 'Pai',
    valor: 25.5,
    data: '2026-09-10',
  });
  assert.equal(result.error, undefined);
  assert.equal(result.value.valor, 25.5);
  assert.match(validateMovement({ ...result.value, valor: -1 }).error, /Valor inválido/);
});

test('exige senha, usuário e e-mail válidos', () => {
  assert.equal(validateUser({ nome: 'Maria', user: 'maria_1', email: 'maria@site.com', senha: 'segura123' }), null);
  assert.match(validateUser({ nome: 'Maria', user: 'maria', email: 'maria@site.com', senha: '1234' }), /8 caracteres/);
  assert.match(validateUser({ nome: 'Maria', user: 'maria@site', email: 'maria@site.com', senha: 'segura123' }), /caracteres inválidos/);
  assert.match(validateUser({ nome: 'Maria', user: 'maria', email: 'email-invalido', senha: 'segura123' }), /E-mail inválido/);
});
