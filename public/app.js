'use strict';

const $ = (sel) => document.querySelector(sel);

async function fetchJSON(url) {
	const userId = localStorage.getItem('loginUserId');
	const res = await fetch(url, { headers: userId ? { 'x-user-id': userId } : {} });
	if (!res.ok) throw new Error(await res.text());
	return res.json();
}

async function initItemSelectors() {
	// 載入樓層到新增物品的下拉
	const floors = await fetchJSON('/api/floors');
	const itemFloorSel = $('#item-floor');
	const itemRoomSel = $('#item-room');
	if (!itemFloorSel || !itemRoomSel) return; // 安全保護

	itemFloorSel.innerHTML = '<option value="">選擇樓層</option>';
	for (const f of floors) {
		itemFloorSel.insertAdjacentHTML('beforeend', `<option value="${f.id}">${f.name}</option>`);
	}

	// 當樓層變更時載入對應房間
	itemFloorSel.addEventListener('change', async (e) => {
		await populateRoomsForItem(e.target.value);
	});
}

async function populateRoomsForItem(floorId) {
	const itemRoomSel = $('#item-room');
	itemRoomSel.innerHTML = '';
	if (!floorId) {
		itemRoomSel.innerHTML = '<option value="">請先選擇樓層</option>';
		return;
	}
	const rooms = await fetchJSON(`/api/rooms?floor_id=${encodeURIComponent(floorId)}`);
	itemRoomSel.innerHTML = '<option value="">選擇區域</option>';
	for (const r of rooms) {
		itemRoomSel.insertAdjacentHTML('beforeend', `<option value="${r.id}">${r.name}</option>`);
	}
}

function bindItemForm() {
	const form = document.querySelector('#item-form');
	if (!form) return;
	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		
		// 檢查檔案大小和類型
		const fileInput = form.querySelector('input[type="file"]');
		if (fileInput.files.length > 0) {
			const file = fileInput.files[0];
			
			// 檢查檔案類型
			if (!file.type.startsWith('image/')) {
				alert('檔案類型錯誤！只允許上傳圖片檔案（JPG、PNG、GIF 等）。');
				return;
			}
			
			// 檢查檔案大小
			const maxSize = 5 * 1024 * 1024; // 5MB
			if (file.size > maxSize) {
				// 嘗試自動壓縮
				if (window.imageCompressor && window.imageCompressor.needsCompression(file)) {
					try {
						const compressedFile = await window.imageCompressor.compress(file);
						if (compressedFile.size <= maxSize) {
							// 替換原始檔案
							const dataTransfer = new DataTransfer();
							dataTransfer.items.add(compressedFile);
							fileInput.files = dataTransfer.files;
							
							const originalSize = (file.size / 1024 / 1024).toFixed(2);
							const compressedSize = (compressedFile.size / 1024 / 1024).toFixed(2);
							console.log(`圖片已自動壓縮：${originalSize}MB → ${compressedSize}MB`);
						} else {
							alert(`檔案太大！檔案大小不能超過 5MB。\n\n目前檔案大小：${(file.size / 1024 / 1024).toFixed(2)}MB\n建議：請選擇較小的圖片或手動壓縮圖片後再上傳。`);
							return;
						}
					} catch (error) {
						alert(`檔案太大！檔案大小不能超過 5MB。\n\n目前檔案大小：${(file.size / 1024 / 1024).toFixed(2)}MB\n建議：請選擇較小的圖片或手動壓縮圖片後再上傳。`);
						return;
					}
				} else {
					alert(`檔案太大！檔案大小不能超過 5MB。\n\n目前檔案大小：${(file.size / 1024 / 1024).toFixed(2)}MB\n建議：請選擇較小的圖片或手動壓縮圖片後再上傳。`);
					return;
				}
			}
		}
		
		const formData = new FormData(form);
		// 不再從表單送出 owner，後端會依登入者自動設定
		formData.delete('owner');
		try {
			const userId = localStorage.getItem('loginUserId');
			const res = await fetch('/api/items', { method: 'POST', headers: userId? { 'x-user-id': userId } : {}, body: formData });
			if (!res.ok) {
				const errorText = await res.text();
				let errorMessage = '上傳失敗';
				
				try {
					const errorData = JSON.parse(errorText);
					errorMessage = errorData.message || errorData.error || errorMessage;
				} catch {
					errorMessage = errorText;
				}
				
				alert(errorMessage);
				return;
			}
			
			form.reset();
			// 重置房間選單提示
			await populateRoomsForItem('');
			alert('新增成功');
		} catch (error) {
			alert('網路錯誤，請檢查網路連接後重試');
		}
	});
}

