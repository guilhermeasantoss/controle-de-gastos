require('dotenv').config();

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(48).toString('hex');
const PORT = Number(process.env.PORT || 3000);

if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET é obrigatório em produção.');
  }
  console.warn('JWT_SECRET não configurado; tokens serão invalidados ao reiniciar o servidor.');
}
if (JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET deve ter pelo menos 32 caracteres.');
}

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'controle_gastos',
  port: Number(process.env.DB_PORT || 3306),
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

let supabase = null;
let mysqlPool = mysql.createPool(dbConfig);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_SERVICE_KEY
  || process.env.SUPABASE_SECRET_KEY;
if (Boolean(supabaseUrl) !== Boolean(supabaseServiceKey)) {
  throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem ser configurados juntos.');
}
if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
  mysqlPool = null;
}

const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS
    || 'http://localhost:5500,http://127.0.0.1:5500,https://controle-de-gastos-ekvr.vercel.app')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);

app.use(cors({
  origin(origin, callback) {
    if (!origin || origin === 'null' || allowedOrigins.has(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origem não permitida pelo CORS'));
  },
  credentials: false,
}));

app.use(express.json({ limit: '100kb' }));

const loginAttempts = new Map();
function loginRateLimit(req, res, next) {
  const user = typeof req.body?.user === 'string' ? req.body.user.trim().toLowerCase() : '';
  const key = `${req.ip}:${user}`;
  const now = Date.now();
  const current = loginAttempts.get(key);
  if (!current || now - current.startedAt >= 15 * 60 * 1000) {
    loginAttempts.set(key, { startedAt: now, count: 0 });
  }
  const attempt = loginAttempts.get(key);
  if (attempt.count >= 10) {
    return res.status(429).json({ erro: 'Muitas tentativas. Tente novamente mais tarde.' });
  }
  attempt.count += 1;
  return next();
}

function auth(req, res, next) {
  const token = (req.headers['authorization'] || '').split(' ')[1];
  if (!token) return res.status(401).json({ erro: 'Token ausente' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ erro: 'Token inválido' });
    req.user = user;
    next();
  });
}

function parsePositiveId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function validateMovement(body = {}) {
  const { tipo, descricao, categoria, pessoa, valor, data } = body || {};
  const normalized = {
    tipo: typeof tipo === 'string' ? tipo.trim() : '',
    descricao: typeof descricao === 'string' ? descricao.trim() : '',
    categoria: typeof categoria === 'string' ? categoria.trim() : '',
    pessoa: typeof pessoa === 'string' ? pessoa.trim() : '',
    valor: typeof valor === 'number' ? valor : Number(valor),
    data: typeof data === 'string' ? data.trim() : '',
  };

  if (!['gasto', 'receita'].includes(normalized.tipo)) {
    return { error: 'Tipo de movimentação inválido' };
  }
  if (!normalized.descricao || normalized.descricao.length > 255) {
    return { error: 'Descrição inválida' };
  }
  if (normalized.categoria.length > 100 || normalized.pessoa.length > 100) {
    return { error: 'Categoria ou pessoa excede o limite permitido' };
  }
  if (!Number.isFinite(normalized.valor) || normalized.valor <= 0 || normalized.valor > 99999999.99) {
    return { error: 'Valor inválido' };
  }
  if (!isValidDate(normalized.data)) {
    return { error: 'Data inválida' };
  }

  return { value: normalized };
}

function validateUser({ nome, user, email, senha }) {
  if (typeof nome !== 'string' || typeof user !== 'string' || typeof email !== 'string' || typeof senha !== 'string') {
    return 'Preencha todos os campos';
  }
  if (!nome.trim() || !user.trim() || !email.trim() || !senha) return 'Preencha todos os campos';
  if (nome.trim().length > 100 || user.trim().length > 50 || email.trim().length > 254) {
    return 'Nome, usuário ou e-mail excede o limite permitido';
  }
  if (!/^[A-Za-z0-9_.-]+$/.test(user.trim())) return 'Usuário contém caracteres inválidos';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'E-mail inválido';
  if (senha.length < 8) return 'A senha deve ter no mínimo 8 caracteres';
  return null;
}

