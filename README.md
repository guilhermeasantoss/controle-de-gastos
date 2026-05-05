# 💰 Controle Financeiro Familiar

Sistema web para controle de finanças familiares com autenticação, lançamento de gastos e receitas, parcelamentos, fatura mensal e dashboard com gráficos.

---

## 🖥️ Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| Frontend | HTML, CSS, JavaScript puro |
| Backend | Node.js + Express |
| Banco de dados | MySQL 8 |
| Autenticação | JWT + bcrypt |

---

## 📁 Estrutura de arquivos

```
controle-gastos/
├── index.html          # Dashboard principal (protegido por login)
├── login.html          # Tela de login e cadastro
├── aut.js              # Lógica do dashboard (movimentações, gráficos, fatura)
├── login.js            # Lógica de autenticação
├── app-style.css       # Estilos do dashboard
├── login-style.css     # Estilos da tela de login
├── server.js           # API REST (Node.js + Express)
├── controle_gastos.sql # Script de criação do banco de dados
├── .env.example        # Modelo de variáveis de ambiente
└── package.json
```

---

## ⚙️ Como rodar localmente

### Pré-requisitos
- [Node.js](https://nodejs.org) v18+
- [MySQL](https://dev.mysql.com/downloads/) 8+

### 1. Clone o repositório
```bash
git clone https://github.com/seu-usuario/controle-gastos.git
cd controle-gastos
```

### 2. Instale as dependências
```bash
npm install
```

### 3. Configure o banco de dados
Abra o MySQL e execute o script:
```bash
mysql -u root -p < controle_gastos.sql
```

### 4. Configure as variáveis de ambiente
```bash
cp .env.example .env
```
Edite o `.env` com suas credenciais:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sua_senha
DB_NAME=controle_gastos
PORT=3000
JWT_SECRET=gere_uma_string_aleatoria_aqui
```

Para gerar um JWT_SECRET seguro:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 5. Inicie o servidor
```bash
node server.js
```

### 6. Abra o frontend
Abra o `login.html` no browser ou use uma extensão como **Live Server** no VS Code.

---

## 🔐 Autenticação

- Login via usuário e senha
- Senha armazenada com **bcrypt** (hash seguro, não reversível)
- Sessão gerenciada por **JWT** com validade de 8 horas
- Todas as rotas da API exigem token no header `Authorization: Bearer <token>`

### Usuários padrão (criados pelo SQL)
| Usuário | Senha |
|---------|-------|
| pai | 1234 |
| mae | 1234 |

> ⚠️ Troque as senhas após o primeiro login em produção.

---

## 📊 Funcionalidades

### Dashboard
- Resumo de receitas, gastos e saldo total
- Gráfico de rosca (receitas vs gastos)
- Gráfico de barras por categoria
- Botão de exportação para CSV

### Nova Movimentação
- Tipos: **Gasto à vista**, **Gasto parcelado**, **Receita**
- Parcelamento automático — cria um registro por parcela em meses consecutivos
- Máscara de valor no formato brasileiro (ex: `1.234,56`)
- Edição de movimentações existentes

### Movimentações
- Listagem completa com filtros por tipo, pessoa e mês
- Seleção múltipla para exclusão em lote
- Botão "Apagar tudo"

### Fatura do Mês
- Navegação entre meses com setas `< Mês Ano >`
- Lista todos os gastos do mês selecionado
- Total do mês calculado automaticamente

---

## 🌐 API REST

Base URL: `http://localhost:3000`

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/login` | Autenticar usuário | ❌ |
| POST | `/cadastro` | Criar novo usuário | ❌ |
| GET | `/movimentacoes` | Listar movimentações | ✅ |
| POST | `/movimentacoes` | Criar movimentação | ✅ |
| PUT | `/movimentacoes/:id` | Editar movimentação | ✅ |
| DELETE | `/movimentacoes/:id` | Remover movimentação | ✅ |
| GET | `/categorias` | Gastos por categoria | ✅ |
| GET | `/exportar` | Exportar CSV | ✅ |

---

## 🗄️ Banco de dados

```sql
-- Usuários
usuarios (id, user, senha, nome)

-- Movimentações financeiras
movimentacoes (id, tipo, descricao, categoria, pessoa, valor, data)
```

O campo `tipo` aceita: `receita` ou `gasto`.

---

## 🚀 Deploy

O projeto está preparado para deploy com as seguintes configurações:

- **Frontend:** Vercel, Netlify ou GitHub Pages
- **Backend:** Render, Fly.io ou qualquer VPS com Node.js
- **Banco:** PlanetScale, Supabase (PostgreSQL) ou Railway MySQL

Antes do deploy em produção:
1. Configure `ALLOWED_ORIGINS` no `.env` com o domínio do frontend
2. Use um `JWT_SECRET` forte e único
3. Nunca suba o arquivo `.env` para o repositório

---

## 📄 Licença

MIT
