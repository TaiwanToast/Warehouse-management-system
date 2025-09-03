const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const os = require('os');
const { runQuery, allQuery, getQuery } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// 維護模式中間件（放在所有路由之前）
// maintenance.flag 檔案存在時啟用維護模式
app.use((req, res, next) => {
    const flagPath = path.join(__dirname, '..', 'maintenance.flag');
    if (fs.existsSync(flagPath)) {
        if (req.path.startsWith('/api')) {
            return res.status(503).json({ error: '系統維護中，請稍後再試' });
        }
        const maintenancePath = path.resolve(__dirname, '../public/maintenance.html');
        if (!fs.existsSync(maintenancePath)) {
            console.error('維護頁面不存在:', maintenancePath);
            return res.status(500).send('維護頁面不存在，請確認 maintenance.html 檔案');
        }
        // 直接用 res.send 讀取檔案內容
        return res.send(fs.readFileSync(maintenancePath, 'utf8'));
    }
    next();
});
// 之後才是 static 路由
app.use('/', express.static(path.join(__dirname, '..', 'public')));

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb', parameterLimit: 50000}));

// 簡單的使用者驗證（以標頭 x-user-id 傳遞）
function requireUser(req, res, next){
    const raw = req.header('x-user-id');
    if(!raw) return res.status(401).json({ error: '未登入' });
    const userId = parseInt(raw, 10);
    if(!Number.isInteger(userId) || userId <= 0){
        return res.status(400).json({ error: '無效的使用者' });
    }
    req.userId = userId;
    next();
}

// 依使用者 ID 取得使用者名稱
async function getUsernameById(userId){
    const row = await getQuery('SELECT username FROM users WHERE id = ?', [userId]);
    return row ? row.username : null;
}

// 是否為系統管理員（使用者名稱為「開發人員」）
async function isAdmin(req){
    try{
        const username = await getUsernameById(req.userId);
        return username === '開發人員';
    }catch{ return false; }
}

// 支援 NAS 部署的上傳目錄
const uploadsDir = process.env.NODE_ENV === 'production' ? '/app/uploads' : path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
	fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, uploadsDir);
	},
	filename: function (req, file, cb) {
		const timestamp = Date.now();
		const safeName = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
		cb(null, `${timestamp}-${safeName}`);
	},
});
// 檔案過濾函數
const fileFilter = (req, file, cb) => {
	// 只允許圖片檔案
	if (file.mimetype.startsWith('image/')) {
		cb(null, true);
	} else {
		cb(new Error('只允許上傳圖片檔案'), false);
	}
};

// 設定檔案上傳限制
const upload = multer({ 
	storage,
	fileFilter,
	limits: {
		fileSize: 10 * 1024 * 1024, // 1MB 限制（進一步降低以適應 Tunnelmole）
		files: 1 // 一次只能上傳一個檔案
	}
});

app.use('/uploads', express.static(uploadsDir));

// 靜態檔案服務
app.use('/', express.static(path.join(__dirname, '..', 'public')));

// 確保 API 路由優先於靜態檔案
app.use('/api', (req, res, next) => {
    // 如果請求的是 API 路由，繼續到下一個中間件
    if (req.path.startsWith('/')) {
        return next();
    }
    // 否則返回 404
    res.status(404).json({ error: 'API endpoint not found' });
});

