'use strict';

const $ = (s)=>document.querySelector(s);

async function fetchJSON(url){
	const userId = localStorage.getItem('loginUserId');
	const r = await fetch(url, { headers: userId? { 'x-user-id': userId } : {} });
	if(!r.ok) throw new Error(await r.text());
	return r.json();
}
async function sendJSON(url, method, body){
	const userId = localStorage.getItem('loginUserId');
	const headers = { 'Content-Type':'application/json' };
	if(userId) headers['x-user-id'] = userId;
	const r = await fetch(url, { method, headers, body: JSON.stringify(body)});
	if(!r.ok) throw new Error(await r.text());
	return r.json();
}

function cnNumToInt(str){
	const d = String(str).match(/\d+/);
	if(d) return parseInt(d[0],10);
	const map={"零":0,"〇":0,"一":1,"二":2,"兩":2,"三":3,"四":4,"五":5,"六":6,"七":7,"八":8,"九":9};
	let s = String(str).replace(/樓|層|F|f/g,'');
	if(s==='十') return 10;
	const idx = s.indexOf('十');
	if(idx!==-1){
		const tens = idx===0?1:(map[s[idx-1]]||0);
		const ones = map[s[idx+1]]||0;
		return tens*10 + ones;
	}
	let n = 0; for(const ch of s){ if(map.hasOwnProperty(ch)) n = n*10 + map[ch]; }
	return n||Number.MAX_SAFE_INTEGER;
}

async function loadFloorsAndRooms(){
	let floors = await fetchJSON('/api/floors');
	floors = floors.sort((a,b)=> cnNumToInt(a.name) - cnNumToInt(b.name));
	const floorSel = $('#q-floor-manage');
	const roomSel = $('#q-room-manage');
	floorSel.innerHTML = '<option value="">全部樓層</option>';
	for(const f of floors){ floorSel.insertAdjacentHTML('beforeend', `<option value="${f.id}">${f.name}</option>`); }
	roomSel.innerHTML = '<option value="">全部區域</option>';
	floorSel.onchange = async ()=>{
		const fid = floorSel.value;
		roomSel.innerHTML = '<option value="">全部區域</option>';
		if(!fid) return;
		const rooms = await fetchJSON(`/api/rooms?floor_id=${encodeURIComponent(fid)}`);
		for(const r of rooms){ roomSel.insertAdjacentHTML('beforeend', `<option value="${r.id}">${r.name}</option>`); }
	};
}

async function search(){
	const q = $('#q').value.trim();
	const floorId = $('#q-floor-manage').value;
	const roomId = $('#q-room-manage').value;
	const u = new URL('/api/items', location.origin);
	if (q) u.searchParams.set('q', q);
	if (floorId) u.searchParams.set('floor_id', floorId);
	if (roomId) u.searchParams.set('room_id', roomId);
	const response = await fetchJSON(u.toString());
	const rows = response.data || response; // 支援新舊格式
	const c = $('#results'); c.innerHTML='';
	for(const r of rows){
		c.insertAdjacentHTML('beforeend', `
			<div class="item" data-id="${r.id}" data-floor-id="${r.floor_id}" data-room-id="${r.room_id}">
				${r.image_path?`<img class="zoomable" src="${r.image_path}" alt="${r.name}">`:''}
				<h3>${r.name}</h3>
				<div>
					<span class="badge">${r.floor_name}</span>
					<span class="badge">${r.room_name}</span>
					${r.owner?`<span class="badge owner">所屬：${r.owner}</span>`:''}
					${(r.quantity!==undefined && r.quantity!==null)?`<span class="badge" style="${Number(r.quantity)===0?'background:#dc3545;color:#fff;':''}">總數量：${r.quantity}</span>`:''}
					${(r.borrow_quantity!==undefined && r.borrow_quantity!==null && r.borrow_quantity>0)?`<span class="badge" style="background:#ff9500;color:#fff;">借出：${r.borrow_quantity}</span>`:''}
					${(r.quantity!==undefined && r.quantity!==null && r.borrow_quantity!==undefined && r.borrow_quantity!==null)?`<span class="badge" style="background:#34c759;color:#fff;">可用：${Math.max(0, (r.quantity || 0) - (r.borrow_quantity || 0))}</span>`:''}
				</div>
				<p>${r.description||''}</p>
				<div class="flex">
					<button class="edit">編輯</button>
					<button class="delete" style="background:#dc3545">刪除</button>
				</div>
			</div>
		`);
	}
	bindImagePreview();
}

function bindImagePreview(){
	const dlg = $('#imgDialog');
	const img = $('#imgPreview');
	if(!dlg||!img) return;
	$('#closeImg')&&($('#closeImg').onclick = ()=> dlg.close());
	dlg.addEventListener('click', (e)=>{ if(e.target === dlg) dlg.close(); });
	$('#results').querySelectorAll('img.zoomable').forEach(el => {
		el.addEventListener('click', ()=>{ img.src = el.src; img.alt = el.alt||'預覽'; dlg.showModal(); });
	});
}

