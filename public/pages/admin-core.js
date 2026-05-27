// admin-core.js - Consolidated Logic for Admin Suite

// --- SECURITY CHECK ---
if (localStorage.getItem('admin_auth') !== 'true' && !window.location.href.includes('admin-login.html')) {
    window.location.href = 'admin-login.html';
}

let activeProctoring = {};

// --- SHARED UTILS ---
function togglePassword(id) {
    const el = document.getElementById(id);
    if (el.dataset.revealed === 'true') {
        el.textContent = '••••••••';
        el.dataset.revealed = 'false';
    } else {
        el.textContent = el.dataset.pass;
        el.dataset.revealed = 'true';
    }
}

function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// --- DASHBOARD LOGIC ---
async function initDashboard() {
    if (!document.getElementById('trendsChart')) return;
    
    // 1. Fetch Real Stats from Supabase
    try {
        // Total Students
        const { count: studentCount } = await supabaseClient.from('students').select('*', { count: 'exact', head: true });
        document.getElementById('stat-students').textContent = studentCount || 0;

        // Total Questions
        document.getElementById('stat-questions').textContent = typeof QUESTIONS_DATA !== 'undefined' ? 
            QUESTIONS_DATA.reduce((acc, t) => acc + t.questions.length, 0) : '0';

        // Live Sessions & Recent Activity
        const { data: tests, error: testsError } = await supabaseClient.from('tests').select('*').order('created_at', { ascending: false });
        if (testsError) throw testsError;

        if (tests) {
            let liveCount = 0;
            tests.forEach(t => {
                if (t.data && t.data.liveStudents) {
                    liveCount += Object.keys(t.data.liveStudents).length;
                }
            });
            document.getElementById('stat-live').textContent = liveCount;

            // Populate Recent Feed
            const feed = document.getElementById('recent-tests');
            if (feed) {
                const recent = tests.slice(0, 5);
                if (recent.length > 0) {
                    feed.innerHTML = recent.map(t => `
                        <div class="p-4 bg-white/5 rounded-2xl border border-white/5 group hover:border-blue-500/30 transition-all cursor-pointer">
                            <div class="flex justify-between items-start mb-1">
                                <h5 class="text-sm font-bold text-white truncate">${t.data.name}</h5>
                                <span class="text-[9px] font-black px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded-full uppercase">${t.code}</span>
                            </div>
                            <p class="text-[10px] text-slate-500 font-medium">${(t.data.students || []).length} Submissions</p>
                        </div>
                    `).join('');
                } else {
                    feed.innerHTML = `<p class="text-xs text-slate-500 text-center py-4">No recent activity</p>`;
                }
            }
        }
    } catch (err) {
        console.error('Dashboard init error:', err);
    }

    // 2. Chart.js Trends
    const ctx = document.getElementById('trendsChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            datasets: [{
                label: 'Exam Attendance',
                data: [12, 19, 3, 5, 2, 3], // Static for now as historical data isn't in DB yet
                borderColor: '#3b82f6',
                tension: 0.4,
                fill: true,
                backgroundColor: 'rgba(59, 130, 246, 0.1)'
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: { y: { grid: { color: 'rgba(255,255,255,0.05)' } }, x: { grid: { display: false } } }
        }
    });

    // 3. Supabase Realtime
    if (window.adminDashboardSub) supabaseClient.removeChannel(window.adminDashboardSub);
    window.adminDashboardSub = supabaseClient.channel('admin_dashboard_realtime')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tests' }, payload => {
            const data = payload.new.data;
            if (data && data.liveStudents) {
                Object.values(data.liveStudents).forEach(s => {
                    activeProctoring[s.studentEmail || s.studentName] = {
                        name: s.studentName,
                        email: s.studentEmail,
                        testCode: payload.new.code,
                        answered: s.answered,
                        total: s.total,
                        progress: `${s.answered}/${s.total}`,
                        isMinimized: false
                    };
                });
                renderLiveGrid();
            }
        }).subscribe();
}