(async function main() {
	await initItemSelectors();
	bindItemForm();
	await initUserSection();
	function updateOwner() {
		const ownerSpan = document.getElementById('ownerName');
		if (!ownerSpan) return;
		const username = localStorage.getItem('loginUsername');
		ownerSpan.textContent = username ? username : '（未登入）';
	}
	updateOwner();
	let last = localStorage.getItem('loginUsername') || '';
	setInterval(()=>{
		const cur = localStorage.getItem('loginUsername') || '';
		if (cur !== last) { last = cur; updateOwner(); }
	}, 800);
	window.addEventListener('storage', (e)=>{
		if(e.key === 'loginUsername' || e.key === 'loginUserId') updateOwner();
	});
	window.addEventListener('focus', updateOwner);
})();

async function initUserSection() {
	const registerBtn = document.getElementById('register-btn');
	const registerInput = document.getElementById('register-username');
	const loginSelect = document.getElementById('login-user-select');
	const loginBtn = document.getElementById('login-btn');
	const userMsg = document.getElementById('user-message');

	// 若頁面沒有這些元件（例如 add.html），直接跳過初始化
	if (!loginSelect || !loginBtn) {
		return;
	}

	// 載入所有用戶
	async function loadUsers() {
		loginSelect.innerHTML = '<option value="">請選擇使用者</option>';
		try {
			const users = await fetchJSON('/api/users');
			for (const u of users) {
				loginSelect.insertAdjacentHTML('beforeend', `<option value="${u.id}">${u.username}</option>`);
			}
		} catch (e) {
			loginSelect.insertAdjacentHTML('beforeend', `<option value="">載入失敗</option>`);
		}
	}
	await loadUsers();

	// 註冊事件
	registerBtn && registerBtn.addEventListener('click', async () => {
		const username = registerInput.value.trim();
		if (!username) {
			if (userMsg) { userMsg.style.color = 'red'; userMsg.textContent = '請輸入使用者名稱'; }
			return;
		}
		try {
			const res = await fetch('/api/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username })
			});
			if (!res.ok) {
				const err = await res.json();
				if (userMsg) { userMsg.style.color = 'red'; userMsg.textContent = err.error || '註冊失敗'; }
				return;
			}
			if (userMsg) { userMsg.style.color = 'green'; userMsg.textContent = '註冊成功'; }
			if (registerInput) registerInput.value = '';
			await loadUsers();
		} catch (e) {
			if (userMsg) { userMsg.style.color = 'red'; userMsg.textContent = '網路錯誤'; }
		}
	});

	// 登入事件
	loginBtn.addEventListener('click', () => {
		const userId = loginSelect.value;
		const username = loginSelect.options[loginSelect.selectedIndex]?.text;
		if (!userId) {
			userMsg.style.color = 'red';
			userMsg.textContent = '請選擇使用者';
			return;
		}
		userMsg.style.color = 'green';
		userMsg.textContent = `已登入：${username}`;
		// 這裡可用 localStorage 儲存登入狀態
		localStorage.setItem('loginUserId', userId);
		localStorage.setItem('loginUsername', username);
		// 立即更新新增頁「所屬人」顯示
		const ownerSpan = document.getElementById('ownerName');
		if (ownerSpan) ownerSpan.textContent = username || '（未登入）';
	});
}
