// admin-core.js - Consolidated Logic for Admin Suite

// --- SECURITY CHECK ---
if (localStorage.getItem('admin_auth') !== 'true' && !window.location.href.includes('admin-login.html')) {
    window.location.href = 'admin-login.html';
}

let activeProctoring = {};

// --- SHARED UTILS ---
function togglePassword(id) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.dataset.revealed === 'true') {
        el.textContent = '••••••••';
        el.dataset.revealed = 'false';
    } else {
        el.textContent = el.dataset.pass;
        el.dataset.revealed = 'true';
    }
}

function openModal(id) { 
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden'); 
}
function closeModal(id) { 
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden'); 
}

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
        const { data: tests, error: testsError } = await supabaseClient.from('tests').select('*');
        if (testsError) throw testsError;

        if (tests) {
            activeProctoring = {};
            tests.forEach(t => {
                if (t.data && t.data.liveStudents) {
                    Object.keys(t.data.liveStudents).forEach(emailKey => {
                        const s = t.data.liveStudents[emailKey];
                        if (s === null || s === 'null') return; // Clean Null Key Handling
                        
                        activeProctoring[emailKey] = {
                            name: s.studentName || s.name || 'Unknown',
                            email: emailKey,
                            testCode: t.code,
                            answered: s.answered || 0,
                            total: s.total || 0,
                            progress: `${s.answered || 0}/${s.total || 0}`,
                            isMinimized: false
                        };
                    });
                }
            });
            document.getElementById('stat-live').textContent = Object.keys(activeProctoring).length;

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
        
        const wofSession = document.getElementById('wof-session');
        if (wofSession && typeof fetchActiveSession === 'function') {
            wofSession.value = await fetchActiveSession();
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
            const tCode = payload.new.code;
            
            Object.keys(activeProctoring).forEach(k => {
                if (activeProctoring[k].testCode === tCode) delete activeProctoring[k];
            });
            
            if (data && data.liveStudents) {
                Object.keys(data.liveStudents).forEach(emailKey => {
                    const s = data.liveStudents[emailKey];
                    if (s === null || s === 'null') return; // Clean Null Key Handling
                    
                    activeProctoring[emailKey] = {
                        name: s.studentName || s.name || 'Unknown',
                        email: emailKey,
                        testCode: tCode,
                        answered: s.answered || 0,
                        total: s.total || 0,
                        progress: `${s.answered || 0}/${s.total || 0}`,
                        isMinimized: false
                    };
                });
            }
            
            const statLive = document.getElementById('stat-live');
            if (statLive) statLive.textContent = Object.keys(activeProctoring).length;
            renderLiveTable();
        }).subscribe();

    // Memory Leak Prevention: Cleanup when leaving page/closing dashboard
    window.addEventListener('beforeunload', () => {
        if (window.adminDashboardSub) supabaseClient.removeChannel(window.adminDashboardSub);
    });
}

