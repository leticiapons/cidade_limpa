require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('./db');

const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET;
const PROD = process.env.NODE_ENV === 'production';
if (!SECRET || SECRET.length < 32) {
  console.error('Defina JWT_SECRET com 32 ou mais caracteres (veja .env.example).');
  process.exit(1);
}

const TIPOS = ['Lixo reciclável', 'Lixo orgânico', 'Móveis e eletrodomésticos',
  'Resíduos perigosos ou químicos', 'Resíduos hospitalares', 'Outros/diversos'];
const STATUS = ['Recebido', 'Em Andamento', 'Concluído'];
// hash falso para gastar o mesmo tempo quando a matrícula não existe
const FAKE_HASH = bcrypt.hashSync('nao-existe', 12);

const app = express();
app.set('trust proxy', 1); // necessário atrás do Render/Railway/Nginx
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ['https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// ---------- limites contra abuso ----------
const limiteEnvio = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 15, standardHeaders: true, legacyHeaders: false,
  message: { erro: 'Muitos envios em pouco tempo. Tente novamente mais tarde.' },
});
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false,
  message: { erro: 'Muitas tentativas de login. Aguarde 15 minutos.' },
});

// ---------- autenticação ----------
function auth(req, res, next) {
  try {
    req.agente = jwt.verify(req.cookies.cl_token || '', SECRET);
    next();
  } catch (e) {
    res.status(401).json({ erro: 'Não autenticado.' });
  }
}

app.post('/api/login', limiteLogin, async (req, res) => {
  try {
    const matricula = String((req.body || {}).matricula || '').replace(/\D/g, '').slice(0, 20);
    const senha = String((req.body || {}).senha || '').slice(0, 200);
    if (!matricula || !senha) return res.status(400).json({ erro: 'Informe matrícula e senha.' });
    const r = await pool.query('SELECT matricula, nome, senha_hash FROM agentes WHERE matricula = $1', [matricula]);
    const ag = r.rows[0];
    const ok = await bcrypt.compare(senha, ag ? ag.senha_hash : FAKE_HASH);
    if (!ag || !ok) return res.status(401).json({ erro: 'Matrícula ou senha inválida.' });
    const token = jwt.sign({ sub: ag.matricula, nome: ag.nome }, SECRET, { expiresIn: '8h' });
    res.cookie('cl_token', token, {
      httpOnly: true, sameSite: 'lax', secure: PROD, maxAge: 8 * 60 * 60 * 1000,
    });
    res.json({ ok: true, nome: ag.nome });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro no servidor.' });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('cl_token', { httpOnly: true, sameSite: 'lax', secure: PROD });
  res.json({ ok: true });
});

app.get('/api/me', auth, (req, res) => res.json({ matricula: req.agente.sub, nome: req.agente.nome }));

// ---------- formulário (público) ----------
function validar(b) {
  const s = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
  const d = {
    tipo: s(b.tipo, 60), rua: s(b.rua, 200), num: s(b.num, 10), bairro: s(b.bairro, 120),
    cidade: s(b.cidade, 120), uf: s(b.uf, 2).toUpperCase(), cep: s(b.cep, 8),
    foto: typeof b.foto === 'string' ? b.foto : '', fotoNome: s(b.fotoNome, 120),
  };
  if (!TIPOS.includes(d.tipo)) return { erro: 'Tipo de lixo inválido.' };
  if (!d.rua || !d.num || !d.bairro || !d.cidade) return { erro: 'Preencha rua, número, bairro e cidade.' };
  if (!/^[A-Z]{2}$/.test(d.uf)) return { erro: 'UF inválida.' };
  if (!/^\d{8}$/.test(d.cep)) return { erro: 'CEP inválido.' };
  const fotoOk = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(d.foto) ||
    /^data:application\/pdf;base64,[A-Za-z0-9+/=]+$/.test(d.foto) ||
    d.foto === 'data:application/pdf;name';
  if (!fotoOk || d.foto.length > 400000) return { erro: 'Foto inválida ou muito grande.' };
  return { d };
}

app.post('/api/submissoes', limiteEnvio, async (req, res) => {
  const { d, erro } = validar(req.body || {});
  if (erro) return res.status(400).json({ erro });
  try {
    const r = await pool.query(
      `INSERT INTO submissoes (tipo, rua, num, bairro, cidade, uf, cep, foto, foto_nome)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [d.tipo, d.rua, d.num, d.bairro, d.cidade, d.uf, d.cep, d.foto, d.fotoNome]
    );
    res.status(201).json({ ok: true, id: r.rows[0].id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Não foi possível gravar. Tente novamente.' });
  }
});

// ---------- painel do agente fiscal (protegido) ----------
app.get('/api/submissoes', auth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id,
              'CL-' || lpad(id::text, 6, '0') AS idv,
              to_char(criado_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') AS data,
              (extract(epoch FROM criado_em) * 1000)::bigint AS ts,
              tipo, rua, num, bairro, cidade, uf, cep,
              foto, foto_nome AS "fotoNome", status
         FROM submissoes ORDER BY criado_em DESC LIMIT 1000`
    );
    res.json(r.rows.map((x) => ({ ...x, ts: Number(x.ts) })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro no servidor.' });
  }
});

app.patch('/api/submissoes/:id/status', auth, async (req, res) => {
  const id = Number(req.params.id);
  const status = String((req.body || {}).status || '');
  if (!Number.isInteger(id) || id < 1 || !STATUS.includes(status)) {
    return res.status(400).json({ erro: 'Dados inválidos.' });
  }
  try {
    const r = await pool.query('UPDATE submissoes SET status = $1 WHERE id = $2', [status, id]);
    if (!r.rowCount) return res.status(404).json({ erro: 'Registro não encontrado.' });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro no servidor.' });
  }
});

// ---------- site ----------
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));
app.use((err, req, res, next) => { // JSON inválido ou grande demais
  if (err && err.status) return res.status(err.status).json({ erro: 'Requisição inválida.' });
  console.error(err);
  res.status(500).json({ erro: 'Erro no servidor.' });
});

app.listen(PORT, () => console.log('Cidade Limpa rodando na porta ' + PORT));
