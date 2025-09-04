'use strict';

const $ = (s)=>document.querySelector(s);

async function fetchJSON(url){
	const userId = localStorage.getItem('loginUserId');
	const r = await fetch(url, { headers: userId? { 'x-user-id': userId } : {} });
	if(!r.ok) throw new Error(await r.text());
	return r.json();
}

function mapStatus(status){
	switch(status){
		case 'borrowed': return { label:'借出中', cls:'badge-status badge-borrowed' };
		case 'returned': return { label:'已歸還', cls:'badge-status badge-returned' };
		case 'available':
		default: return { label:'可用', cls:'badge-status badge-available' };
	}
}

function fmt(ts){
	if(!ts) return '';
	try{
		// 以 UTC 解析（SQLite CURRENT_TIMESTAMP 為 UTC），固定轉為台北時間（UTC+8）
		const iso = ts.includes('T') ? ts : ts.replace(' ','T');
		const d = new Date(iso + 'Z');
		if(Number.isNaN(d.getTime())) return ts;
		const opt = { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false, timeZone:'Asia/Taipei' };
		return new Intl.DateTimeFormat('zh-TW', opt).format(d).replaceAll('/','-');
	}catch{ return ts; }
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

async function initOptions(){
	let floors = await fetchJSON('/api/floors');
	floors = floors.sort((a,b)=> cnNumToInt(a.name) - cnNumToInt(b.name));
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
	sel.innerHTML = '<option value="">全部區域</option>';
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
	const response = await fetchJSON(u.toString());
	const rows = response.data || response; // 支援新舊格式
	const container = $('#results'); container.innerHTML='';
	for(const r of rows){
		const st = mapStatus(r.status);
		const borrowLine = r.status === 'borrowed' ? `
			<div style="margin-top:6px; font-size:13px; color:#555;">
				${r.borrower?`借用人：${r.borrower}`:''}<br>
				${r.borrow_location?`借用地點：${r.borrow_location}`:''}<br>
				${r.borrow_at?`借出時間：${fmt(r.borrow_at)}`:''}
			</div>
		` : r.status === 'returned' ? `
			<div style="margin-top:6px; font-size:13px; color:#555;">
				${r.returned_at?`歸還時間：${fmt(r.returned_at)}`:''}
			</div>
		` : '';
		container.insertAdjacentHTML('beforeend', `
			<div class="item" data-id="${r.id}">
				${r.image_path?`<img class="zoomable" src="${r.image_path}" alt="${r.name}">`:''}
				<h3><span class="badge ${st.cls}">${st.label}</span>${r.name}</h3>
				<div>
					<span class="badge">${r.floor_name}</span>
					<span class="badge">${r.room_name}</span>
					${r.owner?`<span class="badge owner">所屬：${r.owner}</span>`:''}
					${(r.quantity!==undefined && r.quantity!==null)?`<span class="badge" style="${Number(r.quantity)===0?'background:#dc3545;color:#fff;':''}">總數量：${r.quantity}</span>`:''}
					${(r.borrow_quantity!==undefined && r.borrow_quantity!==null && r.borrow_quantity>0)?`<span class="badge" style="background:#ff9500;color:#fff;">借出：${r.borrow_quantity}</span>`:''}
					${(r.quantity!==undefined && r.quantity!==null && r.borrow_quantity!==undefined && r.borrow_quantity!==null)?`<span class="badge" style="background:#34c759;color:#fff;">可用：${Math.max(0, (r.quantity || 0) - (r.borrow_quantity || 0))}</span>`:''}
				</div>
				<p>${r.description||''}</p>
				${borrowLine}
			</div>
		`);
	}
	bindImagePreview();
	bindHistoryClick();
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

function bindHistoryClick(){
	const dlg = document.getElementById('historyDialog');
	const list = document.getElementById('historyList');
	const closeBtn = document.getElementById('closeHistory');
	if(!dlg||!list||!closeBtn) return;
	closeBtn.onclick = ()=> dlg.close();
	dlg.addEventListener('click', (e)=>{ if(e.target === dlg) dlg.close(); });
	document.querySelectorAll('#results .item').forEach(card => {
		const img = card.querySelector('img.zoomable');
		card.addEventListener('click', async (e)=>{
			if(img && img.contains(e.target)) return; // 交給圖片預覽
			const id = card.getAttribute('data-id');
			try{
				const userId = localStorage.getItem('loginUserId');
				const r = await fetch(`/api/items/${id}/history`, { headers: userId? { 'x-user-id': userId } : {} });
				if(!r.ok){ throw new Error(await r.text()); }
				const response = await r.json();
				const rows = response.data || response; // 支援新舊格式
				list.innerHTML = rows.map(h=>{
					let changes = '';
					try{ const obj = h.changes? JSON.parse(h.changes):{}; changes = `<pre style="white-space:pre-wrap;">${JSON.stringify(obj,null,2)}</pre>`; }catch{ changes = h.changes||''; }
					return `<div style="border-bottom:1px solid var(--border); padding:8px 0;">
						<div style="font-weight:600;">${h.action}</div>
						<div style="font-size:12px; color:#666;">${h.created_at}</div>
						${changes}
					</div>`;
				}).join('') || '<div>目前沒有紀錄</div>';
				dlg.showModal();
			}catch(err){ alert('載入歷史失敗'); }
		});
	});
}

(function(){
	$('#search').addEventListener('click', search);
	initOptions().then(search);
})();
