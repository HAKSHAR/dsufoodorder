require('dotenv').config();
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
(async () => {
  const pool = await mysql.createPool({host:process.env.DB_HOST||'localhost',port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER||'root',password:process.env.DB_PASSWORD||'',database:process.env.DB_NAME||'dsu_food_ordering'});
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password === 'ChangeMe123!') {
    console.error('Set a strong ADMIN_PASSWORD in .env before running npm run create-admin.');
    process.exitCode=1; await pool.end(); return;
  }
  const hash = await bcrypt.hash(password, 12);
  await pool.query('INSERT INTO admins (username,password_hash) VALUES (?,?) ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash)', [username,hash]);
  console.log(`Admin '${username}' created/updated. Keep the password private.`);
  await pool.end();
})().catch(e=>{console.error(e.message);process.exit(1)});
