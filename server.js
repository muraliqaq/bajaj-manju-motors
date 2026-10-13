const express = require('express');
const crypto = require('node:crypto');
const path = require('node:path');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const DATABASE_URL = process.env.DATABASE_URL || '';
if (!ADMIN_TOKEN || ADMIN_TOKEN.length < 24) {
  console.error('Set ADMIN_TOKEN to a random secret of at least 24 characters.');
  process.exit(1);
}
if (!DATABASE_URL) {
  console.error('Set DATABASE_URL to your hosted PostgreSQL connection string.');
  process.exit(1);
}
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
  max: 5
});

app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});
app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html' }));

const statuses = new Set(['Prepared','Contacted','Confirmed','Completed','Cancelled']);
function clean(v, max=1000) { return String(v ?? '').trim().slice(0,max); }
function normalize(body) {
  const name=clean(body.name,120), phone=clean(body.phone,30), model=clean(body.model,120), service=clean(body.service,120), date=clean(body.date,10);
  const digits=phone.replace(/\D/g,'');
  if (!name || !model || !service || !date || digits.length < 10 || digits.length > 15) throw new Error('Provide name, valid phone (10–15 digits), model, request type, and preferred date.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) throw new Error('Preferred date must be a valid YYYY-MM-DD date.');
  return {name,phone,model,service,date,registration:clean(body.registration,30),time:clean(body.time,60),message:clean(body.message,2000)};
}
const auth = (req,res,next) => {
  const supplied = (req.get('authorization') || '').replace(/^Bearer\s+/i,'');
  const a = Buffer.from(supplied); const b = Buffer.from(ADMIN_TOKEN);
  if (a.length !== b.length || !crypto.timingSafeEqual(a,b)) return res.status(401).json({error:'Admin access key is missing or invalid.'});
  next();
};
app.get('/api/health', async (req,res) => {
  try { await pool.query('SELECT 1'); res.json({ok:true,database:'postgresql',timestamp:new Date().toISOString()}); }
  catch { res.status(503).json({ok:false,error:'Database connection failed.'}); }
});
app.post('/api/bookings', async (req,res) => {
  try {
    const f=normalize(req.body || {}), now=new Date().toISOString(), id=crypto.randomUUID();
    const q=`INSERT INTO bookings (id,name,phone,model,registration,service,date,time,message,status,"createdAt","updatedAt")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`;
    const values=[id,f.name,f.phone,f.model,f.registration,f.service,f.date,f.time,f.message,'Prepared',now,now];
    const result=await pool.query(q,values);
    res.status(201).json({booking:result.rows[0]});
  } catch(e) { res.status(400).json({error:e.message || 'Invalid booking.'}); }
});
app.get('/api/bookings', auth, async (req,res) => {
  try { const r=await pool.query('SELECT * FROM bookings ORDER BY "createdAt" DESC'); res.json({bookings:r.rows}); }
  catch { res.status(500).json({error:'Could not load bookings.'}); }
});
app.patch('/api/bookings/:id', auth, async (req,res) => {
  try {
    const status=clean(req.body?.status,30);
    if(!statuses.has(status)) return res.status(400).json({error:'Invalid status.'});
    const r=await pool.query('UPDATE bookings SET status=$1, "updatedAt"=$2 WHERE id=$3 RETURNING *',[status,new Date().toISOString(),req.params.id]);
    if(!r.rowCount) return res.status(404).json({error:'Booking not found.'});
    res.json({booking:r.rows[0]});
  } catch { res.status(500).json({error:'Could not update booking.'}); }
});
app.delete('/api/bookings/:id', auth, async (req,res) => {
  try {
    const r=await pool.query('DELETE FROM bookings WHERE id=$1',[req.params.id]);
    if(!r.rowCount) return res.status(404).json({error:'Booking not found.'});
    res.json({ok:true});
  } catch { res.status(500).json({error:'Could not delete booking.'}); }
});
app.delete('/api/bookings', auth, async (req,res) => {
  try { const r=await pool.query('DELETE FROM bookings'); res.json({ok:true,deleted:r.rowCount}); }
  catch { res.status(500).json({error:'Could not clear bookings.'}); }
});
app.use('/api', (req,res) => res.status(404).json({error:'API route not found.'}));

async function start() {
  await pool.query(`CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL, model TEXT NOT NULL,
    registration TEXT NOT NULL DEFAULT '', service TEXT NOT NULL, date TEXT NOT NULL,
    time TEXT NOT NULL DEFAULT '', message TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'Prepared',
    "createdAt" TEXT NOT NULL, "updatedAt" TEXT NOT NULL
  )`);
  app.listen(PORT, () => console.log(`Bajaj Manju Motors backend listening on port ${PORT}`));
}
start().catch(err => { console.error('Database initialization failed:', err.message); process.exit(1); });
