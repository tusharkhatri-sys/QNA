window.handleOtpInput = function(current, index) {
    current.value = current.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (current.value.length === 1 && index < 6) {
        current.nextElementSibling.focus();
    }
};

window.handleOtpBackspace = function(e, current, index) {
    if (e.key === 'Backspace' && current.value === '' && index > 1) {
        current.previousElementSibling.focus();
    }
    if (e.key === 'Enter') {
        joinLiveTest();
    }
};

let student = getLoggedInStudent();

const renderUI = () => {
    if (!student) return;
    const headerName = document.getElementById('header-student-name');
    if (headerName) headerName.textContent = student.name;
    
    const initialSpan = document.getElementById('badge-initial');
    if (initialSpan) initialSpan.textContent = student.name.charAt(0).toUpperCase();
    
    const studentNameInput = document.getElementById('student-name-input');
    if (studentNameInput) studentNameInput.value = student.name;
    
    const studentNameDisplay = document.getElementById('student-name-display');
    if (studentNameDisplay) studentNameDisplay.textContent = student.name;
    
    const studentEmail = document.getElementById('student-email');
    if (studentEmail) studentEmail.textContent = student.email;
    
    // Initialize Dashboard Features
    initStudentDashboard();
    
    // Attempt offline sync if network is available
    syncPendingSubmissions();
};

const initLogic = async () => {
    // SINGLE SOURCE OF TRUTH: Supabase session via boot lock
    const session = await ensureSupabaseAuthReady();

    if (!session) {
        console.warn('[Student] No active session. Redirecting to login.');
        window.location.replace('auth.html');
        return;
    }

    const sessionEmail = session.user.email;

    // Check if localStorage student data exists AND has required fields
    const cachedStudent = getLoggedInStudent();
    const isValidCache = cachedStudent && cachedStudent.email && cachedStudent.name;

    if (isValidCache) {
        // Cache is good — use it directly
        student = cachedStudent;
    } else {
        // Cache missing or incomplete — fetch from DB using verified session email
        console.log('[Student] Repopulating student data from DB for:', sessionEmail);
        const { data: studentDb, error: fetchErr } = await supabaseClient
            .from('students')
            .select('name, email')
            .eq('email', sessionEmail)
            .single();

        if (studentDb && !fetchErr) {
            student = { email: studentDb.email, name: studentDb.name };
            // Write back to localStorage with correct structure
            localStorage.setItem('loggedInStudent', JSON.stringify(student));
        } else {
            // DB fetch failed — build minimal object from session so UI doesn't break
            console.warn('[Student] DB fetch failed. Using session email as fallback.');
            student = {
                email: sessionEmail,
                name: session.user.user_metadata?.name || sessionEmail.split('@')[0]
            };
            localStorage.setItem('loggedInStudent', JSON.stringify(student));
        }
    }

    // Render UI — student is guaranteed to have email + name here
    renderUI();
};


if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLogic);
} else {
    initLogic();
}
    
