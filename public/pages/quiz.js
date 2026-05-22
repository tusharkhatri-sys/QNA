const testData = JSON.parse(localStorage.getItem('activeTest'));
const studentName = localStorage.getItem('activeTestStudentName');
const student = getLoggedInStudent();

let currentQuiz = [];
let currentIndex = 0;
let userAnswers = {};
let score = 0;
let timeRemaining = 0;
let liveTestTimer = null;

if (!testData && !localStorage.getItem('practiceMode')) {
    window.location.href = 'student.html';
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
    const config = testData.topicConfig || {};
    for (const [topicName, count] of Object.entries(config)) {
        const tObj = QUESTIONS_DATA.find(t => t.topic === topicName);
        if (tObj) {
            let pool = [...tObj.questions];
            for (let i = pool.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [pool[i], pool[j]] = [pool[j], pool[i]];
            }
            currentQuiz = currentQuiz.concat(pool.slice(0, count));
        }
    }
    for (let i = currentQuiz.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [currentQuiz[i], currentQuiz[j]] = [currentQuiz[j], currentQuiz[i]];
    }
    
    timeRemaining = testData.duration * 60;
    updateTimerDisplay();
    liveTestTimer = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();
        if (timeRemaining <= 0) {
            clearInterval(liveTestTimer);
            alert("Time's up! Your test will be auto-submitted.");
            submitQuiz();
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
                alert('Test was closed by admin. Submitting your current progress...');
                submitQuiz(); 
            }
            
            const emailKey = student ? student.email : studentName;
            if (data.forceClosedStudents && data.forceClosedStudents.includes(emailKey)) {
                alert('Admin has force closed your session.');
                submitQuiz();
            }
        }).subscribe();
        
    renderQuestion();
    reportLiveProgress();
}

function initPracticeMode() {
    document.getElementById('quiz-timer').style.display = 'none';
    currentQuiz = [];
    QUESTIONS_DATA.forEach(t => currentQuiz = currentQuiz.concat(t.questions));
    
    if(localStorage.getItem('practiceMode') === 'random') {
        for (let i = currentQuiz.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [currentQuiz[i], currentQuiz[j]] = [currentQuiz[j], currentQuiz[i]];
        }
        currentQuiz = currentQuiz.slice(0, 50);
    }
    renderQuestion();
}

function updateTimerDisplay() {
    const mins = Math.floor(timeRemaining / 60);
    const secs = timeRemaining % 60;
    document.getElementById('quiz-timer').textContent = `⏱️ ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    if (timeRemaining < 60) document.getElementById('quiz-timer').style.color = 'var(--red)';
}

function renderQuestion() {
    if (!currentQuiz || currentQuiz.length === 0) {
        document.getElementById('question-text').textContent = 'Error: No questions found! Admin might not have selected any questions for this test.';
        document.getElementById('question-text-hi').textContent = '';
        document.getElementById('options-grid').innerHTML = '';
        return;
    }
    const q = currentQuiz[currentIndex];
    
    document.getElementById('current-q-num').textContent = currentIndex + 1;
    document.getElementById('total-q-num').textContent = currentQuiz.length;
    document.getElementById('question-text').textContent = q.q;
    document.getElementById('question-text-hi').textContent = q.q_hi || '';
    
    const grid = document.getElementById('options-grid');
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
    
    document.getElementById('prev-btn').disabled = currentIndex === 0;
    
    if (currentIndex === currentQuiz.length - 1) {
        document.getElementById('next-btn').style.display = 'none';
        document.getElementById('submit-btn').style.display = 'block';
    } else {
        document.getElementById('next-btn').style.display = 'block';
        document.getElementById('submit-btn').style.display = 'none';
    }
}

function selectOption(idx) {
    userAnswers[currentIndex] = idx;
    renderQuestion();
    if(testData) reportLiveProgress();
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

async function reportLiveProgress() {
    if (!testData) return;
    const answered = Object.keys(userAnswers).length;
    const emailKey = student ? student.email : studentName;
    try {
        const { data: dbTest } = await supabaseClient.from('tests').select('data').eq('code', testData.code).single();
        if (dbTest) {
            if (!dbTest.data.liveStudents) dbTest.data.liveStudents = {};
            dbTest.data.liveStudents[emailKey] = {
                studentName, studentEmail: student ? student.email : '',
                answered, total: currentQuiz.length,
                joinedAt: dbTest.data.liveStudents[emailKey]?.joinedAt || new Date().toISOString()
            };
            await supabaseClient.from('tests').update({ data: dbTest.data }).eq('code', testData.code);
        }
    } catch(e) {}
}

async function submitQuiz() {
    if (liveTestTimer) clearInterval(liveTestTimer);
    if (window.studentRealtimeSub) supabaseClient.removeChannel(window.studentRealtimeSub);
    
    score = 0;
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
        
        try {
            const emailKey = student ? student.email : studentName;
            const { data: dbTest } = await supabaseClient.from('tests').select('data').eq('code', testData.code).single();
            if (dbTest) {
                if (dbTest.data.liveStudents && dbTest.data.liveStudents[emailKey]) delete dbTest.data.liveStudents[emailKey];
                if (!dbTest.data.students) dbTest.data.students = [];
                dbTest.data.students.push(payload);
                await supabaseClient.from('tests').update({ data: dbTest.data }).eq('code', testData.code);
            }
        } catch(e) {}
    }
    
    // Save results to local storage to show in results screen
    localStorage.setItem('lastQuizResults', JSON.stringify({ score, total: currentQuiz.length }));
    localStorage.removeItem('activeTest');
    localStorage.removeItem('activeTestStudentName');
    window.location.href = 'student.html'; // Or results.html if implemented
}

initQuiz();