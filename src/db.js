const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

// 簡單的查詢快取機制
const queryCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5分鐘快取

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

	// 添加效能優化索引
	createPerformanceIndexes(db);
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

// 創建效能優化索引
function createPerformanceIndexes(db) {
	// 檢查索引是否已存在，避免重複創建
	const indexes = [
		// 物品表索引
		{ name: 'idx_items_owner_user_id', sql: 'CREATE INDEX IF NOT EXISTS idx_items_owner_user_id ON items(owner_user_id)' },
		{ name: 'idx_items_status', sql: 'CREATE INDEX IF NOT EXISTS idx_items_status ON items(status)' },
		{ name: 'idx_items_floor_room', sql: 'CREATE INDEX IF NOT EXISTS idx_items_floor_room ON items(floor_id, room_id)' },
		{ name: 'idx_items_name', sql: 'CREATE INDEX IF NOT EXISTS idx_items_name ON items(name)' },
		{ name: 'idx_items_created_at', sql: 'CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at DESC)' },
		{ name: 'idx_items_quantity', sql: 'CREATE INDEX IF NOT EXISTS idx_items_quantity ON items(quantity)' },
		{ name: 'idx_items_borrow_quantity', sql: 'CREATE INDEX IF NOT EXISTS idx_items_borrow_quantity ON items(borrow_quantity)' },
		
		// 歷史記錄表索引
		{ name: 'idx_item_history_item_id', sql: 'CREATE INDEX IF NOT EXISTS idx_item_history_item_id ON item_history(item_id)' },
		{ name: 'idx_item_history_created_at', sql: 'CREATE INDEX IF NOT EXISTS idx_item_history_created_at ON item_history(created_at DESC)' },
		{ name: 'idx_item_history_user_id', sql: 'CREATE INDEX IF NOT EXISTS idx_item_history_user_id ON item_history(user_id)' },
		{ name: 'idx_item_history_action', sql: 'CREATE INDEX IF NOT EXISTS idx_item_history_action ON item_history(action)' },
		
		// 複合索引（針對常用查詢組合）
		{ name: 'idx_items_owner_status', sql: 'CREATE INDEX IF NOT EXISTS idx_items_owner_status ON items(owner_user_id, status)' },
		{ name: 'idx_items_floor_room_status', sql: 'CREATE INDEX IF NOT EXISTS idx_items_floor_room_status ON items(floor_id, room_id, status)' },
		{ name: 'idx_item_history_item_created', sql: 'CREATE INDEX IF NOT EXISTS idx_item_history_item_created ON item_history(item_id, created_at DESC)' },
		
		// 樓層和房間索引
		{ name: 'idx_rooms_floor_id', sql: 'CREATE INDEX IF NOT EXISTS idx_rooms_floor_id ON rooms(floor_id)' },
		{ name: 'idx_floors_name', sql: 'CREATE INDEX IF NOT EXISTS idx_floors_name ON floors(name)' },
		{ name: 'idx_rooms_name', sql: 'CREATE INDEX IF NOT EXISTS idx_rooms_name ON rooms(name)' },
		
		// 使用者表索引
		{ name: 'idx_users_username', sql: 'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)' },
		{ name: 'idx_users_created_at', sql: 'CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC)' }
	];

	indexes.forEach(index => {
		db.run(index.sql, (err) => {
			if (err) {
				console.warn(`警告：創建索引 ${index.name} 失敗:`, err.message);
			}
		});
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

// 快取查詢函數（僅用於讀取操作）
function cachedQuery(sql, params = [], cacheKey = null) {
	return new Promise((resolve, reject) => {
		// 生成快取鍵
		const key = cacheKey || `${sql}:${JSON.stringify(params)}`;
		const cached = queryCache.get(key);
		
		// 檢查快取是否有效
		if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
			return resolve(cached.data);
		}
		
		// 執行查詢
		db.all(sql, params, (err, rows) => {
			if (err) return reject(err);
			
			// 儲存到快取
			queryCache.set(key, {
				data: rows,
				timestamp: Date.now()
			});
			
			resolve(rows);
		});
	});
}

// 清除快取
function clearCache(pattern = null) {
	if (pattern) {
		// 清除符合模式的快取
		for (const key of queryCache.keys()) {
			if (key.includes(pattern)) {
				queryCache.delete(key);
			}
		}
	} else {
		// 清除所有快取
		queryCache.clear();
	}
}

module.exports = {
	db,
	runQuery,
	getQuery,
	allQuery,
	cachedQuery,
	clearCache,
	DATABASE_PATH,
};