async function findUserByLogin(login) {
  if (supabase) {
    const byUser = await supabase
      .from('usuarios')
      .select('id, user, email, nome, senha')
      .eq('user', login)
      .maybeSingle();
    if (byUser.error || byUser.data) return byUser;

    return supabase
      .from('usuarios')
      .select('id, user, email, nome, senha')
      .eq('email', login)
      .maybeSingle();
  }

  const [rows] = await mysqlPool.execute(
    'SELECT id, user, email, nome, senha FROM usuarios WHERE user = ? OR email = ? LIMIT 1',
    [login, login],
  );
  return { data: rows[0] || null, error: null };
}

async function createUser({ nome, user, email, senhaHash }) {
  if (supabase) {
    const { error } = await supabase
      .from('usuarios')
      .insert([{ user, email, senha: senhaHash, nome }]);
    return { error };
  }

  try {
    await mysqlPool.execute(
      'INSERT INTO usuarios (user, email, senha, nome) VALUES (?, ?, ?, ?)',
      [user, email, senhaHash, nome],
    );
    return { error: null };
  } catch (error) {
    return { error };
  }
}

async function listMovimentacoesByUser(userId) {
  if (supabase) {
    const { data, error } = await supabase
      .from('movimentacoes')
      .select('id, tipo, descricao, categoria, pessoa, valor, data')
      .eq('usuario_id', userId)
      .order('data', { ascending: false });
    return { data, error };
  }

  const [rows] = await mysqlPool.execute(
    'SELECT id, tipo, descricao, categoria, pessoa, valor, data FROM movimentacoes WHERE usuario_id = ? ORDER BY data DESC, id DESC',
    [userId]
  );
  return { data: rows, error: null };
}

async function insertMovimentacao({ userId, tipo, descricao, categoria, pessoa, valor, data }) {
  if (supabase) {
    const { data: result, error } = await supabase
      .from('movimentacoes')
      .insert([{ usuario_id: userId, tipo, descricao, categoria: categoria || null, pessoa: pessoa || null, valor, data }])
      .select('id')
      .single();
    return { result, error };
  }

  const [result] = await mysqlPool.execute(
    'INSERT INTO movimentacoes (usuario_id, tipo, descricao, categoria, pessoa, valor, data) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [userId, tipo, descricao, categoria || null, pessoa || null, valor, data]
  );
  return { result: { id: result.insertId }, error: null };
}

async function insertMovimentacoes({ userId, movimentacoes }) {
  if (supabase) {
    const rows = movimentacoes.map(({ tipo, descricao, categoria, pessoa, valor, data }) => ({
      usuario_id: userId,
      tipo,
      descricao,
      categoria: categoria || null,
      pessoa: pessoa || null,
      valor,
      data,
    }));
    const { data, error } = await supabase.from('movimentacoes').insert(rows).select('id');
    return { data, error };
  }

  const connection = await mysqlPool.getConnection();
  try {
    await connection.beginTransaction();
    for (const { tipo, descricao, categoria, pessoa, valor, data } of movimentacoes) {
      await connection.execute(
        'INSERT INTO movimentacoes (usuario_id, tipo, descricao, categoria, pessoa, valor, data) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, tipo, descricao, categoria || null, pessoa || null, valor, data],
      );
    }
    await connection.commit();
    return { data: [], error: null };
  } catch (error) {
    await connection.rollback();
    return { data: null, error };
  } finally {
    connection.release();
  }
}

async function updateMovimentacao({ id, userId, tipo, descricao, categoria, pessoa, valor, data }) {
  if (supabase) {
    const { data: updated, error } = await supabase
      .from('movimentacoes')
      .update({ tipo, descricao, categoria: categoria || null, pessoa: pessoa || null, valor, data })
      .eq('id', id)
      .eq('usuario_id', userId)
      .select('id');
    return { error, affectedRows: updated ? updated.length : 0 };
  }

  const [result] = await mysqlPool.execute(
    'UPDATE movimentacoes SET tipo = ?, descricao = ?, categoria = ?, pessoa = ?, valor = ?, data = ? WHERE id = ? AND usuario_id = ?',
    [tipo, descricao, categoria || null, pessoa || null, valor, data, id, userId]
  );

  return { error: null, affectedRows: result.affectedRows };
}