async function loadEditSelectors(fid, rid){
	let floors = await fetchJSON('/api/floors');
	floors = floors.sort((a,b)=> cnNumToInt(a.name) - cnNumToInt(b.name));
	const floorSel = $('#edit-floor');
	const roomSel = $('#edit-room');
	floorSel.innerHTML = '<option value="">選擇樓層</option>';
	for(const f of floors){ floorSel.insertAdjacentHTML('beforeend', `<option value="${f.id}">${f.name}</option>`); }
	if(fid){ floorSel.value = String(fid); }
	roomSel.innerHTML = '<option value="">選擇區域</option>';
	if(fid){
		const rooms = await fetchJSON(`/api/rooms?floor_id=${encodeURIComponent(fid)}`);
		for(const r of rooms){ roomSel.insertAdjacentHTML('beforeend', `<option value="${r.id}">${r.name}</option>`); }
		if(rid){ roomSel.value = String(rid); }
	}
	floorSel.onchange = async ()=>{
		const nfid = floorSel.value;
		roomSel.innerHTML = '<option value="">選擇區域</option>';
		if(!nfid) return;
		const rooms = await fetchJSON(`/api/rooms?floor_id=${encodeURIComponent(nfid)}`);
		for(const r of rooms){ roomSel.insertAdjacentHTML('beforeend', `<option value="${r.id}">${r.name}</option>`); }
	};
}

function bind(){
	loadFloorsAndRooms().then(search);
	$('#search').addEventListener('click', search);
	$('#results').addEventListener('click', async (e)=>{
		const item = e.target.closest('.item'); if(!item) return;
		const id = item.getAttribute('data-id');
		if(e.target.classList.contains('edit')){
			const dlg = $('#editDialog');
			const form = $('#editForm');
			
			// 除錯：顯示當前使用者ID
			const currentUserId = localStorage.getItem('loginUserId');
			console.log('當前使用者ID:', currentUserId);
			console.log('要編輯的物品ID:', id);
			
			form.name.value = item.querySelector('h3').textContent;
			// 取得完整資料（但不再編輯 owner）
			const itemId = item.getAttribute('data-id');
			const itemData = await fetchJSON(`/api/items/${itemId}`);
			const ownerSpan = document.getElementById('ownerNameEdit');
			if(ownerSpan){
				const username = localStorage.getItem('loginUsername');
				ownerSpan.textContent = username ? username : (itemData.owner || '（未登入）');
			}
			form.quantity.value = itemData.quantity ?? 1;
			form.description.value = item.querySelector('p').textContent;
			await loadEditSelectors(item.dataset.floorId, item.dataset.roomId);
			form.status && (form.status.value = itemData.status || 'available');
			form.borrower && (form.borrower.value = itemData.borrower || '');
			form.borrow_location && (form.borrow_location.value = itemData.borrow_location || '');
			// 載入借出數量
			const borrowQuantityInput = document.getElementById('edit-borrow-quantity');
			if (borrowQuantityInput) {
				borrowQuantityInput.value = itemData.borrow_quantity || 1;
			}
			const dispatchAmountInput = document.getElementById('dispatch-amount');
			const statusSel = document.getElementById('edit-status');
			function updateFieldsByStatus(){
				if(!statusSel) return;
				const borrowQuantityInput = document.getElementById('edit-borrow-quantity');
				
				if(statusSel.value === 'borrowed'){
					form.borrower.style.display = '';
					form.borrower.placeholder = '借用人（狀態為借出中時填寫）';
					form.borrow_location.style.display = '';
					borrowQuantityInput.style.display = '';
					dispatchAmountInput.style.display = 'none';
				}else if(statusSel.value === 'dispatch'){
					form.borrower.style.display = '';
					form.borrower.placeholder = '送出對象';
					form.borrow_location.style.display = 'none';
					borrowQuantityInput.style.display = 'none';
					dispatchAmountInput.style.display = '';
					dispatchAmountInput.value = '1';
				}else{
					form.borrower.style.display = 'none';
					form.borrow_location.style.display = 'none';
					borrowQuantityInput.style.display = 'none';
					dispatchAmountInput.style.display = 'none';
				}
			}
			statusSel && statusSel.addEventListener('change', updateFieldsByStatus);
			updateFieldsByStatus();
			dlg.returnValue='';
			dlg.showModal();
			$('#saveEdit').onclick = async ()=>{
				const payload = {
					name: form.name.value.trim(),
					description: form.description.value.trim()||null,
					floor_id: $('#edit-floor').value || null,
					room_id: $('#edit-room').value || null,
					// owner 由後端依登入者自動帶入
					quantity: form.quantity.value === '' ? undefined : parseInt(form.quantity.value,10),
					status: form.status ? (form.status.value==='dispatch'?'available':form.status.value) : undefined,
					borrower: form.borrower ? form.borrower.value.trim()||null : undefined,
					borrow_location: form.borrow_location ? form.borrow_location.value.trim()||null : undefined,
					borrow_quantity: form.status && form.status.value === 'borrowed' ? parseInt(document.getElementById('edit-borrow-quantity').value, 10) : undefined,
				};
				await sendJSON(`/api/items/${id}`, 'PUT', payload);
				// 若選擇送出，於儲存後呼叫 dispatch API 扣庫存
				if(form.status && form.status.value === 'dispatch'){
					const amt = parseInt(dispatchAmountInput.value,10);
					if(!Number.isInteger(amt) || amt<=0){ alert('請輸入正整數的送出數量'); return; }
					try{
						await sendJSON(`/api/items/${id}/dispatch`, 'POST', { amount: amt });
					}catch(e){
						try{
							const err = JSON.parse(e.message);
							if(err && err.error){
								alert(err.error);
								return;
							}
						}catch{}
						alert('庫存不足');
						return;
					}
				}
				dlg.close();
				await search();
			};


		}
		if(e.target.classList.contains('delete')){
			if(!confirm('確定要刪除？')) return;
			const userId = localStorage.getItem('loginUserId');
			await fetch(`/api/items/${id}`, { 
				method:'DELETE',
				headers: userId ? { 'x-user-id': userId } : {}
			});
			await search();
		}
	});
}

(function(){ bind(); })();
