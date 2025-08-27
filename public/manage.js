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

async function search(){
	const q = $('#q').value.trim();
	const u = new URL('/api/items', location.origin);
	if (q) u.searchParams.set('q', q);
	const rows = await fetchJSON(u.toString());
	const c = $('#results'); c.innerHTML='';
	for(const r of rows){
		c.insertAdjacentHTML('beforeend', `
			<div class="item" data-id="${r.id}">
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
	$('#closeImg').onclick = ()=> dlg.close();
	dlg.addEventListener('click', (e)=>{ if(e.target === dlg) dlg.close(); });
	$('#results').querySelectorAll('img.zoomable').forEach(el => {
		el.addEventListener('click', ()=>{ img.src = el.src; img.alt = el.alt||'預覽'; dlg.showModal(); });
	});
}

function bind(){
	$('#search').addEventListener('click', search);
	$('#results').addEventListener('click', async (e)=>{
		const item = e.target.closest('.item'); if(!item) return;
		const id = item.getAttribute('data-id');
		if(e.target.classList.contains('edit')){
			const dlg = $('#editDialog');
			const form = $('#editForm');
			form.name.value = item.querySelector('h3').textContent;
			form.description.value = item.querySelector('p').textContent;
			dlg.returnValue='';
			dlg.showModal();
			$('#saveEdit').onclick = async ()=>{
				await sendJSON(`/api/items/${id}`, 'PUT', { name: form.name.value.trim(), description: form.description.value.trim()||null });
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

(function(){ bind(); search(); })();