const processResultsLogic = () => {
    const lastResults = localStorage.getItem('lastQuizResults');
    if (lastResults) {
        try {
            const res = JSON.parse(lastResults);
            
            // Save to history only if it's an admin live test
            if (!res.isPractice) {
                let history = [];
                try {
                    history = JSON.parse(localStorage.getItem('studentTestHistory') || '[]');
                } catch(e) {
                    console.error("Corrupted student test history. Resetting.", e);
                }
                history.push({
                    date: new Date().toISOString(),
                    score: res.score,
                    total: res.total,
                    percent: Math.round((res.score / res.total) * 100)
                });
                localStorage.setItem('studentTestHistory', JSON.stringify(history));
            }

            const scoreText = document.getElementById('result-score-text');
            if (scoreText) {
                scoreText.textContent = `${res.score} / ${res.total}`;
                
                const attemptedEl = document.getElementById('result-attempted');
                if (attemptedEl) attemptedEl.textContent = res.attempted;
                
                const totalEl = document.getElementById('result-total');
                if (totalEl) totalEl.textContent = res.total;
                
                const correctEl = document.getElementById('result-correct');
                if (correctEl) correctEl.textContent = res.score;
                
                const incorrectEl = document.getElementById('result-incorrect');
                if (incorrectEl) incorrectEl.textContent = res.incorrect;
                
                const modal = document.getElementById('results-modal');
                if (modal) modal.style.display = 'flex';
                
                // Confetti if score > 80%
                if ((res.score / res.total) >= 0.8 && window.confetti) {
                    setTimeout(() => {
                        try {
                            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
                        } catch (e) { console.warn("Confetti failed", e); }
                    }, 300);
                }
            }
        } catch(e) {
            console.error("Failed to parse lastQuizResults", e);
        }
        localStorage.removeItem('lastQuizResults');
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', processResultsLogic);
} else {
    processResultsLogic();
}

// Tab Switching & Analytics
function switchTab(tabName) {
    document.querySelectorAll('.section-view').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    document.getElementById(`section-${tabName}`).classList.add('active');
    document.getElementById(`nav-${tabName}`).classList.add('active');
    
    if (tabName === 'analytics') {
        renderAnalytics();
    }
}

function renderAnalytics() {
    let history = [];
    try {
        history = JSON.parse(localStorage.getItem('studentTestHistory') || '[]');
    } catch(e) {
        console.error("Corrupted student history", e);
    }
    
    const totalTestsEl = document.getElementById('analytics-total-tests');
    if (totalTestsEl) totalTestsEl.textContent = history.length;
    
    if (history.length === 0) return;
    
    let totalPercent = history.reduce((sum, h) => sum + h.percent, 0);
    const avgScoreEl = document.getElementById('analytics-avg-score');
    if (avgScoreEl) avgScoreEl.textContent = Math.round(totalPercent / history.length) + '%';
    
    // Render Chart
    const ctx = document.getElementById('performanceChart');
    if (!ctx) return;
    
    // Get last 10 tests
    const recent = history.slice(-10);
    const labels = recent.map((_, i) => `T${i+1}`);
    const data = recent.map(h => h.percent);
    
    if (window.perfChart) window.perfChart.destroy();
    
    try {
        window.perfChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Score %',
                    data: data,
                    borderColor: '#60a5fa',
                    backgroundColor: 'rgba(96, 165, 250, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.05)' } },
                    x: { grid: { display: false } }
                }
            }
        });
    } catch (e) {
        console.error("Failed to render performance chart", e);
    }
}

async function logout() {
    try {
        // CRITICAL: Sign out from Supabase so boot lock doesn't auto-redirect back in
        await supabaseClient.auth.signOut();
    } catch (e) {
        console.warn('[Logout] Supabase signOut failed silently:', e);
    }
    localStorage.removeItem('loggedInStudent');
    window.location.replace('auth.html');
}

function exitSafeBrowser() {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
        window.Capacitor.Plugins.App.exitApp();
    } else if (window.qnaBrowser && typeof window.qnaBrowser.closeApp === 'function') {
        window.qnaBrowser.closeApp();
    } else {
        alert("This feature only works in the QNA Safe Browser.");
    }
}

async function joinLiveTest() {
    const err = document.getElementById('join-error-msg');
    const errText = document.getElementById('join-error-text');
    if (!err) return;
    
    const showError = (msg) => {
        if(errText) errText.textContent = msg;
        else err.textContent = msg;
        err.classList.remove('hidden');
        err.style.display = "flex";
    };
    
    const hideError = () => {
        err.classList.add('hidden');
        err.style.display = "none";
    };

    let code = "";
    const otpInputs = document.querySelectorAll('#otp-container input');
    if (otpInputs.length === 6) {
        otpInputs.forEach(input => code += input.value);
    } else {
        const codeInput = document.getElementById('test-code-input');
        code = codeInput ? codeInput.value.trim().toUpperCase() : "";
    }
    
    code = code.trim().toUpperCase();
    
    if (code.length !== 6) { 
        showError("Please enter the complete 6-character code."); 
        return; 
    }

    try {
        hideError();
        const { data: dbTest, error } = await supabaseClient.from('tests').select('data').eq('code', code).single();
        if (error || !dbTest) {
            showError("Invalid Code. Please check and try again."); return;
        }

        const testData = { code, ...dbTest.data };
        if (testData.isActive === false || testData.isActive === 'stopped') {
            showError("This test is no longer active."); return;
        }
        if (testData.isActive === 'hold') {
            showError("This test is currently on hold by the admin."); return;
        }

        // Save session
        localStorage.removeItem('practiceMode');
        localStorage.removeItem('practiceTopic');
        localStorage.setItem('activeTest', JSON.stringify(testData));
        localStorage.setItem('activeTestStudentName', name);
        window.location.href = 'quiz.html';
    } catch (e) {
        console.error("Join live test failed", e);
        showError("Network error. Please try again.");
    } finally {
        const btn = document.querySelector('button[onclick="joinLiveTest()"]');
        if(btn) btn.textContent = 'Join Test';
    }
}

