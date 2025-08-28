'use strict';

// 資料儲存管理
const Storage = {
	floors: 'warehouse_floors',
	rooms: 'warehouse_rooms',
	items: 'warehouse_items',
	
	get(key) {
		try {
			return JSON.parse(localStorage.getItem(key) || '[]');
		} catch {
			return [];
		}
	},
	
	set(key, data) {
		localStorage.setItem(key, JSON.stringify(data));
	},
	
	add(key, item) {
		const data = this.get(key);
		item.id = Date.now() + Math.random();
		item.created_at = new Date().toISOString();
		data.push(item);
		this.set(key, data);
		return item;
	},
	
	update(key, id, updates) {
		const data = this.get(key);
		const index = data.findIndex(item => item.id == id);
		if (index !== -1) {
			data[index] = { ...data[index], ...updates };
			this.set(key, data);
			return data[index];
		}
		return null;
	},
	
	delete(key, id) {
		const data = this.get(key);
		const filtered = data.filter(item => item.id != id);
		this.set(key, filtered);
	},
	
	find(key, predicate) {
		return this.get(key).filter(predicate);
	}
};

// 圖片處理
const ImageHandler = {
	async fileToDataURL(file) {
		return new Promise((resolve) => {
			const reader = new FileReader();
			reader.onload = (e) => resolve(e.target.result);
			reader.readAsDataURL(file);
		});
	}
};

// 頁面管理
const PageManager = {
	show(pageId) {
		document.querySelectorAll('main > section').forEach(s => s.style.display = 'none');
		document.getElementById(pageId + '-page').style.display = 'block';
		
		document.querySelectorAll('.nav a').forEach(a => a.classList.remove('active'));
		document.querySelector(`[data-page="${pageId}"]`).classList.add('active');
		
		// 切換到查詢頁面時自動載入所有物品
		if (pageId === 'search') {
			ItemManager.loadAllItems();
		}
	},
	
	init() {
		document.querySelectorAll('.nav a').forEach(a => {
			a.addEventListener('click', (e) => {
				e.preventDefault();
				this.show(e.target.dataset.page);
			});
		});
	}
};

// 樓層管理
const FloorManager = {
	loadFloors() {
		const floors = Storage.get(Storage.floors);
		const ul = document.getElementById('floors');
		const sel = document.getElementById('room-floor');
		const itemFloorSel = document.getElementById('item-floor');
		const qFloorSel = document.getElementById('q-floor');
		
		ul.innerHTML = '';
		sel.innerHTML = '';
		itemFloorSel.innerHTML = '<option value="">選擇樓層</option>';
		qFloorSel.innerHTML = '<option value="">全部樓層</option>';
		
		floors.forEach(f => {
			ul.insertAdjacentHTML('beforeend', 
				`<li data-id="${f.id}">${f.name} <button class="del-floor" style="background:#dc3545">刪除</button></li>`);
			sel.insertAdjacentHTML('beforeend', `<option value="${f.id}">${f.name}</option>`);
			itemFloorSel.insertAdjacentHTML('beforeend', `<option value="${f.id}">${f.name}</option>`);
			qFloorSel.insertAdjacentHTML('beforeend', `<option value="${f.id}">${f.name}</option>`);
		});
		
		this.loadRooms();
	},
	
	loadRooms() {
		const floorId = document.getElementById('room-floor').value;
		const rooms = floorId ? Storage.find(Storage.rooms, r => r.floor_id == floorId) : [];
		const ul = document.getElementById('rooms');
		ul.innerHTML = '';
		
		rooms.forEach(r => {
			ul.insertAdjacentHTML('beforeend', 
				`<li data-id="${r.id}">${r.name} <button class="del-room" style="background:#dc3545">刪除</button></li>`);
		});
	},
	
	bind() {
		document.getElementById('add-floor').addEventListener('click', () => {
			const name = document.getElementById('floor-name').value.trim();
			if (!name) return alert('請輸入樓層名稱');
			Storage.add(Storage.floors, { name });
			document.getElementById('floor-name').value = '';
			this.loadFloors();
		});
		
		document.getElementById('floors').addEventListener('click', (e) => {
			if (!e.target.classList.contains('del-floor')) return;
			const li = e.target.closest('li');
			const id = li.dataset.id;
			if (!confirm('刪除此樓層將會同時刪除其房間，確定？')) return;
			
			// 刪除相關房間
			const rooms = Storage.get(Storage.rooms);
			const filteredRooms = rooms.filter(r => r.floor_id != id);
			Storage.set(Storage.rooms, filteredRooms);
			
			// 刪除樓層
			Storage.delete(Storage.floors, id);
			this.loadFloors();
		});
		
		document.getElementById('room-floor').addEventListener('change', () => this.loadRooms());
	}
};

// 房間管理
const RoomManager = {
	bind() {
		document.getElementById('add-room').addEventListener('click', () => {
			const floor_id = document.getElementById('room-floor').value;
			const name = document.getElementById('room-name').value.trim();
			if (!floor_id) return alert('請先選擇樓層');
			if (!name) return alert('請輸入房間名稱');
			
			// 確保 floor_id 是數字
			const floorId = parseFloat(floor_id);
			if (isNaN(floorId)) return alert('樓層 ID 無效');
			
			Storage.add(Storage.rooms, { floor_id: floorId, name });
			document.getElementById('room-name').value = '';
			FloorManager.loadRooms();
		});
		
		document.getElementById('rooms').addEventListener('click', (e) => {
			if (!e.target.classList.contains('del-room')) return;
			const li = e.target.closest('li');
			const id = li.dataset.id;
			if (!confirm('確定刪除此房間？')) return;
			
			Storage.delete(Storage.rooms, id);
			FloorManager.loadRooms();
		});
	}
};

