-- ================================================
-- Controle Financeiro Familiar — Supabase (PostgreSQL)
-- Cole no SQL Editor do Supabase e execute
-- ================================================

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS usuarios (
  id    SERIAL       PRIMARY KEY,
  "user" VARCHAR(50) NOT NULL UNIQUE,
  senha VARCHAR(255) NOT NULL,
  nome  VARCHAR(100) NOT NULL
);

-- Tabela de movimentações
CREATE TABLE IF NOT EXISTS movimentacoes (
  id          SERIAL         PRIMARY KEY,
  usuario_id  INT            REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo        VARCHAR(20)    NOT NULL,
  descricao   VARCHAR(255)   NOT NULL,
  categoria   VARCHAR(100),
  pessoa      VARCHAR(100),
  valor       DECIMAL(10,2)  NOT NULL,
  data        DATE           NOT NULL,
  criado_em   TIMESTAMP      DEFAULT NOW()
);

-- Desabilitar RLS (Row Level Security) — autenticação é feita pelo nosso JWT
ALTER TABLE usuarios      DISABLE ROW LEVEL SECURITY;
ALTER TABLE movimentacoes DISABLE ROW LEVEL SECURITY;