function renderLiveGrid() {
    const grid = document.getElementById('live-grid');
    if (!grid) return;
    
    const entries = Object.values(activeProctoring);
    if (entries.length === 0) {
        grid.innerHTML = '<p class="text-xs text-slate-500">No active students.</p>';
        return;
    }

    grid.innerHTML = entries.map(s => `
        <div class="glass-card p-4 rounded-2xl border ${s.isMinimized ? 'border-red-500/50 bg-red-500/5' : 'border-white/5'}">
            <div class="flex justify-between items-start mb-4">
                <div>
                    <p class="font-bold text-sm">${s.name || 'Unknown'}</p>
                    <p class="text-[10px] text-slate-500 uppercase">${s.email || ''}</p>
                    <p class="text-[10px] text-blue-400 font-bold mt-1">Answered: ${s.answered} / ${s.total}</p>
                </div>
                ${s.isMinimized ? '<span class="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded font-black">MINIMIZED</span>' : '<span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>'}
            </div>
            <div class="space-y-2">
                <div class="flex justify-between text-[10px] font-bold">
                    <span>PROGRESS</span>
                    <span>${s.total > 0 ? Math.round((s.answered/s.total)*100) : 0}%</span>
                </div>
                <div class="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div class="h-full bg-blue-500 transition-all duration-500" style="width: ${s.total > 0 ? (s.answered/s.total)*100 : 0}%"></div>
                </div>
            </div>
        </div>
    `).join('');
}

// --- TEST MANAGER LOGIC ---
let currentStep = 1;
let testConfig = { topics: {} };

async function initTestManager() {
    renderStep();
    
    // Fetch and Render Existing Tests
    const list = document.getElementById('tests-list');
    if (!list) return;

    try {
        let { data: tests, error } = await supabaseClient.from('tests').select('*');
        if (error) throw error;

        // Status Filter Logic
        const statusFilter = document.getElementById('status-filter')?.value || 'active';
        if (tests) {
            if (statusFilter === 'active') {
                tests = tests.filter(t => t.data.isActive !== 'archived');
            } else if (statusFilter === 'archived') {
                tests = tests.filter(t => t.data.isActive === 'archived');
            }
        }

        if (!tests || tests.length === 0) {
            list.innerHTML = `<div class="py-20 text-center text-slate-500 italic">No tests found for this status.</div>`;
            return;
        }

        // Sort in JavaScript since created_at column doesn't exist
        tests.sort((a, b) => new Date(b.data.createdAt || 0) - new Date(a.data.createdAt || 0));

        list.innerHTML = tests.map(t => {
            const isArchived = t.data.isActive === 'archived';
            const statusColor = isArchived ? 'bg-slate-500/10 text-slate-500 border-slate-500/20' :
                                (t.data.isActive === 'active' || t.data.isActive === true) ? 'bg-green-500/10 text-green-500 border-green-500/20' : 
                                t.data.isActive === 'hold' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : 
                                'bg-red-500/10 text-red-500 border-red-500/20';
            const statusText = isArchived ? 'ARCHIVED' :
                               (t.data.isActive === true || t.data.isActive === 'active') ? 'ACTIVE' : 
                               (t.data.isActive === 'hold' ? 'PAUSED' : 'STOPPED');
                               
            return `
            <div class="glass-card p-6 rounded-3xl flex items-center justify-between group hover:border-blue-500/30 transition-all cursor-pointer">
                <div class="flex items-center gap-6" onclick="viewResults('${t.code}')">
                    <div class="w-14 h-14 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-500 font-black text-lg">
                        ${t.code}
                    </div>
                    <div>
                        <div class="flex items-center gap-2">
                            <h4 class="font-bold text-white">${escapeHTML(t.data.name)}</h4>
                            <button onclick="event.stopPropagation(); toggleTestStatus('${t.code}', '${t.data.isActive}')" class="text-[9px] font-black px-2 py-0.5 rounded-full border ${statusColor} hover:opacity-80 uppercase transition-all">
                                ${statusText}
                            </button>
                        </div>
                        <p class="text-xs text-slate-500 mt-1">${t.data.createdAt ? new Date(t.data.createdAt).toLocaleDateString() : 'N/A'} | ${t.data.duration} Mins</p>
                    </div>
                </div>
                <div class="flex items-center gap-8">
                    <div class="text-center" onclick="viewResults('${t.code}')">
                        <p class="text-[10px] font-black text-slate-500 uppercase">Students</p>
                        <p class="font-bold">${(t.data.students || []).length}</p>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="viewResults('${t.code}')" class="p-2 bg-white/5 rounded-xl text-slate-400 hover:text-blue-400 transition-all" title="View Results"><i data-lucide="bar-chart-2" class="w-5 h-5"></i></button>
                        ${!isArchived ? `<button onclick="deleteTest('${t.code}')" class="p-2 bg-white/5 rounded-xl text-slate-400 hover:text-red-500 transition-all" title="Archive Test"><i data-lucide="archive" class="w-5 h-5"></i></button>` : ''}
                    </div>
                </div>
            </div>
        `}).join('');
        lucide.createIcons();
    } catch (err) {
        console.error('Tests fetch error:', err);
        list.innerHTML = `<div class="py-20 text-center text-red-500 italic">Error loading tests. Check console.</div>`;
    }
}