// Background Sync for pending offline submissions
async function syncPendingSubmissions() {
    if (!navigator.onLine) return;
    
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('pendingSubmission_')) {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                console.log(`Syncing offline submission for ${data.testCode}...`);
                
                const { error: updateErr } = await supabaseClient.rpc('submit_test_result', {
                    p_test_code: data.testCode,
                    p_payload: data.payload,
                    p_email_key: data.emailKey
                });
                
                if (updateErr) {
                    const { data: currentTest } = await supabaseClient.from('tests').select('submissions').eq('code', data.testCode).single();
                    let submissions = currentTest?.submissions || {};
                    submissions[data.emailKey] = data.payload;
                    await supabaseClient.from('tests').update({ submissions }).eq('code', data.testCode);
                }
                
                localStorage.removeItem(key);
                console.log(`Successfully synced ${key}`);
            } catch (e) {
                console.error(`Failed to sync pending submission ${key}:`, e);
            }
        }
    }
}
window.addEventListener('online', syncPendingSubmissions);


function startLocalPractice(mode) {
    if (mode === 'topic') {
        let options = QUESTIONS_DATA.map(t => `<button class="btn btn-secondary" style="margin-bottom:10px; width:100%; text-align:left;" onclick="launchTopicPractice('${t.topic}')">${t.topic} (${t.questions.length} Qs)</button>`).join('');
        
        let modal = document.createElement('div');
        modal.id = 'topic-select-modal';
        modal.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.8); backdrop-filter:blur(5px); z-index:1000; display:flex; align-items:center; justify-content:center; padding:20px;";
        modal.innerHTML = `
            <div style="background:var(--bg-card); padding:30px; border-radius:20px; border:1px solid var(--border); width:100%; max-width:400px; max-height:80vh; display:flex; flex-direction:column;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h3 style="font-size:1.2rem; font-weight:700;">Select a Topic</h3>
                    <button onclick="document.getElementById('topic-select-modal').remove()" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1.5rem;">&times;</button>
                </div>
                <div style="overflow-y:auto; flex-1; padding-right:10px;">
                    ${options}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        return;
    }
    // EXPLICITLY CLEAR LIVE TEST STATE
    localStorage.removeItem('activeTest');
    localStorage.removeItem('activeTestStudentName');
    
    localStorage.setItem('practiceMode', mode);
    window.location.href = 'quiz.html';
}

function launchTopicPractice(topic) {
    // EXPLICITLY CLEAR LIVE TEST STATE
    localStorage.removeItem('activeTest');
    localStorage.removeItem('activeTestStudentName');
    
    localStorage.setItem('practiceMode', 'topic');
    localStorage.setItem('practiceTopic', topic);
    window.location.href = 'quiz.html';
}

// Gamification and Extra Features
async function initStudentDashboard() {
    if(!student) return;
    
    // 1. Fetch Streak
    try {
        const { data: sData, error } = await supabaseClient.from('students').select('current_streak, session').eq('email', student.email).single();
        if (error) throw error;
        if(sData && document.getElementById('header-streak')) {
            document.getElementById('header-streak').textContent = `${sData.current_streak || 0} Day Streak`;
            student.session = sData.session; // Update local session
        }
    } catch(e) {
        console.error("Failed to load streak data", e);
    }
    
    // 2. Fetch Wall of Fame
    try {
        const { data: wof, error } = await supabaseClient.from('toppers_wall').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        const container = document.getElementById('wof-container');
        if(wof && wof.length > 0 && container) {
            container.innerHTML = wof.map(w => `
                <div class="min-w-[280px] bg-slate-800/50 border border-white/10 rounded-2xl p-5 flex flex-col items-center snap-center hover:bg-slate-800 transition-all">
                    <img src="${w.photo_url}" class="w-16 h-16 rounded-full border-2 border-yellow-500 mb-3 object-cover shadow-[0_0_15px_rgba(234,179,8,0.3)]">
                    <h4 class="font-bold text-white text-lg">${w.student_name}</h4>
                    <p class="text-xs text-slate-400 mb-2">${w.session}</p>
                    <div class="bg-yellow-500/10 text-yellow-500 font-bold px-3 py-1 rounded-full text-xs mb-2 border border-yellow-500/20">${w.achievement_tag}</div>
                    <p class="text-xl font-black text-white">${w.ncvt_percentage}% <span class="text-[10px] text-slate-500 font-normal uppercase">NCVT</span></p>
                </div>
            `).join('');
        } else if (container) {
            container.innerHTML = '<div class="py-10 text-center text-slate-400 w-full italic">No superstars yet!</div>';
        }
    } catch(e) {
        console.error("Failed to fetch Wall of Fame", e);
        const container = document.getElementById('wof-container');
        if (container) {
            container.innerHTML = `
                <div class="w-full py-8 flex flex-col items-center justify-center text-red-400 bg-red-500/10 border border-red-500/20 rounded-2xl">
                    <p class="mb-3 font-bold text-sm">Failed to load Wall of Fame data.</p>
                    <button onclick="window.location.reload()" class="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-white text-xs font-bold rounded-lg transition-all">Refresh Page</button>
                </div>
            `;
        }
    }
    
    // 3. Listen for Announcements
    supabaseClient.channel('announcements').on('broadcast', { event: 'new_notice' }, (payload) => {
        const data = payload.payload;
        const currentSession = typeof getCurrentSession === 'function' ? getCurrentSession() : 'All';
        if(data.target_session === 'All' || data.target_session === currentSession || data.target_session === student.session) {
            const bar = document.getElementById('announcement-bar');
            const txt = document.getElementById('announcement-text');
            if(bar && txt) {
                txt.textContent = data.message;
                bar.classList.remove('-translate-y-full');
            }
        }
    }).subscribe();
    
    // 4. Fetch Alumni Records
    fetchAlumniRecords();
    
    // 5. Initialize Native Push Notifications (Capacitor)
    initPushNotifications();
}

// --- Native Push Notifications (Capacitor) ---
async function initPushNotifications() {
    try {
        if (!window.Capacitor || !window.Capacitor.Plugins || !window.Capacitor.Plugins.PushNotifications) {
            console.log("Push notifications not supported in this environment (likely web).");
            return;
        }

        const PushNotifications = window.Capacitor.Plugins.PushNotifications;
        
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive !== 'granted') {
            permStatus = await PushNotifications.requestPermissions();
        }
        
        if (permStatus.receive === 'granted') {
            await PushNotifications.register();
            console.log("Push registration triggered.");
        }

        // Defensively capture the token
        PushNotifications.addListener('registration', async (token) => {
            try {
                if (!token || !token.value) throw new Error("Invalid token received from OS");
                const currentStudent = getLoggedInStudent();
                if (!currentStudent || !currentStudent.email) return;

                console.log("Updating FCM token for:", currentStudent.email);
                
                // Strictly targeting 'students' table
                const { error } = await supabaseClient.from('students')
                    .update({ fcm_token: token.value })
                    .eq('email', currentStudent.email);
                    
                if (error) throw error;
                console.log("FCM Token successfully registered in DB.");
            } catch (dbErr) {
                console.error("Silent failure intercepted: DB Token Update Failed.", dbErr);
            }
        });

        PushNotifications.addListener('registrationError', (error) => {
            console.warn("OS Registration Error:", error);
        });

        // Defensive foreground notification listener
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
            try {
                const bar = document.getElementById('announcement-bar');
                const txt = document.getElementById('announcement-text');
                if (bar && txt && notification) {
                    txt.textContent = `${notification.title || 'Notice'}: ${notification.body || ''}`;
                    bar.classList.remove('-translate-y-full');
                    setTimeout(() => {
                        try { bar.classList.add('-translate-y-full'); } catch(e){}
                    }, 10000);
                }
            } catch (uiErr) {
                console.error("Foreground UI update failed", uiErr);
            }
        });

    } catch (fatalErr) {
        console.error("Push Notification initialization fatally blocked to prevent crash.", fatalErr);
    }
}

async function fetchAlumniRecords() {
    const table = document.getElementById('alumni-table-body');
    if(!table) return;
    try {
        let history = [];
        try {
            history = JSON.parse(localStorage.getItem('studentTestHistory') || '[]');
        } catch (e) {
            console.error("Corrupted studentTestHistory in localStorage", e);
        }
        
        if(history.length === 0) {
            table.innerHTML = `<tr><td colspan="3" class="py-8 text-center text-slate-500 italic">No past records found.</td></tr>`;
            return;
        }
        table.innerHTML = history.reverse().map(h => {
            const d = new Date(h.date);
            return `
            <tr class="group hover:bg-white/[0.02] transition-all">
                <td class="py-4 text-slate-400 text-sm">${d.toLocaleDateString()}</td>
                <td class="font-bold text-white">Mock Test</td>
                <td class="font-black ${h.percent >= 80 ? 'text-green-400' : (h.percent >= 50 ? 'text-blue-400' : 'text-red-400')}">${h.percent}%</td>
            </tr>
            `;
        }).join('');
    } catch(e) {
        console.error("Failed to render alumni records", e);
        table.innerHTML = `
            <tr>
                <td colspan="3" class="py-8 text-center">
                    <p class="text-red-400 text-sm font-bold mb-3">Error loading records.</p>
                    <button onclick="window.location.reload()" class="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-white text-xs font-bold rounded-lg transition-all">Refresh Page</button>
                </td>
            </tr>
        `;
    }
}