function renderLiveTable() {
    const tbody = document.getElementById('live-monitoring-tbody');
    if (!tbody) return;

    const entries = Object.values(activeProctoring);
    if (entries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-500">No active test sessions found.</td></tr>';
        return;
    }

    tbody.innerHTML = entries.map(s => {
        const statusBadge = s.isMinimized 
            ? '<span class="px-2 py-1 bg-red-100 text-red-700 text-[10px] font-bold rounded-sm border border-red-200">MINIMIZED WARNING</span>'
            : '<span class="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-sm border border-emerald-200">ACTIVE & SECURE</span>';
        
        const progressColor = s.progress >= 100 ? 'bg-emerald-600' : 'bg-blue-600';

        return `
            <tr class="hover:bg-gray-50 transition-colors border-b border-gray-100">
                <td class="px-8 py-4">
                    <div class="font-bold text-slate-900">${s.name}</div>
                    <div class="text-[11px] text-slate-500">${s.email}</div>
                </td>
                <td class="px-8 py-4">
                    <span class="font-mono text-xs bg-gray-100 border border-gray-200 px-2 py-1 rounded-sm text-slate-700">${s.testCode}</span>
                </td>
                <td class="px-8 py-4 text-xs font-medium text-slate-600">
                    ${new Date(s.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </td>
                <td class="px-8 py-4">
                    <div class="flex items-center gap-3">
                        <div class="w-32 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div class="h-full ${progressColor}" style="width: ${s.progress}%"></div>
                        </div>
                        <span class="text-xs font-bold text-slate-700">${s.progress}%</span>
                    </div>
                </td>
                <td class="px-8 py-4">${statusBadge}</td>
                <td class="px-8 py-4 text-right">
                    <button onclick="forceCloseApp('${s.email}', '${s.testCode}')" class="px-4 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-lg font-bold text-xs flex items-center gap-2 ml-auto transition-colors">
                        <i data-lucide="shield-off" class="w-3.5 h-3.5"></i> Terminate
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function loadLiveSessions() {
    const tbody = document.getElementById('live-monitoring-tbody');
    if (!tbody) return;

    try {
        const { data: tests, error } = await supabaseClient.from('tests').select('*');
        if (error) throw error;

        activeProctoring = {};
        if (tests) {
            tests.forEach(t => {
                if (t.data && t.data.liveStudents) {
                    Object.keys(t.data.liveStudents).forEach(emailKey => {
                        const s = t.data.liveStudents[emailKey];
                        if (s === null || s === 'null') return;
                        
                        activeProctoring[emailKey] = {
                            name: s.studentName || s.name || 'Unknown',
                            email: emailKey,
                            testCode: t.code,
                            answered: s.answered || 0,
                            total: s.total || 0,
                            progress: s.total > 0 ? Math.round((s.answered/s.total)*100) : 0,
                            isMinimized: s.isMinimized || false,
                            startTime: s.startTime || new Date().toISOString()
                        };
                    });
                }
            });
        }
        
        renderLiveTable();

        // 3. Setup Realtime Subscription for Live Monitoring
        if (window.liveMonitoringSub) supabaseClient.removeChannel(window.liveMonitoringSub);
        window.liveMonitoringSub = supabaseClient.channel('live_monitoring_realtime')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tests' }, payload => {
                const data = payload.new.data;
                const tCode = payload.new.code;
                
                Object.keys(activeProctoring).forEach(k => {
                    if (activeProctoring[k].testCode === tCode) delete activeProctoring[k];
                });
                
                if (data && data.liveStudents) {
                    Object.keys(data.liveStudents).forEach(emailKey => {
                        const s = data.liveStudents[emailKey];
                        if (s === null || s === 'null') return; 
                        
                        activeProctoring[emailKey] = {
                            name: s.studentName || s.name || 'Unknown',
                            email: emailKey,
                            testCode: tCode,
                            answered: s.answered || 0,
                            total: s.total || 0,
                            progress: s.total > 0 ? Math.round((s.answered/s.total)*100) : 0,
                            isMinimized: s.isMinimized || false,
                            startTime: s.startTime || new Date().toISOString()
                        };
                    });
                }
                
                renderLiveTable();
            }).subscribe();

    } catch (err) {
        console.error("Live Monitoring Error:", err);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-red-500">Failed to load live telemetry. Check console.</td></tr>';
    }
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
        let query = supabaseClient.from('tests').select('*');
        const sessionFilter = document.getElementById('session-filter')?.value;
        if (sessionFilter && sessionFilter !== 'All') {
            query = query.eq('session', sessionFilter);
        }
        let { data: tests, error } = await query;
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
                <div class="flex items-center gap-6">
                    <div class="text-center">
                        <p class="text-[10px] font-black text-green-500/80 uppercase">Live</p>
                        <p class="font-bold text-green-400">${t.data.liveStudents ? Object.keys(t.data.liveStudents).length : 0}</p>
                    </div>
                    <div class="text-center" onclick="viewResults('${t.code}')">
                        <p class="text-[10px] font-black text-slate-500 uppercase">Students</p>
                        <p class="font-bold">${(t.data.students || []).length}</p>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="viewResults('${t.code}')" class="p-2 bg-white/5 rounded-xl text-slate-400 hover:text-blue-400 transition-all border border-transparent hover:border-blue-500/30" title="View Results"><i data-lucide="bar-chart-2" class="w-5 h-5"></i></button>
                        ${!isArchived ? `<button onclick="deleteTest('${t.code}')" class="p-2 bg-white/5 rounded-xl text-slate-400 hover:text-red-500 transition-all border border-transparent hover:border-red-500/30" title="Archive Test"><i data-lucide="archive" class="w-5 h-5"></i></button>` : ''}
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
    document.getElementById('results-table-body').innerHTML = '<tr><td colspan="5" class="py-10 text-center text-slate-500">Loading...</td></tr>';
    document.getElementById('live-results-section').classList.add('hidden');
    openModal('results-modal');

    try {
        const { data: dbData } = await supabaseClient.from('tests').select('data').eq('code', code).single();
        if (dbData) {
            // Render Live Students
            const liveStudents = dbData.data.liveStudents 
                ? Object.values(dbData.data.liveStudents).filter(s => s !== null && s !== 'null') 
                : [];
                
            if (liveStudents.length > 0) {
                document.getElementById('live-results-section').classList.remove('hidden');
                document.getElementById('live-results-table-body').innerHTML = liveStudents.map(s => `
                    <tr class="group hover:bg-white/[0.02] transition-all">
                        <td class="py-4 border-b border-white/5 font-bold text-white">${escapeHTML(s.studentName || s.name || 'Unknown')}</td>
                        <td class="py-4 border-b border-white/5 text-sm text-slate-400">${escapeHTML(s.studentEmail || '')}</td>
                        <td class="py-4 border-b border-white/5 font-bold text-green-400">${s.answered || 0} / ${s.total || 0} <span class="text-[10px] text-slate-500 font-normal ml-2">Attempted</span></td>
                        <td class="py-4 border-b border-white/5 text-sm text-slate-400 text-right">${s.joinedAt ? new Date(s.joinedAt).toLocaleTimeString() : 'N/A'}</td>
                    </tr>
                `).join('');
            }

            // Render Submitted Students
            if (dbData.data.students) {
                const students = dbData.data.students;
                window.currentTestStudents = students;
                window.currentTestCode = code;
                window.currentTestPassScore = dbData.data.passScore || 40;
                
                if (students.length === 0) {
                    document.getElementById('results-subtitle').textContent = `0 submissions found.`;
                    document.getElementById('results-table-body').innerHTML = '<tr><td colspan="5" class="py-10 text-center text-slate-500 italic">No submissions yet.</td></tr>';
                    return;
                }

                document.getElementById('results-subtitle').innerHTML = `${students.length} submissions found. <button onclick="exportTestResultsCSV()" class="ml-4 text-[10px] font-black uppercase px-3 py-1 bg-green-500/10 text-green-400 rounded hover:bg-green-500/20 transition-all border border-green-500/20 inline-flex items-center gap-1"><i data-lucide="download" class="w-3 h-3"></i> Export</button>`;
                setTimeout(() => lucide.createIcons(), 50);

                students.sort((a, b) => (b.score || 0) - (a.score || 0));

                document.getElementById('results-table-body').innerHTML = students.map((s, index) => `
                    <tr class="group hover:bg-white/[0.02] transition-all">
                        <td class="py-4 border-b border-white/5">
                            <p class="font-bold text-white">${escapeHTML(s.studentName || 'Unknown')}</p>
                        </td>
                        <td class="py-4 border-b border-white/5 text-sm text-slate-400">${escapeHTML(s.studentEmail || '')}</td>
                        <td class="py-4 border-b border-white/5 font-bold ${s.score >= (dbData.data.passScore || 40) ? 'text-green-500' : 'text-red-500'}">${s.score} / ${s.total}</td>
                        <td class="py-4 border-b border-white/5 text-sm text-slate-400 text-right">${new Date(s.submittedAt).toLocaleString()}</td>
                        <td class="py-4 border-b border-white/5 text-right">
                            ${s.detailedResults ? `<button onclick="viewDetailedResults(${index})" class="text-xs px-3 py-1 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/40 border border-blue-500/20 transition-all">Details</button>` : `<span class="text-xs text-slate-500">N/A</span>`}
                        </td>
                    </tr>
                `).join('');
                lucide.createIcons();
            } else {
                document.getElementById('results-table-body').innerHTML = '<tr><td colspan="5" class="py-10 text-center text-slate-500 italic">No submissions yet.</td></tr>';
            }
        }
    } catch (err) {
        console.error('Results fetch error:', err);
        document.getElementById('results-table-body').innerHTML = '<tr><td colspan="5" class="py-10 text-center text-red-500 italic">Error loading results.</td></tr>';
    }
}

function viewDetailedResults(studentIndex) {
    if (!window.currentTestStudents) return;
    const s = window.currentTestStudents[studentIndex];
    if (!s || !s.detailedResults) return;

    document.getElementById('detailed-student-name').textContent = s.studentName || 'Unknown';
    document.getElementById('detailed-student-score').textContent = `Score: ${s.score} / ${s.total} | Submitted: ${new Date(s.submittedAt).toLocaleString()}`;
    
    const list = document.getElementById('detailed-questions-list');
    list.innerHTML = s.detailedResults.map((dr, qIdx) => {
        const isCorrect = dr.studentAnswerIndex === dr.correctAnswerIndex;
        let optionsHtml = dr.options.map((opt, oIdx) => {
            let className = "p-2 rounded mt-1 text-sm ";
            if (oIdx === dr.correctAnswerIndex) className += "bg-green-500/20 text-green-400 border border-green-500/30 font-bold";
            else if (oIdx === dr.studentAnswerIndex) className += "bg-red-500/20 text-red-400 border border-red-500/30";
            else className += "bg-slate-800/50 text-slate-400 border border-white/5";
            
            return `<div class="${className}">${String.fromCharCode(65+oIdx)}. ${escapeHTML(opt)}</div>`;
        }).join('');
        
        return `
            <div class="p-4 rounded-xl border ${isCorrect ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'}">
                <p class="font-bold text-sm mb-2">Q${qIdx+1}: ${escapeHTML(dr.questionText)}</p>
                <div class="space-y-1">
                    ${optionsHtml}
                </div>
                ${dr.studentAnswerIndex === null ? '<p class="text-xs text-red-500 mt-2 font-bold">Unanswered</p>' : ''}
            </div>
        `;
    }).join('');
    
    openModal('detailed-results-modal');
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
            ` + QUESTIONS_DATA.map((t, idx) => `
                <div class="topic-row flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5" data-topic="${t.topic}">
                    <div class="flex items-center gap-4">
                        <div>
                            <p class="topic-name text-sm font-bold">${t.topic}</p>
                            <p class="text-[10px] text-slate-500">${t.questions.length} Questions Available</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <button onclick="openManualSelect(${idx})" class="text-xs font-bold px-3 py-2 rounded-lg bg-blue-600/10 text-blue-400 hover:bg-blue-600/30 transition-all border border-blue-500/20">Browse</button>
                        <input type="number" placeholder="Pick N" min="0" max="${t.questions.length}" class="topic-count w-20 bg-slate-800 border border-white/10 rounded-lg p-2 text-sm text-center focus:border-blue-500 outline-none">
                        <input type="hidden" class="topic-manual-data" value="">
                    </div>
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

document.addEventListener('DOMContentLoaded', () => {
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
                    const manualDataEl = row.querySelector('.topic-manual-data');
                    
                    const topic = topicEl ? topicEl.textContent.trim() : null;
                    const count = numEl ? parseInt(numEl.value || 0) : 0;
                    
                    let manualData = null;
                    if (manualDataEl && manualDataEl.value) {
                        try {
                            manualData = JSON.parse(manualDataEl.value);
                        } catch(e) {
                            console.error("Failed to parse manual data", e);
                        }
                    }
                    
                    if (topic) {
                        if (manualData && manualData.length > 0) {
                            testConfig.topicConfig[topic] = { mode: 'manual', indices: manualData };
                            totalQ += manualData.length;
                        } else if (count > 0) {
                            testConfig.topicConfig[topic] = count;
                            totalQ += count;
                        }
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
});

// --- STUDENTS LIST LOGIC ---
async function initStudentsList() {
    const table = document.getElementById('student-table-body');
    if (!table) return;

    try {
        let query = supabaseClient.from('students').select('*').order('created_at', { ascending: false });
        const sessionFilter = document.getElementById('session-filter')?.value;
        if (sessionFilter && sessionFilter !== 'All') {
            query = query.eq('session', sessionFilter);
        }
        const { data: students, error } = await query;
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

async function exportTestResultsCSV() {
    if (!window.currentTestStudents || !window.currentTestCode) return;
    try {
        let csv = "Student Name,Roll No/Email,Score,Total,Pass Status,Submitted At\n";
        window.currentTestStudents.forEach(s => {
            const isPass = (s.score || 0) >= (window.currentTestPassScore || 40) ? "PASS" : "FAIL";
            csv += `"${s.studentName || 'Unknown'}","${s.studentEmail || ''}",${s.score || 0},${s.total || 0},"${isPass}","${s.submittedAt ? new Date(s.submittedAt).toLocaleString() : 'N/A'}"\n`;
        });
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `qna_results_${window.currentTestCode}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error("Export test results failed", e);
        alert("Failed to export test results CSV.");
    }
}

// --- Manual Selection Logic ---
let currentManualTopicIdx = null;

function openManualSelect(topicIdx) {
    currentManualTopicIdx = topicIdx;
    const t = QUESTIONS_DATA[topicIdx];
    document.getElementById('manual-select-topic').textContent = t.topic;
    
    const row = document.querySelector(`.topic-row[data-topic="${t.topic}"]`);
    const manualInput = row.querySelector('.topic-manual-data');
    let selectedIndices = [];
    if (manualInput && manualInput.value) {
        try {
            selectedIndices = JSON.parse(manualInput.value);
        } catch(e) {
            console.error("Failed to parse manual indices", e);
        }
    }
    
    let html = '';
    t.questions.forEach((q, idx) => {
        const isChecked = selectedIndices.includes(idx) ? 'checked' : '';
        html += `
            <div class="flex items-start gap-4 p-4 bg-white/5 border border-white/10 rounded-xl hover:border-blue-500/30 transition-all cursor-pointer" onclick="const cb = this.querySelector('input[type=checkbox]'); cb.checked = !cb.checked; updateManualCount();">
                <input type="checkbox" class="manual-q-cb mt-1 cursor-pointer w-4 h-4 rounded" value="${idx}" ${isChecked} onclick="event.stopPropagation(); updateManualCount();">
                <div class="flex-1">
                    <p class="text-sm font-bold text-slate-200 mb-1">${q.q}</p>
                    ${q.q_hi ? `<p class="text-[10px] text-slate-400 mb-2">${q.q_hi}</p>` : ''}
                    <div class="grid grid-cols-2 gap-2 mt-2">
                        ${q.o.map((opt, oIdx) => `<div class="text-[10px] px-2 py-1 rounded bg-slate-800 ${oIdx === q.a ? 'border border-green-500/50 text-green-400' : 'text-slate-500'}">${opt}</div>`).join('')}
                    </div>
                </div>
            </div>
        `;
    });
    
    document.getElementById('manual-questions-list').innerHTML = html;
    updateManualCount();
    openModal('manual-select-modal');
}

function updateManualCount() {
    const count = document.querySelectorAll('.manual-q-cb:checked').length;
    document.getElementById('manual-selected-count').textContent = count + ' Selected';
}

function selectAllManual() {
    const cbs = document.querySelectorAll('.manual-q-cb');
    const allChecked = Array.from(cbs).every(cb => cb.checked);
    cbs.forEach(cb => cb.checked = !allChecked);
    updateManualCount();
}

function saveManualSelection() {
    if (currentManualTopicIdx === null) return;
    const t = QUESTIONS_DATA[currentManualTopicIdx];
    const selected = Array.from(document.querySelectorAll('.manual-q-cb:checked')).map(cb => parseInt(cb.value));
    
    const row = document.querySelector(`.topic-row[data-topic="${t.topic}"]`);
    const numEl = row.querySelector('.topic-count');
    const manualInput = row.querySelector('.topic-manual-data');
    const randomInput = document.getElementById('random-total-count');
    
    if (selected.length > 0) {
        manualInput.value = JSON.stringify(selected);
        numEl.value = selected.length;
        numEl.disabled = true;
        if (randomInput) randomInput.value = '';
    } else {
        manualInput.value = "";
        numEl.disabled = false;
    }
    
    closeModal('manual-select-modal');
}

// --- Gamification & Notifications ---
async function broadcastNotice() {
    const msgEl = document.getElementById('notice-msg');
    const sessionEl = document.getElementById('notice-session');
    const btn = document.getElementById('btn-broadcast');
    
    const message = msgEl.value.trim();
    const session = sessionEl.value;
    
    if (!message) return alert("Please type a message first.");
    
    btn.textContent = "Sending...";
    btn.disabled = true;
    
    try {
        // 1. Save to database
        const { error: dbErr } = await supabaseClient.from('announcements').insert({
            title: 'Important Notice',
            message: message,
            target_session: session,
            created_by: 'Admin_ITI'
        });
        if (dbErr) throw dbErr;
        
        // 2. Broadcast Realtime
        await supabaseClient.channel('announcements').send({
            type: 'broadcast',
            event: 'new_notice',
            payload: { message, target_session: session }
        });
        
        // 3. Trigger Firebase Push Notifications (Native Delivery)
        try {
            // Defensive fetching of valid FCM tokens from 'students' table
            let query = supabaseClient.from('students')
                .select('fcm_token')
                .not('fcm_token', 'is', null)
                .neq('fcm_token', ''); // Prevent empty strings

            if (session !== 'All') {
                query = query.eq('session', session);
            }
            
            const { data: tokensData, error: tokenError } = await query;
            if (tokenError) throw new Error(`Token fetch failed: ${tokenError.message}`);

            const validTokens = (tokensData || [])
                .map(t => t.fcm_token)
                .filter(t => typeof t === 'string' && t.length > 5); // Basic validation

            if (validTokens.length > 0) {
                console.log(`Dispatching push to ${validTokens.length} devices.`);
                const pushRes = await fetch('/api/send-notification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: 'New Notice from Admin',
                        message: message,
                        fcm_tokens: validTokens
                    })
                });

                if (!pushRes.ok) {
                    console.warn("Push API returned non-200 status:", pushRes.status);
                }
            } else {
                console.log("No registered devices found for broadcast.");
            }
        } catch (pushErr) {
            console.error("Push Notification dispatch handled defensively:", pushErr);
        }
        
        msgEl.value = "";
        alert("Broadcast sent successfully!");
    } catch (e) {
        console.error("Notice broadcast failed:", e);
        alert("Failed to broadcast notice.");
    } finally {
        btn.textContent = "Broadcast";
        btn.disabled = false;
    }
}

