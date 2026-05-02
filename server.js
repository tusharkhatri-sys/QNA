const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const SUPABASE_URL = 'https://gxfojevrtvexfootbzjw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4Zm9qZXZydHZleGZvb3Riemp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NDg5MTMsImV4cCI6MjA5MzAyNDkxM30.0MP9rW4UdOYT3irbPqCjY352g8vr1b92zymXeqsnD8w';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[tag] || tag));
}

// Sanitize codes to prevent prototype pollution
function sanitizeCode(code) {
    const upper = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 10);
    if (['__PROTO__', 'CONSTRUCTOR', 'PROTOTYPE'].includes(upper)) return null;
    return upper;
}

// Generate unique 6 character code
function generateCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// === API ROUTES ===

// 1. Create a test (Admin)
app.post('/api/tests', async (req, res) => {
    try {
        const { name, duration, topicConfig } = req.body;
        let code = generateCode();

        const newTest = {
            code,
            name: escapeHTML(name || 'Untitled Test').substring(0, 100),
            duration: Math.min(Math.max(parseInt(duration) || 30, 1), 300),
            topicConfig: topicConfig || {},
            isActive: true,
            students: [],
            liveStudents: {},
            createdAt: new Date().toISOString()
        };

        const { error } = await supabase.from('tests').insert({ code, data: newTest });
        if (error) {
            return res.status(500).json({ success: false, message: 'Database error: ' + error.message });
        }

        res.json({ success: true, code, test: newTest });
    } catch (e) {
        console.error('POST /api/tests error:', e.message);
        res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
});

// 2. Get all tests (Admin)
app.get('/api/tests', async (req, res) => {
    try {
        const { data, error } = await supabase.from('tests').select('data');
        if (error || !data) return res.json([]);
        const testsList = data.map(row => row.data).filter(Boolean);
        res.json(testsList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch (e) {
        console.error('GET /api/tests error:', e.message);
        res.json([]);
    }
});

// 3. Join a test (Student)
app.get('/api/tests/:code', async (req, res) => {
    try {
        const code = sanitizeCode(req.params.code);
        if (!code) return res.status(400).json({ success: false, message: 'Invalid code.' });

        const studentEmail = String(req.query.email || '').trim().toLowerCase();

        const { data, error } = await supabase.from('tests').select('data').eq('code', code).single();

        if (data && data.data) {
            if (data.data.isActive === false) return res.status(403).json({ success: false, message: 'This test has been ended by the Admin.' });

            // Check if student already submitted this test
            if (studentEmail && data.data.students && data.data.students.length > 0) {
                const alreadySubmitted = data.data.students.find(s =>
                    s.studentEmail && s.studentEmail.toLowerCase() === studentEmail
                );
                if (alreadySubmitted) {
                    return res.status(403).json({ success: false, message: 'You have already taken this test. Each student can only attempt a test once.' });
                }
            }

            const testData = {
                code: data.data.code,
                name: data.data.name,
                duration: data.data.duration,
                topicConfig: data.data.topicConfig
            };
            res.json({ success: true, test: testData });
        } else {
            res.status(404).json({ success: false, message: 'Test not found or invalid code.' });
        }
    } catch (e) {
        console.error('GET /api/tests/:code error:', e.message);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// 4. Update test progress (Student)
app.post('/api/tests/:code/progress', async (req, res) => {
    try {
        const code = sanitizeCode(req.params.code);
        if (!code) return res.status(400).end();

        let { studentName, answered, total } = req.body;
        studentName = escapeHTML(studentName || 'Unknown').substring(0, 50);
        answered = Math.max(0, parseInt(answered) || 0);
        total = Math.max(1, parseInt(total) || 1);

        const { data } = await supabase.from('tests').select('data').eq('code', code).single();

        if (data && data.data) {
            let testObj = data.data;
            if (!testObj.liveStudents) testObj.liveStudents = {};

            testObj.liveStudents[studentName] = {
                answered,
                total,
                lastUpdated: new Date().toISOString()
            };

            await supabase.from('tests').update({ data: testObj }).eq('code', code);
            res.json({ success: true });
        } else {
            res.status(404).json({ success: false, message: 'Test not found.' });
        }
    } catch (e) {
        console.error('POST /api/tests/:code/progress error:', e.message);
        res.status(500).json({ success: false });
    }
});

// 5. Submit test results (Student)
app.post('/api/tests/:code/submit', async (req, res) => {
    try {
        const code = sanitizeCode(req.params.code);
        if (!code) return res.status(400).end();

        let { studentName, studentEmail, score, total, detailedResults } = req.body;
        studentName = escapeHTML(studentName || 'Unknown').substring(0, 50);
        // DO NOT escape email — it must match raw email stored in students table
        studentEmail = String(studentEmail || '').substring(0, 100).trim();
        score = Math.max(0, parseInt(score) || 0);
        total = Math.max(1, parseInt(total) || 1);

        const { data } = await supabase.from('tests').select('data').eq('code', code).single();

        if (data && data.data) {
            let testObj = data.data;
            if (!testObj.students) testObj.students = [];
            if (!testObj.liveStudents) testObj.liveStudents = {};

            testObj.students.push({
                studentName,
                studentEmail,
                score,
                total,
                detailedResults: Array.isArray(detailedResults) ? detailedResults : [],
                submittedAt: new Date().toISOString()
            });
            delete testObj.liveStudents[studentName];

            await supabase.from('tests').update({ data: testObj }).eq('code', code);
            res.json({ success: true, message: 'Results submitted successfully!' });
        } else {
            res.status(404).json({ success: false, message: 'Test not found.' });
        }
    } catch (e) {
        console.error('POST /api/tests/:code/submit error:', e.message);
        res.status(500).json({ success: false, message: 'Server error during submission.' });
    }
});

// 6. Student Register
app.post('/api/students/register', async (req, res) => {
    try {
        let { name, email, password } = req.body;
        name = escapeHTML(String(name || '')).substring(0, 50);
        // DO NOT escape email - it needs to match for lookups
        email = String(email || '').substring(0, 100).trim().toLowerCase();
        password = String(password || '').substring(0, 100);

        if (!name || !email || !password) return res.status(400).json({ success: false, message: 'Missing fields' });
        if (password.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });

        // Step 1: Check if already registered in our table
        const { data: existing } = await supabase.from('students').select('id').eq('email', email).single();
        if (existing) return res.status(400).json({ success: false, message: 'Email already registered' });

        // Step 2: Use Supabase Auth for Gmail confirmation handling
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: password
        });

        if (authError) return res.status(400).json({ success: false, message: authError.message });

        // Step 3: Insert into custom students table (password stored for admin visibility as requested)
        const newStudent = { name, email, password };
        const { data, error } = await supabase.from('students').insert([newStudent]).select().single();

        if (error) return res.status(500).json({ success: false, message: error.message });

        res.json({ success: true, message: 'Registration successful! Please check your email inbox to confirm your account before logging in.' });
    } catch (e) {
        console.error('POST /api/students/register error:', e.message);
        res.status(500).json({ success: false, message: 'Server error during registration.' });
    }
});

// 7. Student Login
app.post('/api/students/login', async (req, res) => {
    try {
        let { email, password } = req.body;
        email = String(email || '').trim().toLowerCase();
        password = String(password || '');

        if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required.' });

        // Step 1: Use Supabase Auth to login
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (authError) {
            return res.status(401).json({ success: false, message: authError.message });
        }

        // Step 2: Fetch student details from our table
        const { data, error } = await supabase.from('students')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !data) return res.status(401).json({ success: false, message: 'Account details not found in database.' });

        res.json({ success: true, student: data });
    } catch (e) {
        console.error('POST /api/students/login error:', e.message);
        res.status(500).json({ success: false, message: 'Server error during login.' });
    }
});

// 8. Admin Get All Students
app.get('/api/students', async (req, res) => {
    try {
        const { data, error } = await supabase.from('students').select('*').order('created_at', { ascending: false });
        if (error) return res.status(500).json([]);
        res.json(data || []);
    } catch (e) {
        console.error('GET /api/students error:', e.message);
        res.json([]);
    }
});

// 9. Admin Delete Student
app.delete('/api/students/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!id || id.length > 50) return res.status(400).json({ success: false });
        const { error } = await supabase.from('students').delete().eq('id', id);
        if (error) return res.status(500).json({ success: false });
        res.json({ success: true });
    } catch (e) {
        console.error('DELETE /api/students/:id error:', e.message);
        res.status(500).json({ success: false });
    }
});

