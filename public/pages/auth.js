// ─── CONFIG ────────────────────────────────────────────────
var SAFE_BROWSER_UA = 'QnaCopa-Safe-Browser-v1';
var DOWNLOAD_URL = 'https://github.com/tusharkhatri-sys/QNA/releases/latest/download/QNA-Safe-Browser-Setup-1.0.0.exe';

// ─── STEP 2: UI SHIELD + BOOT LOCK ────────────────────────
// Inject a full-screen splash that BLOCKS the login UI from ever
// flashing while Supabase is still hydrating from localStorage.
(function injectSplash() {
    const splash = document.createElement('div');
    splash.id = 'boot-splash';
    splash.style.cssText = [
        'position:fixed', 'inset:0', 'z-index:9999',
        'background:#0f172a',
        'display:flex', 'flex-direction:column',
        'align-items:center', 'justify-content:center',
        'transition:opacity 0.4s ease'
    ].join(';');
    splash.innerHTML = `
        <div style="width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;margin-bottom:20px;box-shadow:0 0 40px rgba(99,102,241,0.4);">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
        </div>
        <div style="color:#94a3b8;font-size:0.85rem;letter-spacing:0.1em;font-family:sans-serif;">LOADING SESSION...</div>`;
    document.documentElement.appendChild(splash);
})();

// ─── BOOT LOCK: Wait for Supabase to fully hydrate, THEN decide ──
(async function enforceAutoLogin() {
    try {
        // This waits for INITIAL_SESSION event — the real hydration signal
        const session = await ensureSupabaseAuthReady();

        const splash = document.getElementById('boot-splash');

        if (session) {
            // Valid session found — go directly to dashboard, splash stays until redirect
            console.log('[Auth] Valid session hydrated. Redirecting to dashboard.');
            window.location.replace('student.html');
            return; // Stop all further execution on this page
        }

        // No session — fade out splash and show login form
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => splash.remove(), 400);
        }
        showLoginUI();

    } catch (err) {
        console.warn('[Auth] Boot lock error, falling back to login.', err);
        const splash = document.getElementById('boot-splash');
        if (splash) splash.remove();
        showLoginUI();
    }
})();

function showLoginUI() {
    var ua = navigator.userAgent || '';
    var isSafeBrowser = true; // ua.indexOf(SAFE_BROWSER_UA) !== -1;

    var downloadSection = document.getElementById('download-section');
    var loginSection = document.getElementById('login-section');
    var exitBtn = document.getElementById('exit-app-btn');
    var downloadBtn = document.getElementById('download-exe-btn');

    if (!loginSection || !downloadSection) return;

    if (isSafeBrowser) {
        loginSection.classList.add('active');
        downloadSection.classList.remove('active');
        if (exitBtn) exitBtn.style.display = 'block';
    } else {
        downloadSection.classList.add('active');
        loginSection.classList.remove('active');
        if (exitBtn) exitBtn.style.display = 'none';
    }

    if (downloadBtn) {
        downloadBtn.href = DOWNLOAD_URL;
    }
}



// ─── DOWNLOAD HANDLER ──────────────────────────────────────
function handleDownload(event) {
    // If URL is still the placeholder, show a helpful alert
    if (DOWNLOAD_URL.indexOf('YOUR_GITHUB_USERNAME') !== -1) {
        event.preventDefault();
        alert(
            '⚠️ Download link not configured yet!\n\n' +
            'Admin: Update the DOWNLOAD_URL variable in auth.js with your actual .exe download link.\n\n' +
            'Options:\n' +
            '1. GitHub Releases: Upload .exe to a GitHub repo release\n' +
            '2. Google Drive: Share .exe as a direct download link\n' +
            '3. Any file hosting service with a direct URL'
        );
        return;
    }
    // Otherwise, the <a> tag href will handle the download naturally
}


// ─── LOGIN / REGISTER TOGGLE ───────────────────────────────
var authMode = 'login';

function toggleAuthMode() {
    authMode = authMode === 'login' ? 'register' : 'login';
    document.getElementById('auth-title').textContent = authMode === 'login' ? 'Student Login' : 'Student Registration';
    document.getElementById('auth-subtitle').textContent = authMode === 'login' ? 'Login to access your exam dashboard' : 'Create an account to take tests';
    document.getElementById('auth-name-group').style.display = authMode === 'login' ? 'none' : 'block';
    document.getElementById('auth-submit-btn').textContent = authMode === 'login' ? 'Login' : 'Register';
    document.getElementById('auth-toggle-text').textContent = authMode === 'login' ? "Don't have an account?" : "Already have an account?";
    document.getElementById('auth-toggle-btn').textContent = authMode === 'login' ? 'Register' : 'Login';
    document.getElementById('auth-error-msg').style.display = 'none';
}


// ─── SUBMIT AUTH (Login or Register) ───────────────────────
async function submitAuth() {
    var email = document.getElementById('auth-email').value.trim();
    var password = document.getElementById('auth-password').value.trim();
    var name = document.getElementById('auth-name').value.trim();
    var errObj = document.getElementById('auth-error-msg');

    if (!email || !password || (authMode === 'register' && !name)) {
        errObj.textContent = 'Please fill all fields';
        errObj.style.display = 'block';
        return;
    }

    var btn = document.getElementById('auth-submit-btn');
    btn.textContent = 'Processing...';
    btn.disabled = true;

    try {
        var endpoint = authMode === 'login' ? '/students/login' : '/students/register';
        var payload = { email: email, password: password, name: name };
        var res = await fetch(API_URL + endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        var data = await res.json();

        if (data.success) {
            localStorage.setItem('loggedInStudent', JSON.stringify({
                email: data.student.email,
                name: data.student.name
            }));
            window.location.href = 'student.html';
        } else {
            errObj.textContent = data.message;
            errObj.style.display = 'block';
            btn.textContent = authMode === 'login' ? 'Login' : 'Register';
            btn.disabled = false;
        }
    } catch (e) {
        errObj.textContent = 'Server error. Please try again.';
        errObj.style.display = 'block';
        btn.textContent = authMode === 'login' ? 'Login' : 'Register';
        btn.disabled = false;
    }
}


// ─── EXIT SAFE BROWSER ─────────────────────────────────────
function exitSafeBrowser() {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
        window.Capacitor.Plugins.App.exitApp();
    } else if (window.qnaBrowser && typeof window.qnaBrowser.closeApp === 'function') {
        window.qnaBrowser.closeApp();
    } else {
        alert("This feature only works in the QNA Safe Browser.");
    }
}