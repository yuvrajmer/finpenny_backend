const Database = require('better-sqlite3');
const path     = require('path');

const db = new Database(path.join(__dirname, 'contacts.db'));
db.pragma('journal_mode = WAL');

// ── Contacts Table ────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS contacts (
    id          INTEGER  PRIMARY KEY AUTOINCREMENT,
    first_name  TEXT     NOT NULL,
    last_name   TEXT     DEFAULT '',
    email       TEXT     NOT NULL,
    phone       TEXT     NOT NULL,
    message     TEXT     NOT NULL,
    status      TEXT     DEFAULT 'new',
    trashed     INTEGER  DEFAULT 0,
    deleted_at  DATETIME DEFAULT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

try { db.exec("ALTER TABLE contacts ADD COLUMN trashed INTEGER DEFAULT 0") } catch(e) {}
try { db.exec("ALTER TABLE contacts ADD COLUMN deleted_at DATETIME DEFAULT NULL") } catch(e) {}

// ── Blog Categories Table ─────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS blog_categories (
    id         INTEGER  PRIMARY KEY AUTOINCREMENT,
    name       TEXT     NOT NULL UNIQUE,
    slug       TEXT     NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// ── Blog Posts Table ──────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS blog_posts (
    id          INTEGER  PRIMARY KEY AUTOINCREMENT,
    title       TEXT     NOT NULL,
    slug        TEXT     NOT NULL UNIQUE,
    content     TEXT     NOT NULL,
    excerpt     TEXT     DEFAULT '',
    category_id INTEGER  REFERENCES blog_categories(id),
    cover_image TEXT     DEFAULT '',
    author      TEXT     DEFAULT 'admin',
    status      TEXT     DEFAULT 'draft',
    tags        TEXT     DEFAULT '',
    image_width INTEGER  DEFAULT 1200,
    image_height INTEGER DEFAULT 630,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Add tags and image dimensions columns if they don't exist
try { db.exec("ALTER TABLE blog_posts ADD COLUMN tags TEXT DEFAULT ''") } catch(e) {}
try { db.exec("ALTER TABLE blog_posts ADD COLUMN image_width INTEGER DEFAULT 1200") } catch(e) {}
try { db.exec("ALTER TABLE blog_posts ADD COLUMN image_height INTEGER DEFAULT 630") } catch(e) {}

// ── Blog Tags Table ───────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS blog_tags (
    id         INTEGER  PRIMARY KEY AUTOINCREMENT,
    name       TEXT     NOT NULL UNIQUE,
    slug       TEXT     NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Seed default category if none exist
const catCount = db.prepare("SELECT COUNT(*) as c FROM blog_categories").get();
if (catCount.c === 0) {
  db.prepare("INSERT INTO blog_categories (name, slug) VALUES (?, ?)").run('Goal Based Investments', 'goal-based-investments');
  db.prepare("INSERT INTO blog_categories (name, slug) VALUES (?, ?)").run('Mutual Funds', 'mutual-funds');
  db.prepare("INSERT INTO blog_categories (name, slug) VALUES (?, ?)").run('SIP Planning', 'sip-planning');
  db.prepare("INSERT INTO blog_categories (name, slug) VALUES (?, ?)").run('Tax Saving (ELSS)', 'tax-saving-elss');
}

console.log('✅ Database connected! Tables "contacts", "blog_posts", "blog_categories" are ready.');
module.exports = db;