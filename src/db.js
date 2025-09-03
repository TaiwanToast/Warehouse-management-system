const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

// 支援 NAS 部署的資料目錄
const DATA_DIR = process.env.NODE_ENV === 'production' ? '/app/data' : path.join(__dirname, '..');
const DATABASE_PATH = path.join(DATA_DIR, 'warehouse.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// 確保資料目錄存在
if (!fs.existsSync(DATA_DIR)) {
	fs.mkdirSync(DATA_DIR, { recursive: true });
}

function applyMigrations(db) {
	// 檢查並新增 items 的新欄位
	db.all("PRAGMA table_info(items)", [], (err, rows) => {
		if (err) return; // 靜默失敗避免中斷啟動
		const existing = new Set(rows.map(r => r.name));
		const alters = [];
		// 基礎業務欄位
		if (!existing.has('status')) alters.push("ALTER TABLE items ADD COLUMN status TEXT DEFAULT 'available'");
		if (!existing.has('borrower')) alters.push("ALTER TABLE items ADD COLUMN borrower TEXT");
		if (!existing.has('borrow_location')) alters.push("ALTER TABLE items ADD COLUMN borrow_location TEXT");
		if (!existing.has('borrow_at')) alters.push("ALTER TABLE items ADD COLUMN borrow_at DATETIME");
		if (!existing.has('returned_at')) alters.push("ALTER TABLE items ADD COLUMN returned_at DATETIME");
		if (!existing.has('owner')) alters.push("ALTER TABLE items ADD COLUMN owner TEXT");
		// 數量欄位（預設 1）
		if (!existing.has('quantity')) alters.push("ALTER TABLE items ADD COLUMN quantity INTEGER DEFAULT 1");
		// 借出數量欄位（預設 0）
		if (!existing.has('borrow_quantity')) alters.push("ALTER TABLE items ADD COLUMN borrow_quantity INTEGER DEFAULT 0");
		// 擁有者使用者 ID（用於權限）
		if (!existing.has('owner_user_id')) alters.push("ALTER TABLE items ADD COLUMN owner_user_id INTEGER");
		if (alters.length) {
			alters.forEach(sql => db.run(sql));
		}
	});
	// 檢查並建立 users 表格（如不存在）
	db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", [], (err, row) => {
		if (err) return;
		if (!row) {
			db.run(`CREATE TABLE IF NOT EXISTS users (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				username TEXT NOT NULL UNIQUE,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP
			)`);
		}
	});

	// 建立 item_history 表（若不存在）
	db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='item_history'", [], (err, row) => {
		if (err) return;
		if (!row) {
			db.run(`CREATE TABLE IF NOT EXISTS item_history (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				item_id INTEGER NOT NULL,
				user_id INTEGER NOT NULL,
				action TEXT NOT NULL,
				changes TEXT,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
			)`);
		}
	});
}

function ensureDatabaseInitialized() {
	const dbExists = fs.existsSync(DATABASE_PATH);
	const db = new sqlite3.Database(DATABASE_PATH);
	if (!dbExists) {
		const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
		db.exec(schema);
	}
	applyMigrations(db);
	return db;
}

const db = ensureDatabaseInitialized();

function runQuery(sql, params = []) {
	return new Promise((resolve, reject) => {
		db.run(sql, params, function (err) {
			if (err) return reject(err);
			resolve({ lastID: this.lastID, changes: this.changes });
		});
	});
}

function getQuery(sql, params = []) {
	return new Promise((resolve, reject) => {
		db.get(sql, params, (err, row) => {
			if (err) return reject(err);
			resolve(row);
		});
	});
}

function allQuery(sql, params = []) {
	return new Promise((resolve, reject) => {
		db.all(sql, params, (err, rows) => {
			if (err) return reject(err);
			resolve(rows);
		});
	});
}

module.exports = {
	db,
	runQuery,
	getQuery,
	allQuery,
	DATABASE_PATH,
};
