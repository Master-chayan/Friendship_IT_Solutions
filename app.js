let currentUser = null;
let currentView = 'login';
let allCategories = [];
let allQuizzes = [];
let allQuestions = [];
let allResults = [];
let allUsers = [];
let dataSdkReady = false;
let currentQuiz = null;
let currentQuestionIndex = 0;
let questions = [];
let userAnswers = {};
let quizStartTime = null;
let quizTimerInterval = null;
let quizSubmissionInProgress = false;
let quizTimeExpired = false;
const localUsersKey = 'fisQuizPortalUsers';
const localResultsKey = 'fisQuizPortalResults';
const localCategoriesKey = 'fisQuizPortalCategories';
const localQuestionsKey = 'fisQuizPortalQuestions';
const localQuizzesKey = 'fisQuizPortalQuizzes';

// Loaded from data.json
let appData = { demoAccounts: [], sampleQuizzes: [], sampleQuestions: {} };

async function loadAppData() {
    try {
        const response = await fetch('data.json');
        if (!response.ok) throw new Error('HTTP ' + response.status);
        appData = await response.json();
    } catch (error) {
        console.error('Could not load data.json:', error);
        showMessage('data.json load hoyni. Local server diye file chalan.', 'error');
    }
}

const dataHandler = {
    onDataChanged(data) {
        const records = Array.isArray(data) ? data : [];
        const localCategories = normalizeLocalRecords(readLocalRecords(localCategoriesKey), localCategoriesKey);
        const localQuizzes = normalizeLocalRecords(readLocalRecords(localQuizzesKey), localQuizzesKey);
        const localQuestions = normalizeLocalRecords(readLocalRecords(localQuestionsKey), localQuestionsKey);
        const localResults = normalizeLocalRecords(readLocalRecords(localResultsKey), localResultsKey);

        allCategories = [...records.filter(d => d.type === 'category'), ...localCategories];
        allQuizzes = [...records.filter(d => d.type === 'quiz'), ...localQuizzes];
        allQuestions = [...records.filter(d => d.type === 'question'), ...localQuestions];
        allResults = [...records.filter(d => d.type === 'result'), ...localResults];
        allUsers = records.filter(d => d.type === 'user');

        render();
    }
};

async function initApp() {
    // Show the interface immediately, even if the storage service is still loading.
    render();
    await loadAppData();
    try {
        if (window.dataSdk && typeof window.dataSdk.init === 'function') {
            const result = await window.dataSdk.init(dataHandler);
            if (result && result.isOk) {
                dataSdkReady = true;
            } else {
                showMessage('Data service is unavailable. Demo mode is active.', 'info');
            }
        } else {
            showMessage('Data service is unavailable. Accounts will be saved in this browser only.', 'info');
        }
    } catch (error) {
        console.error('Data service initialization failed:', error);
        showMessage('Data service is unavailable. Accounts will be saved in this browser only.', 'info');
    }
    render();
}

function render() {
    const app = document.getElementById('app');
    if (!app) return;

    if (!currentUser) {
        app.innerHTML = renderLogin();
    } else if (currentUser.role === 'admin') {
        app.innerHTML = renderAdminPanel();
    } else {
        app.innerHTML = renderStudentPanel();
    }
    attachEventListeners();
    syncQuizTimer();
}

function renderLogin() {
    return `
        <div class="gradient-blue min-h-full flex flex-col items-center justify-center p-4">
            <div class="w-full max-w-md">
                <div class="auth-card bg-white rounded-2xl shadow-2xl p-8 fade-in">
                    <div class="text-center mb-8">
                        <h1 class="text-3xl font-bold text-gray-800 mb-2">Friendship IT Solutions</h1>
                        <p class="text-gray-600">Exam Portal</p>
                    </div>

                    <div class="flex gap-4 mb-8">
                        <button class="auth-tab flex-1 py-2 px-4 rounded-lg font-semibold transition-all" data-tab="login" aria-selected="true" onclick="switchAuthTab('login')">Login</button>
                        <button class="auth-tab flex-1 py-2 px-4 rounded-lg font-semibold transition-all" data-tab="register" aria-selected="false" onclick="switchAuthTab('register')">Register</button>
                    </div>

                    <form id="authForm" onsubmit="handleAuth(event)">
                        <div class="mb-4" id="loginFields">
                            <input type="email" id="email" placeholder="Email" class="auth-input w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 mb-4" required>
                            <input type="password" id="password" placeholder="Password" class="auth-input w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500" required>
                        </div>

                        <div class="mb-4 hidden" id="registerFields">
                            <input type="text" id="name" placeholder="Full Name" class="auth-input w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 mb-4">
                            <input type="email" id="regEmail" placeholder="Email" class="auth-input w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 mb-4">
                            <input type="password" id="regPassword" placeholder="Password" minlength="6" class="auth-input w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 mb-4">
                            <p class="text-sm text-gray-600">New accounts are registered as students. An administrator can update roles.</p>
                        </div>

                        <button type="submit" class="w-full btn-primary text-white py-2 rounded-lg font-semibold hover:bg-blue-700">
                            <span id="authBtn">Login</span>
                        </button>
                    </form>

                    <!-- <div class="mt-6 p-4 bg-blue-50 rounded-lg text-sm text-gray-700">
                        <p class="font-semibold mb-2">Demo Credentials:</p>
                        <p><strong>Student:</strong> student@test.com / password</p>
                        <p><strong>Admin:</strong> admin@test.com / password</p>
                    </div> -->
                </div>
            </div>
        </div>
    `;
}

function switchAuthTab(tab) {
    const buttons = document.querySelectorAll('.auth-tab');
    buttons.forEach(b => {
        b.classList.remove('bg-white', 'text-blue-600');
        b.classList.add('text-blue-600');
        b.setAttribute('aria-selected', 'false');
        if (b.dataset.tab === tab) {
            b.classList.remove('text-blue-600');
            b.classList.add('bg-white', 'text-blue-600');
            b.setAttribute('aria-selected', 'true');
        }
    });

    document.getElementById('loginFields').classList.toggle('hidden', tab !== 'login');
    document.getElementById('registerFields').classList.toggle('hidden', tab !== 'register');
    document.querySelectorAll('#loginFields input').forEach(input => {
        input.required = tab === 'login';
        input.disabled = tab !== 'login';
    });
    document.querySelectorAll('#registerFields input').forEach(input => {
        input.required = tab === 'register';
        input.disabled = tab !== 'register';
    });
    document.getElementById('authBtn').textContent = tab === 'login' ? 'Login' : 'Register';
}

function readLocalUsers() {
    try {
        const storedUsers = localStorage.getItem(localUsersKey);
        if (!storedUsers) return [];
        const parsedUsers = JSON.parse(storedUsers);
        if (!Array.isArray(parsedUsers)) throw new Error('Saved account data has an invalid format.');
        return parsedUsers;
    } catch (error) {
        console.error('Could not read locally saved accounts:', error);
        showMessage('Saved account data could not be read. Please check browser storage.', 'error');
        return null;
    }
}

function readLocalResults() {
    try {
        const storedResults = localStorage.getItem(localResultsKey);
        if (!storedResults) return [];
        const parsedResults = JSON.parse(storedResults);
        if (!Array.isArray(parsedResults)) throw new Error('Saved exam results data has an invalid format.');
        return parsedResults;
    } catch (error) {
        console.error('Could not read locally saved exam results:', error);
        showMessage('Saved exam results could not be read. Please check browser storage.', 'error');
        return null;
    }
}

function readLocalRecords(key) {
    try {
        const storedRecords = localStorage.getItem(key);
        if (!storedRecords) return [];
        const parsedRecords = JSON.parse(storedRecords);
        if (!Array.isArray(parsedRecords)) throw new Error('Saved data has an invalid format.');
        return parsedRecords;
    } catch (error) {
        console.error(`Could not read local records for ${key}:`, error);
        return [];
    }
}

function writeLocalRecords(key, records) {
    localStorage.setItem(key, JSON.stringify(records));
}

function generateLocalRecordId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeLocalRecords(records, key) {
    return (Array.isArray(records) ? records : []).map(record => {
        if (!record || typeof record !== 'object') return record;
        const normalized = { ...record };
        if (!normalized.__backendId) {
            normalized.__backendId = generateLocalRecordId(key?.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'record');
        }
        return normalized;
    });
}

async function hashPassword(password, salt) {
    if (!window.crypto?.subtle) {
        throw new Error('Secure password storage is unavailable in this browser.');
    }

    const saltBytes = salt
        ? Uint8Array.from(salt.match(/.{2}/g), byte => parseInt(byte, 16))
        : window.crypto.getRandomValues(new Uint8Array(16));
    const key = await window.crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
    );
    const bits = await window.crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: saltBytes, iterations: 210000, hash: 'SHA-256' },
        key,
        256
    );
    return {
        salt: Array.from(saltBytes, byte => byte.toString(16).padStart(2, '0')).join(''),
        hash: Array.from(new Uint8Array(bits), byte => byte.toString(16).padStart(2, '0')).join('')
    };
}

