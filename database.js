const Database = require('better-sqlite3');
const path     = require('path');

const db = new Database(path.join(__dirname, 'contacts.db'));
db.pragma('journal_mode = WAL');

// Create table with trashed + deleted_at columns
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

// If existing DB doesn't have trashed/deleted_at columns, add them safely
try { db.exec("ALTER TABLE contacts ADD COLUMN trashed INTEGER DEFAULT 0") } catch(e) {}
try { db.exec("ALTER TABLE contacts ADD COLUMN deleted_at DATETIME DEFAULT NULL") } catch(e) {}

console.log('✅ Database connected! Table "contacts" is ready.');
module.exports = db;