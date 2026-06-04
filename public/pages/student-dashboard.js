// student-dashboard.js

if (typeof lucide !== 'undefined') {
    lucide.createIcons();
}

let studentData = {
    email: '',
    name: '',
    trade: 'COPA',
    session_id: ''
};

// 1. Initialize Dashboard
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (error || !session) {
            window.location.href = 'student-auth.html';
            return;
        }

        // Set student data
        studentData.email = session.user.email;
        studentData.name = session.user.user_metadata?.full_name || 'Trainee';
        studentData.trade = session.user.user_metadata?.trade || 'COPA';
        studentData.session_id = session.user.user_metadata?.session_id || '';
        
        // Save to localStorage for quiz.js to use
        localStorage.setItem('studentData', JSON.stringify(studentData));

        // Render Header
        document.getElementById('header-name').textContent = studentData.name;
        document.getElementById('header-email').textContent = studentData.email;
        document.getElementById('header-trade').textContent = `Trade: ${studentData.trade}`;

        // Process any pending results
        await processLastResults();

        // Fetch Live Assessments
        await fetchLiveAssessments();
        
        // Render History
        await renderHistory();

    } catch(err) {
        console.error("Auth Error:", err);
    }
});

async function logout() {
    await supabaseClient.auth.signOut();
    window.location.href = 'student-auth.html';
}

