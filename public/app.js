'use strict';

const $ = (sel) => document.querySelector(sel);

async function fetchJSON(url) {
	const res = await fetch(url);
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
		const formData = new FormData(form);
		const res = await fetch('/api/items', { method: 'POST', body: formData });
		if (!res.ok) return alert(await res.text());
		form.reset();
		// 重置房間選單提示
		await populateRoomsForItem('');
		alert('新增成功');
	});
}

(async function main() {
	await initItemSelectors();
	bindItemForm();
})();
