let authMode = 'login';
function toggleAuthMode() {
    authMode = authMode === 'login' ? 'register' : 'login';
    document.getElementById('auth-title').textContent = authMode === 'login' ? 'Student Login' : 'Student Registration';
    document.getElementById('auth-subtitle').textContent = authMode === 'login' ? 'Login to access your dashboard' : 'Create an account to take tests';
    document.getElementById('auth-name-group').style.display = authMode === 'login' ? 'none' : 'block';
    document.getElementById('auth-submit-btn').textContent = authMode === 'login' ? 'Login' : 'Register';
    document.getElementById('auth-toggle-text').textContent = authMode === 'login' ? "Don't have an account?" : "Already have an account?";
    document.getElementById('auth-toggle-btn').textContent = authMode === 'login' ? 'Register' : 'Login';
    document.getElementById('auth-error-msg').style.display = 'none';
}

async function submitAuth() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const name = document.getElementById('auth-name').value;
    const errObj = document.getElementById('auth-error-msg');
    
    if (!email || !password || (authMode === 'register' && !name)) {
        errObj.textContent = "Please fill all fields";
        errObj.style.display = 'block';
        return;
    }
    
    document.getElementById('auth-submit-btn').textContent = 'Processing...';
    
    try {
        const payload = { action: authMode, email, password, name };
        const res = await fetch(`${API_URL}/students`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if (data.success) {
            localStorage.setItem('loggedInStudent', JSON.stringify({ email: data.student.email, name: data.student.name }));
            window.location.href = 'student.html';
        } else {
            errObj.textContent = data.message;
            errObj.style.display = 'block';
            document.getElementById('auth-submit-btn').textContent = authMode === 'login' ? 'Login' : 'Register';
        }
    } catch (e) {
        errObj.textContent = "Server error. Try again.";
        errObj.style.display = 'block';
        document.getElementById('auth-submit-btn').textContent = authMode === 'login' ? 'Login' : 'Register';
    }
}