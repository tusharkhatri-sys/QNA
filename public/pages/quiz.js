let testData = null;
try {
    const rawData = localStorage.getItem('activeTest');
    if (rawData) testData = JSON.parse(rawData);
} catch (e) {
    console.error("Corrupted activeTest in localStorage", e);
    localStorage.removeItem('activeTest');
    window.location.href = 'student.html';
}

const studentName = localStorage.getItem('activeTestStudentName');
const student = getLoggedInStudent();
let currentQuiz = [];
let currentIndex = 0;
let userAnswers = {};
let score = 0;
let timeRemaining = 0;
let liveTestTimer = null;
let isSubmitting = false;
let offlineBuffer = false;

window.addEventListener('online', async () => {
    if (offlineBuffer && testData && !isSubmitting) {
        console.log('Network restored. Syncing offline buffer...');
        debouncedReportLiveProgress();
        offlineBuffer = false;
    }
});

if (!testData && !localStorage.getItem('practiceMode')) {
    window.location.href = 'student.html';
}

// --- Custom Non-Blocking Modal ---
function showCustomModal(title, message, isConfirm = false, onConfirm = null, onCancel = null) {
    const overlay = document.getElementById('custom-modal-overlay');
    const titleEl = document.getElementById('custom-modal-title');
    const msgEl = document.getElementById('custom-modal-message');
    const btnConfirm = document.getElementById('custom-modal-confirm');
    const btnCancel = document.getElementById('custom-modal-cancel');

    titleEl.textContent = title;
    msgEl.textContent = message;
    
    if (isConfirm) {
        btnCancel.style.display = 'block';
    } else {
        btnCancel.style.display = 'none';
    }

    // Cleanup old listeners
    const newConfirm = btnConfirm.cloneNode(true);
    const newCancel = btnCancel.cloneNode(true);
    btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);
    btnCancel.parentNode.replaceChild(newCancel, btnCancel);

    newConfirm.onclick = () => {
        overlay.style.display = 'none';
        if (onConfirm) onConfirm();
    };

    newCancel.onclick = () => {
        overlay.style.display = 'none';
        if (onCancel) onCancel();
    };

    overlay.style.display = 'flex';
}

// Utility: Fisher-Yates Shuffle
function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// Utility: Debounce for API calls
function debounce(func, timeout = 1000) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}

function initQuiz() {
    if (testData) {
        initLiveTest();
    } else {
        initPracticeMode();
    }
}