// 2. Fetch Live Assessments
async function fetchLiveAssessments() {
    const container = document.getElementById('live-tests-container');
    try {
        const { data: tests, error } = await supabaseClient
            .from('tests')
            .select('code, session, data')
            .eq('data->>isActive', 'active');
            
        if (error) throw error;
        
        // Filter tests by session if needed. Show tests that belong to the student's session, global active session, or all sessions.
        const activeSessionName = await window.fetchActiveSession();
        const targetSession = studentData.session_id || activeSessionName;
        const relevantTests = tests.filter(t => !t.session || t.session === targetSession || t.session === 'All Sessions' || t.session === activeSessionName);

        if (relevantTests.length === 0) {
            container.innerHTML = '<div class="text-center text-sm font-bold text-gray-500 py-6 border border-dashed border-gray-300 rounded-sm">No live assessments assigned to your session.</div>';
            return;
        }

        container.innerHTML = relevantTests.map(t => {
            const testName = t.data.testName || `Institutional Exam (${t.code})`;
            const questionsCount = t.data.questions ? t.data.questions.length : 0;
            const duration = t.data.duration ? `${t.data.duration} Mins` : 'No Limit';
            
            return `
                <div class="border border-gray-300 rounded-sm p-5 bg-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h3 class="font-black text-gray-900 uppercase tracking-tight text-lg">${testName}</h3>
                        <div class="flex gap-3 text-xs font-bold text-gray-600 mt-2">
                            <span>Questions: ${questionsCount}</span>
                            <span>|</span>
                            <span>Duration: ${duration}</span>
                            <span>|</span>
                            <span>Code: ${t.code}</span>
                        </div>
                    </div>
                    <button onclick="joinLiveTest('${t.code}')" class="bg-blue-800 hover:bg-blue-900 border border-blue-900 text-white font-bold py-3 px-6 rounded-sm transition-colors text-xs uppercase tracking-wider shrink-0 shadow-sm flex items-center gap-2">
                        <span>Proceed to Instructions</span>
                        <i data-lucide="arrow-right" class="w-4 h-4"></i>
                    </button>
                </div>
            `;
        }).join('');
        
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch(err) {
        console.error("Error fetching live tests:", err);
        container.innerHTML = '<div class="text-center text-sm font-bold text-red-600 py-6">Failed to load active assessments.</div>';
    }
}

window.joinLiveTest = async function(code) {
    try {
        const { data: dbTest, error } = await supabaseClient.from('tests').select('data').eq('code', code).single();
        if (error || !dbTest) {
            alert("Invalid or expired test.");
            return;
        }
        
        const testData = { code, ...dbTest.data };
        
        // Block Re-joining
        const hasSubmitted = testData.students && testData.students.some(s => 
            s.studentEmail === studentData.email || 
            s.studentName === studentData.email ||
            s.studentEmail === studentData.name ||
            s.studentName === studentData.name
        );
        const inLive = testData.liveStudents && (testData.liveStudents[studentData.email] || testData.liveStudents[studentData.name]);
        
        if (hasSubmitted || inLive) {
            alert("You have already started or submitted this test. If you need to retest, ask the admin to allow a retest.");
            return;
        }

        localStorage.removeItem('practiceMode');
        localStorage.removeItem('practiceTopic');
        localStorage.setItem('activeTest', JSON.stringify(testData));
        localStorage.setItem('activeTestStudentName', studentData.name);
        window.location.href = 'quiz.html';
    } catch(err) {
        alert("Network error.");
    }
};

// 3. Self Practice
window.launchMockTest = function(e) {
    if (e) e.preventDefault();
    const topic = document.getElementById('practice-topic').value;
    const count = document.querySelector('input[name="practice-count"]:checked').value;
    
    localStorage.removeItem('activeTest');
    localStorage.removeItem('activeTestStudentName');
    
    localStorage.setItem('practiceMode', topic === 'ALL' ? 'mock' : 'topic');
    if (topic !== 'ALL') {
        localStorage.setItem('practiceTopic', topic);
    }
    localStorage.setItem('practiceCount', count);
    
    window.location.href = 'quiz.html';
};

// 4. Process Last Results before rendering History
async function processLastResults() {
    const lastResultsRaw = localStorage.getItem('lastQuizResults');
    if (!lastResultsRaw) return;

    try {
        const res = JSON.parse(lastResultsRaw);
        let history = JSON.parse(localStorage.getItem('studentTestHistory') || '[]');
        
        const isPractice = res.isPractice;
        let is_published = true;
        let actualTotal = res.total;
        
        if (!isPractice && res.testCode) {
            const { data: dbTest } = await supabaseClient.from('tests').select('is_published, data').eq('code', res.testCode).single();
            if (dbTest) {
                is_published = dbTest.is_published;
                if (dbTest.data && dbTest.data.questions) {
                    actualTotal = dbTest.data.questions.length;
                }
            }
            
            // Auto lock out
            localStorage.removeItem(`exam_state_${res.testCode}`);
            localStorage.removeItem('activeTest');
        }
        
        const percent = Math.round((res.score / actualTotal) * 100);
        
        history.push({
            date: new Date().toISOString(),
            score: res.score,
            total: actualTotal,
            percent: percent,
            isPractice: isPractice,
            testCode: res.testCode,
            is_published: is_published
        });
        localStorage.setItem('studentTestHistory', JSON.stringify(history));
        
        // Show scorecard immediately if published or practice
        if (isPractice || is_published) {
            showScorecard(actualTotal, res.score, percent);
        } else {
            alert("Exam Submitted Securely. Result awaiting administrator publication.");
        }
        
    } catch(e) {
        console.error("Failed to process results", e);
    } finally {
        localStorage.removeItem('lastQuizResults');
    }
}

// 5. Render History Table
async function renderHistory() {
    const instTbody = document.getElementById('institutional-table-body');
    const pracTbody = document.getElementById('practice-table-body');
    
    let history = [];
    try {
        history = JSON.parse(localStorage.getItem('studentTestHistory') || '[]');
    } catch(e) {}

    // Separate tests
    const practiceTests = history.filter(h => h.isPractice);
    const instTests = history.filter(h => !h.isPractice);

    // Dynamic publish check for Institutional Exams
    const nonPracticeCodes = instTests.filter(h => h.testCode).map(h => h.testCode);
    let publishedMap = {};
    if (nonPracticeCodes.length > 0) {
        const { data: dbTests } = await supabaseClient.from('tests').select('code, is_published').in('code', [...new Set(nonPracticeCodes)]);
        if (dbTests) {
            dbTests.forEach(t => publishedMap[t.code] = t.is_published);
        }
    }

    // Render Institutional Exams
    if (instTests.length === 0) {
        instTbody.innerHTML = '<tr><td colspan="4" class="py-8 text-center text-sm font-bold text-gray-500">No institutional exams found.</td></tr>';
    } else {
        instTbody.innerHTML = instTests.reverse().map((h, index) => {
            const d = new Date(h.date);
            const dateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            // Map index back to original history array for scorecard mapping
            const originalIndex = history.findIndex(orig => orig.date === h.date);
            
            let isPublished = publishedMap[h.testCode] !== undefined ? publishedMap[h.testCode] : h.is_published;
            
            let actionBtn = '';
            if (isPublished) {
                actionBtn = `<button onclick="viewScorecard(${originalIndex})" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-sm text-xs uppercase transition-colors whitespace-nowrap shadow-sm">Check Result</button>`;
            } else {
                actionBtn = `<span class="bg-yellow-50 text-yellow-700 border border-yellow-300 font-bold py-2 px-4 rounded-sm text-xs uppercase whitespace-nowrap flex items-center justify-end gap-2"><i data-lucide="clock" class="w-3.5 h-3.5"></i> Result Pending</span>`;
            }
            
            return `
                <tr class="hover:bg-gray-50 transition-colors">
                    <td class="py-4 px-4 text-sm font-bold text-gray-600">${dateStr}</td>
                    <td class="py-4 px-4 text-sm font-bold text-gray-900">${h.testCode || 'N/A'}</td>
                    <td class="py-4 px-4 font-black ${isPublished ? (h.percent >= 50 ? 'text-green-700' : 'text-red-600') : 'text-gray-400'}">${isPublished ? h.percent + '%' : 'Pending Publish'}</td>
                    <td class="py-4 px-4 text-right flex justify-end">${actionBtn}</td>
                </tr>
            `;
        }).join('');
    }

    // Render Practice Tests
    if (practiceTests.length === 0) {
        pracTbody.innerHTML = '<tr><td colspan="4" class="py-8 text-center text-sm font-bold text-gray-500">No practice attempts found.</td></tr>';
    } else {
        pracTbody.innerHTML = practiceTests.reverse().map((h, index) => {
            const d = new Date(h.date);
            const dateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            const originalIndex = history.findIndex(orig => orig.date === h.date);
            const actionBtn = `<button onclick="viewScorecard(${originalIndex})" class="bg-white border border-gray-300 hover:bg-gray-100 text-gray-900 font-bold py-2 px-4 rounded-sm text-xs uppercase transition-colors whitespace-nowrap shadow-sm">View Scorecard</button>`;
            
            return `
                <tr class="hover:bg-gray-50 transition-colors">
                    <td class="py-4 px-4 text-sm font-bold text-gray-600">${dateStr}</td>
                    <td class="py-4 px-4 text-sm font-bold text-gray-900">Self Practice Mock</td>
                    <td class="py-4 px-4 font-black ${h.percent >= 50 ? 'text-green-700' : 'text-red-600'}">${h.percent}%</td>
                    <td class="py-4 px-4 text-right flex justify-end">${actionBtn}</td>
                </tr>
            `;
        }).join('');
    }
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.viewScorecard = function(historyIndex) {
    let history = [];
    try {
        history = JSON.parse(localStorage.getItem('studentTestHistory') || '[]');
    } catch(e) {}
    
    const h = history[historyIndex];
    if (!h) return;
    
    showScorecard(h.total, h.score, h.percent);
};

function showScorecard(total, score, percent) {
    document.getElementById('scorecard-total').textContent = total || 0;
    document.getElementById('scorecard-correct').textContent = score || 0;
    document.getElementById('scorecard-percent').textContent = (percent || 0) + '%';
    
    document.getElementById('scorecard-modal').classList.remove('hidden');
}

window.closeScorecard = function() {
    document.getElementById('scorecard-modal').classList.add('hidden');
};