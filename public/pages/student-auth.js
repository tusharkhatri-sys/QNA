// Ensure Lucide icons load
if (typeof lucide !== 'undefined') {
    lucide.createIcons();
}

// Redirect if already logged in
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            window.location.href = 'student-dashboard.html';
        }
    } catch(err) {
        console.error("Session check error:", err);
    }
});

// UI Alert Helper
function showAlert(formType, message, type) {
    const alertBox = document.getElementById(`${formType}-alert`);
    if (!alertBox) return;

    alertBox.classList.remove('hidden', 'bg-red-50', 'border-red-500', 'text-red-800', 'bg-emerald-50', 'border-emerald-500', 'text-emerald-800');
    alertBox.classList.add('block');
    
    if (type === 'error') {
        alertBox.classList.add('bg-red-50', 'border-red-500', 'text-red-800', 'border');
    } else if (type === 'success') {
        alertBox.classList.add('bg-emerald-50', 'border-emerald-500', 'text-emerald-800', 'border');
    }

    alertBox.textContent = message;
}

function hideAlert(formType) {
    const alertBox = document.getElementById(`${formType}-alert`);
    if (alertBox) {
        alertBox.classList.add('hidden');
        alertBox.classList.remove('block');
    }
}

// Login Logic
let unverifiedLoginAttempts = 0;
let currentUnverifiedEmail = "";

function showResendModal(email) {
    currentUnverifiedEmail = email;
    document.getElementById('resend-email-display').textContent = email;
    document.getElementById('resend-modal').classList.remove('hidden');
}

window.closeResendModal = function() {
    document.getElementById('resend-modal').classList.add('hidden');
}

document.getElementById('send-new-link-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('send-new-link-btn');
    btn.textContent = 'Sending...';
    btn.disabled = true;
    
    try {
        // Construct redirect URL dynamically based on current host
        const redirectUrl = window.location.href.replace('student-auth.html', 'verified.html').replace('auth.html', 'verified.html');
        
        const { error } = await supabaseClient.auth.resend({
            type: 'signup',
            email: currentUnverifiedEmail,
            options: {
                emailRedirectTo: redirectUrl
            }
        });
        
        if (error) throw error;
        
        closeResendModal();
        showAlert('login', 'A new confirmation link has been sent to your email. Please check your inbox.', 'success');
        unverifiedLoginAttempts = 0; // reset
    } catch(err) {
        console.error('Resend error:', err);
        showAlert('login', err.message || 'Failed to send activation link.', 'error');
        closeResendModal();
    } finally {
        btn.textContent = 'SEND NEW LINK';
        btn.disabled = false;
    }
});

const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlert('login');

        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        const btn = document.getElementById('login-btn');

        if (!email || !password) {
            showAlert('login', 'Please provide both email and password.', 'error');
            return;
        }

        btn.textContent = 'Authenticating...';
        btn.disabled = true;

        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) {
                throw error;
            }

            // Redirect on success
            window.location.href = 'student-dashboard.html';

        } catch (err) {
            console.error('Login error:', err);
            let msg = err.message;
            
            // Handle unverified email error
            if (msg.toLowerCase().includes('confirm') || msg.toLowerCase().includes('verif') || msg.toLowerCase().includes('not confirmed')) {
                unverifiedLoginAttempts++;
                msg = 'Your email is not verified yet. Please check your inbox.';
                if (unverifiedLoginAttempts >= 2) {
                    showResendModal(email);
                }
            } else if (msg === 'Invalid login credentials') {
                msg = 'Invalid email or password.';
            }
            
            showAlert('login', msg, 'error');
        } finally {
            btn.textContent = 'Authorize & Open Dashboard';
            btn.disabled = false;
        }
    });
}
