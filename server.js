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
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ════════════════════════════════════════════════════════════════════
//  CONTACT ROUTES
// ════════════════════════════════════════════════════════════════════

app.post('/api/contact', (req, res) => {
  try {
    const { firstName, lastName, email, phone, message } = req.body;
    if (!firstName || !email || !phone || !message)
      return res.status(400).json({ success:false, message:'Please fill in all required fields.' });

    const result = db.prepare(`
      INSERT INTO contacts (first_name, last_name, email, phone, message)
      VALUES (?, ?, ?, ?, ?)
    `).run(firstName, lastName, email, phone, message);

    res.status(201).json({ success:true, message:'Thank you! Your message has been received.', id: result.lastInsertRowid });
  } catch(e) {
    console.error('❌ Error:', e.message);
    res.status(500).json({ success:false, message:'Server error. Please try again.' });
  }
});

app.get('/api/contacts', (req, res) => {
  try {
    const contacts = db.prepare("SELECT * FROM contacts WHERE trashed = 0 ORDER BY created_at DESC").all();
    res.json({ success:true, total:contacts.length, data:contacts });
  } catch(e) {
    res.status(500).json({ success:false, message:'Error fetching data.' });
  }
});

app.get('/api/contacts/trash', (req, res) => {
  try {
    const contacts = db.prepare("SELECT * FROM contacts WHERE trashed = 1 ORDER BY deleted_at DESC").all();
    res.json({ success:true, total:contacts.length, data:contacts });
  } catch(e) {
    res.status(500).json({ success:false, message:'Error fetching trash.' });
  }
});

app.put('/api/contacts/:id/read', (req, res) => {
  try {
    db.prepare("UPDATE contacts SET status = 'read' WHERE id = ?").run(req.params.id);
    res.json({ success:true });
  } catch(e) { res.status(500).json({ success:false }); }
});

app.put('/api/contacts/:id/trash', (req, res) => {
  try {
    db.prepare("UPDATE contacts SET trashed = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id);
    res.json({ success:true, message:'Moved to recycle bin.' });
  } catch(e) { res.status(500).json({ success:false }); }
});

app.put('/api/contacts/:id/restore', (req, res) => {
  try {
    db.prepare("UPDATE contacts SET trashed = 0, deleted_at = NULL WHERE id = ?").run(req.params.id);
    res.json({ success:true, message:'Restored successfully.' });
  } catch(e) { res.status(500).json({ success:false }); }
});

app.delete('/api/contacts/:id', (req, res) => {
  try {
    db.prepare("DELETE FROM contacts WHERE id = ?").run(req.params.id);
    res.json({ success:true, message:'Permanently deleted.' });
  } catch(e) { res.status(500).json({ success:false }); }
});

app.delete('/api/contacts/trash/empty', (req, res) => {
  try {
    db.prepare("DELETE FROM contacts WHERE trashed = 1").run();
    res.json({ success:true, message:'Recycle bin emptied.' });
  } catch(e) { res.status(500).json({ success:false }); }
});

// ════════════════════════════════════════════════════════════════════
//  BLOG CATEGORY ROUTES
// ════════════════════════════════════════════════════════════════════

// GET all categories
app.get('/api/blog/categories', (req, res) => {
  try {
    const cats = db.prepare("SELECT * FROM blog_categories ORDER BY name ASC").all();
    res.json({ success:true, data:cats });
  } catch(e) {
    res.status(500).json({ success:false, message:'Error fetching categories.' });
  }
});

// POST create category
app.post('/api/blog/categories', (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success:false, message:'Category name required.' });
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const result = db.prepare("INSERT INTO blog_categories (name, slug) VALUES (?, ?)").run(name, slug);
    res.status(201).json({ success:true, data: { id: result.lastInsertRowid, name, slug } });
  } catch(e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ success:false, message:'Category already exists.' });
    res.status(500).json({ success:false, message:'Error creating category.' });
  }
});

// PUT update category
app.put('/api/blog/categories/:id', (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success:false, message:'Category name required.' });
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    db.prepare("UPDATE blog_categories SET name = ?, slug = ? WHERE id = ?").run(name, slug, req.params.id);
    res.json({ success:true, data: { id: parseInt(req.params.id), name, slug } });
  } catch(e) {
    res.status(500).json({ success:false, message:'Error updating category.' });
  }
});