// 物品管理
const ItemManager = {
	async addItem(formData) {
		const name = formData.get('name');
		const description = formData.get('description');
		const floor_id = parseFloat(formData.get('floor_id'));
		const room_id = parseFloat(formData.get('room_id'));
		const imageFile = formData.get('image');
		
		if (!name || !floor_id || !room_id) return alert('請填寫必要欄位');
		
		let imageData = null;
		if (imageFile && imageFile.size > 0) {
			imageData = await ImageHandler.fileToDataURL(imageFile);
		}
		
		Storage.add(Storage.items, {
			name,
			description: description || null,
			floor_id,
			room_id,
			image_path: imageData
		});
		
		alert('新增成功');
		document.getElementById('item-form').reset();
	},
	
	searchItems(query = '', floorId = '', roomId = '') {
		let items = Storage.get(Storage.items);
		
		if (query) {
			items = items.filter(item => item.name.toLowerCase().includes(query.toLowerCase()));
		}
		if (floorId) {
			items = items.filter(item => item.floor_id == floorId);
		}
		if (roomId) {
			items = items.filter(item => item.room_id == roomId);
		}
		
		return items;
	},
	
	renderItems(items, containerId) {
		const floors = Storage.get(Storage.floors);
		const rooms = Storage.get(Storage.rooms);
		const container = document.getElementById(containerId);
		container.innerHTML = '';
		
		items.forEach(item => {
			const floor = floors.find(f => f.id == item.floor_id);
			const room = rooms.find(r => r.id == item.room_id);
			
			container.insertAdjacentHTML('beforeend', `
				<div class="item" data-id="${item.id}">
					${item.image_path ? `<img class="zoomable" src="${item.image_path}" alt="${item.name}">` : ''}
					<h3>${item.name}</h3>
					<div><span class="badge">${floor?.name || '未知'}</span><span class="badge">${room?.name || '未知'}</span></div>
					<p>${item.description || ''}</p>
					${containerId === 'results-manage' ? `
						<div class="flex">
							<button class="edit">編輯</button>
							<button class="delete" style="background:#dc3545">刪除</button>
						</div>
					` : ''}
				</div>
			`);
		});
		
		this.bindImagePreview();
	},
	
	bindImagePreview() {
		const dlg = document.getElementById('imgDialog');
		const img = document.getElementById('imgPreview');
		document.getElementById('closeImg').onclick = () => dlg.close();
		dlg.addEventListener('click', (e) => { if(e.target === dlg) dlg.close(); });
		
		document.querySelectorAll('img.zoomable').forEach(el => {
			el.addEventListener('click', () => {
				img.src = el.src;
				img.alt = el.alt || '預覽';
				dlg.showModal();
			});
		});
	},
	
	bind() {
		// 新增物品
		document.getElementById('item-form').addEventListener('submit', async (e) => {
			e.preventDefault();
			const formData = new FormData(e.target);
			await this.addItem(formData);
		});
		
		// 樓層變更時載入房間
		document.getElementById('item-floor').addEventListener('change', (e) => {
			const floorId = parseFloat(e.target.value);
			const rooms = floorId ? Storage.find(Storage.rooms, r => r.floor_id == floorId) : [];
			const sel = document.getElementById('item-room');
			sel.innerHTML = '<option value="">選擇房間</option>';
			rooms.forEach(r => {
				sel.insertAdjacentHTML('beforeend', `<option value="${r.id}">${r.name}</option>`);
			});
		});
		
		// 查詢
		document.getElementById('search').addEventListener('click', () => {
			const q = document.getElementById('q').value.trim();
			const floorId = document.getElementById('q-floor').value;
			const roomId = document.getElementById('q-room').value;
			const items = this.searchItems(q, floorId, roomId);
			this.renderItems(items, 'results');
		});
		
		// 管理頁查詢
		document.getElementById('search-manage').addEventListener('click', () => {
			const q = document.getElementById('q-manage').value.trim();
			const items = this.searchItems(q);
			this.renderItems(items, 'results-manage');
		});
		
		// 管理頁編輯/刪除
		document.getElementById('results-manage').addEventListener('click', (e) => {
			const item = e.target.closest('.item');
			if (!item) return;
			const id = item.dataset.id;
			
			if (e.target.classList.contains('edit')) {
				const dlg = document.getElementById('editDialog');
				const form = document.getElementById('editForm');
				form.name.value = item.querySelector('h3').textContent;
				form.description.value = item.querySelector('p').textContent;
				dlg.returnValue = '';
				dlg.showModal();
				
				document.getElementById('saveEdit').onclick = () => {
					Storage.update(Storage.items, id, {
						name: form.name.value.trim(),
						description: form.description.value.trim() || null
					});
					dlg.close();
					document.getElementById('search-manage').click();
				};
			}
			
			if (e.target.classList.contains('delete')) {
				if (!confirm('確定要刪除？')) return;
				Storage.delete(Storage.items, id);
				document.getElementById('search-manage').click();
			}
		});
	},
	
	loadAllItems() {
		const items = Storage.get(Storage.items);
		this.renderItems(items, 'results');
	}
};

// 初始化
(function() {
	PageManager.init();
	FloorManager.bind();
	RoomManager.bind();
	ItemManager.bind();
	FloorManager.loadFloors();
	ItemManager.renderItems([], 'results');
	ItemManager.renderItems([], 'results-manage');
})();
