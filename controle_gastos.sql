-- ================================================
-- Controle Financeiro Familiar
-- Script de criação do banco de dados
-- ================================================

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS usuarios (
  id    INT          AUTO_INCREMENT PRIMARY KEY,
  user  VARCHAR(50)  NOT NULL UNIQUE,
  senha VARCHAR(255) NOT NULL,
  nome  VARCHAR(100) NOT NULL
);

-- Tabela de movimentações financeiras
CREATE TABLE IF NOT EXISTS movimentacoes (
  id          INT            AUTO_INCREMENT PRIMARY KEY,
  usuario_id  INT            NULL,
  tipo        VARCHAR(20)    NOT NULL,
  descricao   VARCHAR(255)   NOT NULL,
  categoria   VARCHAR(100)   NULL,
  pessoa      VARCHAR(100)   NULL,
  valor       DECIMAL(10,2)  NOT NULL,
  data        DATE           NOT NULL,
  criado_em   TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);
