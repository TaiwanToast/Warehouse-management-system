// 用戶資訊與登出功能代理
(function(){
    const label = document.getElementById('login-user-label');
    const btn = document.getElementById('logout-btn');
    if (!label || !btn) return;
    const loginUser = localStorage.getItem('loginUsername');
    label.textContent = loginUser ? `${loginUser} 吉祥` : '未登入';
    btn.addEventListener('click', function() {
        localStorage.removeItem('loginUserId');
        localStorage.removeItem('loginUsername');
        window.location.href = '/';
    });
})();