async function deleteMovimentacao({ id, userId }) {
  if (supabase) {
    const { data: deleted, error } = await supabase
      .from('movimentacoes')
      .delete()
      .eq('id', id)
      .eq('usuario_id', userId)
      .select('id');
    return { error, affectedRows: deleted ? deleted.length : 0 };
  }

  const [result] = await mysqlPool.execute('DELETE FROM movimentacoes WHERE id = ? AND usuario_id = ?', [id, userId]);
  return { error: null, affectedRows: result.affectedRows };
}

async function listCategoriasByUser(userId) {
  if (supabase) {
    const { data, error } = await supabase
      .from('movimentacoes')
      .select('categoria, valor')
      .eq('usuario_id', userId)
      .neq('tipo', 'receita');
    return { data, error };
  }

  const [rows] = await mysqlPool.execute('SELECT categoria, valor FROM movimentacoes WHERE usuario_id = ? AND tipo <> ?', [userId, 'receita']);
  return { data: rows, error: null };
}

async function listMovimentacoesForExport(userId) {
  if (supabase) {
    const { data, error } = await supabase
      .from('movimentacoes')
      .select('tipo, descricao, categoria, pessoa, valor, data')
      .eq('usuario_id', userId)
      .order('data', { ascending: false });
    return { data, error };
  }

  const [rows] = await mysqlPool.execute(
    'SELECT tipo, descricao, categoria, pessoa, valor, data FROM movimentacoes WHERE usuario_id = ? ORDER BY data DESC, id DESC',
    [userId]
  );
  return { data: rows, error: null };
}

app.get('/', (req, res) => res.send('API Controle de Gastos 🚀'));

app.post('/login', loginRateLimit, async (req, res) => {
  const user = typeof req.body.user === 'string' ? req.body.user.trim() : '';
  const senha = typeof req.body.senha === 'string' ? req.body.senha : '';
  if (!user || !senha) {
    return res.status(400).json({ erro: 'Usuário e senha são obrigatórios' });
  }

  const login = user.toLowerCase();
  const { data, error } = await findUserByLogin(login);
  if (error || !data) {
    return res.status(401).json({ erro: 'Usuário ou senha inválidos' });
  }

  const senhaOk = await bcrypt.compare(senha, data.senha);
  if (!senhaOk) {
    return res.status(401).json({ erro: 'Usuário ou senha inválidos' });
  }

  loginAttempts.delete(`${req.ip}:${user.toLowerCase()}`);
  const token = jwt.sign({ id: data.id, user: data.user }, JWT_SECRET, { expiresIn: '8h' });
  return res.json({ usuario: { id: data.id, user: data.user, email: data.email, nome: data.nome }, token });
});

app.post('/cadastro', async (req, res) => {
  const { nome, user, email, senha } = req.body;
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const validationError = validateUser({ nome, user, email: normalizedEmail, senha });
  if (validationError) return res.status(400).json({ erro: validationError });

  const hash = await bcrypt.hash(senha, 12);
  const { error } = await createUser({
    nome: nome.trim(),
    user: user.trim(),
    email: normalizedEmail,
    senhaHash: hash,
  });

  if (error) {
    const code = error.code || error.errno;
    if (code === '23505' || code === 1062) {
      return res.status(409).json({ erro: 'Usuário ou e-mail já existe' });
    }
    console.error(error);
    return res.status(500).json({ erro: 'Erro ao criar conta' });
  }

  return res.status(201).json({ message: 'Conta criada com sucesso!' });
});

app.get('/movimentacoes', auth, async (req, res) => {
  const { data, error } = await listMovimentacoesByUser(req.user.id);
  if (error) {
    console.error(error);
    return res.status(500).json({ erro: 'Erro ao buscar' });
  }
  return res.json(data || []);
});

