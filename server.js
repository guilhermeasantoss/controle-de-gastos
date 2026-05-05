require('dotenv').config();

const express    = require('express');
const mysql      = require('mysql2');
const cors       = require('cors');
const jwt        = require('jsonwebtoken');
const bcrypt     = require('bcryptjs');

const app        = express();
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('ERRO: JWT_SECRET não definido no .env');
  process.exit(1);
}

// ── CORS — restringe origens em produção ────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:3000'];

app.use(cors({
  origin: (origin, cb) => {
    // permite requisições sem origin (ex: Postman, mobile)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Origem não permitida pelo CORS'));
  },
  credentials: true
}));

app.use(express.json());

// ── BANCO ──────────────────────────────────────────
const db = mysql.createConnection({
  host:     process.env.DB_HOST,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.connect(err => {
  if (err) { console.error('Erro MySQL:', err); return; }
  console.log('MySQL conectado!');
});

// ── MIDDLEWARE JWT ──────────────────────────────────
function auth(req, res, next) {
  const header = req.headers['authorization'];
  const token  = header && header.split(' ')[1];
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
app.post('/login', (req, res) => {
  const { user, senha } = req.body;
  if (!user || !senha)
    return res.status(400).json({ erro: 'Usuário e senha são obrigatórios' });

  db.query(
    'SELECT id, user, nome, senha FROM usuarios WHERE user = ?',
    [user],
    async (err, rows) => {
      if (err) { console.error(err); return res.status(500).json({ erro: 'Erro interno' }); }
      if (!rows.length) return res.status(401).json({ erro: 'Usuário ou senha inválidos' });

      const usuario = rows[0];
      const senhaOk = await bcrypt.compare(senha, usuario.senha);
      if (!senhaOk) return res.status(401).json({ erro: 'Usuário ou senha inválidos' });

      const token = jwt.sign({ id: usuario.id, user: usuario.user }, JWT_SECRET, { expiresIn: '8h' });
      res.json({ usuario: { id: usuario.id, user: usuario.user, nome: usuario.nome }, token });
    }
  );
});

// ── CADASTRO ────────────────────────────────────────
app.post('/cadastro', async (req, res) => {
  const { nome, user, senha } = req.body;
  if (!nome || !user || !senha)
    return res.status(400).json({ erro: 'Preencha todos os campos' });
  if (senha.length < 4)
    return res.status(400).json({ erro: 'Senha deve ter no mínimo 4 caracteres' });

  const hash = await bcrypt.hash(senha, 12);

  db.query('INSERT INTO usuarios (user, senha, nome) VALUES (?, ?, ?)', [user, hash, nome], (err) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ erro: 'Usuário já existe' });
      console.error(err);
      return res.status(500).json({ erro: 'Erro ao criar conta' });
    }
    res.status(201).json({ message: 'Conta criada com sucesso!' });
  });
});

// ── LISTAR MOVIMENTAÇÕES ────────────────────────────
app.get('/movimentacoes', auth, (req, res) => {
  const sql = `
    SELECT id, tipo, descricao, categoria, pessoa, valor,
           DATE_FORMAT(data, '%Y-%m-%d') as data
    FROM movimentacoes
    WHERE usuario_id = ?
    ORDER BY data DESC
  `;
  db.query(sql, [req.user.id], (err, rows) => {
    if (err) { console.error(err); return res.status(500).json({ erro: 'Erro ao buscar' }); }
    res.json(rows);
  });
});

// ── CRIAR MOVIMENTAÇÃO ──────────────────────────────
app.post('/movimentacoes', auth, (req, res) => {
  const { tipo, descricao, categoria, pessoa, valor, data } = req.body;
  if (!tipo || !descricao || !valor || !data)
    return res.status(400).json({ erro: 'Campos obrigatórios: tipo, descricao, valor, data' });

  const sql = `INSERT INTO movimentacoes (usuario_id, tipo, descricao, categoria, pessoa, valor, data)
               VALUES (?, ?, ?, ?, ?, ?, ?)`;
  db.query(sql, [req.user.id, tipo, descricao, categoria || null, pessoa || null, valor, data], (err, result) => {
    if (err) { console.error(err); return res.status(500).json({ erro: 'Erro ao salvar' }); }
    res.status(201).json({ message: 'Salvo!', id: result.insertId });
  });
});

// ── EDITAR MOVIMENTAÇÃO ─────────────────────────────
app.put('/movimentacoes/:id', auth, (req, res) => {
  const { id } = req.params;
  const { tipo, descricao, categoria, pessoa, valor, data } = req.body;
  if (!tipo || !descricao || !valor || !data)
    return res.status(400).json({ erro: 'Campos obrigatórios ausentes' });

  const sql = `UPDATE movimentacoes SET tipo=?, descricao=?, categoria=?, pessoa=?, valor=?, data=?
               WHERE id=? AND usuario_id=?`;
  db.query(sql, [tipo, descricao, categoria || null, pessoa || null, valor, data, id, req.user.id], (err, result) => {
    if (err) { console.error(err); return res.status(500).json({ erro: 'Erro ao editar' }); }
    if (result.affectedRows === 0) return res.status(404).json({ erro: 'Movimentação não encontrada' });
    res.json({ message: 'Atualizado!' });
  });
});

// ── REMOVER MOVIMENTAÇÃO ────────────────────────────
app.delete('/movimentacoes/:id', auth, (req, res) => {
  db.query('DELETE FROM movimentacoes WHERE id = ? AND usuario_id = ?', [req.params.id, req.user.id], (err, result) => {
    if (err) { console.error(err); return res.status(500).json({ erro: 'Erro ao remover' }); }
    if (result.affectedRows === 0) return res.status(404).json({ erro: 'Movimentação não encontrada' });
    res.json({ message: 'Removido!' });
  });
});

// ── GASTOS POR CATEGORIA ────────────────────────────
app.get('/categorias', auth, (req, res) => {
  const sql = `
    SELECT COALESCE(categoria, 'Sem categoria') as categoria,
           SUM(valor) as total
    FROM movimentacoes
    WHERE tipo != 'receita' AND usuario_id = ?
    GROUP BY categoria
    ORDER BY total DESC
  `;
  db.query(sql, [req.user.id], (err, rows) => {
    if (err) { console.error(err); return res.status(500).json({ erro: 'Erro' }); }
    res.json(rows);
  });
});

// ── EXPORTAR CSV ────────────────────────────────────
app.get('/exportar', (req, res) => {
  const token = (req.headers['authorization'] || '').split(' ')[1] || req.query.token;
  if (!token) return res.status(401).json({ erro: 'Token ausente' });

  let decoded;
  try { decoded = jwt.verify(token, JWT_SECRET); }
  catch { return res.status(403).json({ erro: 'Token inválido' }); }

  const sql = `
    SELECT tipo, descricao, categoria, pessoa, valor,
           DATE_FORMAT(data, '%d/%m/%Y') as data
    FROM movimentacoes WHERE usuario_id = ? ORDER BY data DESC
  `;
  db.query(sql, [decoded.id], (err, rows) => {
    if (err) { console.error(err); return res.status(500).json({ erro: 'Erro' }); }
    const header = 'Tipo,Descrição,Categoria,Pessoa,Valor,Data\n';
    const lines  = rows.map(r =>
      `${r.tipo},"${r.descricao}","${r.categoria || ''}","${r.pessoa || ''}",${r.valor},${r.data}`
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="movimentacoes.csv"');
    res.send('\uFEFF' + header + lines);
  });
});

// ── SERVIDOR ────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));
