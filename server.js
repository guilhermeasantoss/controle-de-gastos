require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const jwt        = require('jsonwebtoken');
const bcrypt     = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const app        = express();
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('ERRO: JWT_SECRET não definido no .env');
  process.exit(1);
}

// ── SUPABASE ────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ── CORS ────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ];

if (process.env.NODE_ENV === 'production') {
  allowedOrigins.push('https://controle-de-gastos-lyart.vercel.app');
}

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Origem não permitida pelo CORS'));
  },
  credentials: true
}));

app.use(express.json());

// ── MIDDLEWARE JWT ──────────────────────────────────
function auth(req, res, next) {
  const token = (req.headers['authorization'] || '').split(' ')[1];
  if (!token) return res.status(401).json({ erro: 'Token ausente' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ erro: 'Token inválido' });
    req.user = user;
    next();
  });
}

// ── ROTA TESTE ──────────────────────────────────────
app.get('/', (req, res) => res.send('API Controle de Gastos 🚀'));

// ── LOGIN ───────────────────────────────────────────
app.post('/login', async (req, res) => {
  const { user, senha } = req.body;
  if (!user || !senha)
    return res.status(400).json({ erro: 'Usuário e senha são obrigatórios' });

  const { data, error } = await supabase
    .from('usuarios')
    .select('id, user, nome, senha')
    .eq('user', user)
    .single();

  if (error || !data)
    return res.status(401).json({ erro: 'Usuário ou senha inválidos' });

  const senhaOk = await bcrypt.compare(senha, data.senha);
  if (!senhaOk)
    return res.status(401).json({ erro: 'Usuário ou senha inválidos' });

  const token = jwt.sign({ id: data.id, user: data.user }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ usuario: { id: data.id, user: data.user, nome: data.nome }, token });
});

// ── CADASTRO ────────────────────────────────────────
app.post('/cadastro', async (req, res) => {
  const { nome, user, senha } = req.body;
  if (!nome || !user || !senha)
    return res.status(400).json({ erro: 'Preencha todos os campos' });
  if (senha.length < 4)
    return res.status(400).json({ erro: 'Senha deve ter no mínimo 4 caracteres' });

  const hash = await bcrypt.hash(senha, 12);

  const { error } = await supabase
    .from('usuarios')
    .insert([{ user, senha: hash, nome }]);

  if (error) {
    if (error.code === '23505') return res.status(409).json({ erro: 'Usuário já existe' });
    console.error(error);
    return res.status(500).json({ erro: 'Erro ao criar conta' });
  }
  res.status(201).json({ message: 'Conta criada com sucesso!' });
});

// ── LISTAR MOVIMENTAÇÕES ────────────────────────────
app.get('/movimentacoes', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('movimentacoes')
    .select('id, tipo, descricao, categoria, pessoa, valor, data')
    .eq('usuario_id', req.user.id)
    .order('data', { ascending: false });

  if (error) { console.error(error); return res.status(500).json({ erro: 'Erro ao buscar' }); }
  res.json(data);
});

// ── CRIAR MOVIMENTAÇÃO ──────────────────────────────
app.post('/movimentacoes', auth, async (req, res) => {
  const { tipo, descricao, categoria, pessoa, valor, data } = req.body;
  if (!tipo || !descricao || !valor || !data)
    return res.status(400).json({ erro: 'Campos obrigatórios ausentes' });

  const { data: result, error } = await supabase
    .from('movimentacoes')
    .insert([{ usuario_id: req.user.id, tipo, descricao, categoria: categoria || null, pessoa: pessoa || null, valor, data }])
    .select('id')
    .single();

  if (error) { console.error(error); return res.status(500).json({ erro: 'Erro ao salvar' }); }
  res.status(201).json({ message: 'Salvo!', id: result.id });
});

// ── EDITAR MOVIMENTAÇÃO ─────────────────────────────
app.put('/movimentacoes/:id', auth, async (req, res) => {
  const { tipo, descricao, categoria, pessoa, valor, data } = req.body;
  if (!tipo || !descricao || !valor || !data)
    return res.status(400).json({ erro: 'Campos obrigatórios ausentes' });

  const { error, count } = await supabase
    .from('movimentacoes')
    .update({ tipo, descricao, categoria: categoria || null, pessoa: pessoa || null, valor, data })
    .eq('id', req.params.id)
    .eq('usuario_id', req.user.id);

  if (error) { console.error(error); return res.status(500).json({ erro: 'Erro ao editar' }); }
  res.json({ message: 'Atualizado!' });
});

// ── REMOVER MOVIMENTAÇÃO ────────────────────────────
app.delete('/movimentacoes/:id', auth, async (req, res) => {
  const { error } = await supabase
    .from('movimentacoes')
    .delete()
    .eq('id', req.params.id)
    .eq('usuario_id', req.user.id);

  if (error) { console.error(error); return res.status(500).json({ erro: 'Erro ao remover' }); }
  res.json({ message: 'Removido!' });
});

// ── GASTOS POR CATEGORIA ────────────────────────────
app.get('/categorias', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('movimentacoes')
    .select('categoria, valor')
    .eq('usuario_id', req.user.id)
    .neq('tipo', 'receita');

  if (error) { console.error(error); return res.status(500).json({ erro: 'Erro' }); }

  // Agrupa por categoria no JS
  const mapa = {};
  data.forEach(d => {
    const cat = d.categoria || 'Sem categoria';
    mapa[cat] = (mapa[cat] || 0) + parseFloat(d.valor);
  });

  const resultado = Object.entries(mapa)
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total);

  res.json(resultado);
});

// ── EXPORTAR CSV ────────────────────────────────────
app.get('/exportar', async (req, res) => {
  const token = (req.headers['authorization'] || '').split(' ')[1] || req.query.token;
  if (!token) return res.status(401).json({ erro: 'Token ausente' });

  let decoded;
  try { decoded = jwt.verify(token, JWT_SECRET); }
  catch { return res.status(403).json({ erro: 'Token inválido' }); }

  const { data, error } = await supabase
    .from('movimentacoes')
    .select('tipo, descricao, categoria, pessoa, valor, data')
    .eq('usuario_id', decoded.id)
    .order('data', { ascending: false });

  if (error) { console.error(error); return res.status(500).json({ erro: 'Erro' }); }

  const header = 'Tipo,Descrição,Categoria,Pessoa,Valor,Data\n';
  const lines  = data.map(r =>
    `${r.tipo},"${r.descricao}","${r.categoria || ''}","${r.pessoa || ''}",${r.valor},${r.data}`
  ).join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="movimentacoes.csv"');
  res.send('\uFEFF' + header + lines);
});

// ── SERVIDOR ────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));
