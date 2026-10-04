/* Medical Admission Tester - application engine
 * Questions are loaded from ./questions.json at runtime.
 * Firebase configuration/auth remains external and is never hard-coded here.
 */

let QUESTION_BANK = [];

class MedicalExamApp {
            constructor() {
                this.views = ['home', 'setup', 'exam', 'result', 'review', 'progress', 'syllabus'];
                this.currentTheme = localStorage.getItem('med_theme') || 'light';
                
                // Exam Setup Options
                this.setup = {
                    mode: 'model', // 'random', 'model', 'previous'
                    subject: 'all',
                    questionsCount: 30,
                    durationMins: 30
                };

                // Active Exam State
                this.examState = {
                    questions: [],
                    userAnswers: [], // Array of selected option indices (or null)
                    markedForReview: [], // Array of booleans
                    currentIndex: 0,
                    timerSeconds: 0,
                    timerInterval: null,
                    timeUsedSeconds: 0,
                    submitted: false
                };

                this.questionBank = [];
                this.questionsLoaded = false;
                this.authUser = null;
                this.auth = null;
                this.authMode = 'login';
                this.authReady = false;

                this.init();
            }

            async init() {
                // Apply theme and show the existing home UI immediately.
                this.applyTheme();
                this.showView('home');
                this.setDataStatus('loading');

                // Firebase/auth should never prevent Guest mode.
                this.initAuth();

                try {
                    await this.loadQuestionBank();
                    this.updateSubjectCountsUI();
                    this.updateSetupUI();
                    this.loadProgressStats();
                    this.setDataStatus('ready');
                } catch (error) {
                    console.error('Question bank initialization failed:', error);
                    this.updateSubjectCountsUI();
                    this.updateSetupUI();
                    this.loadProgressStats();
                    this.setDataStatus('error', error.message || 'questions.json লোড করা যায়নি।');
                }
            }


            setDataStatus(state, message = '') {
                const el = document.getElementById('question-data-status');
                if (!el) return;
                el.className = 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 text-xs';
                if (state === 'ready') {
                    el.classList.add('hidden');
                    return;
                }
                el.classList.remove('hidden');
                if (state === 'loading') {
                    el.classList.add('text-blue-700', 'dark:text-blue-300', 'bg-blue-50', 'dark:bg-blue-950/30');
                    el.innerHTML = '<i class="fa-solid fa-spinner fa-spin ml-1"></i> প্রশ্ন ব্যাংক লোড হচ্ছে...';
                } else {
                    el.classList.add('text-red-700', 'dark:text-red-300', 'bg-red-50', 'dark:bg-red-950/30');
                    el.innerHTML = `<i class="fa-solid fa-triangle-exclamation ml-1"></i> ${this.escapeHtml(message || 'প্রশ্ন ব্যাংক লোড করা যায়নি।')}`;
                }
            }

            showDataError(message) {
                this.setDataStatus('error', message);
            }

            async loadQuestionBank() {
                const cacheBuster = `?v=${Date.now()}`;
                const response = await fetch(`./questions.json${cacheBuster}`, {
                    cache: 'no-store',
                    headers: { 'Accept': 'application/json' }
                });
                if (!response.ok) {
                    throw new Error(`questions.json (${response.status})`);
                }
                const raw = await response.json();
                if (!Array.isArray(raw)) {
                    throw new Error('questions.json-এ একটি JSON array থাকতে হবে।');
                }

                const normalized = raw.map((q, index) => this.normalizeQuestion(q, index))
                    .filter(Boolean);

                if (!normalized.length) {
                    throw new Error('questions.json-এ কোনো বৈধ প্রশ্ন পাওয়া যায়নি।');
                }

                this.questionBank = normalized;
                this.questionsLoaded = true;
                this.populateYearFilter();
            }

