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

function showAlert(message, type) {
    const alertBox = document.getElementById('register-alert');
    if (!alertBox) return;

    alertBox.classList.remove('hidden', 'bg-red-50', 'border-red-500', 'text-red-800', 'bg-emerald-50', 'border-emerald-500', 'text-emerald-800');
    alertBox.classList.add('block', 'border');
    
    if (type === 'error') {
        alertBox.classList.add('bg-red-50', 'border-red-500', 'text-red-800');
    } else if (type === 'success') {
        alertBox.classList.add('bg-emerald-50', 'border-emerald-500', 'text-emerald-800');
    }

    alertBox.textContent = message;
}

function hideAlert() {
    const alertBox = document.getElementById('register-alert');
    if (alertBox) {
        alertBox.classList.add('hidden');
        alertBox.classList.remove('block');
    }
}

// Registration Logic
const registerForm = document.getElementById('register-form');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlert();

        const name = document.getElementById('reg-name').value.trim();
        const session_id = document.getElementById('reg-session-select').value;
        const trade = document.getElementById('reg-trade').value;
        const dob = document.getElementById('reg-dob').value;
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;
        const btn = document.getElementById('register-btn');

        if (!name || !session_id || !trade || !email || !password || !dob) {
            showAlert('All fields including Date of Birth are required.', 'error');
            return;
        }

        // Pre-flight check
        if (password.length < 8) {
            showAlert('Password must be at least 8 characters long.', 'error');
            return;
        }

        if (!name || !email) {
            showAlert('Please fill in all required fields.', 'error');
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
                        session_id: session_id,
                        dob: dob
                    }
                }
            });

            if (error) {
                throw error;
            }

            // Also insert into public.students table so admin can see them
            // FIX BUG-003: Removed plain text password from being stored in the database.
            const { error: dbError } = await supabaseClient.from('students').insert([{
                name: name,
                email: email,
                trade: trade,
                session: session_id,
                dob: dob
            }]);

            if (dbError) {
                console.error('Warning: Failed to insert into students table', dbError);
                // We won't block registration, but this means admin won't see them in the custom table
            }

            // On successful registration
            window.location.href = 'thankyou.html';

        } catch (err) {
            console.error('Registration error:', err);
            let msg = err.message;
            if (msg.toLowerCase().includes('already registered')) {
                msg = 'This email is already registered.';
            }
            showAlert(msg, 'error');
        } finally {
            btn.textContent = 'Complete Registration';
            btn.disabled = false;
        }
    });
}