async function addToWallOfFame() {
    const name = document.getElementById('wof-name').value.trim();
    const session = document.getElementById('wof-session').value.trim();
    const percent = document.getElementById('wof-percent').value;
    const badge = document.getElementById('wof-badge').value.trim();
    const photo = document.getElementById('wof-photo').value.trim() || 'https://ui-avatars.com/api/?background=random&color=fff&name=' + encodeURIComponent(name);
    
    if (!name || !session || !percent || !badge) return alert("Please fill all required fields.");
    
    const btn = document.getElementById('btn-wof');
    btn.textContent = "Publishing...";
    btn.disabled = true;
    
    try {
        const { error } = await supabaseClient.from('toppers_wall').insert({
            student_name: name,
            session: session,
            ncvt_percentage: parseFloat(percent),
            achievement_tag: badge,
            photo_url: photo
        });
        
        if (error) throw error;
        
        alert(`Successfully added ${name} to Wall of Fame!`);
        document.getElementById('wof-name').value = '';
        document.getElementById('wof-percent').value = '';
        document.getElementById('wof-badge').value = '';
        document.getElementById('wof-photo').value = '';
    } catch (e) {
        console.error("Wall of fame error:", e);
        alert("Failed to add to Wall of Fame.");
    } finally {
        btn.textContent = "Publish to Dashboard";
        btn.disabled = false;
    }
}