            normalizeQuestion(q, index) {
                if (!q || typeof q !== 'object') return null;

                const rawOptions = Array.isArray(q.options)
                    ? q.options
                    : ['A', 'B', 'C', 'D'].map(k => q.options && q.options[k]);

                const options = rawOptions.map(v => String(v ?? '').trim());
                if (options.length !== 4 || options.some(v => !v)) {
                    console.warn(`Skipping invalid question at index ${index}: options missing`);
                    return null;
                }

                const rawAnswer = q.correctAnswer ?? q.answer;
                let answer = -1;

                if (Number.isInteger(rawAnswer)) {
                    answer = rawAnswer;
                } else {
                    const value = String(rawAnswer ?? '').trim();
                    if (/^[ABCD]$/i.test(value)) {
                        answer = 'ABCD'.indexOf(value.toUpperCase());
                    } else if (/^[0-3]$/.test(value)) {
                        answer = Number(value);
                    } else {
                        const found = options.findIndex(opt => opt === value);
                        if (found >= 0) answer = found;
                    }
                }

                if (answer < 0 || answer > 3) {
                    console.warn(`Skipping invalid question at index ${index}: correct answer missing`);
                    return null;
                }

                const questionText = String(q.question ?? q.questionText ?? '').trim();
                if (!questionText) {
                    console.warn(`Skipping invalid question at index ${index}: question text missing`);
                    return null;
                }

                const source = String(q.source || 'Model Test').trim();
                const year = q.year === null || q.year === undefined || q.year === ''
                    ? null
                    : String(q.year).trim();

                const rawSubject = String(q.subject || 'general').trim().toLowerCase();
                const subjectAliases = {
                    'biology - zoology': 'biology',
                    'biology - botany': 'biology',
                    'general knowledge': 'gk',
                    'general knowledge / current affairs': 'gk'
                };
                const subject = subjectAliases[rawSubject] || rawSubject;

                return {
                    id: String(q.id || q.questionId || `question_${index + 1}`),
                    subject,
                    difficulty: String(q.difficulty || 'medium').toLowerCase().trim(),
                    source,
                    year,
                    question: questionText,
                    options,
                    answer,
                    correctAnswer: 'ABCD'[answer],
                    explanation: String(q.explanation || '').trim(),
                    isPreviousYear: Boolean(year) || /previous\s*year|বিগত|past\s*year/i.test(source)
                };
            }

            populateYearFilter() {
                const select = document.getElementById('setup-year');
                if (!select) return;
                const years = [...new Set(this.questionBank.map(q => q.year).filter(Boolean))]
                    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
                const previous = select.value;
                select.innerHTML = '<option value="all">সব বছর (All Years)</option>';
                years.forEach(year => {
                    const option = document.createElement('option');
                    option.value = year;
                    option.textContent = year;
                    select.appendChild(option);
                });
                select.value = years.includes(previous) ? previous : 'all';
            }

            getHistoryKey() {
                return this.authUser?.uid ? `med_history_${this.authUser.uid}` : 'med_history';
            }