async function toggleTestStatus(code, currentStatus) {
    if (currentStatus === 'archived') {
        alert('Archived tests cannot be toggled.');
        return;
    }

    let newStatus = 'active';
    if (currentStatus === 'active' || currentStatus === true) newStatus = 'hold';
    else if (currentStatus === 'hold') newStatus = 'stopped';
    else newStatus = 'active';

    try {
        const { data: dbData } = await supabaseClient.from('tests').select('data').eq('code', code).single();
        if (dbData) {
            dbData.data.isActive = newStatus;
            await supabaseClient.from('tests').update({ data: dbData.data }).eq('code', code);
            initTestManager();
        }
    } catch (err) {
        alert('Failed to update status');
        console.error(err);
    }
}

async function deleteTest(code) {
    if (!confirm(`Are you sure you want to archive test ${code}? Archiving will close active sessions and move it out of the active list.`)) return;
    try {
        const { data: dbData } = await supabaseClient.from('tests').select('data').eq('code', code).single();
        if (dbData) {
            dbData.data.isActive = 'archived';
            await supabaseClient.from('tests').update({ data: dbData.data }).eq('code', code);
            initTestManager();
        }
    } catch (err) {
        alert('Failed to archive test');
        console.error(err);
    }
}

async function viewResults(code) {
    document.getElementById('results-title').textContent = `Results for ${code}`;
    document.getElementById('results-subtitle').textContent = 'Loading...';
    document.getElementById('results-table-body').innerHTML = '<tr><td colspan="4" class="py-10 text-center text-slate-500">Loading...</td></tr>';
    openModal('results-modal');

    try {
        const { data: dbData } = await supabaseClient.from('tests').select('data').eq('code', code).single();
        if (dbData && dbData.data.students) {
            const students = dbData.data.students;
            document.getElementById('results-subtitle').textContent = `${students.length} submissions found.`;
            
            if (students.length === 0) {
                document.getElementById('results-table-body').innerHTML = '<tr><td colspan="4" class="py-10 text-center text-slate-500 italic">No submissions yet.</td></tr>';
                return;
            }

            // Sort by score descending
            students.sort((a, b) => b.score - a.score);

            document.getElementById('results-table-body').innerHTML = students.map(s => `
                <tr class="group hover:bg-white/[0.02] transition-all">
                    <td class="py-4 border-b border-white/5">
                        <p class="font-bold text-white">${escapeHTML(s.studentName || 'Unknown')}</p>
                    </td>
                    <td class="py-4 border-b border-white/5 text-sm text-slate-400">${escapeHTML(s.studentEmail || '')}</td>
                    <td class="py-4 border-b border-white/5 font-bold ${s.score >= (dbData.data.passScore || 40) ? 'text-green-500' : 'text-red-500'}">${s.score} / ${s.total}</td>
                    <td class="py-4 border-b border-white/5 text-sm text-slate-400 text-right">${new Date(s.submittedAt).toLocaleString()}</td>
                </tr>
            `).join('');
        } else {
            document.getElementById('results-table-body').innerHTML = '<tr><td colspan="4" class="py-10 text-center text-slate-500 italic">No submissions yet.</td></tr>';
        }
    } catch (err) {
        console.error('Error fetching results:', err);
        document.getElementById('results-table-body').innerHTML = '<tr><td colspan="4" class="py-10 text-center text-red-500">Failed to load results.</td></tr>';
    }
}