// 10. Student Test History & Analytics
app.get('/api/students/:email/history', async (req, res) => {
    try {
        const email = decodeURIComponent(req.params.email).trim().toLowerCase();
        const { data, error } = await supabase.from('tests').select('data');
        if (error || !data) return res.json([]);

        let history = [];
        data.forEach(row => {
            const test = row.data;
            if (test && test.students) {
                // Match both raw and potentially escaped emails
                const studentSub = test.students.find(s =>
                    s.studentEmail === email ||
                    s.studentEmail?.toLowerCase() === email
                );
                if (studentSub) {
                    history.push({
                        testCode: test.code,
                        testName: test.name,
                        score: studentSub.score,
                        total: studentSub.total,
                        submittedAt: studentSub.submittedAt
                    });
                }
            }
        });

        res.json(history.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)));
    } catch (e) {
        console.error('GET /api/students/:email/history error:', e.message);
        res.json([]);
    }
});

// 11. Admin: Toggle Test Status
app.post('/api/tests/:code/status', async (req, res) => {
    try {
        const code = sanitizeCode(req.params.code);
        if (!code) return res.status(400).json({ success: false });
        const { isActive } = req.body;

        const { data } = await supabase.from('tests').select('data').eq('code', code).single();
        if (data && data.data) {
            let testObj = data.data;
            testObj.isActive = !!isActive;
            await supabase.from('tests').update({ data: testObj }).eq('code', code);
            res.json({ success: true });
        } else {
            res.status(404).json({ success: false });
        }
    } catch (e) {
        console.error('POST /api/tests/:code/status error:', e.message);
        res.status(500).json({ success: false });
    }
});

