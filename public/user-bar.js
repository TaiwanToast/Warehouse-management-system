// 用戶資訊與登出功能代理
(function(){
    const label = document.getElementById('login-user-label');
    const btn = document.getElementById('logout-btn');
    if (!label || !btn) return;
    const loginUser = localStorage.getItem('loginUsername');
    label.textContent = loginUser ? `${loginUser} 吉祥` : '未登入';
    // 管理員捷徑：顯示註銷按鈕
    if (loginUser === '開發人員') {
        const container = document.getElementById('user-info');
        if (container && !document.getElementById('admin-cancel-link')) {
            const link = document.createElement('a');
            link.id = 'admin-cancel-link';
            link.href = '/cancel.html';
            link.textContent = '註銷';
            link.style.marginLeft = '8px';
            link.style.textDecoration = 'none';
            link.style.color = '#0b57d0';
            container.insertBefore(link, btn);
        }
    }
    btn.addEventListener('click', function() {
        localStorage.removeItem('loginUserId');
        localStorage.removeItem('loginUsername');
        window.location.href = '/';
    });
})();