function renderStep() {
    const content = document.getElementById('stepper-content');
    if (!content) return;

    if (currentStep === 1) {
        content.innerHTML = `
            <div class="space-y-6">
                <div>
                    <label class="block text-xs font-black text-slate-500 mb-2 uppercase tracking-widest">Test Title</label>
                    <input type="text" id="t-name" class="w-full bg-slate-800/50 border border-white/5 rounded-2xl p-4 outline-none focus:border-blue-500" placeholder="e.g. Mid-term Assessment 2026">
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-black text-slate-500 mb-2 uppercase tracking-widest">Duration (Mins)</label>
                        <input type="number" id="t-time" class="w-full bg-slate-800/50 border border-white/5 rounded-2xl p-4 outline-none" value="60">
                    </div>
                    <div>
                        <label class="block text-xs font-black text-slate-500 mb-2 uppercase tracking-widest">Passing Score (%)</label>
                        <input type="number" id="t-pass" class="w-full bg-slate-800/50 border border-white/5 rounded-2xl p-4 outline-none" value="40">
                    </div>
                </div>
            </div>
        `;
    } else if (currentStep === 2) {
        const topicsHTML = (typeof QUESTIONS_DATA !== 'undefined' && QUESTIONS_DATA.length > 0)
            ? `
                <div class="p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl mb-4 flex items-center justify-between">
                    <div>
                        <h4 class="font-bold text-purple-400">Random Mix from All Topics</h4>
                        <p class="text-[10px] text-slate-400">Specify total questions to randomly pick across everything.</p>
                    </div>
                    <input type="number" id="random-total-count" placeholder="Total Qs" class="w-24 bg-slate-800 border border-white/10 rounded-lg p-2 text-sm text-center focus:border-purple-500 outline-none">
                </div>
                <div class="text-center text-xs font-bold text-slate-500 mb-4 tracking-widest uppercase">-- OR PICK BY TOPIC --</div>
                <div class="flex justify-end mb-2"><button onclick="document.querySelectorAll('.topic-count').forEach(tc => { tc.value = tc.max; document.getElementById('random-total-count').value = ''; })" class="px-4 py-2 bg-blue-600/20 text-blue-400 rounded-xl text-xs font-bold hover:bg-blue-600/40 transition-all cursor-pointer">Select All Max Questions</button></div>
              ` + QUESTIONS_DATA.map(t => `
                <div class="topic-row flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div class="flex items-center gap-4">
                        <div>
                            <p class="topic-name text-sm font-bold">${t.topic}</p>
                            <p class="text-[10px] text-slate-500">${t.questions.length} Questions Available</p>
                        </div>
                    </div>
                    <input type="number" placeholder="Pick N" min="0" max="${t.questions.length}" class="topic-count w-20 bg-slate-800 border border-white/10 rounded-lg p-2 text-sm text-center focus:border-blue-500 outline-none">
                </div>
            `).join('')
            : '<p class="text-slate-500 text-center py-8">Question bank not loaded. Please refresh.</p>';
        content.innerHTML = `<div class="space-y-4 max-h-[400px] overflow-y-auto pr-2">${topicsHTML}</div>`;
    } else {
        content.innerHTML = `
            <div class="space-y-6">
                <div class="p-6 bg-blue-600/10 rounded-2xl border border-blue-500/20">
                    <h4 class="font-bold text-blue-400 mb-2">Shuffle Protocol Enabled</h4>
                    <p class="text-sm text-slate-400">Every student will receive a unique set of questions. Option order (A,B,C,D) will be randomized per session.</p>
                </div>
                <div class="flex items-center justify-between p-4 border border-white/5 rounded-2xl">
                    <span class="text-sm font-bold">Safe Browser Mode (Kiosk)</span>
                    <div class="w-12 h-6 bg-blue-600 rounded-full relative"><div class="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div></div>
                </div>
            </div>
        `;
    }

    // Update Headers
    document.querySelectorAll('.stepper-btn').forEach((btn, i) => {
        if (i + 1 === currentStep) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    document.getElementById('prev-btn').classList.toggle('hidden', currentStep === 1);
    document.getElementById('next-btn').textContent = currentStep === 3 ? 'Deploy' : 'Continue';
}

document.getElementById('next-btn')?.addEventListener('click', async () => {
    if (currentStep === 1) {
        testConfig.name = document.getElementById('t-name').value;
        testConfig.duration = document.getElementById('t-time').value;
        testConfig.passScore = document.getElementById('t-pass').value;
        currentStep++;
        renderStep();
    } else if (currentStep === 2) {
        const randomInput = document.getElementById('random-total-count');
        const randomCount = randomInput ? parseInt(randomInput.value) : 0;
        testConfig.topicConfig = {};
        
        if (randomCount > 0) {
            testConfig.isRandomMix = true;
            testConfig.randomTotal = randomCount;
        } else {
            testConfig.isRandomMix = false;
            testConfig.randomTotal = 0;
            let totalQ = 0;
            const rows = document.querySelectorAll('#stepper-content .topic-row');
            rows.forEach(row => {
                const topicEl = row.querySelector('.topic-name');
                const numEl = row.querySelector('.topic-count');
                const topic = topicEl ? topicEl.textContent.trim() : null;
                const count = numEl ? parseInt(numEl.value || 0) : 0;
                if (topic && count > 0) {
                    testConfig.topicConfig[topic] = count;
                    totalQ += count;
                }
            });
            
            if (totalQ === 0) {
                alert('Please select at least 1 question from topics OR enter a Random Mix Total.');
                return;
            }
        }
        currentStep++;
        renderStep();
    } else {
        // Deploy to Supabase
        const btn = document.getElementById('next-btn');
        btn.textContent = 'Deploying...';
        btn.disabled = true;

        try {
            const code = Math.random().toString(36).substring(2, 8).toUpperCase();
            const payload = {
                code: code,
                data: {
                    name: testConfig.name || 'Untitled Test',
                    duration: parseInt(testConfig.duration) || 60,
                    passScore: parseInt(testConfig.passScore) || 40,
                    topicConfig: testConfig.topicConfig,
                    isRandomMix: testConfig.isRandomMix,
                    randomTotal: testConfig.randomTotal,
                    createdAt: new Date().toISOString(),
                    isActive: 'active',
                    students: [],
                    liveStudents: {}
                }
            };

            const { error } = await supabaseClient.from('tests').insert(payload);
            if (error) throw error;

            alert('Assessment Deployed Successfully! Code: ' + code);
            closeModal('create-modal');
            initTestManager(); // Refresh list
        } catch (err) {
            console.error('Deployment error:', err);
            alert('Failed to deploy test: ' + err.message);
        } finally {
            btn.textContent = 'Deploy';
            btn.disabled = false;
        }
    }
});

document.getElementById('prev-btn')?.addEventListener('click', () => {
    if (currentStep > 1) {
        currentStep--;
        renderStep();
    }
});

// --- STUDENTS LIST LOGIC ---
async function initStudentsList() {
    const table = document.getElementById('student-table-body');
    if (!table) return;

    try {
        const { data: students, error } = await supabaseClient.from('students').select('*').order('created_at', { ascending: false });
        if (error) throw error;

        if (!students || students.length === 0) {
            table.innerHTML = `<tr><td colspan="5" class="px-8 py-10 text-center text-slate-500">No students registered yet.</td></tr>`;
            return;
        }

        table.innerHTML = students.map(s => `
            <tr class="group hover:bg-white/[0.02] transition-all">
                <td class="px-8 py-6">
                    <p class="font-bold text-white">${s.name || 'No Name'}</p>
                    <p class="text-xs text-slate-500">${s.email}</p>
                </td>
                <td class="px-8 py-6 text-sm font-medium text-slate-400">${s.trade || 'N/A'}</td>
                <td class="px-8 py-6 text-sm font-medium text-slate-400">${new Date(s.created_at).getFullYear()}</td>
                <td class="px-8 py-6">
                    <div class="flex items-center gap-3">
                        <span id="pass-${s.id}" data-pass="${s.password || '******'}" class="text-xs font-mono text-slate-500">••••••••</span>
                        <button onclick="togglePassword('pass-${s.id}')" class="text-slate-600 hover:text-blue-500"><i data-lucide="eye" class="w-4 h-4"></i></button>
                    </div>
                </td>
                <td class="px-8 py-6 text-right">
                    <button onclick="forceCloseApp('${s.email}', null)" class="p-2 text-slate-600 hover:text-red-500" title="Force Disconnect">
                        <i data-lucide="shield-off" class="w-5 h-5"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        lucide.createIcons();
    } catch (err) {
        console.error('Students fetch error:', err);
        table.innerHTML = `<tr><td colspan="5" class="px-8 py-10 text-center text-red-500">Error loading students.</td></tr>`;
    }
}

async function forceCloseApp(email, testCode) {
    if (!confirm(`Are you sure you want to force close the app for ${email}?`)) return;
    try {
        let codesToUpdate = testCode ? [testCode] : [];
        if (!testCode) {
            const { data: tests } = await supabaseClient.from('tests').select('code, data').eq('data->>isActive', 'active');
            if (tests) {
                for (let t of tests) {
                    if (t.data.liveStudents && (t.data.liveStudents[email] || Object.values(t.data.liveStudents).some(s => s.studentName === email))) {
                        codesToUpdate.push(t.code);
                    }
                }
            }
        }
        
        for (let code of codesToUpdate) {
            const { data: dbData } = await supabaseClient.from('tests').select('data').eq('code', code).single();
            if (dbData) {
                if (!dbData.data.forceClosedStudents) dbData.data.forceClosedStudents = [];
                if (!dbData.data.forceClosedStudents.includes(email)) {
                    dbData.data.forceClosedStudents.push(email);
                    await supabaseClient.from('tests').update({ data: dbData.data }).eq('code', code);
                }
            }
        }
        alert('Kill signal sent via database.');
    } catch(e) {
        console.error('Failed to force close:', e);
    }
}

function logout() {
    localStorage.removeItem('admin_auth');
    window.location.href = 'admin-login.html';
}

async function exportStudentsCSV() {
    const btn = document.querySelector('button[onclick="exportStudentsCSV()"]');
    if (btn) btn.textContent = "Exporting...";
    try {
        const { data, error } = await supabaseClient.from('students').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        
        let csv = "Name,Roll No,Trade,Year,Password,Created At\n";
        data.forEach(s => {
            csv += `"${s.name}","${s.roll_no}","${s.trade}","${s.year}","${s.plain_password}","${new Date(s.created_at).toLocaleString()}"\n`;
        });
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `qna_students_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error("Export failed", e);
        alert("Failed to export CSV.");
    }
    if (btn) btn.textContent = "Export CSV";
}
