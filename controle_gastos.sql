-- ================================================
-- Controle Financeiro Familiar
-- Script de criação do banco de dados
-- ================================================

CREATE DATABASE IF NOT EXISTS controle_gastos;
USE controle_gastos;

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS usuarios (
  id    INT          AUTO_INCREMENT PRIMARY KEY,
  user  VARCHAR(50)  NOT NULL UNIQUE,
  email VARCHAR(254)  NULL UNIQUE,
  senha VARCHAR(255) NOT NULL,
  nome  VARCHAR(100) NOT NULL
);

-- Tabela de movimentações financeiras
CREATE TABLE IF NOT EXISTS movimentacoes (
  id          INT            AUTO_INCREMENT PRIMARY KEY,
  usuario_id  INT            NOT NULL,
  tipo        VARCHAR(20)    NOT NULL,
  descricao   VARCHAR(255)   NOT NULL,
  categoria   VARCHAR(100)   NULL,
  pessoa      VARCHAR(100)   NULL,
  valor       DECIMAL(10,2)  NOT NULL,
  data        DATE           NOT NULL,
  criado_em   TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX idx_movimentacoes_usuario_data (usuario_id, data)
);