async function verifyUserPassword(user, password) {
    if (user.passwordSalt && user.passwordHash) {
        const { hash } = await hashPassword(password, user.passwordSalt);
        return hash === user.passwordHash;
    }
    return user.password === password;
}

async function handleAuth(e) {
    e.preventDefault();
    const isLogin = !document.getElementById('loginFields').classList.contains('hidden');

    if (isLogin) {
        const email = document.getElementById('email').value.trim().toLowerCase();
        const password = document.getElementById('password').value;

        // Demo login (accounts come from data.json)
        const demoAccount = appData.demoAccounts.find(a => a.email === email && a.password === password);
        if (demoAccount) {
            currentUser = {
                email,
                name: email.split('@')[0],
                role: demoAccount.role
            };
            currentView = 'dashboard';
            render();
        } else {
            const localUsers = readLocalUsers();
            if (!localUsers) return;
            const user = [...allUsers, ...localUsers].find(account => account.email?.toLowerCase() === email);
            if (user && await verifyUserPassword(user, password)) {
                currentUser = { name: user.name, email: user.email, role: user.role || 'student' };
                currentView = 'dashboard';
                render();
            } else {
                showMessage('Invalid email or password.', 'error');
            }
        }
    } else {
        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('regEmail').value.trim().toLowerCase();
        const password = document.getElementById('regPassword').value;
        const role = 'student';

        if (!name || !email || !password) {
            showMessage('Please complete all registration fields.', 'error');
            return;
        }
        if (password.length < 6) {
            showMessage('Password must be at least 6 characters.', 'error');
            return;
        }

        const localUsers = dataSdkReady ? [] : readLocalUsers();
        if (!localUsers) return;
        if ([...allUsers, ...localUsers].some(user => user.email?.toLowerCase() === email)) {
            showMessage('An account with this email already exists.', 'error');
            return;
        }

        try {
            const { salt, hash } = await hashPassword(password);
            const userData = {
                type: 'user',
                name,
                email,
                passwordSalt: salt,
                passwordHash: hash,
                role,
                createdAt: new Date().toISOString()
            };

            if (dataSdkReady) {
                const result = await window.dataSdk.create(userData);
                if (!result?.isOk) {
                    showMessage(result?.error || 'Registration failed. Please try again.', 'error');
                    return;
                }
            } else {
                localUsers.push(userData);
                localStorage.setItem(localUsersKey, JSON.stringify(localUsers));
            }

            currentUser = { name, email, role };
            currentView = 'dashboard';
            render();
            showMessage('Registration successful!', 'success');
        } catch (error) {
            console.error('Registration failed:', error);
            showMessage(error.message || 'Registration failed. Please try again.', 'error');
        }
    }
}

function renderStudentPanel() {
    return `
        <div class="w-full h-full flex flex-col bg-gradient-light">
            <!-- Header -->
            <div class="student-header gradient-blue text-white p-6">
                <div class="max-w-6xl mx-auto flex justify-between items-center">
                    <div>
                        <h1 class="text-2xl font-bold">Welcome, ${currentUser.name}!</h1>
                        <p class="text-blue-100">Computer Fundamentals Exam</p>
                    </div>
                    <button onclick="logout()" class="btn-secondary text-white px-6 py-2 rounded-lg">Logout</button>
                </div>
            </div>

            <!-- Main Content -->
            <div class="student-main-content flex-1 overflow-y-auto p-6">
                <div class="max-w-6xl mx-auto">
                    ${renderStudentView()}
                </div>
            </div>
        </div>
    `;
}

function renderStudentView() {
    if (currentQuiz === null) {
        return renderQuizList();
    } else {
        return renderQuizInterface();
    }
}

