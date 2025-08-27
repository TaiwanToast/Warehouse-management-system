'use strict';

const $ = (s)=>document.querySelector(s);

async function fetchJSON(url){
	const r = await fetch(url);
	if(!r.ok) throw new Error(await r.text());
	return r.json();
}

async function initOptions(){
	const floors = await fetchJSON('/api/floors');
	$('#q-floor').innerHTML = '<option value="">全部樓層</option>';
	for(const f of floors){
		$('#q-floor').insertAdjacentHTML('beforeend', `<option value="${f.id}">${f.name}</option>`);
	}
	$('#q-floor').addEventListener('change', async (e)=>{
		await populateRooms(e.target.value);
	});
	await populateRooms($('#q-floor').value);
}

async function populateRooms(floorId){
	const sel = $('#q-room');
	sel.innerHTML = '<option value="">全部房間</option>';
	if(!floorId) return;
	const rooms = await fetchJSON(`/api/rooms?floor_id=${encodeURIComponent(floorId)}`);
	for(const r of rooms){ sel.insertAdjacentHTML('beforeend', `<option value="${r.id}">${r.name}</option>`); }
}

async function search(){
	const q = $('#q').value.trim();
	const floorId = $('#q-floor').value;
	const roomId = $('#q-room').value;
	const u = new URL('/api/items', location.origin);
	if (q) u.searchParams.set('q', q);
	if (floorId) u.searchParams.set('floor_id', floorId);
	if (roomId) u.searchParams.set('room_id', roomId);
	const rows = await fetchJSON(u.toString());
	const container = $('#results'); container.innerHTML='';
	for(const r of rows){
		container.insertAdjacentHTML('beforeend', `
			<div class="item">
				${r.image_path?`<img class="zoomable" src="${r.image_path}" alt="${r.name}">`:''}
				<h3>${r.name}</h3>
				<div><span class="badge">${r.floor_name}</span><span class="badge">${r.room_name}</span></div>
				<p>${r.description||''}</p>
			</div>
		`);
	}
	bindImagePreview();
}

function bindImagePreview(){
	const dlg = $('#imgDialog');
	const img = $('#imgPreview');
	$('#closeImg').onclick = ()=> dlg.close();
	dlg.addEventListener('click', (e)=>{ if(e.target === dlg) dlg.close(); });
	$('#results').querySelectorAll('img.zoomable').forEach(el => {
		el.addEventListener('click', ()=>{ img.src = el.src; img.alt = el.alt||'預覽'; dlg.showModal(); });
	});
}

(function(){
	$('#search').addEventListener('click', search);
	initOptions().then(search);
})();
