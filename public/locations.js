'use strict';

const $ = (s)=>document.querySelector(s);

async function fetchJSON(url){ const r=await fetch(url); if(!r.ok) throw new Error(await r.text()); return r.json(); }
async function postJSON(url, body){ const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); if(!r.ok) throw new Error(await r.text()); return r.json(); }

async function loadFloors(){
	const floors = await fetchJSON('/api/floors');
	const ul = $('#floors'); ul.innerHTML='';
	const sel = $('#room-floor'); sel.innerHTML='';
	for(const f of floors){
		ul.insertAdjacentHTML('beforeend', `<li data-id="${f.id}">${f.name} <button class="del-floor" style="background:#dc3545">刪除</button></li>`);
		sel.insertAdjacentHTML('beforeend', `<option value="${f.id}">${f.name}</option>`);
	}
	await loadRooms();
}

async function loadRooms(){
	const floorId = $('#room-floor').value; if(!floorId){ $('#rooms').innerHTML=''; return; }
	const rooms = await fetchJSON(`/api/rooms?floor_id=${encodeURIComponent(floorId)}`);
	const ul = $('#rooms'); ul.innerHTML='';
	for(const r of rooms){ ul.insertAdjacentHTML('beforeend', `<li data-id="${r.id}">${r.name} <button class="del-room" style="background:#dc3545">刪除</button></li>`); }
}

function bind(){
	$('#add-floor').addEventListener('click', async ()=>{
		const name = $('#floor-name').value.trim(); if(!name) return alert('請輸入樓層名稱');
		await postJSON('/api/floors', { name }); $('#floor-name').value=''; await loadFloors();
	});
	$('#floors').addEventListener('click', async (e)=>{
		if(!e.target.classList.contains('del-floor')) return;
		const li = e.target.closest('li'); const id = li.getAttribute('data-id');
		if(!confirm('刪除此樓層將會同時刪除其區域，確定？')) return;
		await fetch(`/api/floors/${id}`, { method:'DELETE' });
		await loadFloors();
	});
	$('#room-floor').addEventListener('change', loadRooms);
	$('#add-room').addEventListener('click', async ()=>{
		const floor_id = $('#room-floor').value; const name = $('#room-name').value.trim();
		if(!floor_id) return alert('請先選擇樓層'); if(!name) return alert('請輸入區域名稱');
		await postJSON('/api/rooms', { floor_id, name }); $('#room-name').value=''; await loadRooms();
	});
	$('#rooms').addEventListener('click', async (e)=>{
		if(!e.target.classList.contains('del-room')) return;
		const li = e.target.closest('li'); const id = li.getAttribute('data-id');
		if(!confirm('確定刪除此區域？')) return;
		await fetch(`/api/rooms/${id}`, { method:'DELETE' });
		await loadRooms();
	});
}

(function(){ bind(); loadFloors(); })();
