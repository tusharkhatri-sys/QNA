document.addEventListener('DOMContentLoaded', () => {
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    const form = document.getElementById('result-form');
    const emailInput = document.getElementById('res-email');
    const dobInput = document.getElementById('res-dob');
    const btn = document.getElementById('view-result-btn');
    const marksheetDisplay = document.getElementById('marksheet-display');
    const alertBox = document.getElementById('result-alert');

    function showAlert(msg, type) {
        alertBox.textContent = msg;
        alertBox.className = `mb-6 p-3 rounded-md text-sm font-bold ${type === 'error' ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'}`;
        alertBox.classList.remove('hidden');
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        alertBox.classList.add('hidden');
        marksheetDisplay.classList.add('hidden');
        btn.textContent = 'Verifying...';
        btn.disabled = true;

        const email = emailInput.value.trim();
        const dob = dobInput.value;

        try {
            // 1. Verify Student
            const { data: studentData, error: studentError } = await supabaseClient
                .from('students')
                .select('name, email, dob, trade')
                .eq('email', email)
                .single();

            if (studentError || !studentData) {
                throw new Error("Student not found. Please check your email.");
            }

            if (studentData.dob !== dob) {
                throw new Error("Date of Birth does not match our records.");
            }

            // 2. Fetch Latest Published Test
            const { data: publishedTests, error: testError } = await supabaseClient
                .from('tests')
                .select('code, data, is_published')
                .eq('is_published', true)
                .order('created_at', { ascending: false })
                .limit(1);

            if (testError || !publishedTests || publishedTests.length === 0) {
                throw new Error("No published results available at this time.");
            }

            const test = publishedTests[0];
            const testName = test.data?.name || test.code;
            const passScore = test.data?.passScore || 40;
            const students = test.data?.students || [];

            // 3. Find Student Result
            const studentResult = students.find(s => s.studentEmail === email || s.studentName === studentData.name);

            if (!studentResult) {
                throw new Error(`You did not submit the exam: ${testName}`);
            }

            // 4. Calculate Percentage and Status
            const totalMarks = studentResult.total || 1;
            const score = studentResult.score || 0;
            const percentScored = studentResult.percentScored !== undefined ? studentResult.percentScored : Math.round((score / totalMarks) * 100);
            const isPassed = percentScored >= passScore;

            // 5. Render Marksheet
            renderMarksheet(studentData, testName, score, totalMarks, percentScored, isPassed, passScore, studentResult.submittedAt);
            
            form.classList.add('hidden');
            marksheetDisplay.classList.remove('hidden');

        } catch (err) {
            console.error(err);
            showAlert(err.message, 'error');
        } finally {
            btn.textContent = 'View Result';
            btn.disabled = false;
        }
    });

    function renderMarksheet(student, testName, score, total, percent, isPassed, passScore, submittedAt) {
        const dateStr = submittedAt ? new Date(submittedAt).toLocaleString() : new Date().toLocaleString();
        
        marksheetDisplay.innerHTML = `
            <div class="border-2 border-gray-900 p-6 rounded-lg bg-white relative">
                <div class="absolute top-4 right-4 opacity-10">
                    <i data-lucide="award" class="w-24 h-24 text-gray-900"></i>
                </div>
                
                <div class="text-center border-b-2 border-gray-900 pb-4 mb-6 relative z-10">
                    <h1 class="text-3xl font-black uppercase tracking-widest text-gray-900 mb-1">QNA Platform</h1>
                    <h2 class="text-xl font-bold uppercase tracking-wider text-gray-700">Official Marksheet</h2>
                    <p class="text-sm font-bold text-gray-500 mt-2">Exam: ${testName}</p>
                </div>

                <div class="grid grid-cols-2 gap-4 mb-8 text-sm relative z-10">
                    <div>
                        <p class="text-gray-500 font-bold uppercase text-[10px] tracking-wider mb-1">Trainee Name</p>
                        <p class="font-black text-gray-900 text-lg uppercase">${student.name}</p>
                    </div>
                    <div>
                        <p class="text-gray-500 font-bold uppercase text-[10px] tracking-wider mb-1">Trade</p>
                        <p class="font-bold text-gray-900">${student.trade || 'COPA'}</p>
                    </div>
                    <div>
                        <p class="text-gray-500 font-bold uppercase text-[10px] tracking-wider mb-1">Date of Birth</p>
                        <p class="font-bold text-gray-900">${student.dob}</p>
                    </div>
                    <div>
                        <p class="text-gray-500 font-bold uppercase text-[10px] tracking-wider mb-1">Submission Date</p>
                        <p class="font-bold text-gray-900">${dateStr}</p>
                    </div>
                </div>

                <div class="bg-gray-50 border border-gray-300 rounded-md p-4 mb-6 relative z-10">
                    <table class="w-full text-left">
                        <thead>
                            <tr class="border-b-2 border-gray-900 text-xs uppercase tracking-wider font-bold text-gray-600">
                                <th class="pb-2">Subject/Topic</th>
                                <th class="pb-2 text-right">Max Marks</th>
                                <th class="pb-2 text-right">Marks Obtained</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr class="border-b border-gray-200">
                                <td class="py-3 font-bold text-gray-900">Theory & Practical</td>
                                <td class="py-3 text-right font-mono font-bold text-gray-600">${total}</td>
                                <td class="py-3 text-right font-mono font-bold text-gray-900 text-lg">${score}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="flex justify-between items-end relative z-10 border-t-2 border-gray-900 pt-6">
                    <div>
                        <p class="text-gray-500 font-bold uppercase text-[10px] tracking-wider mb-1">Result Status</p>
                        <div class="text-2xl font-black uppercase tracking-wider ${isPassed ? 'text-green-700' : 'text-red-700'}">
                            ${isPassed ? 'PASS' : 'FAIL'}
                        </div>
                        <p class="text-xs font-bold text-gray-500 mt-1">Passing Criteria: ${passScore}%</p>
                    </div>
                    <div class="text-right">
                        <p class="text-gray-500 font-bold uppercase text-[10px] tracking-wider mb-1">Final Percentage</p>
                        <div class="text-4xl font-black text-gray-900">${percent}%</div>
                    </div>
                </div>

                <div class="mt-8 pt-4 border-t border-gray-200 flex gap-4 justify-center">
                    <button onclick="window.print()" class="bg-gray-900 hover:bg-black text-white font-bold py-2 px-6 rounded-sm transition-colors text-sm uppercase tracking-wider flex items-center gap-2">
                        <i data-lucide="printer" class="w-4 h-4"></i> Print Marksheet
                    </button>
                    <button onclick="location.reload()" class="bg-white hover:bg-gray-100 border border-gray-300 text-gray-800 font-bold py-2 px-6 rounded-sm transition-colors text-sm uppercase tracking-wider">
                        Close
                    </button>
                </div>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
});
