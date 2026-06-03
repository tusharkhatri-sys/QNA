// Ensure Lucide icons load
if (typeof lucide !== 'undefined') {
    lucide.createIcons();
}

// Redirect if already logged in and fetch active sessions
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            window.location.href = 'student-dashboard.html';
        }
    } catch(err) {
        console.error("Session check error:", err);
    }
    
    // Fetch active sessions for registration dropdown
    const sessionSelect = document.getElementById('reg-session-select');
    if (sessionSelect) {
        try {
            const { data, error } = await supabaseClient
                .from('sessions')
                .select('id, name')
                .eq('is_active', true);
                
            if (error) throw error;
            
            if (data && data.length > 0) {
                sessionSelect.innerHTML = ''; // Clear loading text
                if (data.length > 1) {
                    sessionSelect.innerHTML = `<option value="" disabled selected>Select a session</option>`;
                }
                
                data.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.id;
                    opt.textContent = s.name;
                    sessionSelect.appendChild(opt);
                });
                
                if (data.length === 1) {
                    sessionSelect.value = data[0].id;
                }
            } else {
                sessionSelect.innerHTML = `<option value="" disabled selected>No active sessions available</option>`;
            }
        } catch(err) {
            console.error("Error fetching active sessions:", err);
            sessionSelect.innerHTML = `<option value="" disabled selected>Failed to load sessions</option>`;
        }
    }
});

// UI Alert Helper
function showAlert(formType, message, type) {
    const alertBox = document.getElementById(`${formType}-alert`);
    if (!alertBox) return;

    alertBox.classList.remove('hidden', 'bg-red-50', 'border-red-500', 'text-red-800', 'bg-emerald-50', 'border-emerald-500', 'text-emerald-800');
    
    if (type === 'error') {
        alertBox.classList.add('bg-red-50', 'border-red-500', 'text-red-800');
    } else if (type === 'success') {
        alertBox.classList.add('bg-emerald-50', 'border-emerald-500', 'text-emerald-800');
    }

    alertBox.textContent = message;
}

function hideAlert(formType) {
    const alertBox = document.getElementById(`${formType}-alert`);
    if (alertBox) {
        alertBox.classList.add('hidden');
    }
}

// Login Logic
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
            if (msg === 'Invalid login credentials') {
                msg = 'Invalid email or password.';
            }
            showAlert('login', msg, 'error');
        } finally {
            btn.textContent = 'Sign In';
            btn.disabled = false;
        }
    });
}

// Registration Logic
const registerForm = document.getElementById('register-form');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlert('register');

        const name = document.getElementById('reg-name').value.trim();
        const trade = 'COPA'; // Locked to COPA as per requirements
        const session_id = document.getElementById('reg-session-select').value;
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;
        const btn = document.getElementById('register-btn');

        if (!session_id) {
            showAlert('register', 'Please select an active session.', 'error');
            return;
        }

        // Pre-flight check
        if (password.length < 8) {
            showAlert('register', 'Password must be at least 8 characters long.', 'error');
            return;
        }

        if (!name || !email) {
            showAlert('register', 'Please fill in all required fields.', 'error');
            return;
        }

        btn.textContent = 'Registering...';
        btn.disabled = true;

        try {
            const { data, error } = await supabaseClient.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        full_name: name,
                        trade: trade,
                        session_id: session_id
                    }
                }
            });

            if (error) {
                throw error;
            }

            // On successful registration, prompt to check email
            showAlert('register', 'Registration successful! Please check your email to verify your account before logging in.', 'success');
            document.getElementById('register-form').reset();

        } catch (err) {
            console.error('Registration error:', err);
            let msg = err.message;
            if (msg.toLowerCase().includes('already registered')) {
                msg = 'This email is already registered. Please log in.';
            }
            showAlert('register', msg, 'error');
        } finally {
            btn.textContent = 'Register';
            btn.disabled = false;
        }
    });
}