// DELETE category
app.delete('/api/blog/categories/:id', (req, res) => {
  try {
    db.prepare("DELETE FROM blog_categories WHERE id = ?").run(req.params.id);
    res.json({ success:true, message:'Category deleted.' });
  } catch(e) {
    res.status(500).json({ success:false, message:'Error deleting category.' });
  }
});

// ════════════════════════════════════════════════════════════════════
//  BLOG POST ROUTES
// ════════════════════════════════════════════════════════════════════

// GET all posts (public — only published) with category name joined
app.get('/api/blog/posts', (req, res) => {
  try {
    const { category, search } = req.query;
    let query = `
      SELECT p.id, p.title, p.slug, p.content, p.excerpt, p.category_id, p.cover_image, p.status, p.tags, p.image_width, p.image_height, p.created_at, p.updated_at, c.name as category_name, c.slug as category_slug
      FROM blog_posts p
      LEFT JOIN blog_categories c ON p.category_id = c.id
      WHERE p.status = 'published'
    `;
    const params = [];
    if (category) { query += ' AND c.slug = ?'; params.push(category); }
    if (search)   { query += ' AND (p.title LIKE ? OR p.excerpt LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    query += ' ORDER BY p.created_at DESC';
    const posts = db.prepare(query).all(...params);
    res.json({ success:true, total:posts.length, data:posts });
  } catch(e) {
    console.error(e);
    res.status(500).json({ success:false, message:'Error fetching posts.' });
  }
});

// GET all posts for ADMIN (all statuses)
app.get('/api/admin/blog/posts', (req, res) => {
  try {
    const posts = db.prepare(`
      SELECT p.id, p.title, p.slug, p.content, p.excerpt, p.category_id, p.cover_image, p.status, p.tags, p.image_width, p.image_height, p.created_at, p.updated_at, c.name as category_name
      FROM blog_posts p
      LEFT JOIN blog_categories c ON p.category_id = c.id
      ORDER BY p.created_at DESC
    `).all();
    res.json({ success:true, total:posts.length, data:posts });
  } catch(e) {
    res.status(500).json({ success:false, message:'Error fetching posts.' });
  }
});

// GET single post by slug (public)
app.get('/api/blog/posts/:slug', (req, res) => {
  try {
    const post = db.prepare(`
      SELECT p.id, p.title, p.slug, p.content, p.excerpt, p.category_id, p.cover_image, p.status, p.tags, p.image_width, p.image_height, p.created_at, p.updated_at, c.name as category_name, c.slug as category_slug
      FROM blog_posts p
      LEFT JOIN blog_categories c ON p.category_id = c.id
      WHERE p.slug = ? AND p.status = 'published'
    `).get(req.params.slug);
    if (!post) return res.status(404).json({ success:false, message:'Post not found.' });
    res.json({ success:true, data:post });
  } catch(e) {
    res.status(500).json({ success:false, message:'Error fetching post.' });
  }
});

// GET single post by ID (admin)
app.get('/api/admin/blog/posts/:id', (req, res) => {
  try {
    const post = db.prepare(`
      SELECT p.id, p.title, p.slug, p.content, p.excerpt, p.category_id, p.cover_image, p.status, p.tags, p.image_width, p.image_height, p.created_at, p.updated_at, c.name as category_name
      FROM blog_posts p
      LEFT JOIN blog_categories c ON p.category_id = c.id
      WHERE p.id = ?
    `).get(req.params.id);
    if (!post) return res.status(404).json({ success:false, message:'Post not found.' });
    res.json({ success:true, data:post });
  } catch(e) {
    res.status(500).json({ success:false, message:'Error fetching post.' });
  }
});

// POST create blog post
app.post('/api/blog/posts', (req, res) => {
  try {
    const { title, content, excerpt, category_id, cover_image, status, tags, image_width, image_height } = req.body;
    if (!title || !content) return res.status(400).json({ success:false, message:'Title and content are required.' });

    let slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    // Ensure unique slug
    const existing = db.prepare("SELECT id FROM blog_posts WHERE slug = ?").get(slug);
    if (existing) slug = slug + '-' + Date.now();

    const result = db.prepare(`
      INSERT INTO blog_posts (title, slug, content, excerpt, category_id, cover_image, status, tags, image_width, image_height)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(title, slug, content, excerpt || '', category_id || null, cover_image || '', status || 'draft', tags || '', image_width || 1200, image_height || 630);

    res.status(201).json({ success:true, message:'Post created.', id: result.lastInsertRowid, slug });
  } catch(e) {
    console.error(e);
    res.status(500).json({ success:false, message:'Error creating post.' });
  }
});

// PUT update blog post
app.put('/api/blog/posts/:id', (req, res) => {
  try {
    const { title, content, excerpt, category_id, cover_image, status, tags, image_width, image_height } = req.body;
    if (!title || !content) return res.status(400).json({ success:false, message:'Title and content are required.' });

    let slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const existing = db.prepare("SELECT id FROM blog_posts WHERE slug = ? AND id != ?").get(slug, req.params.id);
    if (existing) slug = slug + '-' + Date.now();

    db.prepare(`
      UPDATE blog_posts
      SET title = ?, slug = ?, content = ?, excerpt = ?, category_id = ?, cover_image = ?, status = ?, tags = ?, image_width = ?, image_height = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(title, slug, content, excerpt || '', category_id || null, cover_image || '', status || 'draft', tags || '', image_width || 1200, image_height || 630, req.params.id);

    res.json({ success:true, message:'Post updated.', slug });
  } catch(e) {
    console.error(e);
    res.status(500).json({ success:false, message:'Error updating post.' });
  }
});

// DELETE blog post
app.delete('/api/blog/posts/:id', (req, res) => {
  try {
    db.prepare("DELETE FROM blog_posts WHERE id = ?").run(req.params.id);
    res.json({ success:true, message:'Post deleted.' });
  } catch(e) {
    res.status(500).json({ success:false, message:'Error deleting post.' });
  }
});

// ════════════════════════════════════════════════════════════════════
//  BLOG TAG ROUTES
// ════════════════════════════════════════════════════════════════════

// GET all unique tags from posts
app.get('/api/blog/tags', (req, res) => {
  try {
    const posts = db.prepare("SELECT tags FROM blog_posts WHERE status = 'published' AND tags != ''").all();
    const tagsSet = new Set();
    posts.forEach(p => {
      if (p.tags) {
        const tags = p.tags.split(',').map(t => t.trim()).filter(t => t);
        tags.forEach(t => tagsSet.add(t));
      }
    });
    const tags = Array.from(tagsSet).sort();
    res.json({ success:true, data:tags });
  } catch(e) {
    res.status(500).json({ success:false, message:'Error fetching tags.' });
  }
});

// GET tag suggestions based on prefix
app.get('/api/blog/tags/suggest/:prefix', (req, res) => {
  try {
    const prefix = req.params.prefix.toLowerCase();
    const posts = db.prepare("SELECT tags FROM blog_posts WHERE status = 'published' AND tags != ''").all();
    const tagsSet = new Set();
    posts.forEach(p => {
      if (p.tags) {
        const tags = p.tags.split(',').map(t => t.trim()).filter(t => t);
        tags.forEach(t => tagsSet.add(t));
      }
    });
    const filtered = Array.from(tagsSet).filter(t => t.toLowerCase().startsWith(prefix)).sort();
    res.json({ success:true, data:filtered });
  } catch(e) {
    res.status(500).json({ success:false, message:'Error fetching suggestions.' });
  }
});

// GET previous and next blog posts
app.get('/api/blog/posts/:slug/navigation', (req, res) => {
  try {
    const post = db.prepare("SELECT id, created_at FROM blog_posts WHERE slug = ? AND status = 'published'").get(req.params.slug);
    if (!post) return res.status(404).json({ success:false, message:'Post not found.' });

    const next = db.prepare(`
      SELECT id, slug, title FROM blog_posts 
      WHERE status = 'published' AND created_at > ? 
      ORDER BY created_at ASC LIMIT 1
    `).get(post.created_at);

    const prev = db.prepare(`
      SELECT id, slug, title FROM blog_posts 
      WHERE status = 'published' AND created_at < ? 
      ORDER BY created_at DESC LIMIT 1
    `).get(post.created_at);

    res.json({ success:true, data: { prev, next } });
  } catch(e) {
    res.status(500).json({ success:false, message:'Error fetching navigation.' });
  }
});

app.listen(PORT, () => {
  console.log('');
  console.log('🚀 Finpenny Backend Server is running!');
  console.log(`📡 API URL     : http://localhost:${PORT}/api`);
  console.log(`🔑 Admin Panel : http://localhost:${PORT}/admin`);
  console.log('');
});