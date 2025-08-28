'use strict';

const $ = (s)=>document.querySelector(s);

async function fetchJSON(url){
	const r = await fetch(url);
	if(!r.ok) throw new Error(await r.text());
	return r.json();
}
async function sendJSON(url, method, body){
	const r = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
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
	const rows = await fetchJSON(u.toString());
	const c = $('#results'); c.innerHTML='';
	for(const r of rows){
		c.insertAdjacentHTML('beforeend', `
			<div class="item" data-id="${r.id}" data-floor-id="${r.floor_id}" data-room-id="${r.room_id}">
				${r.image_path?`<img class="zoomable" src="${r.image_path}" alt="${r.name}">`:''}
				<h3>${r.name}</h3>
				<div><span class="badge">${r.floor_name}</span><span class="badge">${r.room_name}</span></div>
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
			form.name.value = item.querySelector('h3').textContent;
			form.description.value = item.querySelector('p').textContent;
			await loadEditSelectors(item.dataset.floorId, item.dataset.roomId);
			form.status && (form.status.value = 'available');
			form.borrower && (form.borrower.value = '');
			form.borrow_location && (form.borrow_location.value = '');
			dlg.returnValue='';
			dlg.showModal();
			$('#saveEdit').onclick = async ()=>{
				const payload = {
					name: form.name.value.trim(),
					description: form.description.value.trim()||null,
					floor_id: $('#edit-floor').value || null,
					room_id: $('#edit-room').value || null,
					status: form.status ? form.status.value : undefined,
					borrower: form.borrower ? form.borrower.value.trim()||null : undefined,
					borrow_location: form.borrow_location ? form.borrow_location.value.trim()||null : undefined,
				};
				await sendJSON(`/api/items/${id}`, 'PUT', payload);
				dlg.close();
				await search();
			};
		}
		if(e.target.classList.contains('delete')){
			if(!confirm('確定要刪除？')) return;
			await fetch(`/api/items/${id}`, { method:'DELETE' });
			await search();
		}
	});
}

(function(){ bind(); })();
