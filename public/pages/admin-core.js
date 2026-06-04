// admin-core.js - Consolidated Logic for Admin Suite

// --- CUSTOM ALERT UI OVERRIDE ---
window.alert = function(message) {
    let alertContainer = document.getElementById('admin-custom-alert');
    if (!alertContainer) {
        alertContainer = document.createElement('div');
        alertContainer.id = 'admin-custom-alert';
        alertContainer.className = 'fixed top-4 right-4 z-[9999] flex flex-col gap-2';
        document.body.appendChild(alertContainer);
    }
    
    const isSuccess = message.toLowerCase().includes('success') || message.toLowerCase().includes('deployed');
    const bgColor = isSuccess ? 'bg-emerald-50 border-emerald-500 text-emerald-800' : 'bg-red-50 border-red-500 text-red-800';
    
    const alertBox = document.createElement('div');
    alertBox.className = `p-4 border-l-4 shadow-lg rounded-r-md transform transition-all duration-300 translate-x-full ${bgColor} min-w-[300px] flex justify-between items-start bg-white`;
    alertBox.innerHTML = `
        <p class="font-bold text-sm mr-4">${message}</p>
        <button onclick="this.parentElement.remove()" class="text-gray-400 hover:text-gray-900 font-bold">&times;</button>
    `;
    
    alertContainer.appendChild(alertBox);
    setTimeout(() => alertBox.classList.remove('translate-x-full'), 10);
    
    setTimeout(() => {
        if(alertBox.parentElement) {
            alertBox.classList.add('translate-x-full');
            setTimeout(() => alertBox.remove(), 300);
        }
    }, 4000);
};

