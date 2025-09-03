async function deleteMe(){
	const confirmText = document.getElementById('confirmText').value.trim();
	const loggedId = localStorage.getItem('loginUserId');
	const result = document.getElementById('result');
	result.textContent = '';
	if (confirmText !== '確認註銷') {
		alert('請正確輸入「確認註銷」');
		return;
	}
	if (!loggedId) {
		alert('尚未登入，無法註銷');
		return;
	}
	if (!confirm('此動作無法復原。確定要永久刪除帳號與所有物品嗎？')) return;
	try {
		const res = await fetch('/api/users/me', { method: 'DELETE', headers: { 'x-user-id': loggedId } });
		const data = await res.json();
		if (!res.ok) throw new Error(data.error || '刪除失敗');
		result.textContent = `完成註銷。已刪除物品數量：${data.deleted_items}`;
		localStorage.removeItem('loginUserId');
		setTimeout(()=>{ location.href = '/add.html'; }, 1500);
	} catch (e) {
		alert(e.message || '發生錯誤');
	}
}

async function initAdminSection(){
	const userId = localStorage.getItem('loginUserId');
	const username = localStorage.getItem('loginUsername');
	if (username !== '開發人員') return; // 非管理員不顯示
	// 動態插入管理員區塊（若頁面沒有）
	const container = document.querySelector('main.container');
	if (!container) return;
	let adminCard = document.getElementById('admin-cancel-card');
	if (!adminCard){
		adminCard = document.createElement('div');
		adminCard.id = 'admin-cancel-card';
		adminCard.className = 'card';
		adminCard.innerHTML = `
			<h3 style="margin-top:0;">管理員：選擇帳號註銷</h3>
			<select id="targetUserSelect" style="min-width:240px;"></select>
			<button id="adminDeleteBtn" class="btn" style="margin-left:8px; background:#f44336; color:#fff;">刪除選擇帳號</button>
			<p id="adminResult" class="muted" style="margin-top:8px"></p>
		`;
		container.insertBefore(adminCard, container.querySelector('.card'));
	}
	// 載入使用者清單
	const sel = document.getElementById('targetUserSelect');
	try{
		const res = await fetch('/api/users');
		const users = await res.json();
		sel.innerHTML = users.map(u=>`<option value="${u.id}">${u.username}</option>`).join('');
	}catch{ sel.innerHTML = '<option value="">載入失敗</option>'; }
	// 綁定刪除
	document.getElementById('adminDeleteBtn').onclick = async ()=>{
		const target = sel.value;
		if(!target){ alert('請選擇要註銷的帳號'); return; }
		if(!confirm('此動作無法復原，確定刪除此帳號？')) return;
		const r = await fetch(`/api/users/${encodeURIComponent(target)}`, { method:'DELETE', headers: { 'x-user-id': userId } });
		const txt = await r.text();
		let msg = txt;
		try{ const j = JSON.parse(txt); msg = j.error || j.success ? `完成，刪除物品數：${j.deleted_items||0}` : txt; }catch{}
		document.getElementById('adminResult').textContent = msg;
		// 若刪的是自己，提醒重新登入
		if (String(target) === String(userId)) alert('您已刪除自己的帳號，請重新登入');
	};
}

(function(){ initAdminSection(); })();

document.getElementById('deleteBtn').addEventListener('click', deleteMe);