// 12. Admin: Delete Test
app.delete('/api/tests/:code', async (req, res) => {
    try {
        const code = sanitizeCode(req.params.code);
        if (!code) return res.status(400).json({ success: false });
        const { error } = await supabase.from('tests').delete().eq('code', code);
        res.json({ success: !error });
    } catch (e) {
        console.error('DELETE /api/tests/:code error:', e.message);
        res.status(500).json({ success: false });
    }
});

// 13. Global Leaderboard (Accuracy-based: Average % across all tests)
app.get('/api/leaderboard', async (req, res) => {
    try {
        const { data, error } = await supabase.from('tests').select('data');
        if (error || !data) return res.json([]);

        let studentScores = {};
        data.forEach(row => {
            if (row.data && row.data.students) {
                row.data.students.forEach(s => {
                    if (!s.studentEmail) return;
                    const emailKey = s.studentEmail.toLowerCase();
                    const studentScore = parseInt(s.score) || 0;
                    const studentTotal = parseInt(s.total) || 1;
                    if (!studentScores[emailKey]) {
                        studentScores[emailKey] = {
                            name: s.studentName,
                            email: emailKey,
                            totalScore: 0,
                            totalPossible: 0,
                            testsTaken: 0
                        };
                    }
                    studentScores[emailKey].totalScore += studentScore;
                    studentScores[emailKey].totalPossible += studentTotal;
                    studentScores[emailKey].testsTaken += 1;
                });
            }
        });

        // Calculate average percentage for each student
        const leaderboard = Object.values(studentScores).map(s => ({
            ...s,
            avgPercent: s.totalPossible > 0 ? Math.round((s.totalScore / s.totalPossible) * 100) : 0
        }));

        // Sort by accuracy (avgPercent) descending, tiebreaker: more tests taken wins
        leaderboard.sort((a, b) => {
            if (b.avgPercent !== a.avgPercent) return b.avgPercent - a.avgPercent;
            return b.testsTaken - a.testsTaken;
        });

        res.json(leaderboard.slice(0, 50));
    } catch (e) {
        console.error('GET /api/leaderboard error:', e.message);
        res.json([]);
    }
});

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Global error handler — prevents server crash on unhandled route errors
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err.message);
    res.status(500).json({ success: false, message: 'Internal server error.' });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
