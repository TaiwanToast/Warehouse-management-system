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

function ensureDatabaseInitialized() {
	const dbExists = fs.existsSync(DATABASE_PATH);
	const db = new sqlite3.Database(DATABASE_PATH);
	if (!dbExists) {
		const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
		db.exec(schema);
	}
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