app.post('/movimentacoes', auth, async (req, res) => {
  const validation = validateMovement(req.body);
  if (validation.error) return res.status(400).json({ erro: validation.error });
  const { tipo, descricao, categoria, pessoa, valor, data } = validation.value;

  const { result, error } = await insertMovimentacao({
    userId: req.user.id,
    tipo,
    descricao,
    categoria,
    pessoa,
    valor,
    data,
  });

  if (error) {
    console.error(error);
    return res.status(500).json({ erro: 'Erro ao salvar' });
  }

  return res.status(201).json({ message: 'Salvo!', id: result.id });
});

app.post('/movimentacoes/lote', auth, async (req, res) => {
  if (!Array.isArray(req.body.movimentacoes) || req.body.movimentacoes.length < 1 || req.body.movimentacoes.length > 120) {
    return res.status(400).json({ erro: 'Lista de movimentações inválida' });
  }

  const movimentacoes = [];
  for (const body of req.body.movimentacoes) {
    const validation = validateMovement(body);
    if (validation.error) return res.status(400).json({ erro: validation.error });
    movimentacoes.push(validation.value);
  }

  const { data, error } = await insertMovimentacoes({
    userId: req.user.id,
    movimentacoes,
  });
  if (error) {
    console.error(error);
    return res.status(500).json({ erro: 'Erro ao salvar movimentações' });
  }
  return res.status(201).json({ message: 'Movimentações salvas!', ids: (data || []).map((row) => row.id) });
});

app.put('/movimentacoes/:id', auth, async (req, res) => {
  const id = parsePositiveId(req.params.id);
  if (!id) return res.status(400).json({ erro: 'Identificador inválido' });
  const validation = validateMovement(req.body);
  if (validation.error) return res.status(400).json({ erro: validation.error });
  const { tipo, descricao, categoria, pessoa, valor, data } = validation.value;

  const { error, affectedRows } = await updateMovimentacao({
    id,
    userId: req.user.id,
    tipo,
    descricao,
    categoria,
    pessoa,
    valor,
    data,
  });

  if (error) {
    console.error(error);
    return res.status(500).json({ erro: 'Erro ao editar' });
  }
  if (!affectedRows) return res.status(404).json({ erro: 'Movimentação não encontrada' });

  return res.json({ message: 'Atualizado!' });
});

app.delete('/movimentacoes/:id', auth, async (req, res) => {
  const id = parsePositiveId(req.params.id);
  if (!id) return res.status(400).json({ erro: 'Identificador inválido' });
  const { error, affectedRows } = await deleteMovimentacao({ id, userId: req.user.id });
  if (error) {
    console.error(error);
    return res.status(500).json({ erro: 'Erro ao remover' });
  }
  if (!affectedRows) return res.status(404).json({ erro: 'Movimentação não encontrada' });
  return res.json({ message: 'Removido!' });
});

app.get('/categorias', auth, async (req, res) => {
  const { data, error } = await listCategoriasByUser(req.user.id);
  if (error) {
    console.error(error);
    return res.status(500).json({ erro: 'Erro' });
  }

  const mapa = {};
  for (const d of data || []) {
    const categoria = d.categoria || 'Sem categoria';
    mapa[categoria] = (mapa[categoria] || 0) + parseFloat(d.valor);
  }

  const resultado = Object.entries(mapa)
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total);

  return res.json(resultado);
});

app.get('/exportar', auth, async (req, res) => {
  const { data, error } = await listMovimentacoesForExport(req.user.id);
  if (error) {
    console.error(error);
    return res.status(500).json({ erro: 'Erro' });
  }

  const csvCell = (value) => {
    const text = String(value ?? '');
    const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const header = ['Tipo', 'Descrição', 'Categoria', 'Pessoa', 'Valor', 'Data'].map(csvCell).join(',') + '\n';
  const lines = (data || []).map((r) => {
    return [
      r.tipo,
      r.descricao,
      r.categoria,
      r.pessoa,
      r.valor,
      r.data,
    ].map(csvCell).join(',');
  }).join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="movimentacoes.csv"');
  return res.send('\uFEFF' + header + lines);
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));
}

module.exports = { app, isValidDate, parsePositiveId, validateMovement, validateUser };
