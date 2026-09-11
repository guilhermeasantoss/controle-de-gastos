# Controle Financeiro Familiar

Sistema web para controle de finanças familiares com autenticação, lançamento de despesas e receitas, parcelamentos, fatura mensal e dashboard com gráficos.

---

## Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| Frontend | HTML, CSS, JavaScript puro |
| Backend | Node.js + Express |
| Banco de dados | Supabase (PostgreSQL) ou MySQL 8 |
| Autenticação | JWT + bcrypt |

---

## Estrutura de arquivos

```text
controle-gastos/
├── index.html          # Dashboard principal (protegido por login)
├── login.html          # Tela de login e cadastro
├── aut.js              # Lógica do dashboard (movimentações, gráficos, fatura)
├── login.js            # Lógica de autenticação
├── app-style.css       # Estilos do dashboard
├── login-style.css     # Estilos da tela de login
├── server.js           # API REST (Node.js + Express)
├── api/index.js        # Adaptador da API para Vercel Functions
├── vercel.json         # Configuração de deploy na Vercel
├── controle_gastos.sql # Script de criação para MySQL
├── supabase_schema.sql # Script de criação para Supabase
├── .env.example        # Modelo de variáveis de ambiente
├── package.json
├── README.md
├── README-sem-emojis.md
└── .gitignore
```

---

## Como rodar localmente

### Pré-requisitos
- Node.js 22+
- Uma instância Supabase ou MySQL 8+

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

Para Supabase, abra o SQL Editor e execute `supabase_schema.sql`.
Depois configure a URL e a chave **service role** no `.env`. Essa chave deve permanecer apenas no backend.

Para MySQL, execute:

```bash
mysql -u root -p < controle_gastos.sql
```

### 4. Configure as variáveis de ambiente

```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas credenciais:

```env
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role
PORT=3000
JWT_SECRET=gere_uma_string_aleatoria_aqui
```

Se as variáveis do Supabase estiverem configuradas, o servidor usará Supabase; caso contrário, usará MySQL.

Para gerar um JWT_SECRET seguro:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 5. Inicie o servidor

```bash
node server.js
```

### 6. Abra o frontend

Abra o arquivo `login.html` no navegador ou use uma extensão como Live Server no VS Code.

### Deploy na Vercel

1. Importe o repositório na Vercel.
2. Use o diretório raiz do projeto.
3. Não defina comando de build; os arquivos HTML/CSS/JS são servidos diretamente.
4. Cadastre estas variáveis em **Settings > Environment Variables**:

```env
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role
JWT_SECRET=uma_chave_aleatoria_com_pelo_menos_32_caracteres
COHERE_API_KEY=sua_chave_da_cohere
COHERE_MODEL=command-a-03-2025
NODE_ENV=production
```

O frontend usa `/api` automaticamente na Vercel. A chave `SUPABASE_SERVICE_ROLE_KEY` deve existir apenas nas variáveis do projeto Vercel e nunca no frontend.

---

## Autenticação

- Login via usuário e senha
- Senha armazenada com bcrypt
- Sessão gerenciada por JWT com validade de 8 horas
- Todas as rotas protegidas exigem token no header `Authorization: Bearer <token>`

Não existem usuários padrão. Crie a primeira conta pela tela de cadastro.
As senhas precisam ter no mínimo 8 caracteres.

---

## Funcionalidades

### Dashboard
- Resumo de receitas, despesas e saldo total
- Gráfico de rosca (receitas vs despesas)
- Gráfico de barras por categoria
- Botão de exportação para CSV

### Nova movimentação
- Tipos: Gasto à vista, Gasto parcelado e Receita
- Parcelamento automático: cria um registro por parcela em meses consecutivos
- Máscara de valor no formato brasileiro
- Edição de movimentações existentes

### Movimentações
- Listagem completa com filtros por tipo, pessoa e mês
- Seleção múltipla para exclusão em lote
- Botão “Apagar tudo”

### Fatura do mês
- Navegação entre meses com setas
- Lista todos os gastos do mês selecionado
- Total do mês calculado automaticamente

---

## API REST

Base URL local: `http://localhost:3000`
Base URL na Vercel: `/api`

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/login` | Autenticar usuário | Não |
| POST | `/cadastro` | Criar novo usuário | Não |
| GET | `/movimentacoes` | Listar movimentações | Sim |
| POST | `/movimentacoes` | Criar movimentação | Sim |
| POST | `/movimentacoes/lote` | Criar movimentações (parcelamento transacional) | Sim |
| PUT | `/movimentacoes/:id` | Editar movimentação | Sim |
| DELETE | `/movimentacoes/:id` | Remover movimentação | Sim |
| GET | `/categorias` | Gastos por categoria | Sim |
| GET | `/exportar` | Exportar CSV | Sim |

---

## Banco de dados

```sql
-- Usuários
usuarios (id, user, senha, nome)

-- Movimentações financeiras
movimentacoes (id, tipo, descricao, categoria, pessoa, valor, data)
```

O campo `tipo` aceita: `receita` ou `gasto`.

Em produção, configure `JWT_SECRET` com pelo menos 32 caracteres e `CORS_ORIGINS` com as origens autorizadas.

---

## Licença

MIT