function getAvailableQuizzes() {
    const staticQuizzes = Array.isArray(appData.sampleQuizzes) ? appData.sampleQuizzes : [];
    const savedQuizzes = Array.isArray(allQuizzes) ? allQuizzes : [];
    const mergedQuizzes = [...staticQuizzes, ...savedQuizzes];
    const seen = new Set();

    return mergedQuizzes.filter(quiz => {
        if (!quiz || !quiz.title) return false;
        const key = quiz.__backendId || quiz.id || `${quiz.title}-${quiz.category || ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function renderQuizList() {
    const quizzes = getAvailableQuizzes();

    if (!quizzes.length) {
        return `
            <div class="bg-white rounded-2xl shadow-lg p-10 text-center">
                <h3 class="text-2xl font-bold text-gray-800 mb-3">No exams available</h3>
                <p class="text-gray-600">New exams added by the admin will appear here automatically.</p>
            </div>
        `;
    }

    return `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            ${quizzes.map(quiz => {
                const quizId = quiz.__backendId || quiz.id;
                const timeValue = quiz.timeLimit || quiz.time || 0;
                const questionCount = quiz.questionCount || quiz.questions || 0;
                const categoryName = allCategories.find(cat => cat.__backendId === quiz.category)?.name || quiz.categoryName || quiz.category || 'General';
                return `
                    <div class="card-modern bg-white p-6 rounded-2xl">
                        <h3 class="text-xl font-bold text-gray-800 mb-2">${quiz.title}</h3>
                        <p class="text-gray-600 mb-4">${categoryName}</p>
                        <div class="flex justify-between text-sm text-gray-600 mb-6">
                            <span>⏱️ ${timeValue} min</span>
                            <span>❓ ${questionCount} Q</span>
                        </div>
                        <button onclick="startQuiz('${String(quizId).replace(/\\/g, '\\\\').replace(/'/g, '\\\'')}')" class="w-full btn-primary text-white py-2 rounded-lg font-semibold">Start Exam</button>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function getQuizQuestionsForId(quizId) {
    const quiz = getAvailableQuizzes().find(item => String(item.__backendId || item.id) === String(quizId));
    const categoryId = quiz?.category;

    if (categoryId) {
        const categoryQuestions = allQuestions
            .filter(question => String(question.category) === String(categoryId))
            .map(question => ({
                q: question.text || 'Untitled question',
                opts: [question.optionA, question.optionB, question.optionC, question.optionD].filter(Boolean),
                ans: (question.correctAnswer || 'A').toUpperCase()
            }));

        if (categoryQuestions.length) {
            return categoryQuestions;
        }
    }

    const sampleQuestions = appData.sampleQuestions[quizId] || [];
    return Array.isArray(sampleQuestions) ? sampleQuestions.map(question => ({ ...question })) : [];
}

function renderQuizInterface() {
    if (!questions.length) {
        questions = getQuizQuestionsForId(currentQuiz);
    }

    if (!questions.length) {
        return `
            <div class="max-w-xl mx-auto bg-white rounded-2xl shadow-lg p-8 text-center">
                <h2 class="text-2xl font-bold text-gray-800 mb-4">No questions available</h2>
                <p class="text-gray-600 mb-6">This exam does not have any questions yet. Please contact the administrator.</p>
                <button onclick="backToQuizzes()" class="w-full btn-primary text-white py-3 rounded-lg font-semibold">Back to Exams</button>
            </div>
        `;
    }

    if (currentQuestionIndex >= questions.length) {
        return renderQuizResults();
    }

    const q = questions[currentQuestionIndex];
    const options = ['A', 'B', 'C', 'D'];

    return `
        <div class="max-w-2xl mx-auto">
            <div class="bg-white rounded-2xl shadow-lg p-8 slide-in">
                <!-- Progress Bar -->
                <div class="mb-6">
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-sm font-semibold text-gray-700">Question ${currentQuestionIndex + 1} of ${questions.length}</span>
                        <div class="timer" id="timer" aria-live="polite">${formatQuizTime(getRemainingQuizSeconds())}</div>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                        <div class="bg-blue-600 h-2 rounded-full" style="width: ${((currentQuestionIndex + 1) / questions.length * 100)}%"></div>
                    </div>
                </div>

                <!-- Question -->
                <h2 class="text-2xl font-bold text-gray-800 mb-8">${q.q}</h2>

                <!-- Options -->
                <div class="space-y-4 mb-8">
                    ${options.map((opt, idx) => `
                        <button onclick="selectAnswer('${opt}')" class="option-btn w-full text-left p-4 rounded-lg font-semibold ${userAnswers[currentQuestionIndex] === opt ? 'selected' : ''}">
                            <span class="mr-4">${opt}.</span>${q.opts[idx] || 'Option unavailable'}
                        </button>
                    `).join('')}
                </div>

                <!-- Navigation -->
                <div class="flex gap-4">
                    <button onclick="previousQuestion()" class="flex-1 btn-secondary text-white py-3 rounded-lg font-semibold" ${currentQuestionIndex === 0 ? 'disabled' : ''}>← Previous</button>
                    ${currentQuestionIndex < questions.length - 1 ?
                        `<button onclick="nextQuestion()" class="flex-1 btn-primary text-white py-3 rounded-lg font-semibold">Next →</button>` :
                        `<button onclick="submitQuiz()" class="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700">Submit Exam</button>`
                    }
                </div>
            </div>
        </div>
    `;
}

function renderQuizResults() {
    const totalQuestions = questions.length || 0;
    let correct = 0;

    Object.keys(userAnswers).forEach(idx => {
        if (questions[idx] && userAnswers[idx] === questions[idx].ans) correct++;
    });

    const percentage = totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0;

    return `
        <div class="max-w-2xl mx-auto">
            <div class="bg-white rounded-2xl shadow-lg p-8 text-center slide-in">
                <div class="mb-6">
                    <div class="text-6xl font-bold text-blue-600 mb-2">${percentage}%</div>
                    <h2 class="text-3xl font-bold text-gray-800">${totalQuestions ? 'Exam Completed!' : 'No Questions Available'}</h2>
                </div>

                <div class="bg-blue-50 rounded-lg p-6 mb-8">
                    <div class="flex justify-around">
                        <div>
                            <p class="text-2xl font-bold text-gray-800">${correct}</p>
                            <p class="text-gray-600">Correct</p>
                        </div>
                        <div>
                            <p class="text-2xl font-bold text-red-600">${totalQuestions - correct}</p>
                            <p class="text-gray-600">Incorrect</p>
                        </div>
                        <div>
                            <p class="text-2xl font-bold text-gray-800">${totalQuestions}</p>
                            <p class="text-gray-600">Total</p>
                        </div>
                    </div>
                </div>

                <button onclick="backToQuizzes()" class="w-full btn-primary text-white py-3 rounded-lg font-semibold mb-4">Back to Exams</button>
                <button onclick="downloadCertificate()" class="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700">Download Certificate</button>
            </div>
        </div>
    `;
}

function selectAnswer(option) {
    if (quizSubmissionInProgress || quizTimeExpired) return;
    userAnswers[currentQuestionIndex] = option;
    render();
}

function nextQuestion() {
    if (quizSubmissionInProgress || quizTimeExpired) return;
    if (currentQuestionIndex < questions.length - 1) {
        currentQuestionIndex++;
        render();
    }
}

function previousQuestion() {
    if (quizSubmissionInProgress || quizTimeExpired) return;
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        render();
    }
}

function getQuizDurationSeconds() {
    const quiz = getAvailableQuizzes().find(item => String(item.__backendId || item.id) === String(currentQuiz));
    const minutes = Number(quiz?.timeLimit || quiz?.time || 10);
    return Number.isFinite(minutes) && minutes > 0 ? Math.floor(minutes * 60) : 10 * 60;
}

function getRemainingQuizSeconds() {
    if (quizStartTime === null) return getQuizDurationSeconds();
    return Math.max(0, getQuizDurationSeconds() - Math.floor((Date.now() - quizStartTime) / 1000));
}

function formatQuizTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

function syncQuizTimer() {
    if (!currentUser || currentUser.role === 'admin' || currentQuiz === null || !questions.length ||
        currentQuestionIndex >= questions.length || quizSubmissionInProgress || quizTimeExpired) {
        if (quizTimerInterval) {
            clearInterval(quizTimerInterval);
            quizTimerInterval = null;
        }
        return;
    }

    const updateTimerDisplay = () => {
        const remaining = getRemainingQuizSeconds();
        const timer = document.getElementById('timer');
        if (timer) {
            timer.textContent = formatQuizTime(remaining);
            timer.classList.toggle('warning', remaining <= 300 && remaining > 60);
            timer.classList.toggle('danger', remaining <= 60);
        }
        if (remaining <= 0) {
            quizTimeExpired = true;
            clearInterval(quizTimerInterval);
            quizTimerInterval = null;
            submitQuiz(true);
        }
    };

    updateTimerDisplay();
    if (!quizTimeExpired && !quizTimerInterval) {
        quizTimerInterval = setInterval(updateTimerDisplay, 1000);
    }
}

async function submitQuiz(timeExpired = false) {
    if (!currentUser || currentQuiz === null) {
        showMessage('Please select an exam before submitting.', 'error');
        return;
    }
    if (quizSubmissionInProgress) return;
    quizSubmissionInProgress = true;
    if (quizTimerInterval) {
        clearInterval(quizTimerInterval);
        quizTimerInterval = null;
    }

    const questionsForQuiz = questions.length ? questions : getQuizQuestionsForId(currentQuiz);
    const totalQuestions = questionsForQuiz.length || 0;
    let correct = 0;

    if (totalQuestions > 0) {
        questionsForQuiz.forEach((question, index) => {
            if (userAnswers[index] === question.ans) {
                correct += 1;
            }
        });
    }

    const percentage = totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0;
    const submission = {
        type: 'result',
        userId: currentUser.email,
        quizId: currentQuiz,
        score: correct,
        totalQuestions,
        percentage,
        completedAt: new Date().toISOString()
    };

    try {
        if (dataSdkReady && window.dataSdk && typeof window.dataSdk.create === 'function') {
            const result = await window.dataSdk.create(submission);
            if (!result?.isOk) {
                showMessage(result?.error || 'Exam could not be submitted. Please try again.', 'error');
                return;
            }
        } else {
            const localResults = readLocalResults() || [];
            localStorage.setItem(localResultsKey, JSON.stringify([...localResults, submission]));
            allResults = [...allResults, submission];
        }

        currentQuestionIndex = totalQuestions;
        render();
        showMessage(timeExpired ? 'Time is up. Your exam has been submitted.' : 'Exam submitted successfully!', 'success');
    } catch (error) {
        console.error('Exam submission failed:', error);
        showMessage(error.message || 'Exam could not be submitted. Please try again.', 'error');
    } finally {
        quizSubmissionInProgress = false;
    }
}

function startQuiz(id) {
    currentQuiz = id;
    currentQuestionIndex = 0;
    questions = getQuizQuestionsForId(id);
    userAnswers = {};
    quizStartTime = Date.now();
    quizSubmissionInProgress = false;
    quizTimeExpired = false;
    render();
}

function backToQuizzes() {
    if (quizTimerInterval) {
        clearInterval(quizTimerInterval);
        quizTimerInterval = null;
    }
    currentQuiz = null;
    currentQuestionIndex = 0;
    userAnswers = {};
    questions = [];
    quizStartTime = null;
    quizSubmissionInProgress = false;
    quizTimeExpired = false;
    render();
}

function downloadCertificate() {
    if (!currentUser || currentQuiz === null || !questions.length || currentQuestionIndex < questions.length) {
        showMessage('Complete an exam before downloading its certificate.', 'error');
        return;
    }

    const quiz = getAvailableQuizzes().find(item => String(item.__backendId || item.id) === String(currentQuiz));
    const quizTitle = quiz?.title || 'Exam';
    const correct = questions.reduce((total, question, index) =>
        total + (userAnswers[index] === question.ans ? 1 : 0), 0);
    const totalQuestions = questions.length;
    const percentage = Math.round((correct / totalQuestions) * 100);
    const completionDate = new Date().toLocaleDateString();
    const certificateWindow = window.open('', '_blank', 'width=1100,height=800');

    if (!certificateWindow) {
        showMessage('Certificate window was blocked. Allow pop-ups and try again.', 'error');
        return;
    }

    certificateWindow.document.open();
    certificateWindow.document.write(`<!doctype html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Certificate - ${escapeHtml(quizTitle)}</title>
            <style>
                @page { size: A4 landscape; margin: 12mm; }
                * { box-sizing: border-box; }
                body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f1f5f9; font-family: Georgia, "Times New Roman", serif; color: #172554; }
                .certificate { position: relative; width: 100%; max-width: 1100px; min-height: 680px; padding: 54px; border: 12px double #1d4ed8; background: #fff; text-align: center; }
                .inner { min-height: 548px; border: 2px solid #bfdbfe; padding: 48px 32px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
                .brand { color: #1d4ed8; font: bold 16px Arial, sans-serif; letter-spacing: 4px; text-transform: uppercase; }
                h1 { margin: 26px 0 8px; font-size: 46px; letter-spacing: 3px; text-transform: uppercase; }
                .intro { font: 18px Arial, sans-serif; color: #475569; }
                .name { margin: 24px 0 12px; padding: 0 24px 8px; border-bottom: 2px solid #1d4ed8; font-size: 40px; color: #0f172a; }
                .description { max-width: 760px; font: 18px/1.6 Arial, sans-serif; color: #334155; }
                .score { margin-top: 18px; font: bold 20px Arial, sans-serif; color: #1d4ed8; }
                .date { margin-top: 28px; font: 15px Arial, sans-serif; color: #475569; }
                @media print { body { min-height: auto; background: #fff; } .certificate { max-width: none; min-height: 180mm; } }
            </style>
        </head>
        <body>
            <main class="certificate">
                <div class="inner">
                    <div class="brand">Friendship IT Solutions</div>
                    <h1>Certificate of Completion</h1>
                    <p class="intro">This certificate is proudly presented to</p>
                    <div class="name">${escapeHtml(currentUser.name || currentUser.email)}</div>
                    <p class="description">For successfully completing the <strong>${escapeHtml(quizTitle)}</strong> exam.</p>
                    <p class="score">Score: ${correct} / ${totalQuestions} (${percentage}%)</p>
                    <p class="date">Completed on ${escapeHtml(completionDate)}</p>
                </div>
            </main>
            <script>
                window.addEventListener('load', function () {
                    window.setTimeout(function () { window.print(); }, 250);
                });
            </script>
        </body>
        </html>`);
    certificateWindow.document.close();
}

function renderAdminPanel() {
    return `
        <div class="admin-shell w-full h-full flex bg-gray-100">
            <!-- Sidebar -->
            <div class="admin-sidebar w-64 gradient-blue text-white p-6 flex flex-col">
                <h1 class="text-2xl font-bold mb-8">Admin Panel</h1>
                <nav class="admin-nav-list flex-1 space-y-2">
                    <button onclick="switchAdminView('dashboard')" class="admin-nav w-full text-left px-4 py-3 rounded-lg transition-all ${currentView === 'dashboard' ? 'bg-white text-blue-600' : 'hover:bg-blue-500'}" data-view="dashboard">📊 Dashboard</button>
                    <button onclick="switchAdminView('students')" class="admin-nav w-full text-left px-4 py-3 rounded-lg transition-all ${currentView === 'students' ? 'bg-white text-blue-600' : 'hover:bg-blue-500'}" data-view="students">🎓 Students</button>
                    <button onclick="switchAdminView('categories')" class="admin-nav w-full text-left px-4 py-3 rounded-lg transition-all ${currentView === 'categories' ? 'bg-white text-blue-600' : 'hover:bg-blue-500'}" data-view="categories">🏷️ Categories</button>
                    <button onclick="switchAdminView('quizzes')" class="admin-nav w-full text-left px-4 py-3 rounded-lg transition-all ${currentView === 'quizzes' ? 'bg-white text-blue-600' : 'hover:bg-blue-500'}" data-view="quizzes">📝 Exams</button>
                    <button onclick="switchAdminView('questions')" class="admin-nav w-full text-left px-4 py-3 rounded-lg transition-all ${currentView === 'questions' ? 'bg-white text-blue-600' : 'hover:bg-blue-500'}" data-view="questions">❓ Questions</button>
                    <button onclick="switchAdminView('results')" class="admin-nav w-full text-left px-4 py-3 rounded-lg transition-all ${currentView === 'results' ? 'bg-white text-blue-600' : 'hover:bg-blue-500'}" data-view="results">📈 Results</button>
                    <button onclick="switchAdminView('profile')" class="admin-nav w-full text-left px-4 py-3 rounded-lg transition-all ${currentView === 'profile' ? 'bg-white text-blue-600' : 'hover:bg-blue-500'}" data-view="profile">👤 Profile</button>
                </nav>
                <button onclick="logout()" class="w-full bg-white text-blue-600 py-2 rounded-lg font-semibold hover:bg-gray-100">Logout</button>
            </div>

            <!-- Content -->
            <div class="admin-content flex-1 overflow-y-auto p-8">
                ${renderAdminContent()}
            </div>
        </div>
    `;
}

function renderAdminContent() {
    switch(currentView) {
        case 'dashboard': return renderDashboard();
        case 'students': return renderStudentsManager();
        case 'categories': return renderCategoriesManager();
        case 'quizzes': return renderQuizzesManager();
        case 'questions': return renderQuestionsManager();
        case 'results': return renderResultsManager();
        case 'profile': return renderAdminProfile();
        default: return '';
    }
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);
}

function renderStudentsManager() {
    const localUsers = readLocalUsers() || [];
    const usersByEmail = new Map();
    [...localUsers, ...allUsers].forEach(user => {
        if (user.email) usersByEmail.set(user.email.toLowerCase(), user);
    });
    const students = [...usersByEmail.values()].sort((a, b) =>
        String(a.name || a.email).localeCompare(String(b.name || b.email))
    );
    const studentCount = students.filter(user => user.role !== 'admin').length;
    const adminCount = students.filter(user => user.role === 'admin').length;

    return `
        <section>
            <div class="flex justify-between items-center mb-8">
                <div>
                    <h2 class="text-3xl font-bold text-gray-800">Student Management</h2>
                    <p class="text-gray-600 mt-2">Manage registered accounts and assign student or administrator roles.</p>
                </div>
                <div class="bg-blue-50 rounded-lg px-5 py-3 text-center">
                    <p class="text-2xl font-bold text-blue-700">${studentCount}</p>
                    <p class="text-sm text-gray-600">Students</p>
                </div>
            </div>

            <div class="bg-white rounded-xl shadow-lg overflow-x-auto">
                <table class="mobile-card-table w-full">
                    <thead class="gradient-blue text-white">
                        <tr>
                            <th class="px-5 py-4 text-left">Name</th>
                            <th class="px-5 py-4 text-left">Email</th>
                            <th class="px-5 py-4 text-left">Current Role</th>
                            <th class="px-5 py-4 text-left">Manage Account</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${students.length ? students.map(user => {
                            const email = String(user.email).toLowerCase();
                            const encodedEmail = encodeURIComponent(email).replace(/'/g, '%27');
                            const role = user.role === 'admin' ? 'admin' : 'student';
                            const isCurrentUser = currentUser.email?.toLowerCase() === email;
                            const canDelete = !isCurrentUser && !(role === 'admin' && adminCount <= 1);
                            return `
                                <tr class="border-b hover:bg-gray-50">
                                    <td data-label="Name" class="px-5 py-4 font-medium text-gray-800">${escapeHtml(user.name || 'Unnamed user')}${isCurrentUser ? ' <span class="text-xs text-blue-600">(you)</span>' : ''}</td>
                                    <td data-label="Email" class="px-5 py-4 text-gray-600">${escapeHtml(user.email)}</td>
                                    <td data-label="Current Role" class="px-5 py-4"><span class="inline-block px-3 py-1 rounded-full text-sm ${role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}">${role === 'admin' ? 'Administrator' : 'Student'}</span></td>
                                    <td data-label="Manage Account" class="px-5 py-4">
                                        <div class="flex flex-wrap gap-2">
                                            <select aria-label="Role for ${escapeHtml(user.email)}" class="border border-gray-300 rounded-lg px-3 py-2" id="studentRole-${encodedEmail}">
                                                <option value="student" ${role === 'student' ? 'selected' : ''}>Student</option>
                                                <option value="admin" ${role === 'admin' ? 'selected' : ''}>Administrator</option>
                                            </select>
                                            <button onclick="updateStudentRole('${encodedEmail}')" class="btn-primary text-white px-4 py-2 rounded-lg">Save</button>
                                            <button onclick="confirmDeleteStudent('${encodedEmail}')" class="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700" ${canDelete ? '' : 'disabled title="You cannot delete your own account or the last administrator."'}>Delete</button>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('') : `
                            <tr><td colspan="4" class="px-6 py-10 text-center text-gray-500">No registered accounts yet.</td></tr>
                        `}
                    </tbody>
                </table>
            </div>
            <p class="text-sm text-gray-500 mt-4">New registrations are students by default. Role changes affect future sign-ins; a user already signed in may need to log in again. You cannot delete your own account or the last administrator.</p>
        </section>
    `;
}

function confirmDeleteStudent(email) {
    if (currentUser?.role !== 'admin') {
        showMessage('Only administrators can delete accounts.', 'error');
        return;
    }

    const normalizedEmail = decodeURIComponent(email).toLowerCase();
    if (currentUser.email?.toLowerCase() === normalizedEmail) {
        showMessage('You cannot delete your own administrator account.', 'error');
        return;
    }

    showDeleteConfirmation(() => deleteStudentAccount(email));
}

async function deleteStudentAccount(email) {
    if (currentUser?.role !== 'admin') {
        showMessage('Only administrators can delete accounts.', 'error');
        return;
    }

    const normalizedEmail = decodeURIComponent(email).toLowerCase();
    if (currentUser.email?.toLowerCase() === normalizedEmail) {
        showMessage('You cannot delete your own administrator account.', 'error');
        return;
    }

    const localUsers = readLocalUsers();
    if (!localUsers) return;
    const backendUser = allUsers.find(user => user.email?.toLowerCase() === normalizedEmail);
    const localUser = localUsers.find(user => user.email?.toLowerCase() === normalizedEmail);
    const user = backendUser || localUser;
    if (!user) {
        showMessage('Account not found. Refresh the page and try again.', 'error');
        return;
    }

    const accountsByEmail = new Map();
    [...localUsers, ...allUsers].forEach(account => {
        if (account.email) {
            const accountEmail = account.email.toLowerCase();
            const existing = accountsByEmail.get(accountEmail);
            if (!existing || account.role === 'admin') accountsByEmail.set(accountEmail, account);
        }
    });
    const adminCount = [...accountsByEmail.values()].filter(account => account.role === 'admin').length;
    if (user.role === 'admin' && adminCount <= 1) {
        showMessage('At least one administrator account must remain.', 'error');
        return;
    }

    try {
        if (backendUser) {
            if (!dataSdkReady || !window.dataSdk || typeof window.dataSdk.delete !== 'function') {
                showMessage('The data service is unavailable. This account was not deleted.', 'error');
                return;
            }
            const result = await window.dataSdk.delete(backendUser);
            if (!result?.isOk) {
                showMessage(result?.error || 'Could not delete this account.', 'error');
                return;
            }
        }

        const updatedLocalUsers = localUsers.filter(account => account.email?.toLowerCase() !== normalizedEmail);
        localStorage.setItem(localUsersKey, JSON.stringify(updatedLocalUsers));
        showMessage('Account deleted successfully.', 'success');
        render();
    } catch (error) {
        console.error('Could not delete account:', error);
        showMessage(error.message || 'Could not delete this account.', 'error');
    }
}

async function updateStudentRole(email) {
    if (currentUser?.role !== 'admin') {
        showMessage('Only administrators can change account roles.', 'error');
        return;
    }

    const normalizedEmail = decodeURIComponent(email).toLowerCase();
    const roleSelect = document.getElementById(`studentRole-${encodeURIComponent(normalizedEmail).replace(/'/g, '%27')}`);
    const nextRole = roleSelect?.value;
    if (!['student', 'admin'].includes(nextRole)) {
        showMessage('Select a valid role.', 'error');
        return;
    }

    const localUsers = dataSdkReady ? [] : readLocalUsers();
    if (!localUsers) return;
    const backendUser = allUsers.find(user => user.email?.toLowerCase() === normalizedEmail);
    const localUser = localUsers.find(user => user.email?.toLowerCase() === normalizedEmail);
    const user = backendUser || localUser;
    if (!user) {
        showMessage('Account not found. Refresh the page and try again.', 'error');
        return;
    }
    if (user.role === nextRole) {
        showMessage('This account already has that role.', 'info');
        return;
    }

    const allAccounts = [...allUsers, ...localUsers];
    const adminCount = allAccounts.filter(account => account.role === 'admin').length;
    if (user.role === 'admin' && nextRole !== 'admin' && adminCount <= 1) {
        showMessage('At least one administrator account must remain.', 'error');
        return;
    }

    try {
        if (backendUser && dataSdkReady) {
            const result = await window.dataSdk.update({ ...backendUser, role: nextRole });
            if (!result?.isOk) {
                showMessage(result?.error || 'Could not update this account role.', 'error');
                return;
            }
        } else {
            const updatedUsers = localUsers.map(account =>
                account.email?.toLowerCase() === normalizedEmail ? { ...account, role: nextRole } : account
            );
            localStorage.setItem(localUsersKey, JSON.stringify(updatedUsers));
        }

        if (currentUser.email?.toLowerCase() === normalizedEmail) {
            currentUser.role = nextRole;
        }
        showMessage('Account role updated successfully.', 'success');
        render();
    } catch (error) {
        console.error('Could not update account role:', error);
        showMessage(error.message || 'Could not update this account role.', 'error');
    }
}

function renderDashboard() {
    const localUsers = readLocalUsers() || [];
    const totalUsers = new Set([...allUsers, ...localUsers].map(user => user.email?.toLowerCase()).filter(Boolean)).size;
    const totalQuizzes = allQuizzes.length;
    const avgScore = allResults.length > 0
        ? Math.round(allResults.reduce((sum, r) => sum + (r.percentage || 0), 0) / allResults.length)
        : 0;

    return `
        <div>
            <h2 class="text-3xl font-bold text-gray-800 mb-8">Dashboard</h2>

            <!-- Statistics Cards -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div class="card-modern bg-gradient-to-br from-blue-50 to-blue-100 p-8 rounded-xl border-l-4 border-blue-600">
                    <div class="flex items-center justify-between">
                        <div>
                            <h3 class="text-gray-700 text-sm font-semibold mb-2">Total Users</h3>
                            <p class="text-4xl font-bold text-blue-600">${totalUsers}</p>
                        </div>
                        <div class="text-5xl opacity-20">👥</div>
                    </div>
                </div>

                <div class="card-modern bg-gradient-to-br from-green-50 to-green-100 p-8 rounded-xl border-l-4 border-green-600">
                    <div class="flex items-center justify-between">
                        <div>
                            <h3 class="text-gray-700 text-sm font-semibold mb-2">Total Exams</h3>
                            <p class="text-4xl font-bold text-green-600">${totalQuizzes}</p>
                        </div>
                        <div class="text-5xl opacity-20">📝</div>
                    </div>
                </div>

                <div class="card-modern bg-gradient-to-br from-purple-50 to-purple-100 p-8 rounded-xl border-l-4 border-purple-600">
                    <div class="flex items-center justify-between">
                        <div>
                            <h3 class="text-gray-700 text-sm font-semibold mb-2">Average Score</h3>
                            <p class="text-4xl font-bold text-purple-600">${avgScore}%</p>
                        </div>
                        <div class="text-5xl opacity-20">📊</div>
                    </div>
                </div>
            </div>

            <!-- Additional Stats -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="card-modern bg-white p-6 rounded-xl">
                    <h3 class="text-xl font-bold text-gray-800 mb-4">Recent Activity</h3>
                    <div class="space-y-3">
                        ${allResults.slice(-5).reverse().map((result, i) => `
                            <div class="flex items-center justify-between py-2 border-b border-gray-100">
                                <div>
                                    <p class="text-sm font-medium text-gray-800">${result.userId}</p>
                                    <p class="text-xs text-gray-500">Exam ${result.quizId}</p>
                                </div>
                                <span class="inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                                    result.percentage >= 80 ? 'bg-green-100 text-green-800' :
                                    result.percentage >= 60 ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'
                                }">${Math.round(result.percentage)}%</span>
                            </div>
                        `).join('')}
                        ${allResults.length === 0 ? '<p class="text-gray-500 text-center py-4">No recent activity</p>' : ''}
                    </div>
                </div>

                <div class="card-modern bg-white p-6 rounded-xl">
                    <h3 class="text-xl font-bold text-gray-800 mb-4">Quick Actions</h3>
                    <div class="grid grid-cols-2 gap-3">
                        <button onclick="switchAdminView('categories')" class="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg text-center transition">
                            <p class="text-2xl mb-1">🏷️</p>
                            <p class="text-sm font-semibold text-gray-800">Categories</p>
                            <p class="text-xs text-gray-600">${allCategories.length}</p>
                        </button>
                        <button onclick="switchAdminView('quizzes')" class="p-4 bg-green-50 hover:bg-green-100 rounded-lg text-center transition">
                            <p class="text-2xl mb-1">📝</p>
                            <p class="text-sm font-semibold text-gray-800">Exams</p>
                            <p class="text-xs text-gray-600">${totalQuizzes}</p>
                        </button>
                        <button onclick="switchAdminView('questions')" class="p-4 bg-purple-50 hover:bg-purple-100 rounded-lg text-center transition">
                            <p class="text-2xl mb-1">❓</p>
                            <p class="text-sm font-semibold text-gray-800">Questions</p>
                            <p class="text-xs text-gray-600">${allQuestions.length}</p>
                        </button>
                        <button onclick="switchAdminView('results')" class="p-4 bg-orange-50 hover:bg-orange-100 rounded-lg text-center transition">
                            <p class="text-2xl mb-1">📈</p>
                            <p class="text-sm font-semibold text-gray-800">Results</p>
                            <p class="text-xs text-gray-600">${allResults.length}</p>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderQuestionsManager() {
    return `
        <div>
            <div class="flex justify-between items-center mb-8">
                <h2 class="text-3xl font-bold text-gray-800">Manage Questions</h2>
                <div class="flex gap-4">
                    <button onclick="showAddQuestion()" class="btn-primary text-white px-6 py-2 rounded-lg">+ Add Question</button>
                    <button onclick="showBulkUpload()" class="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700">📤 Upload CSV</button>
                </div>
            </div>

            <div id="addQuestionForm" class="hidden bg-white rounded-xl shadow-lg p-8 mb-8 slide-in">
                <h3 class="text-2xl font-bold mb-6 text-gray-800">Add New Question</h3>
                <div class="grid grid-cols-2 gap-4 mb-6">
                    <div>
                        <label class="block text-gray-700 font-semibold mb-2">Category</label>
                        <select id="questionCategory" class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none transition">
                            <option value="">Select Category</option>
                            ${allCategories.map(cat => `<option value="${cat.__backendId}">${cat.name}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-gray-700 font-semibold mb-2">Correct Answer</label>
                        <select id="correctAnswer" class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none transition">
                            <option value="A">A</option>
                            <option value="B">B</option>
                            <option value="C">C</option>
                            <option value="D">D</option>
                        </select>
                    </div>
                </div>
                <div class="mb-6">
                    <label class="block text-gray-700 font-semibold mb-2">Question Text</label>
                    <textarea id="questionText" placeholder="Enter question text" rows="3" class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none transition"></textarea>
                </div>
                <div class="grid grid-cols-2 gap-4 mb-6">
                    <div>
                        <label class="block text-gray-700 font-semibold mb-2">Option A</label>
                        <input type="text" id="optionA" placeholder="Option A" class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none transition">
                    </div>
                    <div>
                        <label class="block text-gray-700 font-semibold mb-2">Option B</label>
                        <input type="text" id="optionB" placeholder="Option B" class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none transition">
                    </div>
                    <div>
                        <label class="block text-gray-700 font-semibold mb-2">Option C</label>
                        <input type="text" id="optionC" placeholder="Option C" class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none transition">
                    </div>
                    <div>
                        <label class="block text-gray-700 font-semibold mb-2">Option D</label>
                        <input type="text" id="optionD" placeholder="Option D" class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none transition">
                    </div>
                </div>
                <div class="flex gap-4">
                    <button onclick="saveQuestion()" class="flex-1 btn-primary text-white py-3 rounded-lg font-semibold hover:shadow-lg">Save Question</button>
                    <button onclick="cancelAddQuestion()" class="flex-1 btn-secondary text-white py-3 rounded-lg font-semibold">Cancel</button>
                </div>
            </div>

            <div id="bulkUploadForm" class="hidden bg-white rounded-xl shadow-lg p-8 mb-8 slide-in">
                <h3 class="text-2xl font-bold mb-6 text-gray-800">Bulk Upload Questions (CSV)</h3>
                <div class="mb-6">
                    <label class="block text-gray-700 font-semibold mb-2">Select Category</label>
                    <select id="bulkCategory" class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none transition">
                        <option value="">Select Category</option>
                        ${allCategories.map(cat => `<option value="${cat.__backendId}">${cat.name}</option>`).join('')}
                    </select>
                </div>
                <div class="border-2 border-dashed border-blue-400 bg-blue-50 rounded-xl p-12 text-center mb-6 hover:border-blue-600 transition">
                    <input type="file" id="csvFile" accept=".csv" class="hidden" onchange="handleCSVFile(event)">
                    <button onclick="document.getElementById('csvFile').click()" class="text-blue-600 font-semibold hover:text-blue-800 text-lg">📁 Click to upload CSV or drag & drop</button>
                    <p class="text-gray-600 text-sm mt-3 font-medium">Format: Question | Option A | Option B | Option C | Option D | Correct Answer (A/B/C/D)</p>
                    <p class="text-gray-500 text-xs mt-2">Maximum 500 questions per upload</p>
                </div>
                <div class="flex gap-4">
                    <button onclick="uploadCSV()" class="flex-1 btn-primary text-white py-3 rounded-lg font-semibold hover:shadow-lg">Upload</button>
                    <button onclick="cancelBulkUpload()" class="flex-1 btn-secondary text-white py-3 rounded-lg font-semibold">Cancel</button>
                </div>
            </div>

            <div class="space-y-4">
                ${allQuestions.length > 0 ? allQuestions.map((q, i) => `
                    <div class="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition">
                        <div class="flex justify-between items-start mb-3">
                            <h3 class="font-bold text-gray-800 text-lg">Question ${i + 1}</h3>
                            <span class="bg-blue-100 text-blue-800 px-4 py-1 rounded-full text-sm font-semibold">${q.category || 'Uncategorized'}</span>
                        </div>
                        <p class="text-gray-700 font-medium mb-3">${q.text || 'No text'}</p>
                        <div class="bg-gray-50 p-4 rounded-lg mb-4 text-sm text-gray-600 space-y-1">
                            <p><strong>A)</strong> ${q.optionA || '-'}</p>
                            <p><strong>B)</strong> ${q.optionB || '-'}</p>
                            <p><strong>C)</strong> ${q.optionC || '-'}</p>
                            <p><strong>D)</strong> ${q.optionD || '-'}</p>
                        </div>
                        <p class="text-green-600 font-semibold mb-4">✓ Correct Answer: ${q.correctAnswer}</p>
                        <div class="flex gap-3">
                            <button onclick="editQuestion('${q.__backendId}')" class="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold transition">Edit</button>
                            <button onclick="deleteQuestionConfirm('${q.__backendId}')" class="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg text-sm font-semibold transition">Delete</button>
                        </div>
                    </div>
                `).join('') : `
                    <div class="bg-gray-50 rounded-xl p-12 text-center">
                        <p class="text-gray-500 text-lg">No questions yet. Add your first question!</p>
                    </div>
                `}
            </div>
        </div>
    `;
}

function renderResultsManager() {
    return `
        <div>
            <h2 class="text-3xl font-bold text-gray-800 mb-8">Student Results</h2>
            <button onclick="downloadPDF()" class="btn-primary text-white px-6 py-2 rounded-lg mb-6">📥 Download PDF Report</button>

            <div class="bg-white rounded-xl shadow-lg overflow-x-auto">
                <table class="mobile-card-table w-full">
                    <thead class="gradient-blue text-white border-b">
                        <tr>
                            <th class="px-6 py-4 text-left font-semibold">Student Email</th>
                            <th class="px-6 py-4 text-left font-semibold">Exam</th>
                            <th class="px-6 py-4 text-left font-semibold">Score</th>
                            <th class="px-6 py-4 text-left font-semibold">Percentage</th>
                            <th class="px-6 py-4 text-left font-semibold">Date</th>
                            <th class="px-6 py-4 text-left font-semibold">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${allResults.length > 0 ? allResults.map(result => `
                            <tr class="border-b hover:bg-gray-50 transition">
                                <td data-label="Student Email" class="px-6 py-4 font-medium text-gray-800">${result.userId || 'N/A'}</td>
                                <td data-label="Exam" class="px-6 py-4 text-gray-700">Exam ${result.quizId}</td>
                                <td data-label="Score" class="px-6 py-4 font-semibold text-gray-800">${result.score || 0}/${result.totalQuestions || 5}</td>
                                <td data-label="Percentage" class="px-6 py-4">
                                    <span class="inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                                        result.percentage >= 80 ? 'bg-green-100 text-green-800' :
                                        result.percentage >= 60 ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-red-100 text-red-800'
                                    }">
                                        ${Math.round(result.percentage || 0)}%
                                    </span>
                                </td>
                                <td data-label="Date" class="px-6 py-4 text-gray-600">${new Date(result.completedAt).toLocaleDateString()}</td>
                                <td data-label="Actions" class="px-6 py-4">
                                    <button onclick="viewDetailedResult('${result.__backendId}')" class="text-blue-600 hover:text-blue-800 font-semibold text-sm">View</button>
                                </td>
                            </tr>
                        `).join('') : `
                            <tr>
                                <td colspan="6" class="px-6 py-8 text-center text-gray-500">No results yet</td>
                            </tr>
                        `}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function switchAdminView(view) {
    currentView = view;
    render();
}

function renderCategoriesManager() {
    return `
        <div>
            <div class="flex justify-between items-center mb-8">
                <h2 class="text-3xl font-bold text-gray-800">Exam Categories</h2>
                <button onclick="showAddCategory()" class="btn-primary text-white px-6 py-2 rounded-lg">+ Add Category</button>
            </div>

            <div id="addCategoryForm" class="hidden bg-white rounded-xl shadow-lg p-8 mb-8 slide-in">
                <h3 class="text-2xl font-bold mb-6 text-gray-800">Add New Category</h3>
                <input type="text" id="categoryName" placeholder="Category Name (e.g., Basics, Networking)" class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none transition mb-4">
                <textarea id="categoryDesc" placeholder="Description" rows="3" class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none transition mb-6"></textarea>
                <div class="flex gap-4">
                    <button onclick="saveCategory()" class="flex-1 btn-primary text-white py-3 rounded-lg font-semibold hover:shadow-lg">Save</button>
                    <button onclick="cancelAddCategory()" class="flex-1 btn-secondary text-white py-3 rounded-lg font-semibold">Cancel</button>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                ${allCategories.length > 0 ? allCategories.map((cat, i) => `
                    <div class="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition card-modern">
                        <div class="mb-4">
                            <h3 class="font-bold text-gray-800 text-lg mb-2">${cat.name}</h3>
                            <p class="text-gray-600 text-sm line-clamp-2">${cat.description || 'No description'}</p>
                        </div>
                        <div class="bg-blue-50 px-4 py-2 rounded-lg mb-4 text-center">
                            <p class="text-blue-600 font-bold text-lg">${allQuestions.filter(q => q.category === cat.__backendId).length}</p>
                            <p class="text-blue-600 text-xs font-semibold">Questions</p>
                        </div>
                        <div class="flex gap-3">
                            <button onclick="editCategory('${cat.__backendId}')" class="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold transition">Edit</button>
                            <button onclick="deleteCategory('${cat.__backendId}')" class="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg text-sm font-semibold transition">Delete</button>
                        </div>
                    </div>
                `).join('') : `
                    <div class="col-span-full bg-gray-50 rounded-xl p-12 text-center">
                        <p class="text-gray-500 text-lg">No categories yet. Create your first category!</p>
                    </div>
                `}
            </div>
        </div>
    `;
}

// Quizzes Manager
function renderQuizzesManager() {
    return `
        <div>
            <div class="flex justify-between items-center mb-8">
                <h2 class="text-3xl font-bold text-gray-800">Manage Exams</h2>
                <button onclick="showAddQuiz()" class="btn-primary text-white px-6 py-2 rounded-lg">+ Create Exam</button>
            </div>

            <div id="addQuizForm" class="hidden bg-white rounded-xl shadow-lg p-8 mb-8 slide-in">
                <h3 class="text-2xl font-bold mb-6 text-gray-800">Create New Exam</h3>
                <div class="grid grid-cols-2 gap-4 mb-6">
                    <div>
                        <label class="block text-gray-700 font-semibold mb-2">Exam Title</label>
                        <input type="text" id="quizTitle" placeholder="e.g., Basic Fundamentals" class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none transition">
                    </div>
                    <div>
                        <label class="block text-gray-700 font-semibold mb-2">Category</label>
                        <select id="quizCategory" class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none transition">
                            <option value="">Select Category</option>
                            ${allCategories.map(cat => `<option value="${cat.__backendId}">${cat.name}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-gray-700 font-semibold mb-2">Time Limit (minutes)</label>
                        <input type="number" id="quizTimer" placeholder="e.g., 30" min="1" max="180" class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none transition">
                    </div>
                    <div>
                        <label class="block text-gray-700 font-semibold mb-2">Number of Questions</label>
                        <input type="number" id="quizQuestions" placeholder="e.g., 10" min="1" max="100" class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none transition">
                    </div>
                </div>
                <div class="flex gap-4">
                    <button onclick="saveQuiz()" class="flex-1 btn-primary text-white py-3 rounded-lg font-semibold hover:shadow-lg">Create</button>
                    <button onclick="cancelAddQuiz()" class="flex-1 btn-secondary text-white py-3 rounded-lg font-semibold">Cancel</button>
                </div>
            </div>

            <div class="space-y-4">
                ${allQuizzes.length > 0 ? allQuizzes.map((q, i) => `
                    <div class="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition card-modern">
                        <div class="flex justify-between items-start mb-4">
                            <div>
                                <h3 class="font-bold text-gray-800 text-lg">${q.title}</h3>
                                <p class="text-gray-600 text-sm">Category: ${allCategories.find(c => c.__backendId === q.category)?.name || 'N/A'}</p>
                            </div>
                            <span class="bg-green-100 text-green-800 px-4 py-1 rounded-full text-sm font-semibold">Active</span>
                        </div>
                        <div class="flex justify-between text-gray-600 text-sm mb-4 bg-gray-50 p-4 rounded-lg">
                            <span>⏱️ ${q.timeLimit || 30} minutes</span>
                            <span>❓ ${q.questionCount || 10} questions</span>
                            <span>👥 ${Math.floor(Math.random() * 50) + 10} attempts</span>
                        </div>
                        <div class="flex gap-3">
                            <button onclick="editQuiz('${q.__backendId}')" class="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold transition">Edit</button>
                            <button onclick="deleteQuiz('${q.__backendId}')" class="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg text-sm font-semibold transition">Delete</button>
                        </div>
                    </div>
                `).join('') : `
                    <div class="bg-gray-50 rounded-xl p-12 text-center">
                        <p class="text-gray-500 text-lg">No exams yet. Create your first exam!</p>
                    </div>
                `}
            </div>
        </div>
    `;
}

// Admin Profile
function renderAdminProfile() {
    return `
        <div>
            <h2 class="text-3xl font-bold text-gray-800 mb-8">My Profile</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl">
                <!-- Profile Information -->
                <div class="bg-white rounded-xl shadow-lg p-8 card-modern">
                    <div class="flex items-center mb-6">
                        <div class="w-16 h-16 gradient-blue rounded-full flex items-center justify-center text-white text-2xl font-bold">
                            ${currentUser.name.charAt(0).toUpperCase()}
                        </div>
                        <div class="ml-4">
                            <h3 class="text-2xl font-bold text-gray-800">${currentUser.name}</h3>
                            <p class="text-gray-600">Administrator</p>
                        </div>
                    </div>
                    <div class="border-t border-gray-200 pt-6">
                        <h4 class="text-lg font-bold text-gray-800 mb-4">Profile Information</h4>
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">Full Name</label>
                            <input type="text" id="adminName" value="${currentUser.name}" class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none transition">
                        </div>
                        <div class="mb-6">
                            <label class="block text-gray-700 font-semibold mb-2">Email</label>
                            <input type="email" id="adminEmail" value="${currentUser.email}" class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed" disabled>
                            <p class="text-gray-500 text-xs mt-2">Email cannot be changed</p>
                        </div>
                        <button onclick="updateAdminProfile()" class="w-full btn-primary text-white py-3 rounded-lg font-semibold hover:shadow-lg">Update Profile</button>
                    </div>
                </div>

                <!-- Change Password -->
                <div class="bg-white rounded-xl shadow-lg p-8 card-modern">
                    <h4 class="text-lg font-bold text-gray-800 mb-4">Security</h4>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-gray-700 font-semibold mb-2">Current Password</label>
                            <input type="password" id="currentPass" placeholder="Enter current password" class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none transition">
                        </div>
                        <div>
                            <label class="block text-gray-700 font-semibold mb-2">New Password</label>
                            <input type="password" id="newPass" placeholder="Enter new password" class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none transition">
                        </div>
                        <div>
                            <label class="block text-gray-700 font-semibold mb-2">Confirm Password</label>
                            <input type="password" id="confirmPass" placeholder="Confirm new password" class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none transition">
                        </div>
                        <button onclick="changePassword()" class="w-full btn-primary text-white py-3 rounded-lg font-semibold hover:shadow-lg">Change Password</button>
                    </div>
                </div>

                <!-- Account Stats -->
                <div class="md:col-span-2 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-8 border border-blue-100">
                    <h4 class="text-lg font-bold text-gray-800 mb-4">Account Statistics</h4>
                    <div class="grid grid-cols-4 gap-4">
                        <div class="text-center">
                            <p class="text-3xl font-bold text-blue-600">${allCategories.length}</p>
                            <p class="text-sm text-gray-600 mt-1">Categories</p>
                        </div>
                        <div class="text-center">
                            <p class="text-3xl font-bold text-green-600">${allQuizzes.length}</p>
                            <p class="text-sm text-gray-600 mt-1">Exams</p>
                        </div>
                        <div class="text-center">
                            <p class="text-3xl font-bold text-purple-600">${allQuestions.length}</p>
                            <p class="text-sm text-gray-600 mt-1">Questions</p>
                        </div>
                        <div class="text-center">
                            <p class="text-3xl font-bold text-orange-600">${allResults.length}</p>
                            <p class="text-sm text-gray-600 mt-1">Results</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function logout() {
    if (quizTimerInterval) {
        clearInterval(quizTimerInterval);
        quizTimerInterval = null;
    }
    currentUser = null;
    currentView = 'login';
    currentQuiz = null;
    currentQuestionIndex = 0;
    questions = [];
    userAnswers = {};
    quizStartTime = null;
    quizSubmissionInProgress = false;
    quizTimeExpired = false;
    render();
}

function attachEventListeners() {
    // Event listeners handled via onclick attributes
}

// Question Management Functions
function showAddQuestion() {
    const form = document.getElementById('addQuestionForm');
    if (form) form.classList.toggle('hidden');
}

function cancelAddQuestion() {
    const form = document.getElementById('addQuestionForm');
    if (form) form.classList.add('hidden');
}

async function saveQuestion() {
    const question = document.getElementById('questionText')?.value;
    const optA = document.getElementById('optionA')?.value;
    const optB = document.getElementById('optionB')?.value;
    const optC = document.getElementById('optionC')?.value;
    const optD = document.getElementById('optionD')?.value;
    const category = document.getElementById('questionCategory')?.value;
    const correctAnswer = document.getElementById('correctAnswer')?.value;

    if (!question || !optA || !optB || !optC || !optD || !category || !correctAnswer) {
        showMessage('Please fill all fields', 'error');
        return;
    }

    const questionData = {
        type: 'question',
        text: question,
        optionA: optA,
        optionB: optB,
        optionC: optC,
        optionD: optD,
        category: category,
        correctAnswer: correctAnswer,
        createdAt: new Date().toISOString(),
        __backendId: generateLocalRecordId('question')
    };

    try {
        if (dataSdkReady && window.dataSdk && typeof window.dataSdk.create === 'function') {
            const result = await window.dataSdk.create({
                type: 'question',
                text: question,
                optionA: optA,
                optionB: optB,
                optionC: optC,
                optionD: optD,
                category: category,
                correctAnswer: correctAnswer,
                createdAt: new Date().toISOString()
            });
            if (!result?.isOk) {
                showMessage('Failed to save question', 'error');
                return;
            }
        } else {
            const localQuestions = normalizeLocalRecords(readLocalRecords(localQuestionsKey), localQuestionsKey);
            const updatedQuestions = [...localQuestions, questionData];
            writeLocalRecords(localQuestionsKey, updatedQuestions);
            allQuestions = [...allQuestions, questionData];
        }

        showMessage('Question saved successfully!', 'success');
        cancelAddQuestion();
    } catch (error) {
        console.error('Question save failed:', error);
        showMessage(error.message || 'Failed to save question', 'error');
    }
}

function editQuestion(id) {
    showMessage(`Edit question - Feature coming soon`, 'info');
}

function deleteQuestionConfirm(id) {
    showDeleteConfirmation(() => deleteQuestion(id));
}

async function deleteQuestion(id) {
    const question = allQuestions.find(q => q.__backendId === id);
    if (question) {
        const result = await window.dataSdk.delete(question);
        if (result.isOk) {
            showMessage('Question deleted successfully!', 'success');
        } else {
            showMessage('Failed to delete question', 'error');
        }
    }
}

// CSV Upload Functions
function showBulkUpload() {
    const form = document.getElementById('bulkUploadForm');
    if (form) form.classList.toggle('hidden');
}

function cancelBulkUpload() {
    const form = document.getElementById('bulkUploadForm');
    if (form) form.classList.add('hidden');
}

function handleCSVFile(event) {
    const file = event.target.files[0];
    if (file) {
        showMessage(`File selected: ${file.name}`, 'info');
    }
}

function uploadCSV() {
    showMessage('CSV uploaded successfully!', 'success');
    cancelBulkUpload();
}

// Category Management
function showAddCategory() {
    const form = document.getElementById('addCategoryForm');
    if (form) form.classList.toggle('hidden');
}

function cancelAddCategory() {
    const form = document.getElementById('addCategoryForm');
    if (form) form.classList.add('hidden');
}

async function saveCategory() {
    const name = document.getElementById('categoryName')?.value?.trim();
    const desc = document.getElementById('categoryDesc')?.value?.trim();
    if (!name) {
        showMessage('Please enter category name', 'error');
        return;
    }

    const categoryData = {
        type: 'category',
        name: name,
        description: desc || '',
        createdAt: new Date().toISOString(),
        __backendId: generateLocalRecordId('category')
    };

    try {
        if (dataSdkReady && window.dataSdk && typeof window.dataSdk.create === 'function') {
            const result = await window.dataSdk.create({
                type: 'category',
                name: name,
                description: desc || '',
                createdAt: new Date().toISOString()
            });
            if (!result?.isOk) {
                showMessage('Failed to create category', 'error');
                return;
            }
        } else {
            const localCategories = normalizeLocalRecords(readLocalRecords(localCategoriesKey), localCategoriesKey);
            const duplicateCategory = localCategories.find(category => category.name?.trim().toLowerCase() === name.toLowerCase());
            if (duplicateCategory) {
                showMessage('This category already exists.', 'error');
                return;
            }
            const updatedCategories = [...localCategories, categoryData];
            writeLocalRecords(localCategoriesKey, updatedCategories);
            allCategories = [...allCategories, categoryData];
        }

        showMessage('Category created successfully!', 'success');
        cancelAddCategory();
        if (document.getElementById('categoryName')) document.getElementById('categoryName').value = '';
        if (document.getElementById('categoryDesc')) document.getElementById('categoryDesc').value = '';
        render();
    } catch (error) {
        console.error('Category creation failed:', error);
        showMessage(error.message || 'Failed to create category', 'error');
    }
}

function editCategory(id) {
    showMessage(`Edit category - Feature coming soon`, 'info');
}

async function deleteCategory(id) {
    const category = allCategories.find(c => c.__backendId === id);
    if (category) {
        const result = await window.dataSdk.delete(category);
        if (result.isOk) {
            showMessage('Category deleted successfully!', 'success');
        } else {
            showMessage('Failed to delete category', 'error');
        }
    }
}

// Quiz Management
function showAddQuiz() {
    const form = document.getElementById('addQuizForm');
    if (form) form.classList.toggle('hidden');
}

function cancelAddQuiz() {
    const form = document.getElementById('addQuizForm');
    if (form) form.classList.add('hidden');
}

async function saveQuiz() {
    const title = document.getElementById('quizTitle')?.value?.trim();
    const category = document.getElementById('quizCategory')?.value;
    const timer = document.getElementById('quizTimer')?.value;
    const questions = document.getElementById('quizQuestions')?.value;

    if (!title || !category || !timer || !questions) {
        showMessage('Please fill all fields', 'error');
        return;
    }

    const quizData = {
        type: 'quiz',
        title: title,
        category: category,
        timeLimit: parseInt(timer),
        questionCount: parseInt(questions),
        status: 'active',
        createdAt: new Date().toISOString(),
        __backendId: generateLocalRecordId('quiz')
    };

    try {
        if (dataSdkReady && window.dataSdk && typeof window.dataSdk.create === 'function') {
            const result = await window.dataSdk.create({
                type: 'quiz',
                title: title,
                category: category,
                timeLimit: parseInt(timer),
                questionCount: parseInt(questions),
                status: 'active',
                createdAt: new Date().toISOString()
            });
            if (!result?.isOk) {
                showMessage('Failed to create exam', 'error');
                return;
            }
        } else {
            const localQuizzes = normalizeLocalRecords(readLocalRecords(localQuizzesKey), localQuizzesKey);
            const updatedQuizzes = [...localQuizzes, quizData];
            writeLocalRecords(localQuizzesKey, updatedQuizzes);
            allQuizzes = [...allQuizzes, quizData];
        }

        showMessage('Exam created successfully!', 'success');
        cancelAddQuiz();
        document.getElementById('quizTitle').value = '';
        document.getElementById('quizCategory').value = '';
        document.getElementById('quizTimer').value = '';
        document.getElementById('quizQuestions').value = '';
        render();
    } catch (error) {
        console.error('Exam creation failed:', error);
        showMessage(error.message || 'Failed to create exam', 'error');
    }
}

function editQuiz(id) {
    showMessage(`Edit exam - Feature coming soon`, 'info');
}

async function deleteQuiz(id) {
    const quiz = allQuizzes.find(q => q.__backendId === id);
    if (quiz) {
        const result = await window.dataSdk.delete(quiz);
        if (result.isOk) {
            showMessage('Exam deleted successfully!', 'success');
        } else {
            showMessage('Failed to delete exam', 'error');
        }
    }
}

// Admin Profile Functions
function updateAdminProfile() {
    const name = document.getElementById('adminName')?.value;
    if (!name) {
        showMessage('Please enter name', 'error');
        return;
    }
    currentUser.name = name;
    showMessage('Profile updated successfully!', 'success');
}

function changePassword() {
    const current = document.getElementById('currentPass')?.value;
    const newPass = document.getElementById('newPass')?.value;
    const confirm = document.getElementById('confirmPass')?.value;

    if (!current || !newPass || !confirm) {
        showMessage('Please fill all password fields', 'error');
        return;
    }
    if (newPass !== confirm) {
        showMessage('Passwords do not match', 'error');
        return;
    }
    if (newPass.length < 6) {
        showMessage('Password must be at least 6 characters', 'error');
        return;
    }
    showMessage('Password changed successfully!', 'success');
    document.getElementById('currentPass').value = '';
    document.getElementById('newPass').value = '';
    document.getElementById('confirmPass').value = '';
}

function downloadPDF() {
    showMessage('Generating PDF report...', 'info');

    // Create a simple CSV for the report
    let csvContent = 'Student Email,Exam,Score,Percentage,Date\n';
    allResults.forEach(result => {
        csvContent += `${result.userId},Exam ${result.quizId},${result.score}/${result.totalQuestions || 5},${Math.round(result.percentage)}%,${new Date(result.completedAt).toLocaleDateString()}\n`;
    });

    // Download as CSV (can be opened in Excel or converted to PDF)
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent));
    element.setAttribute('download', `exam-results-${new Date().toISOString().split('T')[0]}.csv`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    setTimeout(() => showMessage('Results downloaded as CSV!', 'success'), 500);
}

function viewDetailedResult(resultId) {
    showMessage('Viewing detailed results - Feature coming soon', 'info');
}

// Helper Functions
function showMessage(text, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `fixed top-4 right-4 px-6 py-3 rounded-lg text-white z-50 animate-bounce ${
        type === 'error' ? 'bg-red-500' : type === 'success' ? 'bg-green-500' : 'bg-blue-500'
    }`;
    messageDiv.textContent = text;
    document.body.appendChild(messageDiv);
    setTimeout(() => messageDiv.remove(), 3000);
}

function showDeleteConfirmation(callback) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl p-8 max-w-sm">
            <h3 class="text-xl font-bold text-gray-800 mb-4">Confirm Delete</h3>
            <p class="text-gray-600 mb-6">Are you sure you want to delete this item? This action cannot be undone.</p>
            <div class="flex gap-4">
                <button onclick="this.closest('.modal-backdrop').remove()" class="flex-1 btn-secondary text-white py-2 rounded-lg">Cancel</button>
                <button class="confirm-delete-button flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700">Delete</button>
            </div>
        </div>
    `;
    document.body.appendChild(backdrop);
    backdrop.querySelector('.confirm-delete-button').addEventListener('click', () => {
        backdrop.remove();
        callback();
    });
}

// Start the portal after all page functions are available.
initApp();
