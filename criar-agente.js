// Cadastra ou atualiza a senha de um agente:
//   npm run criar-agente -- 12345 "Nome do Agente" "senha-forte-aqui"
const bcrypt = require('bcryptjs');
const pool = require('./db');

(async () => {
  const [matricula, nome, senha] = process.argv.slice(2);
  if (!/^\d{1,20}$/.test(matricula || '') || !nome || !senha) {
    console.error('Uso: npm run criar-agente -- <matricula-so-numeros> "<nome>" "<senha>"');
    process.exit(1);
  }
  if (senha.length < 8) {
    console.error('Use uma senha com pelo menos 8 caracteres.');
    process.exit(1);
  }
  try {
    const hash = await bcrypt.hash(senha, 12);
    await pool.query(
      `INSERT INTO agentes (matricula, nome, senha_hash) VALUES ($1,$2,$3)
       ON CONFLICT (matricula) DO UPDATE SET nome = EXCLUDED.nome, senha_hash = EXCLUDED.senha_hash`,
      [matricula, nome.slice(0, 120), hash]
    );
    console.log('Agente ' + matricula + ' salvo com sucesso.');
  } catch (e) {
    console.error('Erro:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
