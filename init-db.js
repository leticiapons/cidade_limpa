// Cria as tabelas no PostgreSQL:  npm run init-db
const fs = require('fs');
const path = require('path');
const pool = require('./db');

(async () => {
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(sql);
    console.log('Tabelas criadas/atualizadas com sucesso.');
  } catch (e) {
    console.error('Erro ao criar tabelas:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