            escapeHtml(value) {
                return String(value ?? '').replace(/[&<>"']/g, ch => ({
                    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
                }[ch]));
            }

            initAuth() {
                try {
                    if (typeof firebase === 'undefined' || !firebase.auth) {
                        this.setAuthState(null, 'Firebase Authentication is not available; Guest mode remains available.');
                        return;
                    }

                    if (!firebase.apps?.length) {
                        const config = window.FIREBASE_CONFIG || window.firebaseConfig || window.__FIREBASE_CONFIG__;
                        if (config && typeof firebase.initializeApp === 'function') {
                            firebase.initializeApp(config);
                        }
                    }

                    if (!firebase.apps?.length) {
                        this.setAuthState(null, 'Firebase configuration is unavailable; Guest mode remains available.');
                        return;
                    }

                    this.auth = firebase.auth();
                    this.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(err => {
                        console.warn('Firebase persistence could not be set:', err);
                    });

                    this.auth.onAuthStateChanged(user => this.setAuthState(user));
                    this.authReady = true;
                } catch (error) {
                    console.error('Firebase initialization error:', error);
                    this.setAuthState(null, 'Firebase authentication failed. You can continue as Guest.');
                }
            }

            setAuthState(user, notice = '') {
                this.authUser = user || null;
                const button = document.getElementById('authStatusBtn');
                const icon = document.getElementById('authStatusIcon');
                const label = document.getElementById('authStatusLabel');

                if (button && label) {
                    if (user) {
                        label.textContent = user.displayName || user.email || 'Account';
                        button.title = user.email || 'Logged in';
                        if (icon) icon.className = 'fa-solid fa-user-check ml-1';
                    } else {
                        label.textContent = 'লগইন';
                        button.title = 'লগইন / রেজিস্টার';
                        if (icon) icon.className = 'fa-solid fa-user ml-1';
                    }
                }

                const authNotice = document.getElementById('authNotice');
                if (authNotice) {
                    if (notice) {
                        authNotice.textContent = notice;
                        authNotice.classList.remove('hidden');
                    } else {
                        authNotice.classList.add('hidden');
                    }
                }

                const accountEmail = document.getElementById('auth-account-email');
                if (accountEmail) accountEmail.textContent = user?.email || user?.displayName || 'Guest';

                this.loadProgressStats();
            }

            openAuthModal(mode = this.authUser ? 'account' : 'login') {
                const modal = document.getElementById('authModal');
                if (!modal) return;
                modal.classList.remove('hidden');
                const msg = document.getElementById('authMessage');
                if (msg) msg.textContent = '';
                this.setAuthMode(mode);
            }

            closeAuthModal() {
                document.getElementById('authModal')?.classList.add('hidden');
            }

            setAuthMode(mode) {
                this.authMode = mode;
                const loginTab = document.getElementById('auth-tab-login');
                const registerTab = document.getElementById('auth-tab-register');
                const nameWrap = document.getElementById('auth-name-wrap');
                const submit = document.getElementById('auth-submit');
                const title = document.getElementById('auth-modal-title');
                const form = document.getElementById('auth-form');

                if (mode === 'account') {
                    document.getElementById('auth-form')?.classList.add('hidden');
                    document.getElementById('auth-account')?.classList.remove('hidden');
                    document.getElementById('auth-email')?.setAttribute('disabled', 'disabled');
                    return;
                }

                document.getElementById('auth-account')?.classList.add('hidden');
                form?.classList.remove('hidden');
                document.getElementById('auth-email')?.removeAttribute('disabled');

                const isRegister = mode === 'register';
                if (loginTab) loginTab.className = isRegister
                    ? 'flex-1 py-2 text-sm font-semibold text-gray-500 hover:text-medical-600'
                    : 'flex-1 py-2 text-sm font-semibold text-medical-700 border-b-2 border-medical-600';
                if (registerTab) registerTab.className = isRegister
                    ? 'flex-1 py-2 text-sm font-semibold text-medical-700 border-b-2 border-medical-600'
                    : 'flex-1 py-2 text-sm font-semibold text-gray-500 hover:text-medical-600';
                if (nameWrap) nameWrap.classList.toggle('hidden', !isRegister);
                if (submit) submit.textContent = isRegister ? 'রেজিস্টার করুন' : 'লগইন করুন';
                if (title) title.textContent = isRegister ? 'নতুন অ্যাকাউন্ট তৈরি করুন' : 'অ্যাকাউন্টে লগইন করুন';
            }

            async handleAuthSubmit(event) {
                event.preventDefault();
                const message = document.getElementById('authMessage');
                const email = document.getElementById('auth-email')?.value.trim();
                const password = document.getElementById('auth-password')?.value;
                const name = document.getElementById('auth-name')?.value.trim();

                if (!this.auth) {
                    if (message) message.textContent = 'Firebase Authentication কনফিগার করা নেই। Guest mode ব্যবহার করতে পারেন।';
                    return;
                }
                if (!email || !password || password.length < 6) {
                    if (message) message.textContent = 'সঠিক ইমেইল দিন এবং অন্তত ৬ অক্ষরের পাসওয়ার্ড ব্যবহার করুন।';
                    return;
                }

                try {
                    if (message) message.textContent = 'অনুগ্রহ করে অপেক্ষা করুন...';
                    let result;
                    if (this.authMode === 'register') {
                        result = await this.auth.createUserWithEmailAndPassword(email, password);
                        if (name && result.user?.updateProfile) {
                            await result.user.updateProfile({ displayName: name });
                        }
                    } else {
                        result = await this.auth.signInWithEmailAndPassword(email, password);
                    }
                    this.closeAuthModal();
                    this.setAuthState(result.user);
                } catch (error) {
                    console.error('Authentication error:', error);
                    if (message) message.textContent = this.friendlyAuthError(error);
                }
            }

            async logout() {
                try {
                    if (this.auth) await this.auth.signOut();
                    this.closeAuthModal();
                } catch (error) {
                    console.error('Logout error:', error);
                    const message = document.getElementById('authMessage');
                    if (message) message.textContent = this.friendlyAuthError(error);
                }
            }

            continueAsGuest() {
                this.authUser = null;
                localStorage.setItem('med_guest_mode', 'true');
                this.closeAuthModal();
                this.setAuthState(null);
            }

            friendlyAuthError(error) {
                const code = error?.code || '';
                const map = {
                    'auth/invalid-email': 'ইমেইল ঠিকানাটি সঠিক নয়।',
                    'auth/user-not-found': 'এই ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি।',
                    'auth/wrong-password': 'পাসওয়ার্ড সঠিক নয়।',
                    'auth/email-already-in-use': 'এই ইমেইল দিয়ে ইতিমধ্যে অ্যাকাউন্ট আছে।',
                    'auth/weak-password': 'পাসওয়ার্ড আরও শক্তিশালী করুন (কমপক্ষে ৬ অক্ষর)।',
                    'auth/too-many-requests': 'অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।',
                    'auth/network-request-failed': 'নেটওয়ার্ক সমস্যা হয়েছে। ইন্টারনেট সংযোগ পরীক্ষা করুন।'
                };
                return map[code] || error?.message || 'Authentication ব্যর্থ হয়েছে।';
            }

            // Theme Management
            toggleTheme() {
                this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
                localStorage.setItem('med_theme', this.currentTheme);
                this.applyTheme();
            }

            applyTheme() {
                if (this.currentTheme === 'dark') {
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.classList.remove('dark');
                }
            }

            // Mobile Menu
            toggleMobileMenu() {
                const menu = document.getElementById('mobileMenu');
                menu.classList.toggle('hidden');
            }

            // View Switching
            showView(viewName) {
                this.views.forEach(v => {
                    const el = document.getElementById(`view-${v}`);
                    if (el) {
                        if (v === viewName) {
                            el.classList.remove('hidden');
                        } else {
                            el.classList.add('hidden');
                        }
                    }
                });
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }

            // Quick Exam Actions
            openSetupView() {
                this.showView('setup');
            }

            setupExamQuick(mode) {
                this.setSetupMode(mode);
                this.showView('setup');
            }

            startSubjectExam(subjectKey) {
                this.setup.mode = 'random';
                this.setup.subject = subjectKey;
                this.setup.questionsCount = 20;
                this.setup.durationMins = 20;
                const subjectSelect = document.getElementById('setup-subject');
                if (subjectSelect) subjectSelect.value = subjectKey;
                this.startExamWithConfig();
            }

            // Setup Config Adjusters
            setSetupMode(mode) {
                this.setup.mode = mode;
                ['random', 'model', 'previous'].forEach(m => {
                    const btn = document.getElementById(`setup-mode-${m}`);
                    if (btn) {
                        if (m === mode) {
                            btn.className = "mode-select-btn py-2.5 px-3 text-xs sm:text-sm font-bold rounded-xl border border-medical-600 bg-medical-50 dark:bg-medical-900/40 text-medical-700 dark:text-medical-300 text-center";
                        } else {
                            btn.className = "mode-select-btn py-2.5 px-3 text-xs sm:text-sm font-semibold rounded-xl border border-gray-300 dark:border-gray-600 text-center hover:bg-gray-50 dark:hover:bg-gray-700";
                        }
                    }
                });
            }

            setSetupQuestions(count) {
                this.setup.questionsCount = count;
                this.updateSetupUI();
            }

            setSetupDuration(mins) {
                this.setup.durationMins = mins;
                this.updateSetupUI();
            }

            updateSetupUI() {
                const subjectSelect = document.getElementById('setup-subject');
                if (subjectSelect) subjectSelect.value = this.setup.subject || 'all';
                const yearSelect = document.getElementById('setup-year');
                if (yearSelect && !yearSelect.value) yearSelect.value = 'all';
                this.setSetupMode(this.setup.mode);

                // Update Question Count buttons active state
                const qBtns = document.querySelectorAll('.q-count-btn');
                qBtns.forEach(btn => {
                    const val = parseInt(btn.innerText.trim());
                    if (val === this.setup.questionsCount) {
                        btn.className = "q-count-btn py-2 text-xs sm:text-sm font-bold rounded-xl border-2 border-medical-600 bg-medical-50 dark:bg-medical-900/40 text-medical-700 dark:text-medical-300 text-center shadow-sm";
                    } else {
                        btn.className = "q-count-btn py-2 text-xs sm:text-sm font-bold rounded-xl border border-gray-300 dark:border-gray-600 text-center hover:bg-gray-50 dark:hover:bg-gray-700";
                    }
                });

                // Update Time buttons active state
                const tBtns = document.querySelectorAll('.time-btn');
                tBtns.forEach(btn => {
                    const val = parseInt(btn.innerText.replace(/[^0-9]/g, ''));
                    if (val === this.setup.durationMins) {
                        btn.className = "time-btn py-2 text-xs sm:text-sm font-bold rounded-xl border-2 border-medical-600 bg-medical-50 dark:bg-medical-900/40 text-medical-700 dark:text-medical-300 text-center shadow-sm";
                    } else {
                        btn.className = "time-btn py-2 text-xs sm:text-sm font-bold rounded-xl border border-gray-300 dark:border-gray-600 text-center hover:bg-gray-50 dark:hover:bg-gray-700";
                    }
                });
            }

            updateSubjectCountsUI() {
                const subjects = ['biology', 'chemistry', 'physics', 'english', 'gk'];
                subjects.forEach(sub => {
                    const count = this.questionBank.filter(q => q.subject === sub).length;
                    const el = document.getElementById(`count-subject-${sub}`);
                    if (el) el.innerText = `${count} টি প্রশ্ন`;
                });
                const totalEl = document.getElementById('dash-total-questions');
                if (totalEl) totalEl.innerText = `${this.questionBank.length}+`;
            }

            /**
             * Fisher-Yates Shuffle that reshuffles options AND updates the answer index
             */
            shuffleQuestionsAndOptions(pool, count) {
                // Filter pool by mode & subject
                let filtered = [...pool];

                // Subject Filter
                const subjectSelect = document.getElementById('setup-subject');
                const selectedSubject = subjectSelect ? subjectSelect.value : this.setup.subject;

                if (selectedSubject !== 'all') {
                    filtered = filtered.filter(q => q.subject === selectedSubject);
                }

                const yearSelect = document.getElementById('setup-year');
                const selectedYear = yearSelect ? yearSelect.value : 'all';
                if (selectedYear !== 'all') {
                    filtered = filtered.filter(q => q.year === selectedYear);
                }

                // Mode Filter
                if (this.setup.mode === 'previous') {
                    filtered = filtered.filter(q => q.isPreviousYear || q.year);
                }

                // Never silently mix unrelated questions into a filtered test.
                if (filtered.length === 0) {
                    this.showDataError('এই ফিল্টারে কোনো প্রশ্ন পাওয়া যায়নি। বিষয়/বছর পরিবর্তন করুন।');
                    return [];
                }

                // Fisher-Yates Shuffle Questions
                for (let i = filtered.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
                }

                // Slice required count
                const selected = filtered.slice(0, Math.min(count, filtered.length));

               // Reshuffle options for each question without breaking the correct answer index
                return selected.map(q => {
                    const optionsWithIndex = q.options.map((opt, idx) => ({
                        text: opt,
                        isCorrect: idx === q.answer
                    }));

                    // Shuffle options
                    for (let i = optionsWithIndex.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [optionsWithIndex[i], optionsWithIndex[j]] = [optionsWithIndex[j], optionsWithIndex[i]];
                    }

                    const newOptions = optionsWithIndex.map(o => o.text);
                    const newAnswer = optionsWithIndex.findIndex(o => o.isCorrect);

                    return {
                        ...q,
                        options: newOptions,
                        answer: newAnswer
                    };
                });
            }

            // Start Exam Process
            startExamWithConfig() {
                if (!this.questionsLoaded || !this.questionBank.length) {
                    this.showDataError('প্রশ্ন ব্যাংক এখনো লোড হয়নি। অনুগ্রহ করে একটু পরে আবার চেষ্টা করুন।');
                    return;
                }
                const count = this.setup.questionsCount;
                const questions = this.shuffleQuestionsAndOptions(this.questionBank, count);
                if (!questions.length) return;

                this.examState = {
                    questions: questions,
                    userAnswers: new Array(questions.length).fill(null),
                    markedForReview: new Array(questions.length).fill(false),
                    currentIndex: 0,
                    timerSeconds: this.setup.durationMins * 60,
                    timerInterval: null,
                    timeUsedSeconds: 0,
                    submitted: false
                };

                this.renderQuestion();
                this.renderPalette();
                this.startTimer();
                this.showView('exam');
            }

            // Timer Controls
            startTimer() {
                if (this.examState.timerInterval) clearInterval(this.examState.timerInterval);
                
                const updateTimerDisplay = () => {
                    const mins = Math.floor(this.examState.timerSeconds / 60);
                    const secs = this.examState.timerSeconds % 60;
                    document.getElementById('exam-timer').innerText = 
                        `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                };

                updateTimerDisplay();

                this.examState.timerInterval = setInterval(() => {
                    this.examState.timerSeconds--;
                    this.examState.timeUsedSeconds++;

                    if (this.examState.timerSeconds <= 0) {
                        clearInterval(this.examState.timerInterval);
                        this.submitExam();
                    } else {
                        updateTimerDisplay();
                    }
                }, 1000);
            }

            // Render Current Question
            renderQuestion() {
                const idx = this.examState.currentIndex;
                const q = this.examState.questions[idx];

                // Meta Info
                document.getElementById('exam-progress-text').innerText = `প্রশ্ন: ${idx + 1} / ${this.examState.questions.length}`;
                document.getElementById('q-subject').innerText = q.subject;
                document.getElementById('q-source').innerText = q.year ? `${q.source} • ${q.year}` : q.source;
                document.getElementById('q-difficulty').innerText = q.difficulty;
                document.getElementById('q-text').innerText = `${idx + 1}. ${q.question}`;

                // Options
                const optionsContainer = document.getElementById('q-options');
                optionsContainer.innerHTML = '';

                const optionLabels = ['A', 'B', 'C', 'D'];
                q.options.forEach((optText, optIdx) => {
                    const isSelected = this.examState.userAnswers[idx] === optIdx;
                    const btn = document.createElement('button');
                    btn.className = `w-full text-right p-4 rounded-2xl border transition flex items-center justify-between ${
                        isSelected 
                            ? 'border-medical-600 bg-medical-50 dark:bg-medical-900/40 text-medical-800 dark:text-medical-200 font-bold' 
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200'
                    }`;
                    btn.onclick = () => this.selectOption(optIdx);

                    btn.innerHTML = `
                        <div class="flex items-center space-x-3 space-x-reverse">
                            <span class="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                                isSelected ? 'bg-medical-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                            }">${optionLabels[optIdx]}</span>
                            <span class="text-sm sm:text-base">${optText}</span>
                        </div>
                    `;
                    optionsContainer.appendChild(btn);
                });

                // Review Button State
                const reviewBtn = document.getElementById('btn-mark-review');
                if (this.examState.markedForReview[idx]) {
                    reviewBtn.className = "px-3 py-2 rounded-xl bg-amber-500 text-white font-semibold text-xs transition flex items-center";
                } else {
                    reviewBtn.className = "px-3 py-2 rounded-xl border border-amber-400 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 font-semibold text-xs transition flex items-center";
                }

                // Nav Buttons
                document.getElementById('btn-prev-q').disabled = idx === 0;
                document.getElementById('btn-next-q').disabled = idx === this.examState.questions.length - 1;
            }

            // Render Side Palette Grid
            renderPalette() {
                const paletteGrid = document.getElementById('q-palette-grid');
                paletteGrid.innerHTML = '';

                this.examState.questions.forEach((_, idx) => {
                    const btn = document.createElement('button');
                    const isCurrent = idx === this.examState.currentIndex;
                    const isAnswered = this.examState.userAnswers[idx] !== null;
                    const isMarked = this.examState.markedForReview[idx];

                    let bgClass = "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300";
                    if (isMarked) bgClass = "bg-amber-400 text-white font-bold";
                    else if (isAnswered) bgClass = "bg-emerald-500 text-white font-bold";

                    let borderClass = isCurrent ? "ring-2 ring-medical-600 ring-offset-2" : "";

                    btn.className = `h-9 w-9 rounded-xl text-xs font-bold flex items-center justify-center transition ${bgClass} ${borderClass}`;
                    btn.innerText = idx + 1;
                    btn.onclick = () => {
                        this.examState.currentIndex = idx;
                        this.renderQuestion();
                        this.renderPalette();
                    };
                    paletteGrid.appendChild(btn);
                });
            }

            selectOption(optIdx) {
                this.examState.userAnswers[this.examState.currentIndex] = optIdx;
                this.renderQuestion();
                this.renderPalette();
            }

            clearOptionSelection() {
                this.examState.userAnswers[this.examState.currentIndex] = null;
                this.renderQuestion();
                this.renderPalette();
            }

            toggleMarkReview() {
                const idx = this.examState.currentIndex;
                this.examState.markedForReview[idx] = !this.examState.markedForReview[idx];
                this.renderQuestion();
                this.renderPalette();
            }

            prevQuestion() {
                if (this.examState.currentIndex > 0) {
                    this.examState.currentIndex--;
                    this.renderQuestion();
                    this.renderPalette();
                }
            }

            nextQuestion() {
                if (this.examState.currentIndex < this.examState.questions.length - 1) {
                    this.examState.currentIndex++;
                    this.renderQuestion();
                    this.renderPalette();
                }
            }

            confirmSubmitExam() {
                if (confirm("আপনি কি নিশ্চিত যে পরীক্ষা জমা দিতে চান?")) {
                    this.submitExam();
                }
            }

            submitExam() {
                if (this.examState.timerInterval) clearInterval(this.examState.timerInterval);
                this.examState.submitted = true;

                let correctCount = 0;
                let wrongCount = 0;
                let skippedCount = 0;

                this.examState.questions.forEach((q, idx) => {
                    const ans = this.examState.userAnswers[idx];
                    if (ans === null) {
                        skippedCount++;
                    } else if (ans === q.answer) {
                        correctCount++;
                    } else {
                        wrongCount++;
                    }
                });

                const negativeMarks = wrongCount * 0.25;
                const totalScore = Math.max(0, correctCount - negativeMarks);
                const totalQuestions = this.examState.questions.length;
                const accuracy = (correctCount + wrongCount) > 0 
                    ? ((correctCount / (correctCount + wrongCount)) * 100).toFixed(1) 
                    : 0;

                // Update Results View UI
                document.getElementById('res-score-main').innerText = `${totalScore.toFixed(2)} / ${totalQuestions}`;
                document.getElementById('res-percentage').innerText = `${(totalQuestions ? ((totalScore / totalQuestions) * 100) : 0).toFixed(1)}%`;
                document.getElementById('res-accuracy').innerText = `${accuracy}%`;
                document.getElementById('res-correct').innerText = correctCount;
                document.getElementById('res-wrong').innerText = wrongCount;
                document.getElementById('res-skipped').innerText = skippedCount;
                document.getElementById('res-negative').innerText = `-${negativeMarks.toFixed(2)}`;

                const minsUsed = Math.floor(this.examState.timeUsedSeconds / 60);
                const secsUsed = this.examState.timeUsedSeconds % 60;
                document.getElementById('res-time-used').innerText = `${minsUsed}:${secsUsed.toString().padStart(2, '0')}`;

                // Save to LocalStorage
                this.saveExamAttempt({
                    date: new Date().toLocaleDateString('bn-BD'),
                    mode: this.setup.mode,
                    subject: document.getElementById('setup-subject').value,
                    year: document.getElementById('setup-year')?.value || 'all',
                    score: totalScore.toFixed(2),
                    total: totalQuestions,
                    accuracy: `${accuracy}%`,
                    timeUsed: `${minsUsed}:${secsUsed.toString().padStart(2, '0')}`
                });

                this.showView('result');
            }

            showReviewAnswersView() {
                const container = document.getElementById('review-list-container');
                container.innerHTML = '';

                const optionLabels = ['A', 'B', 'C', 'D'];

                this.examState.questions.forEach((q, idx) => {
                    const userAns = this.examState.userAnswers[idx];
                    const isCorrect = userAns === q.answer;
                    const isSkipped = userAns === null;

                    const card = document.createElement('div');
                    card.className = "bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-4 shadow-sm";

                    let statusBadge = `<span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">সঠিক</span>`;
                    if (isSkipped) {
                        statusBadge = `<span class="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">উত্তর দেওয়া হয়নি</span>`;
                    } else if (!isCorrect) {
                        statusBadge = `<span class="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">ভুল উত্তর</span>`;
                    }

                    let optionsHTML = q.options.map((opt, optIdx) => {
                        let optStyle = "bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600";
                        if (optIdx === q.answer) {
                            optStyle = "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-800 dark:text-emerald-300 font-bold";
                        } else if (optIdx === userAns && !isCorrect) {
                            optStyle = "bg-red-50 dark:bg-red-950/40 border-red-500 text-red-800 dark:text-red-300 font-bold";
                        }

                        return `
                            <div class="p-3 rounded-xl border text-sm flex items-center justify-between ${optStyle}">
                                <span>${optionLabels[optIdx]}. ${this.escapeHtml(opt)}</span>
                                ${optIdx === q.answer ? '<i class="fa-solid fa-check text-emerald-600"></i>' : ''}
                                ${optIdx === userAns && !isCorrect ? '<i class="fa-solid fa-xmark text-red-600"></i>' : ''}
                            </div>
                        `;
                    }).join('');

                    card.innerHTML = `
                        <div class="flex justify-between items-center">
                            <span class="text-xs font-bold text-medical-600 uppercase">${this.escapeHtml(q.subject)}</span>
                            ${statusBadge}
                        </div>
                        <h4 class="font-bold text-gray-900 dark:text-white text-base">${idx + 1}. ${this.escapeHtml(q.question)}</h4>
                        <div class="space-y-2">${optionsHTML}</div>
                        <div class="p-3 bg-medical-50 dark:bg-medical-900/30 rounded-xl text-xs text-medical-800 dark:text-medical-300 border border-medical-100 dark:border-medical-800">
                            <strong>ব্যাখ্যা:</strong> ${this.escapeHtml(q.explanation || 'এই প্রশ্নের কোনো ব্যাখ্যা দেওয়া হয়নি।')}
                        </div>
                    `;
                    container.appendChild(card);
                });

                this.showView('review');
            }

            // LocalStorage and Analytics
            saveExamAttempt(attempt) {
                let history = JSON.parse(localStorage.getItem(this.getHistoryKey()) || '[]');
                history.unshift(attempt);
                localStorage.setItem(this.getHistoryKey(), JSON.stringify(history));
                this.loadProgressStats();
            }

            loadProgressStats() {
                const history = JSON.parse(localStorage.getItem(this.getHistoryKey()) || '[]');
                
                document.getElementById('dash-total-exams').innerText = history.length;
                document.getElementById('prog-total-attempts').innerText = history.length;

                if (history.length > 0) {
                    const bestScore = Math.max(...history.map(h => parseFloat(h.score) || 0));
                    document.getElementById('dash-best-score').innerText = bestScore.toFixed(2);
                    document.getElementById('prog-best-score').innerText = bestScore.toFixed(2);

                    const avgAcc = (history.reduce((acc, curr) => acc + (parseFloat(curr.accuracy) || 0), 0) / history.length).toFixed(1);
                    document.getElementById('dash-avg-accuracy').innerText = `${avgAcc}%`;
                    document.getElementById('prog-avg-accuracy').innerText = `${avgAcc}%`;

                    const avgScore = (history.reduce((acc, curr) => acc + (parseFloat(curr.score) || 0), 0) / history.length).toFixed(2);
                    document.getElementById('prog-avg-score').innerText = avgScore;
                } else {
                    document.getElementById('dash-best-score').innerText = '0.00';
                    document.getElementById('prog-best-score').innerText = '0.00';
                    document.getElementById('dash-avg-accuracy').innerText = '0%';
                    document.getElementById('prog-avg-accuracy').innerText = '0%';
                    document.getElementById('prog-avg-score').innerText = '0.00';
                }

                // Table render
                const tbody = document.getElementById('prog-history-tbody');
                if (tbody) {
                    tbody.innerHTML = '';
                    history.slice(0, 10).forEach(item => {
                        const tr = document.createElement('tr');
                        tr.className = "hover:bg-gray-50 dark:hover:bg-gray-700/50 transition";
                        tr.innerHTML = `
                            <td class="py-3 px-4 font-medium">${item.date}</td>
                            <td class="py-3 px-4 capitalize">${item.mode}</td>
                            <td class="py-3 px-4">${item.subject}</td>
                            <td class="py-3 px-4 font-bold text-medical-600">${item.score} / ${item.total}</td>
                            <td class="py-3 px-4">${item.accuracy}</td>
                            <td class="py-3 px-4 text-gray-500">${item.timeUsed}</td>
                        `;
                        tbody.appendChild(tr);
                    });
                }
            }

            clearStorageHistory() {
                if (confirm("আপনি কি সমস্ত পরীক্ষার ইতিহাস মুছে ফেলতে চান?")) {
                    localStorage.removeItem(this.getHistoryKey());
                    this.loadProgressStats();
                }
            }
        }

// Expose the app for existing inline UI handlers and legacy Firebase integration.
window.app = new MedicalExamApp();
const app = window.app;
