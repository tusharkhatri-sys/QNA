const student = getLoggedInStudent();
if (!student) {
    window.location.href = 'auth.html';
} else {
    const headerName = document.getElementById('header-student-name');
    if (headerName) headerName.textContent = student.name;
    
    const initialSpan = document.getElementById('badge-initial');
    if (initialSpan) initialSpan.textContent = student.name.charAt(0).toUpperCase();
    
    document.getElementById('student-name-input').value = student.name;
    
    // Initialize Dashboard Features
    initStudentDashboard();
}
    
const lastResults = localStorage.getItem('lastQuizResults');
if (lastResults) {
    try {
        const res = JSON.parse(lastResults);
        
        // Save to history only if it's an admin live test
        if (!res.isPractice) {
            let history = JSON.parse(localStorage.getItem('studentTestHistory') || '[]');
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
            document.getElementById('result-attempted').textContent = res.attempted;
            document.getElementById('result-total').textContent = res.total;
            document.getElementById('result-correct').textContent = res.score;
            document.getElementById('result-incorrect').textContent = res.incorrect;
            
            document.getElementById('results-modal').style.display = 'flex';
            
            // Confetti if score > 80%
            if ((res.score / res.total) >= 0.8 && window.confetti) {
                setTimeout(() => {
                    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
                }, 300);
            }
        }
    } catch(e) {}
    localStorage.removeItem('lastQuizResults');
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
    let history = JSON.parse(localStorage.getItem('studentTestHistory') || '[]');
    document.getElementById('analytics-total-tests').textContent = history.length;
    
    if (history.length === 0) return;
    
    let totalPercent = history.reduce((sum, h) => sum + h.percent, 0);
    document.getElementById('analytics-avg-score').textContent = Math.round(totalPercent / history.length) + '%';
    
    // Render Chart
    const ctx = document.getElementById('performanceChart');
    if (!ctx) return;
    
    // Get last 10 tests
    const recent = history.slice(-10);
    const labels = recent.map((_, i) => `T${i+1}`);
    const data = recent.map(h => h.percent);
    
    if (window.perfChart) window.perfChart.destroy();
    
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
}

function logout() {
    localStorage.removeItem('loggedInStudent');
    window.location.href = 'landing.html';
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
    const name = document.getElementById('student-name-input').value.trim();
    const code = document.getElementById('test-code-input').value.trim().toUpperCase();
    const err = document.getElementById('join-error-msg');
    
    if (!name || !code) { err.textContent = "Please fill all fields."; err.style.display = "block"; return; }

    try {
        err.style.display = "none";
        const { data: dbTest, error } = await supabaseClient.from('tests').select('data').eq('code', code).single();
        if (error || !dbTest) {
            err.textContent = "Invalid Code."; err.style.display = "block"; return;
        }

        const testData = { code, ...dbTest.data };
        if (testData.isActive === false || testData.isActive === 'stopped') {
            err.textContent = "This test is no longer active."; err.style.display = "block"; return;
        }
        if (testData.isActive === 'hold') {
            err.textContent = "This test is currently on hold by the admin."; err.style.display = "block"; return;
        }

        // Save session
        localStorage.setItem('activeTest', JSON.stringify(testData));
        localStorage.setItem('activeTestStudentName', name);
        window.location.href = 'quiz.html';
    } catch (e) {
        console.error(e);
        err.textContent = "Could not connect to database."; err.style.display = "block";
    }
}

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
    localStorage.setItem('practiceMode', mode);
    window.location.href = 'quiz.html';
}

function launchTopicPractice(topic) {
    localStorage.setItem('practiceMode', 'topic');
    localStorage.setItem('practiceTopic', topic);
    window.location.href = 'quiz.html';
}

// Gamification and Extra Features
async function initStudentDashboard() {
    if(!student) return;
    
    // 1. Fetch Streak
    try {
        const { data: sData } = await supabaseClient.from('students').select('current_streak, session').eq('email', student.email).single();
        if(sData && document.getElementById('header-streak')) {
            document.getElementById('header-streak').textContent = `${sData.current_streak || 0} Day Streak`;
            student.session = sData.session; // Update local session
        }
    } catch(e) {}
    
    // 2. Fetch Wall of Fame
    try {
        const { data: wof } = await supabaseClient.from('toppers_wall').select('*').order('created_at', { ascending: false });
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
    } catch(e) {}
    
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
function initPushNotifications() {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.PushNotifications) {
        const PushNotifications = window.Capacitor.Plugins.PushNotifications;
        
        // Request Permission
        PushNotifications.requestPermissions().then(result => {
            if (result.receive === 'granted') {
                PushNotifications.register();
            }
        });

        // Capture Token and Update Supabase
        PushNotifications.addListener('registration', async (token) => {
            if (student && student.email) {
                try {
                    await supabaseClient.from('students').update({ fcm_token: token.value }).eq('email', student.email);
                } catch (error) {
                    console.error("Failed to update FCM token", error);
                }
            }
        });

        // Listen for foreground notifications
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
            const bar = document.getElementById('announcement-bar');
            const txt = document.getElementById('announcement-text');
            if (bar && txt) {
                txt.textContent = `${notification.title}: ${notification.body}`;
                bar.classList.remove('-translate-y-full');
                setTimeout(() => bar.classList.add('-translate-y-full'), 10000);
            }
        });
    }
}

async function fetchAlumniRecords() {
    const table = document.getElementById('alumni-table-body');
    if(!table) return;
    try {
        let history = JSON.parse(localStorage.getItem('studentTestHistory') || '[]');
        if(history.length === 0) {
            table.innerHTML = `<tr><td colspan="3" class="py-8 text-center text-slate-500 italic">No past records found.</td></tr>`;
            return;
        }
        table.innerHTML = history.reverse().map(h => {
            const d = new Date(h.date);
            return \`
            <tr class="group hover:bg-white/[0.02] transition-all">
                <td class="py-4 text-slate-400 text-sm">\${d.toLocaleDateString()}</td>
                <td class="font-bold text-white">Mock Test</td>
                <td class="font-black \${h.percent >= 80 ? 'text-green-400' : (h.percent >= 50 ? 'text-blue-400' : 'text-red-400')}">\${h.percent}%</td>
            </tr>
            \`;
        }).join('');
    } catch(e) {
        table.innerHTML = \`<tr><td colspan="3" class="py-8 text-center text-red-500">Failed to load records.</td></tr>\`;
    }
}