function initLiveTest() {
    document.getElementById('quiz-topic-name').textContent = testData.name || 'Untitled Test';
    
    if (testData.isRandomMix) {
        let allPool = QUESTIONS_DATA.flatMap(tObj => tObj.questions);
        currentQuiz = shuffleArray(allPool).slice(0, testData.randomTotal || 50);
    } else {
        const config = testData.topicConfig || {};
        for (const [topicName, val] of Object.entries(config)) {
            const tObj = QUESTIONS_DATA.find(t => t.topic === topicName);
            if (tObj) {
                if (typeof val === 'object' && val.mode === 'manual') {
                    let selectedQuestions = val.indices.map(i => tObj.questions[i]).filter(Boolean);
                    currentQuiz = currentQuiz.concat(selectedQuestions);
                } else {
                    const count = typeof val === 'number' ? val : 0;
                    let pool = shuffleArray([...tObj.questions]);
                    currentQuiz = currentQuiz.concat(pool.slice(0, count));
                }
            }
        }
        shuffleArray(currentQuiz);
    }
    
    // ANTI-CHEAT: Randomize Option Order for each student
    currentQuiz = currentQuiz.map(orig => {
        const q = JSON.parse(JSON.stringify(orig));
        let opts = q.o.map((text, idx) => ({ text, idx, hiText: q.o_hi ? q.o_hi[idx] : null }));
        shuffleArray(opts);
        
        q.o = opts.map(o => o.text);
        if (q.o_hi) q.o_hi = opts.map(o => o.hiText);
        q.a = opts.findIndex(o => o.idx === orig.a);
        return q;
    });
    
    timeRemaining = (testData.duration || 60) * 60;
    const durationMs = timeRemaining * 1000;
    const testEndTime = Date.now() + durationMs;
    
    updateTimerDisplay();
    liveTestTimer = setInterval(() => {
        timeRemaining = Math.round((testEndTime - Date.now()) / 1000);
        
        if (timeRemaining <= 0) {
            timeRemaining = 0;
            clearInterval(liveTestTimer);
            updateTimerDisplay();
            showCustomModal("Time's Up!", "Your test will be auto-submitted.", false, () => {
                submitQuiz(true);
            });
            // Force submit in background in case they don't click OK
            setTimeout(() => submitQuiz(true), 2000);
        } else {
            updateTimerDisplay();
        }
    }, 1000);

    // Supabase Realtime Listener
    if (window.studentRealtimeSub) supabaseClient.removeChannel(window.studentRealtimeSub);
    window.studentRealtimeSub = supabaseClient.channel(`student_test_${testData.code}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tests', filter: `code=eq.${testData.code}` }, payload => {
            const data = payload.new.data;
            if (data.isActive === 'hold') {
                document.getElementById('quiz-screen').style.opacity = '0.5';
                document.getElementById('quiz-screen').style.pointerEvents = 'none';
                if (!document.getElementById('hold-alert-msg')) {
                    const msg = document.createElement('div');
                    msg.id = 'hold-alert-msg';
                    msg.innerHTML = '<h2 style="color:var(--red); text-align:center; margin-top:20px;">TEST PAUSED BY ADMIN</h2>';
                    document.getElementById('quiz-screen').prepend(msg);
                }
            } else if (data.isActive === 'active') {
                document.getElementById('quiz-screen').style.opacity = '1';
                document.getElementById('quiz-screen').style.pointerEvents = 'auto';
                const msg = document.getElementById('hold-alert-msg');
                if (msg) msg.remove();
            } else if (data.isActive === 'stopped' || data.isActive === false) {
                showCustomModal("Test Closed", "Test was closed by admin. Submitting your current progress...", false, () => submitQuiz(true));
                setTimeout(() => submitQuiz(true), 2000);
            }
            
            const emailKey = student ? student.email : studentName;
            if (data.forceClosedStudents && data.forceClosedStudents.includes(emailKey)) {
                showCustomModal("Force Closed", "Admin has force closed your session.", false, () => submitQuiz(true));
                setTimeout(() => submitQuiz(true), 2000);
            }
        }).subscribe();
        
    renderQuestion();
    debouncedReportLiveProgress();
}

function initPracticeMode() {
    document.getElementById('quiz-timer').style.display = 'none';
    const endBtn = document.getElementById('end-practice-btn');
    if(endBtn) endBtn.style.display = 'block';
    
    currentQuiz = [];
    const mode = localStorage.getItem('practiceMode');
    
    if (mode === 'topic') {
        const selectedTopic = localStorage.getItem('practiceTopic');
        const tObj = QUESTIONS_DATA.find(t => t.topic === selectedTopic);
        if (tObj) {
            let pool = shuffleArray([...tObj.questions]);
            currentQuiz = pool.slice(0, 50);
        }
    } else {
        QUESTIONS_DATA.forEach(t => currentQuiz = currentQuiz.concat(t.questions));
        currentQuiz = shuffleArray(currentQuiz).slice(0, 50);
    }
    renderQuestion();
    if (testData) debouncedReportLiveProgress();
}

function updateTimerDisplay() {
    const mins = Math.floor(Math.max(0, timeRemaining) / 60);
    const secs = Math.max(0, timeRemaining) % 60;
    const timerEl = document.getElementById('quiz-timer');
    timerEl.textContent = `⏱️ ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    if (timeRemaining < 60) timerEl.style.color = 'var(--red)';
}

function renderQuestion() {
    const qNumEl = document.getElementById('current-q-num');
    const totQEl = document.getElementById('total-q-num');
    const qTextEl = document.getElementById('question-text');
    const qTextHiEl = document.getElementById('question-text-hi');
    const grid = document.getElementById('options-grid');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const submitBtn = document.getElementById('submit-btn');

    if (!qTextEl || !grid) return; // Defensive check

    if (!currentQuiz || currentQuiz.length === 0) {
        qTextEl.textContent = 'Error: No questions found!';
        if (qTextHiEl) qTextHiEl.textContent = '';
        grid.innerHTML = '';
        return;
    }
    
    const q = currentQuiz[currentIndex];
    
    if (qNumEl) qNumEl.textContent = currentIndex + 1;
    if (totQEl) totQEl.textContent = currentQuiz.length;
    qTextEl.textContent = q.q;
    if (qTextHiEl) qTextHiEl.textContent = q.q_hi || '';
    
    grid.innerHTML = '';
    
    const letters = ['A', 'B', 'C', 'D'];
    q.o.forEach((opt, idx) => {
        const div = document.createElement('div');
        div.className = 'option-card';
        if (userAnswers[currentIndex] === idx) div.classList.add('selected');
        
        div.onclick = () => selectOption(idx);
        
        const hiText = (q.o_hi && q.o_hi[idx]) ? `<div style="font-size:0.85rem; color:var(--text-muted); margin-top:4px;">${escapeHTML(q.o_hi[idx])}</div>` : '';
        
        div.innerHTML = `
            <div class="option-letter">${letters[idx]}</div>
            <div>
                <div class="option-text">${escapeHTML(opt)}</div>
                ${hiText}
            </div>
        `;
        grid.appendChild(div);
    });
    
    if (prevBtn) prevBtn.disabled = currentIndex === 0;
    
    if (currentIndex === currentQuiz.length - 1) {
        if (nextBtn) nextBtn.style.display = 'none';
        if (submitBtn) submitBtn.style.display = 'block';
    } else {
        if (nextBtn) nextBtn.style.display = 'block';
        if (submitBtn) submitBtn.style.display = 'none';
    }
}

function selectOption(idx) {
    if (isSubmitting) return;
    userAnswers[currentIndex] = idx;
    renderQuestion();
    if(testData) debouncedReportLiveProgress();
}

function nextQuestion() {
    if (currentIndex < currentQuiz.length - 1) {
        currentIndex++;
        renderQuestion();
    }
}

function prevQuestion() {
    if (currentIndex > 0) {
        currentIndex--;
        renderQuestion();
    }
}

const debouncedReportLiveProgress = debounce(async () => {
    if (!testData || isSubmitting) return;
    if (!navigator.onLine) {
        offlineBuffer = true;
        return;
    }
    
    const answered = Object.keys(userAnswers).length;
    const emailKey = student ? student.email : studentName;
    try {
        // FIXED: Using atomic RPC to avoid JSON race conditions
        const { error } = await supabaseClient.rpc('upsert_live_progress', {
            p_test_code: testData.code,
            p_email_key: emailKey,
            p_student_name: studentName,
            p_student_email: student ? student.email : '',
            p_answered: answered,
            p_total: currentQuiz.length
        });
        
        if (error) throw error;
        offlineBuffer = false;
    } catch(e) { 
        console.error('Live progress sync failed:', e); 
        offlineBuffer = true;
    }
}, 1500);

function confirmEarlySubmit() {
    const answered = Object.keys(userAnswers).length;
    showCustomModal(
        "End Practice", 
        `You have attempted ${answered} out of ${currentQuiz.length} questions. Are you sure you want to end practice early?`,
        true, 
        () => submitQuiz(true)
    );
}

// Triggered by the new submit button in quiz.html
function triggerSubmitConfirmation() {
    if (isSubmitting) return;
    if (testData) {
        const answered = Object.keys(userAnswers).length;
        if (answered < currentQuiz.length) {
            showCustomModal(
                "Incomplete Test",
                `You have only answered ${answered} out of ${currentQuiz.length} questions. Are you sure you want to submit? Unanswered questions will be marked as incorrect.`,
                true,
                () => submitQuiz(true)
            );
            return;
        }
    }
    // If all answered or not testData, just confirm normally
    showCustomModal(
        "Confirm Submission",
        "Are you sure you want to submit your assessment?",
        true,
        () => submitQuiz(true)
    );
}

async function submitQuiz(force = false) {
    if (isSubmitting) return;
    isSubmitting = true;
    
    if (liveTestTimer) clearInterval(liveTestTimer);
    if (window.studentRealtimeSub) supabaseClient.removeChannel(window.studentRealtimeSub);
    document.getElementById('submit-btn').textContent = 'Submitting...';
    document.getElementById('submit-btn').disabled = true;
    
    // PRE-FLIGHT AUTH CHECK (Session Refresh)
    if (typeof ensureSupabaseSession === 'function') {
        await ensureSupabaseSession();
    }
    
    score = 0;
    const attempted = Object.keys(userAnswers).length;
    currentQuiz.forEach((q, idx) => {
        if (userAnswers[idx] === q.a) score++;
    });

    if (testData) {
        const detailed = currentQuiz.map((q, idx) => ({
            questionText: q.q, options: q.o, correctAnswerIndex: q.a, studentAnswerIndex: userAnswers[idx] !== undefined ? userAnswers[idx] : null
        }));
        
        const payload = {
            studentName, studentEmail: student ? student.email : '',
            score, total: currentQuiz.length, submittedAt: new Date().toISOString(), detailedResults: detailed
        };
        
        let retries = 3;
        let success = false;
        while (retries > 0 && !success) {
            try {
                if (!navigator.onLine) throw new Error('Offline');
                
                // FIXED: Try atomic RPC to prevent JSON race conditions
                const { error: updateErr } = await supabaseClient.rpc('submit_test_result', {
                    p_test_code: testData.code,
                    p_payload: payload,
                    p_email_key: student ? student.email : studentName
                });
                
                if (updateErr) {
                    console.warn("RPC failed (likely missing on Supabase). Falling back to standard update.", updateErr.message);
                    
                    // Fallback to standard fetch & update if RPC does not exist
                    const { data: currentTest, error: fetchErr } = await supabaseClient
                        .from('tests')
                        .select('submissions')
                        .eq('code', testData.code)
                        .single();
                        
                    if (fetchErr) throw fetchErr;
                    
                    let submissions = currentTest.submissions || {};
                    submissions[student ? student.email : studentName] = payload;
                    
                    const { error: fallbackUpdateErr } = await supabaseClient
                        .from('tests')
                        .update({ submissions })
                        .eq('code', testData.code);
                        
                    if (fallbackUpdateErr) throw fallbackUpdateErr;
                }
                
                success = true;
            } catch(e) { 
                console.error('Test submission failed:', e);
                retries--;
                if (retries === 0) {
                    isSubmitting = false;
                    const submitBtnEl = document.getElementById('submit-btn');
                    if (submitBtnEl) {
                        submitBtnEl.textContent = 'Submit Test';
                        submitBtnEl.disabled = false;
                    }
                    
                    showCustomModal(
                        "Critical Error", 
                        "Failed to submit to server. Please check your internet connection and try again. Your progress is saved locally.", 
                        false
                    );
                    return; // Halt submission so user doesn't lose work
                }
                await new Promise(r => setTimeout(r, 2000)); // wait before retry
            }
        }
    }
    
    const incorrect = attempted - score;
    localStorage.setItem('lastQuizResults', JSON.stringify({ 
        score, attempted, incorrect, total: currentQuiz.length, isPractice: !testData
    }));
    
    // --- Gamification: Update Streak ---
    if (student && student.email) {
        try {
            const { data: sData, error: sErr } = await supabaseClient.from('students').select('current_streak, last_activity_date').eq('email', student.email).single();
            if (!sErr && sData) {
                const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
                let newStreak = sData.current_streak || 0;
                
                if (sData.last_activity_date === todayStr) {
                    // Case B: Already practiced today, unchanged.
                } else if (sData.last_activity_date) {
                    const lastDate = new Date(sData.last_activity_date);
                    const todayDate = new Date(todayStr);
                    const diffTime = Math.abs(todayDate - lastDate);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    if (diffDays === 1) {
                        newStreak += 1;
                    } else {
                        newStreak = 1; // Missed a day
                    }
                } else {
                    newStreak = 1; // First time
                }
                
                if (sData.last_activity_date !== todayStr) {
                    await supabaseClient.from('students').update({
                        current_streak: newStreak,
                        last_activity_date: todayStr
                    }).eq('email', student.email);
                }
            }
        } catch(e) {
            console.error("Failed to update streak:", e);
        }
    }
    
    localStorage.removeItem('activeTest');
    localStorage.removeItem('activeTestStudentName');
    window.location.href = 'student.html';
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initQuiz);
} else {
    initQuiz();
}

// --- ANTI-CHEAT SECURITY MODULE ---
let cheatWarnings = 0;

function handleFocusLoss() {
    if (testData && !isSubmitting) {
        cheatWarnings++;
        if (cheatWarnings >= 3) {
            showCustomModal("Security Violation", "You clicked outside the exam window or switched apps 3 times. Your test has been auto-submitted.", false, () => submitQuiz(true));
            setTimeout(() => submitQuiz(true), 2000);
        } else {
            showCustomModal("Warning", `(${cheatWarnings}/3): Do not switch apps, click outside the window, or lose focus during a live test. Your test will auto-submit after 3 warnings!`, false);
        }
    }
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') handleFocusLoss();
});

window.addEventListener('blur', handleFocusLoss);

document.addEventListener('contextmenu', e => { if (testData) e.preventDefault(); });
document.addEventListener('copy', e => { if (testData) e.preventDefault(); });
document.addEventListener('paste', e => { if (testData) e.preventDefault(); });
document.addEventListener('keydown', e => {
    if (testData && (e.ctrlKey || e.metaKey)) {
        if (['c', 'v', 'x', 'p', 's'].includes(e.key.toLowerCase())) {
            e.preventDefault();
        }
    }
});