const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const os = require('os');
const { runQuery, allQuery, getQuery } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
const upload = multer({ storage });

app.use('/uploads', express.static(uploadsDir));
app.use('/', express.static(path.join(__dirname, '..', 'public')));

// Floors
app.get('/api/floors', async (req, res) => {
	try {
		const floors = await allQuery('SELECT id, name FROM floors ORDER BY name');
		res.json(floors);
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

// Items
app.post('/api/items', upload.single('image'), async (req, res) => {
	try {
		const { name, description, floor_id, room_id } = req.body;
		if (!name || !floor_id || !room_id) return res.status(400).json({ error: 'name, floor_id, room_id are required' });
		const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
		await runQuery(
			'INSERT INTO items (name, description, floor_id, room_id, image_path) VALUES (?, ?, ?, ?, ?)',
			[name, description || null, floor_id, room_id, imagePath]
		);
		res.status(201).json({ success: true });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

app.get('/api/items', async (req, res) => {
	try {
		const { q, floor_id, room_id } = req.query;
		let where = [];
		let params = [];
		if (q) { where.push('items.name LIKE ?'); params.push(`%${q}%`); }
		if (floor_id) { where.push('items.floor_id = ?'); params.push(floor_id); }
		if (room_id) { where.push('items.room_id = ?'); params.push(room_id); }
		const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
		const sql = `
			SELECT items.id, items.name, items.description, items.image_path,
				items.floor_id, items.room_id, items.status, items.borrower, items.borrow_location,
				items.borrow_at, items.returned_at,
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

app.put('/api/items/:id', async (req, res) => {
	try {
		const { name, description, floor_id, room_id, status, borrower, borrow_location } = req.body;
		if (!name) return res.status(400).json({ error: 'name is required' });
		const fields = ['name = ?', 'description = ?'];
		const values = [name, description || null];
		if (floor_id) { fields.push('floor_id = ?'); values.push(floor_id); }
		if (room_id) { fields.push('room_id = ?'); values.push(room_id); }
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
		values.push(req.params.id);
		await runQuery(`UPDATE items SET ${fields.join(', ')} WHERE id = ?`, values);
		res.json({ success: true });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

app.delete('/api/items/:id', async (req, res) => {
	try {
		await runQuery('DELETE FROM items WHERE id = ?', [req.params.id]);
		res.json({ success: true });
	} catch (err) {
		res.status(500).json({ error: err.message });
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

app.listen(PORT, '0.0.0.0', () => {
	const localIPs = getLocalIPs();
	console.log(`\n=== 倉儲管理系統伺服器已啟動 ===`);
	console.log(`本機存取: http://localhost:${PORT}`);
	if (localIPs.length > 0) {
		console.log(`區域網路存取:`);
		localIPs.forEach(ip => {
			console.log(`  http://${ip}:${PORT}`);
		});
	}
	console.log(`\n其他裝置請使用上方區域網路 IP 地址存取`);
	console.log(`========================================\n`);
});
