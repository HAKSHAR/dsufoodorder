require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;
const uploadDir = path.join(__dirname, 'public', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'dsu_food_ordering',
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'development-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 4 }
}));
app.use(flash());
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.admin = req.session.admin || null;
  res.locals.money = n => `₹${Number(n || 0).toFixed(2)}`;
  next();
});

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random()*1e9)}${path.extname(file.originalname).toLowerCase()}`)
});
const imageUpload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ['image/jpeg','image/png','image/webp'].includes(file.mimetype))
});

function requireAdmin(req, res, next) {
  if (!req.session.admin) return res.redirect('/admin/login');
  next();
}
function handleUpload(req, res, next) {
  imageUpload.single('photo')(req, res, err => {
    if (err) {
      req.flash('error', err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 4 MB or smaller.' : 'Upload a JPG, PNG, or WEBP image.');
      return res.redirect('back');
    }
    next();
  });
}

app.get('/api/catalog', async (_req, res, next) => {
  try {
    const [restaurants] = await pool.query('SELECT id, name, description FROM restaurants WHERE is_active = 1 ORDER BY name');
    const [items] = await pool.query(`SELECT m.id, m.restaurant_id, m.name, m.description, m.category, m.price, m.photo, r.name AS restaurant_name FROM menu_items m JOIN restaurants r ON r.id=m.restaurant_id WHERE m.is_available=1 AND r.is_active=1 ORDER BY r.name, m.category, m.name`);
    res.json({ restaurants, items });
  } catch (e) { next(e); }
});

app.get('/', async (_req, res, next) => {
  try {
    const [restaurants] = await pool.query('SELECT * FROM restaurants WHERE is_active = 1 ORDER BY name');
    const [items] = await pool.query(`SELECT m.*, r.name AS restaurant_name FROM menu_items m JOIN restaurants r ON r.id=m.restaurant_id WHERE m.is_available=1 AND r.is_active=1 ORDER BY r.name, m.category, m.name`);
    res.render('home', { restaurants, items, whatsapp: process.env.WHATSAPP_NUMBER || '916304166381' });
  } catch (e) { next(e); }
});

app.get('/admin/login', (req, res) => res.render('login', { pageTitle: 'Admin Login' }));
app.post('/admin/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const [rows] = await pool.query('SELECT * FROM admins WHERE username = ?', [username]);
    const admin = rows[0];
    if (!admin || !(await bcrypt.compare(password || '', admin.password_hash))) {
      req.flash('error', 'Incorrect username or password.');
      return res.redirect('/admin/login');
    }
    req.session.regenerate(err => {
      if (err) return next(err);
      req.session.admin = { id: admin.id, username: admin.username };
      res.redirect('/admin');
    });
  } catch (e) { next(e); }
});
app.post('/admin/logout', requireAdmin, (req, res) => req.session.destroy(() => res.redirect('/')));

app.get('/admin', requireAdmin, async (_req, res, next) => {
  try {
    const [[restaurantCount]] = await pool.query('SELECT COUNT(*) AS total FROM restaurants');
    const [[itemCount]] = await pool.query('SELECT COUNT(*) AS total FROM menu_items');
    const [[orderCount]] = await pool.query("SELECT COUNT(*) AS total FROM orders WHERE status='New'");
    const [restaurants] = await pool.query('SELECT r.*, COUNT(DISTINCT m.id) AS item_count FROM restaurants r LEFT JOIN menu_items m ON m.restaurant_id=r.id GROUP BY r.id ORDER BY r.name');
    const [orders] = await pool.query('SELECT o.*, r.name AS restaurant_name FROM orders o JOIN restaurants r ON r.id=o.restaurant_id ORDER BY o.created_at DESC LIMIT 20');
    res.render('admin', { restaurantCount: restaurantCount.total, itemCount: itemCount.total, orderCount: orderCount.total, restaurants, orders });
  } catch (e) { next(e); }
});

app.post('/admin/restaurants', requireAdmin, async (req, res, next) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name) { req.flash('error', 'Restaurant name is required.'); return res.redirect('/admin'); }
    await pool.query('INSERT INTO restaurants (name, description, is_active) VALUES (?, ?, ?)', [name, (req.body.description || '').trim(), req.body.is_active === 'on' ? 1 : 0]);
    req.flash('success', 'Restaurant added.'); res.redirect('/admin');
  } catch (e) { next(e); }
});
app.post('/admin/restaurants/:id/update', requireAdmin, async (req, res, next) => {
  try {
    await pool.query('UPDATE restaurants SET name=?, description=?, is_active=? WHERE id=?', [(req.body.name || '').trim(), (req.body.description || '').trim(), req.body.is_active === 'on' ? 1 : 0, req.params.id]);
    req.flash('success', 'Restaurant updated.'); res.redirect('/admin');
  } catch (e) { next(e); }
});
app.post('/admin/restaurants/:id/delete', requireAdmin, async (req, res, next) => {
  try { await pool.query('DELETE FROM restaurants WHERE id=?', [req.params.id]); req.flash('success', 'Restaurant and its menu removed.'); res.redirect('/admin'); }
  catch (e) { next(e); }
});

app.get('/admin/restaurants/:id/menu', requireAdmin, async (req, res, next) => {
  try {
    const [[restaurant]] = await pool.query('SELECT * FROM restaurants WHERE id=?', [req.params.id]);
    if (!restaurant) return res.status(404).send('Restaurant not found');
    const [items] = await pool.query('SELECT * FROM menu_items WHERE restaurant_id=? ORDER BY category,name', [req.params.id]);
    res.render('menu-admin', { restaurant, items });
  } catch (e) { next(e); }
});
app.post('/admin/restaurants/:id/menu', requireAdmin, handleUpload, async (req, res, next) => {
  try {
    const { name, description, category, price } = req.body;
    if (!name || !Number.isFinite(Number(price)) || Number(price) < 0) { req.flash('error', 'Enter a food name and valid price.'); return res.redirect(`/admin/restaurants/${req.params.id}/menu`); }
    const photo = req.file ? `/uploads/${req.file.filename}` : null;
    await pool.query('INSERT INTO menu_items (restaurant_id,name,description,category,price,photo,is_available) VALUES (?,?,?,?,?,?,?)', [req.params.id, name.trim(), (description || '').trim(), (category || 'Other').trim(), Number(price), photo, req.body.is_available === 'on' ? 1 : 0]);
    req.flash('success', 'Food item added.'); res.redirect(`/admin/restaurants/${req.params.id}/menu`);
  } catch (e) { next(e); }
});
app.post('/admin/menu/:id/update', requireAdmin, handleUpload, async (req, res, next) => {
  try {
    const [[old]] = await pool.query('SELECT * FROM menu_items WHERE id=?', [req.params.id]);
    if (!old) return res.status(404).send('Menu item not found');
    const photo = req.file ? `/uploads/${req.file.filename}` : old.photo;
    await pool.query('UPDATE menu_items SET name=?,description=?,category=?,price=?,photo=?,is_available=? WHERE id=?', [(req.body.name || '').trim(), (req.body.description || '').trim(), (req.body.category || 'Other').trim(), Number(req.body.price), photo, req.body.is_available === 'on' ? 1 : 0, req.params.id]);
    if (req.file && old.photo) fs.unlink(path.join(__dirname, 'public', old.photo.replace(/^\//, '')), () => {});
    req.flash('success', 'Food item updated.'); res.redirect(`/admin/restaurants/${old.restaurant_id}/menu`);
  } catch (e) { next(e); }
});
app.post('/admin/menu/:id/delete', requireAdmin, async (req, res, next) => {
  try {
    const [[item]] = await pool.query('SELECT * FROM menu_items WHERE id=?', [req.params.id]);
    if (!item) return res.redirect('/admin');
    await pool.query('DELETE FROM menu_items WHERE id=?', [req.params.id]);
    if (item.photo) fs.unlink(path.join(__dirname, 'public', item.photo.replace(/^\//, '')), () => {});
    req.flash('success', 'Food item deleted.'); res.redirect(`/admin/restaurants/${item.restaurant_id}/menu`);
  } catch (e) { next(e); }
});

app.post('/api/orders', async (req, res, next) => {
  try {
    const { restaurantId, items, total, customerName } = req.body;
    if (!restaurantId || !Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Cart is empty.' });
    const [restaurantRows] = await pool.query('SELECT id,name FROM restaurants WHERE id=? AND is_active=1', [restaurantId]);
    if (!restaurantRows.length) return res.status(400).json({ error: 'Please select an active restaurant.' });
    const ids = [...new Set(items.map(i => Number(i.id)).filter(Number.isInteger))];
    if (!ids.length) return res.status(400).json({ error: 'Invalid cart items.' });
    const [dbItems] = await pool.query(`SELECT id,name,price,restaurant_id,is_available FROM menu_items WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
    const byId = new Map(dbItems.map(i => [i.id, i]));
    const verified = [];
    for (const line of items) {
      const item = byId.get(Number(line.id)); const qty = Math.max(1, Math.min(99, Number.parseInt(line.quantity, 10) || 1));
      if (!item || item.restaurant_id !== Number(restaurantId) || !item.is_available) return res.status(400).json({ error: 'One or more items are unavailable. Refresh the menu.' });
      verified.push({ id: item.id, name: item.name, price: Number(item.price), quantity: qty, subtotal: Number(item.price) * qty });
    }
    const calculatedTotal = Number(verified.reduce((sum, i) => sum + i.subtotal, 0).toFixed(2));
    const [result] = await pool.query('INSERT INTO orders (restaurant_id,items_json,total,customer_name) VALUES (?,?,?,?)', [restaurantId, JSON.stringify(verified), calculatedTotal, (customerName || '').trim().slice(0,120) || null]);
    const wa = (process.env.WHATSAPP_NUMBER || '916304166381').replace(/\D/g, '');
    const message = [`Hello, I would like to order from ${restaurantRows[0].name}.`, `Order ID: ${result.insertId}`, '', ...verified.map(i => `${i.name} x ${i.quantity} = ₹${i.subtotal.toFixed(2)}`), '', `Total: ₹${calculatedTotal.toFixed(2)}`, customerName ? `Customer: ${customerName.trim().slice(0,120)}` : '', '', 'Please confirm my order.'].filter(Boolean).join('\n');
    res.json({ orderId: result.insertId, whatsappUrl: `https://wa.me/${wa}?text=${encodeURIComponent(message)}` });
  } catch (e) { next(e); }
});
app.post('/admin/orders/:id/status', requireAdmin, async (req, res, next) => {
  try {
    const allowed = ['New','Confirmed','Preparing','Completed','Cancelled'];
    if (!allowed.includes(req.body.status)) { req.flash('error', 'Invalid order status.'); return res.redirect('/admin'); }
    await pool.query('UPDATE orders SET status=? WHERE id=?', [req.body.status, req.params.id]);
    req.flash('success', 'Order status updated.'); res.redirect('/admin');
  } catch (e) { next(e); }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  if (res.headersSent) return;
  res.status(500).send('Something went wrong. Check the terminal for details and confirm MySQL is running.');
});

async function start() {
  try {
    await pool.query('SELECT 1');
    app.listen(PORT, () => console.log(`DSU Food Ordering System running at http://localhost:${PORT}`));
  } catch (e) {
    console.error('Cannot connect to MySQL. Create the database using schema.sql and check .env settings.\n', e.message);
    process.exit(1);
  }
}
start();