// --- SESSION MANAGEMENT LOGIC ---

async function populateSessionDropdown(dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;

    const sessions = await fetchAllSessions();
    const activeSession = await fetchActiveSession();

    let optionsHtml = `<option value="All">All Sessions</option>`;
    sessions.forEach(s => {
        const isSelected = s.name === activeSession ? 'selected' : '';
        optionsHtml += `<option value="${s.name}" ${isSelected}>${s.name} ${s.is_active ? '(Active)' : ''}</option>`;
    });

    dropdown.innerHTML = optionsHtml;
}

async function initSessionManager() {
    const tbody = document.getElementById('session-table-body');
    if (!tbody) return;

    const sessions = await fetchAllSessions();
    if (sessions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-500">No sessions found.</td></tr>`;
        return;
    }

    tbody.innerHTML = sessions.map(s => {
        const isActive = s.is_active;
        const statusBadge = isActive 
            ? `<span class="bg-green-500/10 text-green-500 border border-green-500/20 px-2 py-1 rounded-md text-xs font-bold uppercase">Active</span>` 
            : `<span class="bg-slate-500/10 text-slate-500 border border-slate-500/20 px-2 py-1 rounded-md text-xs font-bold uppercase">Inactive</span>`;
            
        const editDisabled = (s.update_count >= 2) ? 'disabled title="Update limit reached"' : '';
        const editClass = (s.update_count >= 2) ? 'text-slate-600 cursor-not-allowed' : 'text-blue-400 hover:text-blue-300';
            
        const actionBtn = isActive 
            ? `<button disabled class="text-slate-500 cursor-not-allowed text-xs font-bold"><i data-lucide="check-circle" class="w-4 h-4 inline"></i> Current</button>
               <button ${editDisabled} onclick="editSession('${s.id}', '${s.name}', '${s.start_date}', '${s.end_date}')" class="${editClass} text-xs font-bold transition-colors ml-3"><i data-lucide="edit-3" class="w-4 h-4 inline"></i></button>`
            : `<button onclick="setActiveSession('${s.id}')" class="text-indigo-400 hover:text-indigo-300 text-xs font-bold transition-colors"><i data-lucide="power" class="w-4 h-4 inline"></i> Set Active</button>
               <button ${editDisabled} onclick="editSession('${s.id}', '${s.name}', '${s.start_date}', '${s.end_date}')" class="${editClass} text-xs font-bold transition-colors ml-3"><i data-lucide="edit-3" class="w-4 h-4 inline"></i></button>
               <button onclick="deleteSession('${s.id}')" class="text-red-400 hover:text-red-300 text-xs font-bold transition-colors ml-3"><i data-lucide="trash-2" class="w-4 h-4 inline"></i></button>`;

        return `
            <tr class="hover:bg-white/5 transition-colors">
                <td class="p-4 font-bold text-white">${s.name}</td>
                <td class="p-4 text-slate-400 text-xs">${s.start_date} to ${s.end_date}</td>
                <td class="p-4 text-center">${statusBadge}</td>
                <td class="p-4 text-right">${actionBtn}</td>
            </tr>
        `;
    }).join('');
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function submitSessionForm() {
    const editId = document.getElementById('edit-session-id').value;
    const name = document.getElementById('new-session-name').value.trim();
    const start = document.getElementById('new-session-start').value;
    const end = document.getElementById('new-session-end').value;

    if (!name || !start || !end) {
        return alert("Please fill in all fields (Name, Start Date, End Date).");
    }

    try {
        if (editId) {
            // Check update count first
            const { data: session } = await supabaseClient.from('sessions').select('update_count').eq('id', editId).single();
            if (session.update_count >= 2) {
                alert("Update limit reached (max 2 times).");
                return;
            }
            
            const { error } = await supabaseClient.from('sessions').update({
                name: name,
                start_date: start,
                end_date: end,
                update_count: (session.update_count || 0) + 1
            }).eq('id', editId);
            
            if (error) throw error;
        } else {
            const { error } = await supabaseClient.from('sessions').insert({
                name: name,
                start_date: start,
                end_date: end,
                is_active: false
            });
            if (error) throw error;
        }

        document.getElementById('new-session-name').value = '';
        document.getElementById('new-session-start').value = '';
        document.getElementById('new-session-end').value = '';
        resetSessionForm();
        
        await initSessionManager();
        if (document.getElementById('session-filter')) {
            populateSessionDropdown('session-filter');
        }
    } catch (err) {
        console.error('Error submitting session:', err);
        alert('Failed to save session. ' + err.message);
    }
}

function editSession(id, name, start, end) {
    document.getElementById('edit-session-id').value = id;
    document.getElementById('new-session-name').value = name;
    document.getElementById('new-session-start').value = start;
    document.getElementById('new-session-end').value = end;
    
    document.getElementById('session-form-title').innerText = "Edit Session";
    const submitBtn = document.getElementById('session-submit-btn');
    if (submitBtn) {
        submitBtn.innerText = "Save Updates";
        submitBtn.classList.replace('bg-indigo-600', 'bg-blue-600');
        submitBtn.classList.replace('hover:bg-indigo-500', 'hover:bg-blue-500');
    }
    const cancelBtn = document.getElementById('session-cancel-btn');
    if (cancelBtn) cancelBtn.classList.remove('hidden');
}

function resetSessionForm() {
    document.getElementById('edit-session-id').value = '';
    document.getElementById('new-session-name').value = '';
    document.getElementById('new-session-start').value = '';
    document.getElementById('new-session-end').value = '';
    
    const title = document.getElementById('session-form-title');
    if (title) title.innerText = "Create New Session";
    
    const submitBtn = document.getElementById('session-submit-btn');
    if (submitBtn) {
        submitBtn.innerText = "Add Session";
        submitBtn.classList.replace('bg-blue-600', 'bg-indigo-600');
        submitBtn.classList.replace('hover:bg-blue-500', 'hover:bg-indigo-500');
    }
    const cancelBtn = document.getElementById('session-cancel-btn');
    if (cancelBtn) cancelBtn.classList.add('hidden');
}

async function setActiveSession(sessionId) {
    if (!confirm("Are you sure you want to set this as the active session? New student registrations will be assigned to this session.")) return;

    try {
        // Step 1: Deactivate all sessions
        const { error: err1 } = await supabaseClient
            .from('sessions')
            .update({ is_active: false })
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Dummy condition to update all rows

        if (err1) throw err1;

        // Step 2: Activate the selected session
        const { error: err2 } = await supabaseClient
            .from('sessions')
            .update({ is_active: true })
            .eq('id', sessionId);

        if (err2) throw err2;

        await fetchActiveSession(); // Update global cache
        await initSessionManager();
    } catch (err) {
        console.error('Error setting active session:', err);
        alert('Failed to set active session.');
    }
}

async function deleteSession(sessionId) {
    if (!confirm("Are you sure you want to delete this session? This action cannot be undone.")) return;

    try {
        const { error } = await supabaseClient
            .from('sessions')
            .delete()
            .eq('id', sessionId);

        if (error) throw error;
        await initSessionManager();
    } catch (err) {
        console.error('Error deleting session:', err);
        alert('Failed to delete session. It might be in use.');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const path = window.location.pathname;
    const sf = document.getElementById('session-filter');
    if(sf && typeof populateSessionDropdown === 'function') { await populateSessionDropdown('session-filter'); }
    
    if (path.includes('admin-dashboard')) initDashboard();
    else if (path.includes('admin-students')) initStudentsList();
    else if (path.includes('admin-tests')) initTestManager();
    else if (path.includes('admin-live')) loadLiveSessions();
});
