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
		if (!existing.has('status')) alters.push("ALTER TABLE items ADD COLUMN status TEXT DEFAULT 'available'");
		if (!existing.has('borrower')) alters.push("ALTER TABLE items ADD COLUMN borrower TEXT");
		if (!existing.has('borrow_location')) alters.push("ALTER TABLE items ADD COLUMN borrow_location TEXT");
		if (!existing.has('borrow_at')) alters.push("ALTER TABLE items ADD COLUMN borrow_at DATETIME");
		if (!existing.has('returned_at')) alters.push("ALTER TABLE items ADD COLUMN returned_at DATETIME");
		if (alters.length) {
			alters.forEach(sql => db.run(sql));
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