// Floors
app.get('/api/floors', async (req, res) => {
	try {
		// 先取得所有樓層，然後在 JavaScript 中排序
		const floors = await allQuery('SELECT id, name FROM floors');
		
		// 將中文數字轉換為阿拉伯數字進行排序
		const sortedFloors = floors.sort((a, b) => {
			const getFloorNumber = (name) => {
				const numMap = {
					'一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
					'六': 6, '七': 7, '八': 8, '九': 9, '十': 10
				};
				const chineseNum = name.replace(/樓|樓層/g, '');
				return numMap[chineseNum] || parseInt(chineseNum) || 0;
			};
			return getFloorNumber(a.name) - getFloorNumber(b.name);
		});
		
		res.json(sortedFloors);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

app.post('/api/floors', async (req, res) => {
	try {
		const { name } = req.body;
		if (!name) return res.status(400).json({ error: 'name is required' });
		await runQuery('INSERT INTO floors (name) VALUES (?)', [name]);
		const floor = await getQuery('SELECT id, name FROM floors WHERE name = ?', [name]);
		res.status(201).json(floor);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

app.delete('/api/floors/:id', async (req, res) => {
	try {
		await runQuery('DELETE FROM floors WHERE id = ?', [req.params.id]);
		res.json({ success: true });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// Rooms
app.get('/api/rooms', async (req, res) => {
	try {
		const { floor_id } = req.query;
		const rooms = floor_id
			? await allQuery('SELECT id, name, floor_id FROM rooms WHERE floor_id = ? ORDER BY name', [floor_id])
			: await allQuery('SELECT id, name, floor_id FROM rooms ORDER BY name');
		res.json(rooms);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

app.post('/api/rooms', async (req, res) => {
	try {
		const { floor_id, name } = req.body;
		if (!floor_id || !name) return res.status(400).json({ error: 'floor_id and name are required' });
		await runQuery('INSERT INTO rooms (floor_id, name) VALUES (?, ?)', [floor_id, name]);
		const room = await getQuery('SELECT id, name, floor_id FROM rooms WHERE floor_id = ? AND name = ?', [floor_id, name]);
		res.status(201).json(room);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

app.delete('/api/rooms/:id', async (req, res) => {
	try {
		await runQuery('DELETE FROM rooms WHERE id = ?', [req.params.id]);
		res.json({ success: true });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// 包裝 multer 錯誤處理的函數
function handleMulterUpload(uploadMiddleware) {
	return (req, res, next) => {
		uploadMiddleware(req, res, (err) => {
			if (err instanceof multer.MulterError) {
				if (err.code === 'LIMIT_FILE_SIZE') {
					return res.status(413).json({ 
						error: '檔案太大',
						message: '檔案大小不能超過 5MB，請選擇較小的圖片或壓縮圖片後再上傳'
					});
				}
				if (err.code === 'LIMIT_FILE_COUNT') {
					return res.status(400).json({ 
						error: '檔案數量過多',
						message: '一次只能上傳一個檔案'
					});
				}
				return res.status(400).json({ 
					error: '檔案上傳錯誤',
					message: err.message 
				});
			}
			
			if (err && err.message === '只允許上傳圖片檔案') {
				return res.status(400).json({ 
					error: '檔案類型錯誤',
					message: '只允許上傳圖片檔案（JPG、PNG、GIF 等）'
				});
			}
			
			if (err) {
				return res.status(500).json({ 
					error: '上傳失敗',
					message: err.message 
				});
			}
			
			next();
		});
	};
}

// Items
app.post('/api/items', requireUser, handleMulterUpload(upload.single('image')), async (req, res) => {
	try {
		const { name, description, floor_id, room_id } = req.body;
		let { quantity } = req.body;
		if (!name || !floor_id || !room_id) return res.status(400).json({ error: 'name, floor_id, room_id are required' });
		quantity = quantity === undefined || quantity === '' ? 1 : parseInt(quantity, 10);
		if (!Number.isInteger(quantity) || quantity < 0) return res.status(400).json({ error: 'quantity must be a non-negative integer' });
		const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
		const ownerUsername = await getUsernameById(req.userId);
		await runQuery(
			'INSERT INTO items (name, description, floor_id, room_id, image_path, owner, quantity, owner_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
			[name, description || null, floor_id, room_id, imagePath, ownerUsername || null, quantity, req.userId]
		);
		// 歷史紀錄
		const created = await getQuery('SELECT last_insert_rowid() as id');
		await runQuery('INSERT INTO item_history (item_id, user_id, action, changes) VALUES (?, ?, ?, ?)', [created.id, req.userId, 'create', JSON.stringify({ name, description, floor_id, room_id, owner: ownerUsername, quantity })]);
		res.status(201).json({ success: true });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// 用戶註冊
app.post('/api/users', async (req, res) => {
	try {
		const { username } = req.body;
		if (!username) return res.status(400).json({ error: 'username is required' });
		await runQuery('INSERT INTO users (username) VALUES (?)', [username]);
		const user = await getQuery('SELECT id, username FROM users WHERE username = ?', [username]);
		res.status(201).json(user);
	} catch (err) {
		if (err.message.includes('UNIQUE')) {
			return res.status(409).json({ error: '使用者名稱已存在' });
		}
		res.status(500).json({ error: err.message });
	}
});

// 取得所有用戶
app.get('/api/users', async (req, res) => {
	try {
		const users = await allQuery('SELECT id, username FROM users ORDER BY created_at DESC');
		res.json(users);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

app.get('/api/items', requireUser, async (req, res) => {
	try {
		const { q, floor_id, room_id } = req.query;
		let where = [];
		let params = [];
		if (q) { where.push('items.name LIKE ?'); params.push(`%${q}%`); }
		if (floor_id) { where.push('items.floor_id = ?'); params.push(floor_id); }
		if (room_id) { where.push('items.room_id = ?'); params.push(room_id); }
		const admin = await isAdmin(req);
		if (!admin){ where.push('items.owner_user_id = ?'); params.push(req.userId); }
		const whereSql = where.length ? ('WHERE ' + where.join(' AND ')) : '';
		const sql = `
			SELECT items.id, items.name, items.description, items.image_path,
				items.floor_id, items.room_id, items.status, items.borrower, items.borrow_location,
				items.borrow_at, items.returned_at, items.owner, items.quantity,
				floors.name AS floor_name, rooms.name AS room_name
			FROM items
			JOIN floors ON items.floor_id = floors.id
			JOIN rooms ON items.room_id = rooms.id
			${whereSql}
			ORDER BY items.created_at DESC
		`;
		const rows = await allQuery(sql, params);
		res.json(rows);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

app.get('/api/items/:id', requireUser, async (req, res) => {
	try {
		const sql = `
			SELECT items.id, items.name, items.description, items.image_path,
				items.floor_id, items.room_id, items.status, items.borrower, items.borrow_location,
				items.borrow_at, items.returned_at, items.owner, items.quantity,
				floors.name AS floor_name, rooms.name AS room_name
			FROM items
			JOIN floors ON items.floor_id = floors.id
			JOIN rooms ON items.room_id = rooms.id
			WHERE items.id = ?
		`;
		const item = await getQuery(sql, [req.params.id]);
		if (!item) {
			return res.status(404).json({ error: 'Item not found' });
		}
		const admin = await isAdmin(req);
		if(!admin){
			const ownerCheck = await getQuery('SELECT owner_user_id FROM items WHERE id = ?', [req.params.id]);
			if(!ownerCheck || ownerCheck.owner_user_id !== req.userId){
				return res.status(403).json({ error: '無權限存取' });
			}
		}
		res.json(item);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

app.put('/api/items/:id', requireUser, async (req, res) => {
	try {
		const { name, description, floor_id, room_id, status, borrower, borrow_location } = req.body;
		let { quantity } = req.body;
		if (!name) return res.status(400).json({ error: 'name is required' });
		const fields = ['name = ?', 'description = ?'];
		const values = [name, description || null];
		if (floor_id) { fields.push('floor_id = ?'); values.push(floor_id); }
		if (room_id) { fields.push('room_id = ?'); values.push(room_id); }
		if (typeof quantity !== 'undefined') {
			quantity = quantity === '' ? null : parseInt(quantity, 10);
			if (!Number.isInteger(quantity) || quantity < 0) {
				return res.status(400).json({ error: 'quantity must be a non-negative integer' });
			}
			fields.push('quantity = ?'); values.push(quantity);
		}
		// 狀態與時間
		if (typeof status !== 'undefined') {
			fields.push('status = ?'); values.push(status);
			if (status === 'borrowed') {
				fields.push('borrow_at = CURRENT_TIMESTAMP');
				fields.push('returned_at = NULL');
			} else if (status === 'returned') {
				fields.push('returned_at = CURRENT_TIMESTAMP');
			} else if (status === 'available') {
				fields.push('borrow_at = NULL');
				fields.push('returned_at = NULL');
			}
		}
		if (typeof borrower !== 'undefined') { fields.push('borrower = ?'); values.push(borrower || null); }
		if (typeof borrow_location !== 'undefined') { fields.push('borrow_location = ?'); values.push(borrow_location || null); }
		// 強制 owner 為目前登入者
		const ownerUsername = await getUsernameById(req.userId);
		fields.push('owner = ?'); values.push(ownerUsername || null);
		values.push(req.params.id);
		// 僅允許擁有者更新
		const admin = await isAdmin(req);
		if(!admin){
			const own = await getQuery('SELECT owner_user_id FROM items WHERE id = ?', [req.params.id]);
			if(!own || own.owner_user_id !== req.userId){
				return res.status(403).json({ error: '無權限操作' });
			}
		}
		await runQuery(`UPDATE items SET ${fields.join(', ')} WHERE id = ?`, values);
		const changes = { ...req.body, owner: ownerUsername };
		await runQuery('INSERT INTO item_history (item_id, user_id, action, changes) VALUES (?, ?, ?, ?)', [req.params.id, req.userId, 'update', JSON.stringify(changes)]);
		res.json({ success: true });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// 送出（扣減數量）
app.post('/api/items/:id/dispatch', requireUser, async (req, res) => {
	try {
		const admin = await isAdmin(req);
		if(!admin){
			const own = await getQuery('SELECT owner_user_id FROM items WHERE id = ?', [req.params.id]);
			if(!own || own.owner_user_id !== req.userId){
				return res.status(403).json({ error: '無權限操作' });
			}
		}
		let { amount } = req.body;
		amount = amount === undefined || amount === '' ? 1 : parseInt(amount, 10);
		if (!Number.isInteger(amount) || amount <= 0) return res.status(400).json({ error: 'amount must be a positive integer' });
		const item = await getQuery('SELECT id, quantity FROM items WHERE id = ?', [req.params.id]);
		if (!item) return res.status(404).json({ error: 'Item not found' });
		const newQty = (item.quantity ?? 0) - amount;
		if (newQty < 0) return res.status(400).json({ error: `擁有數量：${item.quantity ?? 0}，庫存不足`, quantity: item.quantity ?? 0 });
		await runQuery('UPDATE items SET quantity = ? WHERE id = ?', [newQty, req.params.id]);
		await runQuery('INSERT INTO item_history (item_id, user_id, action, changes) VALUES (?, ?, ?, ?)', [req.params.id, req.userId, 'dispatch', JSON.stringify({ amount })]);
		res.json({ success: true, quantity: newQty });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

app.delete('/api/items/:id', requireUser, async (req, res) => {
	try {
		const admin = await isAdmin(req);
		if(!admin){
			const own = await getQuery('SELECT owner_user_id FROM items WHERE id = ?', [req.params.id]);
			if(!own || own.owner_user_id !== req.userId){
				return res.status(403).json({ error: '無權限操作' });
			}
		}
		   // 先查詢該物品的圖片路徑
		   const item = await getQuery('SELECT image_path FROM items WHERE id = ?', [req.params.id]);
		   if (item && item.image_path) {
			   // 處理絕對路徑
			   let imagePath = item.image_path;
			   // 處理 /uploads/ 開頭的路徑
			   if (imagePath.startsWith('/uploads/')) {
				   imagePath = path.join(uploadsDir, imagePath.replace(/^\/uploads[\\/]/, ''));
			   } else if (!path.isAbsolute(imagePath)) {
				   imagePath = path.join(uploadsDir, path.basename(imagePath));
			   }
			   // 刪除圖片檔案（若存在）
			   try {
				   if (fs.existsSync(imagePath)) {
					   fs.unlinkSync(imagePath);
				   }
			   } catch (e) {
				   // 不中斷流程，僅記錄錯誤
				   console.error('刪除圖片失敗:', e);
			   }
		   }
		   await runQuery('DELETE FROM items WHERE id = ?', [req.params.id]);
		   res.json({ success: true });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// 使用者註銷：刪除使用者及其所有物品
app.delete('/api/users/me', requireUser, async (req, res) => {
	try {
		const items = await allQuery('SELECT id, image_path FROM items WHERE owner_user_id = ?', [req.userId]);
		for(const it of items){
			// 刪除圖片
			if (it.image_path) {
				let imagePath = it.image_path;
				if (imagePath.startsWith('/uploads/')) {
					imagePath = path.join(uploadsDir, imagePath.replace(/^\/uploads[\\/]?/, ''));
				} else if (!path.isAbsolute(imagePath)) {
					imagePath = path.join(uploadsDir, path.basename(imagePath));
				}
				try { if (fs.existsSync(imagePath)) { fs.unlinkSync(imagePath); } } catch (e) { console.error('刪除圖片失敗:', e); }
			}
			// 刪除歷史與物品
			await runQuery('DELETE FROM item_history WHERE item_id = ?', [it.id]);
			await runQuery('DELETE FROM items WHERE id = ?', [it.id]);
		}
		await runQuery('DELETE FROM users WHERE id = ?', [req.userId]);
		return res.json({ success: true, deleted_items: items.length });
	} catch (err) {
		return res.status(500).json({ error: err.message });
	}
});

// 歷史紀錄查詢
app.get('/api/items/:id/history', requireUser, async (req, res) => {
	try {
		const admin = await isAdmin(req);
		if(!admin){
			const own = await getQuery('SELECT owner_user_id FROM items WHERE id = ?', [req.params.id]);
			if(!own || own.owner_user_id !== req.userId){
				return res.status(403).json({ error: '無權限存取' });
			}
		}
		const rows = await allQuery('SELECT id, action, changes, created_at FROM item_history WHERE item_id = ? ORDER BY created_at DESC', [req.params.id]);
		res.json(rows);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// 管理員刪除任意使用者
app.delete('/api/users/:id', requireUser, async (req, res) => {
	try{
		const admin = await isAdmin(req);
		if(!admin) return res.status(403).json({ error: '僅限管理員' });
		const targetUserId = parseInt(req.params.id, 10);
		if(!Number.isInteger(targetUserId) || targetUserId<=0) return res.status(400).json({ error: '不合法的使用者' });
		const items = await allQuery('SELECT id, image_path FROM items WHERE owner_user_id = ?', [targetUserId]);
		for(const it of items){
			if (it.image_path) {
				let imagePath = it.image_path;
				if (imagePath.startsWith('/uploads/')) {
					imagePath = path.join(uploadsDir, imagePath.replace(/^\/uploads[\\\/]?/, ''));
				} else if (!path.isAbsolute(imagePath)) {
					imagePath = path.join(uploadsDir, path.basename(imagePath));
				}
				try { if (fs.existsSync(imagePath)) { fs.unlinkSync(imagePath); } } catch (e) { console.error('刪除圖片失敗:', e); }
			}
			await runQuery('DELETE FROM item_history WHERE item_id = ?', [it.id]);
			await runQuery('DELETE FROM items WHERE id = ?', [it.id]);
		}
		await runQuery('DELETE FROM users WHERE id = ?', [targetUserId]);
		return res.json({ success: true, deleted_items: items.length });
	}catch(err){
		return res.status(500).json({ error: err.message });
	}
});

// 取得本機 IP 地址
function getLocalIPs() {
	const interfaces = os.networkInterfaces();
	const ips = [];
	for (const name of Object.keys(interfaces)) {
		for (const iface of interfaces[name]) {
			if (iface.family === 'IPv4' && !iface.internal) {
				ips.push(iface.address);
			}
		}
	}
	return ips;
}

const server = app.listen(PORT, '0.0.0.0', () => {
	const localIPs = getLocalIPs();
	console.log(`\n=== 倉儲管理系統伺服器已啟動 ===`);
	console.log(`本機存取: http://localhost:${PORT}`);
	if (localIPs.length > 0) {
		console.log(`區域網路存取:`);
		localIPs.forEach(ip => {
			console.log(`  http://${ip}:${PORT}`);
		});
	}
	console.log(`\n=== Cloudflared 設定 ===`);
	console.log(`1. 安裝 cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/`);
	console.log(`2. 啟動隧道: cloudflared tunnel --url http://localhost:${PORT}`);
	console.log(`3. 使用提供的網址存取系統`);
	console.log(`========================================\n`);
});

// 捕獲未處理的異常
process.on('uncaughtException', (err) => {
	console.error('未捕獲的異常:', err);
	server.close(() => {
		console.log('伺服器已關閉');
		process.exit(1);
	});
});
process.on('unhandledRejection', (reason, promise) => {
	console.error('未處理的 Promise 拒絕:', reason);
	server.close(() => {
		console.log('伺服器已關閉');
		process.exit(1);
	});
});
/*
cloudflared 的缺點或限制包括：
1. 依賴 Cloudflare 帳號與服務，若 Cloudflare 出現問題會影響連線。
2. 免費方案有流量與連線數限制，商業用途需評估。
3. 需安裝 cloudflared 並維護 tunnel 程序，增加運維複雜度。
4. 連線品質受 Cloudflare 節點影響，可能有延遲。
5. 進階自訂（如自訂域名、存取控制）需額外設定。
6. 伺服器本身仍需做好安全防護，cloudflared 只負責隧道連線。
*/