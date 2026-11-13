-- Agentes fiscais (login)
CREATE TABLE IF NOT EXISTS agentes (
  matricula   varchar(20) PRIMARY KEY CHECK (matricula ~ '^[0-9]+$'),
  nome        varchar(120) NOT NULL,
  senha_hash  text NOT NULL,
  criado_em   timestamptz NOT NULL DEFAULT now()
);

-- Respostas do formulario
CREATE TABLE IF NOT EXISTS submissoes (
  id         serial PRIMARY KEY,
  tipo       text NOT NULL CHECK (tipo IN (
               'Lixo reciclável','Lixo orgânico','Móveis e eletrodomésticos',
               'Resíduos perigosos ou químicos','Resíduos hospitalares','Outros/diversos')),
  rua        varchar(200) NOT NULL,
  num        varchar(10)  NOT NULL,
  bairro     varchar(120) NOT NULL,
  cidade     varchar(120) NOT NULL,
  uf         char(2)      NOT NULL,
  cep        char(8)      NOT NULL CHECK (cep ~ '^[0-9]{8}$'),
  foto       text,
  foto_nome  varchar(120),
  status     text NOT NULL DEFAULT 'Recebido'
             CHECK (status IN ('Recebido','Em Andamento','Concluído')),
  criado_em  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_submissoes_criado ON submissoes (criado_em DESC);