window.showCustomAlert = function(message, type) {
    window.alert(message); // Fallback to our new overridden alert
};
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
    
    if (id === 'create-modal') {
        if (typeof currentStep !== 'undefined') currentStep = 1;
        if (typeof testConfig !== 'undefined') testConfig = { topics: {} };
        if (document.getElementById('t-name')) document.getElementById('t-name').value = '';
        if (document.getElementById('t-time')) document.getElementById('t-time').value = '60';
        if (document.getElementById('t-pass')) document.getElementById('t-pass').value = '40';
        if (typeof renderStep === 'function') renderStep();
    }
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
                    <button onclick="allowRetest('${s.testCode}', '${s.email}')" class="px-4 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg font-bold text-xs flex items-center gap-2 ml-auto mt-2 transition-colors">
                        <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i> Retest
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

    // Visual feedback for refresh button
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-blue-500 font-bold"><i data-lucide="loader-2" class="w-6 h-6 animate-spin mx-auto mb-2"></i>Refreshing live telemetry...</td></tr>';
    if (typeof lucide !== 'undefined') lucide.createIcons();

    try {
        const { data: tests, error } = await supabaseClient.from('tests').select('*').eq('data->>isActive', 'active');
        if (error) throw error;

        activeProctoring = {};
        if (tests) {
            tests.forEach(t => {
                if (t.data && t.data.liveStudents) {
                    Object.keys(t.data.liveStudents).forEach(emailKey => {
                        const s = t.data.liveStudents[emailKey];
                        if (s === null || s === 'null') return;
                        
                        // Check if student has already submitted
                        const hasSubmitted = t.data.students && t.data.students.some(sub => sub.studentEmail === emailKey || sub.studentName === emailKey);
                        if (hasSubmitted) return; // Skip if already submitted
                        
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
                
                if (data && data.isActive === 'active' && data.liveStudents) {
                    Object.keys(data.liveStudents).forEach(emailKey => {
                        const s = data.liveStudents[emailKey];
                        if (s === null || s === 'null') return; 
                        
                        // Check if student has already submitted
                        const hasSubmitted = data.students && data.students.some(sub => sub.studentEmail === emailKey || sub.studentName === emailKey);
                        if (hasSubmitted) return; // Skip if already submitted
                        
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
            const statusColor = isArchived ? 'bg-gray-100 text-gray-500 border-gray-200' :
                                (t.data.isActive === 'active' || t.data.isActive === true) ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                                t.data.isActive === 'hold' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                                'bg-red-50 text-red-700 border-red-200';
            const statusText = isArchived ? 'ARCHIVED' :
                               (t.data.isActive === true || t.data.isActive === 'active') ? 'ACTIVE' : 
                               (t.data.isActive === 'hold' ? 'PAUSED' : 'STOPPED');
                               
            return `
            <div class="bg-white border border-gray-200 p-5 rounded-md flex items-center justify-between group hover:border-blue-800 hover:shadow-md transition-all cursor-pointer mb-3">
                <div class="flex items-center gap-5" onclick="viewResults('${t.code}')">
                    <div class="w-14 h-14 bg-gray-50 border border-gray-200 rounded-md flex items-center justify-center text-blue-900 font-bold text-lg">
                        ${t.code}
                    </div>
                    <div>
                        <div class="flex items-center gap-3">
                            <h4 class="font-bold text-gray-900 text-lg">${escapeHTML(t.data.name)}</h4>
                            <button onclick="event.stopPropagation(); toggleTestStatus('${t.code}', '${t.data.isActive}')" class="text-[10px] font-bold px-2.5 py-0.5 rounded border ${statusColor} hover:opacity-80 uppercase transition-all shadow-sm">
                                ${statusText}
                            </button>
                        </div>
                        <p class="text-xs text-gray-500 mt-1 font-medium">${t.data.createdAt ? new Date(t.data.createdAt).toLocaleDateString() : 'N/A'} &bull; ${t.data.duration} Mins</p>
                    </div>
                </div>
                <div class="flex items-center gap-8">
                    <div class="text-center">
                        <p class="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Live</p>
                        <p class="font-bold text-gray-900 text-lg">${t.data.liveStudents ? Object.keys(t.data.liveStudents).length : 0}</p>
                    </div>
                    <div class="text-center" onclick="viewResults('${t.code}')">
                        <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Students</p>
                        <p class="font-bold text-gray-900 text-lg">${(t.data.students || []).length}</p>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="viewResults('${t.code}')" class="p-2 bg-gray-50 rounded-md text-gray-500 hover:text-blue-800 hover:bg-blue-50 transition-all border border-gray-200 hover:border-blue-200" title="View Results"><i data-lucide="bar-chart-2" class="w-5 h-5"></i></button>
                        ${!isArchived ? `<button onclick="deleteTest('${t.code}')" class="p-2 bg-gray-50 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 transition-all border border-gray-200 hover:border-red-200" title="Archive Test"><i data-lucide="archive" class="w-5 h-5"></i></button>` : ''}
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
        showCustomAlert('Archived tests cannot be toggled.', 'error');
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
        showCustomAlert('Failed to update status', 'error');
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
        showCustomAlert('Failed to archive test', 'error');
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
            let liveStudents = [];
            if (dbData.data.liveStudents) {
                Object.keys(dbData.data.liveStudents).forEach(emailKey => {
                    const s = dbData.data.liveStudents[emailKey];
                    if (s === null || s === 'null') return;
                    
                    // Filter out if already submitted
                    const hasSubmitted = dbData.data.students && dbData.data.students.some(sub => sub.studentEmail === emailKey || sub.studentName === emailKey);
                    if (!hasSubmitted) {
                        s._emailKey = emailKey; // Keep track for the allowRetest button
                        liveStudents.push(s);
                    }
                });
            }
                
            if (liveStudents.length > 0) {
                document.getElementById('live-results-section').classList.remove('hidden');
                document.getElementById('live-results-table-body').innerHTML = liveStudents.map(s => `
                    <tr class="group hover:bg-gray-50 transition-all">
                        <td class="py-4 border-b border-gray-100 font-bold text-gray-900">${escapeHTML(s.studentName || s.name || 'Unknown')}</td>
                        <td class="py-4 border-b border-gray-100 text-sm text-gray-500 font-medium">${escapeHTML(s.studentEmail || '')}</td>
                        <td class="py-4 border-b border-gray-100 font-bold text-emerald-600">${s.answered || 0} / ${s.total || 0} <span class="text-[10px] text-gray-400 font-bold uppercase tracking-wider ml-2">Attempted</span></td>
                        <td class="py-4 border-b border-gray-100 text-sm text-gray-500 font-medium text-right">${s.joinedAt ? new Date(s.joinedAt).toLocaleTimeString() : 'N/A'}</td>
                        <td class="py-4 border-b border-gray-100 text-right">
                            <button onclick="allowRetest('${code}', '${s._emailKey || s.studentEmail || s.name}')" class="text-[10px] px-3 py-1 bg-red-50 text-red-700 rounded border border-red-200 hover:bg-red-100 font-bold uppercase tracking-wider" title="Remove from live & allow retest">Clear</button>
                        </td>
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

                document.getElementById('results-subtitle').innerHTML = `${students.length} submissions found. <button onclick="exportTestResultsCSV()" class="ml-4 text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-200 hover:bg-emerald-100 transition-all inline-flex items-center gap-1 shadow-sm"><i data-lucide="download" class="w-3 h-3"></i> Export</button>`;
                setTimeout(() => lucide.createIcons(), 50);

                students.sort((a, b) => (b.score || 0) - (a.score || 0));

                document.getElementById('results-table-body').innerHTML = students.map((s, index) => `
                    <tr class="group hover:bg-gray-50 transition-all">
                        <td class="py-4 border-b border-gray-100">
                            <p class="font-bold text-gray-900">${escapeHTML(s.studentName || 'Unknown')}</p>
                        </td>
                        <td class="py-4 border-b border-gray-100 text-sm text-gray-500 font-medium">${escapeHTML(s.studentEmail || '')}</td>
                        <td class="py-4 border-b border-gray-100 font-bold ${s.score >= (dbData.data.passScore || 40) ? 'text-emerald-600' : 'text-red-600'}">${s.score} / ${s.total}</td>
                        <td class="py-4 border-b border-gray-100 text-sm text-gray-500 font-medium text-right">${new Date(s.submittedAt).toLocaleString()}</td>
                        <td class="py-4 border-b border-gray-100 text-right">
                            ${s.detailedResults ? `<button onclick="viewStudentDetailedResults(${index})" class="text-xs px-4 py-1 bg-blue-50 text-blue-800 rounded hover:bg-blue-100 border border-blue-200 transition-all font-bold">Details</button>` : `<span class="text-xs text-gray-400 font-bold">N/A</span>`}
                            <button onclick="allowRetest('${code}', '${s.studentEmail || s.studentName}')" class="ml-1 text-[10px] px-3 py-1.5 bg-red-50 text-red-700 rounded border border-red-200 hover:bg-red-100 font-bold uppercase tracking-wider" title="Erase result & allow retest">Retest</button>
                        </td>
                    </tr>
                `).join('');
                lucide.createIcons();
            } else {
                document.getElementById('results-table-body').innerHTML = '<tr><td colspan="5" class="py-10 text-center text-gray-500 font-medium italic">No submissions yet.</td></tr>';
            }
        }
    } catch (err) {
        console.error('Results fetch error:', err);
        document.getElementById('results-table-body').innerHTML = '<tr><td colspan="5" class="py-10 text-center text-red-500 italic">Error loading results.</td></tr>';
    }
}

function viewStudentDetailedResults(studentIndex) {
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
            if (oIdx === dr.correctAnswerIndex) className += "bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold";
            else if (oIdx === dr.studentAnswerIndex) className += "bg-red-50 text-red-700 border border-red-200";
            else className += "bg-gray-50 text-gray-600 border border-gray-200";
            
            return `<div class="${className}">${String.fromCharCode(65+oIdx)}. ${escapeHTML(opt)}</div>`;
        }).join('');
        
        return `
            <div class="p-4 rounded-md border ${isCorrect ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/50'}">
                <p class="font-bold text-sm mb-2 text-gray-900">Q${qIdx+1}: ${escapeHTML(dr.questionText)}</p>
                <div class="space-y-1">
                    ${optionsHtml}
                </div>
                ${dr.studentAnswerIndex === null ? '<p class="text-xs text-red-600 mt-2 font-bold uppercase tracking-wider">Unanswered</p>' : ''}
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
                    <label class="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">Test Title</label>
                    <input type="text" id="t-name" class="w-full bg-white border border-gray-300 rounded-md p-3 text-gray-900 outline-none focus:border-blue-800 focus:ring-1 focus:ring-blue-800" placeholder="e.g. Mid-term Assessment 2026">
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">Duration (Mins)</label>
                        <input type="number" id="t-time" class="w-full bg-white border border-gray-300 rounded-md p-3 text-gray-900 outline-none focus:border-blue-800 focus:ring-1 focus:ring-blue-800" value="60">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">Passing Score (%)</label>
                        <input type="number" id="t-pass" class="w-full bg-white border border-gray-300 rounded-md p-3 text-gray-900 outline-none focus:border-blue-800 focus:ring-1 focus:ring-blue-800" value="40">
                    </div>
                </div>
            </div>
        `;
    } else if (currentStep === 2) {
        const topicsHTML = (typeof QUESTIONS_DATA !== 'undefined' && QUESTIONS_DATA.length > 0)
            ? `
                <div class="p-4 bg-gray-50 border border-gray-200 rounded-md mb-6 flex items-center justify-between">
                    <div>
                        <h4 class="font-bold text-gray-900">Auto-Generate Assessment</h4>
                        <p class="text-xs text-gray-500 mt-1">Randomly pick a specific number of questions across all available topics.</p>
                    </div>
                    <input type="number" id="random-total-count" placeholder="Total Qs" class="w-24 bg-white border border-gray-300 rounded-md p-2 text-sm text-center text-gray-900 focus:border-blue-800 outline-none">
                </div>
                
                <div class="flex items-center gap-4 mb-4">
                    <hr class="flex-1 border-gray-200">
                    <span class="text-xs font-bold text-gray-400 uppercase tracking-widest">OR TOPIC BLUEPRINT</span>
                    <hr class="flex-1 border-gray-200">
                </div>
                
                <div class="flex justify-end mb-3">
                    <button onclick="document.querySelectorAll('.topic-count').forEach(tc => { tc.value = tc.max; document.getElementById('random-total-count').value = ''; })" class="px-4 py-2 bg-blue-50 text-blue-800 rounded-md text-xs font-bold hover:bg-blue-100 transition-all border border-blue-100">Select All Available</button>
                </div>
            ` + QUESTIONS_DATA.map((t, idx) => `
                <div class="topic-row flex items-center justify-between p-4 bg-white rounded-md border border-gray-200 mb-2" data-topic="${t.topic}">
                    <div class="flex items-center gap-4">
                        <div>
                            <p class="topic-name text-sm font-bold text-gray-900">${t.topic}</p>
                            <p class="text-[10px] font-medium text-gray-500 uppercase mt-1 tracking-wider">${t.questions.length} Questions Bank</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <button onclick="openManualSelect(${idx})" class="text-xs font-bold px-4 py-2 rounded-md bg-white text-gray-700 hover:bg-gray-50 transition-all border border-gray-300 shadow-sm">Browse</button>
                        <input type="number" placeholder="Pick N" min="0" max="${t.questions.length}" class="topic-count w-20 bg-white border border-gray-300 rounded-md p-2 text-sm text-center text-gray-900 focus:border-blue-800 outline-none">
                        <input type="hidden" class="topic-manual-data" value="">
                    </div>
                </div>
            `).join('')
            : '<p class="text-gray-500 text-center py-8">Question bank not loaded. Please verify questions.js.</p>';
        content.innerHTML = `<div class="max-h-[400px] overflow-y-auto pr-2">${topicsHTML}</div>`;
    }

    // Update Headers
    document.querySelectorAll('.stepper-btn').forEach((btn, i) => {
        if (i + 1 === currentStep) {
            btn.classList.add('active', 'border-blue-800', 'text-blue-800');
            btn.classList.remove('border-transparent', 'text-gray-400');
        } else {
            btn.classList.remove('active', 'border-blue-800', 'text-blue-800');
            btn.classList.add('border-transparent', 'text-gray-400');
        }
    });

    document.getElementById('prev-btn').classList.toggle('hidden', currentStep === 1);
    document.getElementById('next-btn').textContent = currentStep === 2 ? 'Deploy Assessment' : 'Continue';
}

document.addEventListener('DOMContentLoaded', () => {
    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) {
        nextBtn.addEventListener('click', async () => {
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
                        showCustomAlert('Please select at least 1 question from topics OR enter an Auto-Generate Total.', 'error');
                        return;
                    }
                }
                // Deploy to Supabase on Step 2 completion
                const btn = document.getElementById('next-btn');
                btn.textContent = 'Deploying...';
                btn.disabled = true;


                try {
                    const activeSessionName = await fetchActiveSession();
                    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
                    const payload = {
                        code: code,
                        session: activeSessionName,
                        is_published: false,
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

                    showCustomAlert('Assessment Deployed Successfully! Code: ' + code, 'success');
                    closeModal('create-modal');
                    
                    // Reset modal state
                    currentStep = 1;
                    testConfig = { topics: {} };
                    if (document.getElementById('t-name')) document.getElementById('t-name').value = '';
                    if (document.getElementById('t-time')) document.getElementById('t-time').value = '60';
                    if (document.getElementById('t-pass')) document.getElementById('t-pass').value = '40';

                    initTestManager(); // Refresh list
                } catch (err) {
                    console.error('Deployment error:', err);
                    showCustomAlert('Failed to deploy test: ' + err.message, 'error');
                } finally {
                    btn.textContent = 'Deploy Assessment';
                    btn.disabled = false;
                }
            }
        });
    } else {
        console.warn("CRITICAL: 'next-btn' (Create Session/Deploy) not found in the DOM. Check HTML IDs.");
    }

    const prevBtn = document.getElementById('prev-btn');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentStep > 1) {
                currentStep--;
                renderStep();
            }
        });
    } else {
        console.warn("CRITICAL: 'prev-btn' not found in the DOM. Check HTML IDs.");
    }
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
        showCustomAlert('Kill signal sent to candidate device.', 'success');
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
        showCustomAlert("Failed to export CSV.", "error");
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
        showCustomAlert("Failed to export test results CSV.", "error");
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
            <div class="flex items-start gap-4 p-4 bg-white border border-gray-200 rounded-md hover:border-blue-800 hover:shadow-sm transition-all cursor-pointer" onclick="const cb = this.querySelector('input[type=checkbox]'); cb.checked = !cb.checked; updateManualCount();">
                <input type="checkbox" class="manual-q-cb mt-1 cursor-pointer w-4 h-4 rounded text-blue-800 focus:ring-blue-800 border-gray-300" value="${idx}" ${isChecked} onclick="event.stopPropagation(); updateManualCount();">
                <div class="flex-1">
                    <p class="text-sm font-bold text-gray-900 mb-1">${q.q}</p>
                    ${q.q_hi ? `<p class="text-[10px] font-medium text-gray-500 mb-2">${q.q_hi}</p>` : ''}
                    <div class="grid grid-cols-2 gap-2 mt-2">
                        ${q.o.map((opt, oIdx) => `<div class="text-[10px] px-2 py-1.5 rounded-md ${oIdx === q.a ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold' : 'bg-gray-50 border border-gray-200 text-gray-500 font-medium'}">${opt}</div>`).join('')}
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
    
    if (!message) return showCustomAlert("Please type a message first.", "error");
    
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
        showCustomAlert("Broadcast sent successfully!", "success");
    } catch (e) {
        console.error("Notice broadcast failed:", e);
        showCustomAlert("Failed to broadcast notice.", "error");
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
    
    if (!name || !session || !percent || !badge) return showCustomAlert("Please fill all required fields.", "error");
    
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
        
        showCustomAlert(`Successfully added ${name} to Wall of Fame!`, 'success');
        document.getElementById('wof-name').value = '';
        document.getElementById('wof-percent').value = '';
        document.getElementById('wof-badge').value = '';
        document.getElementById('wof-photo').value = '';
    } catch (e) {
        console.error("Wall of fame error:", e);
        showCustomAlert("Failed to add to Wall of Fame.", "error");
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
            <tr class="hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0">
                <td class="p-4 font-bold text-gray-900">${s.name}</td>
                <td class="p-4 text-gray-500 font-medium text-xs">${s.start_date} to ${s.end_date}</td>
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
        return showCustomAlert("Please fill in all fields (Name, Start Date, End Date).", "error");
    }

    try {
        if (editId) {
            // Check update count first
            const { data: session } = await supabaseClient.from('sessions').select('update_count').eq('id', editId).single();
            if (session.update_count >= 2) {
                showCustomAlert("Update limit reached (max 2 times).", "error");
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
        showCustomAlert('Failed to save session. ' + err.message, 'error');
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
        showCustomAlert('Failed to set active session.', 'error');
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
        showCustomAlert('Failed to delete session. It might be in use.', 'error');
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
    else if (path.includes('admin-results')) initResultsPage();
});

// --- RESULTS PAGE LOGIC ---
let currentSessionTests = [];

async function initResultsPage() {
    const activeBadge = document.getElementById('active-session-badge');
    const testsGrid = document.getElementById('tests-grid');
    const testsListView = document.getElementById('tests-list-view');
    const testDetailView = document.getElementById('test-detail-view');
    const backBtn = document.getElementById('back-to-tests-btn');
    const declareTopperBtn = document.getElementById('declare-topper-btn');

    if (!testsGrid) return;

    try {
        const activeSessionName = await fetchActiveSession();
        if (activeBadge) {
            activeBadge.innerHTML = `<i data-lucide="calendar" class="w-4 h-4"></i> Active Session: ${activeSessionName}`;
        }

        const { data: tests, error } = await supabaseClient
            .from('tests')
            .select('code, data, session, is_published')
            .eq('session', activeSessionName);

        if (error) throw error;
        currentSessionTests = tests || [];

        if (currentSessionTests.length === 0) {
            testsGrid.innerHTML = '<div class="col-span-full text-center py-12 text-gray-500 font-bold">No tests found for the active session.</div>';
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        // Render Tests Grid
        testsGrid.innerHTML = currentSessionTests.map(test => {
            const name = test.data?.name || 'Untitled Session';
            const students = test.data?.students || [];
            const studentsCount = students.length;
            
            let passCount = 0;
            let totalScore = 0;
            let totalMax = 0;

            students.forEach(s => {
                if (s.passed) passCount++;
                totalScore += (s.score || 0);
                totalMax += (s.total || 0);
            });

            const passPercent = studentsCount > 0 ? Math.round((passCount / studentsCount) * 100) : 0;
            const avgScore = studentsCount > 0 && totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
            const isPub = test.is_published;

            return `
                <div class="bg-white border ${isPub ? 'border-green-200 shadow-green-50' : 'border-gray-200'} shadow-sm rounded-md p-6 hover:shadow-md transition-shadow relative">
                    ${isPub ? '<div class="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-md rounded-tr-md uppercase">Published</div>' : ''}
                    <h3 class="text-lg font-bold text-gray-900 mb-1 pr-16 truncate" title="${name}">${name}</h3>
                    <p class="text-xs font-mono text-gray-500 font-bold mb-4">Code: ${test.code}</p>
                    
                    <div class="grid grid-cols-3 gap-2 mb-6">
                        <div class="bg-gray-50 p-2 rounded-sm text-center border border-gray-100">
                            <p class="text-xl font-black text-blue-700">${studentsCount}</p>
                            <p class="text-[10px] text-gray-500 font-bold uppercase mt-1">Trainees</p>
                        </div>
                        <div class="bg-gray-50 p-2 rounded-sm text-center border border-gray-100">
                            <p class="text-xl font-black ${passPercent >= 50 ? 'text-green-600' : 'text-amber-600'}">${passPercent}%</p>
                            <p class="text-[10px] text-gray-500 font-bold uppercase mt-1">Passed</p>
                        </div>
                        <div class="bg-gray-50 p-2 rounded-sm text-center border border-gray-100">
                            <p class="text-xl font-black text-purple-700">${avgScore}%</p>
                            <p class="text-[10px] text-gray-500 font-bold uppercase mt-1">Avg Score</p>
                        </div>
                    </div>
                    
                    <button onclick="viewDetailedResults('${test.code}', '${encodeURIComponent(name)}')" class="w-full bg-white border border-gray-300 text-gray-800 font-bold py-2 rounded-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 text-sm shadow-sm">
                        <i data-lucide="list" class="w-4 h-4"></i> View Results
                    </button>
                </div>
            `;
        }).join('');

        // Back Button
        if (backBtn) {
            backBtn.onclick = () => {
                testDetailView.style.display = 'none';
                testsListView.style.display = 'block';
            };
        }

        // Declare Topper Button Logic
        if (declareTopperBtn) {
            declareTopperBtn.onclick = async () => {
                if (currentSessionTests.length === 0) {
                    showCustomAlert("No tests in the active session to evaluate.", "error");
                    return;
                }

                // Aggregate scores by student email
                const studentMap = {};
                
                currentSessionTests.forEach(test => {
                    const students = test.data?.students || [];
                    students.forEach(s => {
                        const key = s.studentEmail || s.studentName;
                        if (!key) return;
                        
                        if (!studentMap[key]) {
                            studentMap[key] = {
                                name: s.studentName,
                                email: s.studentEmail,
                                totalScore: 0,
                                totalMax: 0,
                                testsTaken: 0
                            };
                        }
                        studentMap[key].totalScore += (s.score || 0);
                        studentMap[key].totalMax += (s.total || 0);
                        studentMap[key].testsTaken += 1;
                    });
                });

                const aggregatedStudents = Object.values(studentMap);
                if (aggregatedStudents.length === 0) {
                    showCustomAlert("No student submissions found in this session.", "error");
                    return;
                }

                // Calculate percentage and find the topper
                let topStudent = null;
                let highestPercent = -1;

                aggregatedStudents.forEach(s => {
                    const percent = s.totalMax > 0 ? (s.totalScore / s.totalMax) * 100 : 0;
                    if (percent > highestPercent) {
                        highestPercent = percent;
                        topStudent = s;
                    }
                });

                if (!topStudent) {
                    showCustomAlert("Could not determine a topper.", "error");
                    return;
                }

                const confirmMsg = `Top Student Found!\n\nName: ${topStudent.name}\nEmail: ${topStudent.email}\nPercentage: ${highestPercent.toFixed(2)}%\nTests Taken: ${topStudent.testsTaken}\n\nDo you want to publish this student to the Wall of Fame (Hamare Sitaare)?`;
                
                if (confirm(confirmMsg)) {
                    declareTopperBtn.disabled = true;
                    declareTopperBtn.innerHTML = "Publishing...";
                    try {
                        const badgeStr = `Session Topper (${activeSessionName})`;
                        const photo = 'https://ui-avatars.com/api/?background=random&color=fff&name=' + encodeURIComponent(topStudent.name);
                        
                        const { error: insertError } = await supabaseClient.from('toppers_wall').insert({
                            student_name: topStudent.name,
                            session: activeSessionName,
                            ncvt_percentage: parseFloat(highestPercent.toFixed(2)),
                            achievement_tag: badgeStr,
                            photo_url: photo
                        });
                        
                        if (insertError) throw insertError;
                        
                        showCustomAlert(`${topStudent.name} is now the Session Topper!`, 'success');
                    } catch (e) {
                        console.error("Topper publishing error:", e);
                        showCustomAlert("Failed to publish to Wall of Fame.", "error");
                    } finally {
                        declareTopperBtn.disabled = false;
                        declareTopperBtn.innerHTML = `<i data-lucide="star" class="w-4 h-4"></i> Declare Session Topper`;
                        if (typeof lucide !== 'undefined') lucide.createIcons();
                    }
                }
            };
        }

        if (typeof lucide !== 'undefined') lucide.createIcons();

    } catch (err) {
        console.error("Failed to initialize results page:", err);
    }
}

// Called when "View Results" is clicked on a test card
function viewDetailedResults(testCode, testNameEncoded) {
    const testName = decodeURIComponent(testNameEncoded);
    const test = currentSessionTests.find(t => t.code === testCode);
    if (!test) return;

    const testsListView = document.getElementById('tests-list-view');
    const testDetailView = document.getElementById('test-detail-view');
    const titleEl = document.getElementById('detail-test-title');
    const tbody = document.getElementById('results-tbody');
    const publishBtn = document.getElementById('publish-results-btn');

    titleEl.textContent = `${testName} [${testCode}]`;
    
    // Toggle views
    testsListView.style.display = 'none';
    testDetailView.style.display = 'block';

    let students = test.data?.students || [];
    let isPub = test.is_published;

    // Publish Button Logic
    if (publishBtn) {
        publishBtn.style.display = 'flex';
        publishBtn.innerHTML = isPub 
            ? `<i data-lucide="x-circle" class="w-4 h-4"></i> Unpublish Results` 
            : `<i data-lucide="send" class="w-4 h-4"></i> Publish Results`;
        publishBtn.className = isPub 
            ? "bg-red-600 text-white px-4 py-2 flex items-center gap-2 rounded-sm font-medium text-sm hover:bg-red-700 border border-red-800 transition-colors"
            : "bg-blue-600 text-white px-4 py-2 flex items-center gap-2 rounded-sm font-medium text-sm hover:bg-blue-700 border border-blue-800 transition-colors";
        
        publishBtn.onclick = async () => {
            const newStatus = !isPub;
            publishBtn.disabled = true;
            publishBtn.innerHTML = "Processing...";
            try {
                const { error } = await supabaseClient.from('tests').update({ is_published: newStatus }).eq('code', testCode);
                if(error) throw error;
                
                // Update local state
                test.is_published = newStatus;
                
                // Re-render UI
                showCustomAlert(`Results ${newStatus ? 'Published' : 'Unpublished'} Successfully!`, 'success');
                await initResultsPage(); // Refresh the list view to show correct badges
                viewDetailedResults(testCode, testNameEncoded); // Re-open this view with updated state
            } catch(err) {
                console.error('Publish Error:', err);
                showCustomAlert('Error updating publish status.', 'error');
                publishBtn.disabled = false;
                publishBtn.innerHTML = isPub ? 'Unpublish Results' : 'Publish Results';
            }
        };
    }

    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-gray-500 font-bold">No submissions found for this session.</td></tr>';
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    // Sort students by score descending
    students.sort((a, b) => (b.score || 0) - (a.score || 0));

    tbody.innerHTML = students.map(s => {
        const passClass = s.passed ? 'badge-green' : 'badge-red';
        const passText = s.passed ? 'PASSED' : 'FAILED';
        const submitTime = s.submittedAt ? new Date(s.submittedAt).toLocaleString() : 'Unknown';
        
        return `
            <tr class="hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0">
                <td class="p-4">
                    <p class="font-bold text-gray-900">${s.studentName || 'Unknown'}</p>
                    <p class="text-xs text-gray-500">${s.studentEmail || 'N/A'}</p>
                </td>
                <td class="p-4 text-gray-500 text-sm font-medium">${submitTime}</td>
                <td class="p-4 font-bold text-gray-900">${s.score} / ${s.total || '?'}</td>
                <td class="p-4"><span class="badge ${passClass}">${passText}</span></td>
        <td class="p-4">
            <button onclick="alert('Detailed scorecard view for individual students is coming soon!')" class="text-blue-700 hover:text-blue-900 font-bold text-sm transition-colors flex items-center gap-1">
                <i data-lucide="eye" class="w-4 h-4"></i> View
            </button>
        </td>
    </tr>
`;
    }).join('');
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ==========================================
// ALLOW RETEST LOGIC
// ==========================================
window.allowRetest = async function(testCode, studentEmail) {
    if (!confirm(`Are you sure you want to allow a retest for ${studentEmail}? This will erase their previous answers and progress.`)) return;
    
    showCustomAlert("Processing retest request...", "success");
    try {
        const { data: dbTest, error } = await supabaseClient.from('tests').select('data').eq('code', testCode).single();
        if (error) throw error;
        
        let testData = dbTest.data;
        let modified = false;
        
        // 1. Remove from liveStudents
        if (testData.liveStudents && testData.liveStudents[studentEmail]) {
            delete testData.liveStudents[studentEmail];
            modified = true;
        }
        
        // 2. Remove from students array
        if (testData.students) {
            const initialLen = testData.students.length;
            testData.students = testData.students.filter(s => s.studentEmail !== studentEmail && s.studentName !== studentEmail);
            if (testData.students.length !== initialLen) {
                modified = true;
            }
        }
        
        if (modified) {
            const { error: updateErr } = await supabaseClient.from('tests').update({ data: testData }).eq('code', testCode);
            if (updateErr) throw updateErr;
            showCustomAlert(`Retest allowed for ${studentEmail}. They can now rejoin the test.`, "success");
            
            // Refresh views if they are open
            if (document.getElementById('results-modal') && !document.getElementById('results-modal').classList.contains('hidden')) {
                viewResults(testCode);
            }
            if (typeof loadLiveSessions === 'function') {
                loadLiveSessions();
            }
        } else {
            showCustomAlert("Student data not found. They might not have joined yet.", "error");
        }
    } catch(err) {
        showCustomAlert("Error allowing retest. Check console.", "error");
        console.error(err);
    }
};
