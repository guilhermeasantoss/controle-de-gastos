# Controle de Gastos

Sistema web de controle financeiro familiar com autenticação, cadastro de movimentações, dashboard e exportação em CSV.

## Visão geral

Este projeto contém:
- Front-end em HTML/CSS/JavaScript (`index.html`, `login.html`, `app-style.css`, `login-style.css`, `aut.js`, `login.js`)
- Back-end em Node.js/Express com autenticação JWT (`server.js`)
- Banco de dados MySQL (`controle_gastos.sql`)
- Migração de senhas para bcrypt (`migrate_senhas.js`)

## Funcionalidades

- Cadastro de usuário
- Login com JWT
- Criação de movimentações de gastos e receitas
- Suporte a gastos parcelados (divide valor em parcelas)
- Edição e remoção de movimentações
- Dashboard com resumo de receitas, gastos e saldo
- Gráficos de receita vs gasto e gastos por categoria
- Filtro de movimentações por tipo, pessoa e mês
- Exportação de movimentações para CSV

## Tecnologias

- Node.js
- Express
- MySQL (via `mysql2`)
- JWT (`jsonwebtoken`)
- Criptografia de senha com `bcryptjs`
- Front-end vanilla JavaScript
- Chart.js (via CDN)
- CORS

## Pré-requisitos

- Node.js 18+ instalado
- MySQL instalado e rodando
- Navegador moderno

## Configuração

1. Clone ou copie o projeto para sua máquina.
2. Instale dependências:

```bash
npm install
```

3. Crie um arquivo `.env` no diretório do projeto com estas variáveis:

```env
DB_HOST=localhost
DB_USER=seu_usuario_mysql
DB_PASSWORD=sua_senha_mysql
DB_NAME=controle_gastos
JWT_SECRET=sua_chave_secreta
PORT=3000
ALLOWED_ORIGINS=http://localhost:5500,http://127.0.0.1:5500
```

4. Crie o banco de dados e as tabelas a partir do arquivo SQL:

- Use seu cliente MySQL para executar `controle_gastos.sql`
- Isso cria as tabelas `usuarios` e `movimentacoes`

5. Se já houver usuários com senhas em texto simples, execute a migração:

```bash
node migrate_senhas.js
```

## Executando o servidor

```bash
node server.js
```

A API ficará disponível em `http://localhost:3000`.

## Usando o front-end

O front-end não é servido diretamente pelo servidor Node. Abra os arquivos estáticos no navegador ou use uma extensão como Live Server:

- `login.html` para acesso e cadastro de usuários
- `index.html` para a aplicação principal após autenticação

## Rotas da API

### Autenticação

- `POST /login`
  - body: `{ user, senha }`
  - retorna: `{ usuario, token }`

- `POST /cadastro`
  - body: `{ nome, user, senha }`

### Movimentações

- `GET /movimentacoes` (autenticada)
- `POST /movimentacoes` (autenticada)
- `PUT /movimentacoes/:id` (autenticada)
- `DELETE /movimentacoes/:id` (autenticada)

### Outros

- `GET /categorias` (autenticada)
- `GET /exportar` (autenticada)

> Observação: as rotas autenticadas exigem o header `Authorization: Bearer <token>`.

## Banco de dados

Tabelas principais:

- `usuarios`
  - `id`, `user`, `senha`, `nome`
- `movimentacoes`
  - `id`, `tipo`, `descricao`, `categoria`, `pessoa`, `valor`, `data`

## Credenciais iniciais de testes

O script SQL `controle_gastos.sql` inclui usuários padrão:

- `pai` / `1234`
- `mae` / `1234`

Se for necessário, execute `migrate_senhas.js` para transformar essas senhas em hash bcrypt.

## Observações

- Mantenha o `.env` fora do controle de versão.
- Em produção, ajuste `ALLOWED_ORIGINS` e `JWT_SECRET` com valores seguros.
- O front-end utiliza armazenamento local para guardar usuário e token.
