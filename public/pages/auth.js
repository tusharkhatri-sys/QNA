// ============================================================
// QNA Copa — auth.js
// User-Agent Detection → Download Page vs Login Form
// ============================================================

var SAFE_BROWSER_UA = 'QnaCopa-Safe-Browser-v1';

// ============================================================
// GITHUB RELEASE DOWNLOAD URL — UPDATE THIS!
// ============================================================
// Option A: Direct .exe download from GitHub Releases
//   Format: https://github.com/YOUR_USERNAME/YOUR_REPO/releases/latest/download/FILENAME.exe
//   Example: https://github.com/tusharkhatri/qna-safe-browser/releases/latest/download/QNA-Safe-Browser-Setup-1.0.0.exe
//
// Option B: Google Drive direct link
//   Format: https://drive.google.com/uc?export=download&id=YOUR_FILE_ID
//
// Option C: Any direct file hosting URL
//
// Replace the URL below with your actual download link:
var DOWNLOAD_URL = 'https://github.com/tusharkhatri-sys/QNA/releases/latest/download/QNA-Safe-Browser-Setup-1.0.0.exe';


// ─── PAGE INIT: DETECT USER-AGENT ──────────────────────────
document.addEventListener('DOMContentLoaded', function () {
    var ua = navigator.userAgent || '';
    // For testing: Temporarily making it true so you can see the login form and exit button in normal browser
    var isSafeBrowser = true; // ua.indexOf(SAFE_BROWSER_UA) !== -1;

    var downloadSection = document.getElementById('download-section');
    var loginSection = document.getElementById('login-section');
    var exitBtn = document.getElementById('exit-app-btn');
    var downloadBtn = document.getElementById('download-exe-btn');

    if (isSafeBrowser) {
        // ✅ Inside QNA Copa Safe Browser — show login/register forms
        loginSection.classList.add('active');
        downloadSection.classList.remove('active');
        if (exitBtn) exitBtn.style.display = 'block';
    } else {
        // ❌ Normal browser — show download prompt
        downloadSection.classList.add('active');
        loginSection.classList.remove('active');
        if (exitBtn) exitBtn.style.display = 'none';
    }

    // Set the download button href
    if (downloadBtn) {
        downloadBtn.href = DOWNLOAD_URL;
    }
});


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
    // Electron IPC bridge (set up via preload.js)
    if (window.qnaBrowser && typeof window.qnaBrowser.closeApp === 'function') {
        window.qnaBrowser.closeApp();
        return;
    }

    // Fallback
    window.close();
}