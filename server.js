const express = require('express');
const cors    = require('cors');
const path    = require('path');
const db      = require('./database');

const app  = express();
const PORT = 8000;

app.use(cors({
  origin: ['http://localhost:5173','http://127.0.0.1:5173'],
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true
}));
app.options('*', cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── POST /api/contact — save new submission ──────────────────────
app.post('/api/contact', (req, res) => {
  try {
    const { firstName, lastName, email, phone, message } = req.body;
    if (!firstName || !email || !phone || !message)
      return res.status(400).json({ success:false, message:'Please fill in all required fields.' });

    const result = db.prepare(`
      INSERT INTO contacts (first_name, last_name, email, phone, message)
      VALUES (?, ?, ?, ?, ?)
    `).run(firstName, lastName, email, phone, message);

    console.log(`✅ New contact saved! ID: ${result.lastInsertRowid} | Name: ${firstName} ${lastName}`);
    res.status(201).json({ success:true, message:'Thank you! Your message has been received. We will contact you soon.', id: result.lastInsertRowid });
  } catch(e) {
    console.error('❌ Error:', e.message);
    res.status(500).json({ success:false, message:'Server error. Please try again.' });
  }
});

// ── GET /api/contacts — all active (not trashed) ─────────────────
app.get('/api/contacts', (req, res) => {
  try {
    const contacts = db.prepare("SELECT * FROM contacts WHERE trashed = 0 ORDER BY created_at DESC").all();
    res.json({ success:true, total:contacts.length, data:contacts });
  } catch(e) {
    res.status(500).json({ success:false, message:'Error fetching data.' });
  }
});

// ── GET /api/contacts/trash — all trashed ────────────────────────
app.get('/api/contacts/trash', (req, res) => {
  try {
    const contacts = db.prepare("SELECT * FROM contacts WHERE trashed = 1 ORDER BY deleted_at DESC").all();
    res.json({ success:true, total:contacts.length, data:contacts });
  } catch(e) {
    res.status(500).json({ success:false, message:'Error fetching trash.' });
  }
});

// ── PUT /api/contacts/:id/read — mark as read ────────────────────
app.put('/api/contacts/:id/read', (req, res) => {
  try {
    db.prepare("UPDATE contacts SET status = 'read' WHERE id = ?").run(req.params.id);
    res.json({ success:true });
  } catch(e) {
    res.status(500).json({ success:false });
  }
});

// ── PUT /api/contacts/:id/trash — move to bin ────────────────────
app.put('/api/contacts/:id/trash', (req, res) => {
  try {
    db.prepare("UPDATE contacts SET trashed = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id);
    res.json({ success:true, message:'Moved to recycle bin.' });
  } catch(e) {
    res.status(500).json({ success:false });
  }
});

// ── PUT /api/contacts/:id/restore — restore from bin ────────────
app.put('/api/contacts/:id/restore', (req, res) => {
  try {
    db.prepare("UPDATE contacts SET trashed = 0, deleted_at = NULL WHERE id = ?").run(req.params.id);
    res.json({ success:true, message:'Restored successfully.' });
  } catch(e) {
    res.status(500).json({ success:false });
  }
});

// ── DELETE /api/contacts/:id — permanent delete ──────────────────
app.delete('/api/contacts/:id', (req, res) => {
  try {
    db.prepare("DELETE FROM contacts WHERE id = ?").run(req.params.id);
    res.json({ success:true, message:'Permanently deleted.' });
  } catch(e) {
    res.status(500).json({ success:false });
  }
});

// ── DELETE /api/contacts/trash/empty — empty bin ─────────────────
app.delete('/api/contacts/trash/empty', (req, res) => {
  try {
    db.prepare("DELETE FROM contacts WHERE trashed = 1").run();
    res.json({ success:true, message:'Recycle bin emptied.' });
  } catch(e) {
    res.status(500).json({ success:false });
  }
});

app.listen(PORT, () => {
  console.log('');
  console.log('🚀 Finpenny Backend Server is running!');
  console.log(`📡 API URL     : http://localhost:${PORT}/api`);
  console.log(`🔑 Admin Panel : http://localhost:${PORT}/admin`);
  console.log('');
});