CREATE DATABASE IF NOT EXISTS controle_gastos;
USE controle_gastos;

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user VARCHAR(50) NOT NULL UNIQUE,
  senha VARCHAR(255) NOT NULL,
  nome VARCHAR(100) NOT NULL
);

-- Inserir usuários padrão (senhas em texto simples por ora — idealmente usar bcrypt)
INSERT IGNORE INTO usuarios (user, senha, nome) VALUES
  ('pai', '1234', 'Pai'),
  ('mae', '1234', 'Mãe');

-- Tabela de movimentações financeiras
CREATE TABLE IF NOT EXISTS movimentacoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tipo VARCHAR(20) NOT NULL,        -- 'gasto', 'receita'
  descricao VARCHAR(255) NOT NULL,
  categoria VARCHAR(100),
  pessoa VARCHAR(100),
  valor DECIMAL(10,2) NOT NULL,
  data DATE NOT NULL
);
