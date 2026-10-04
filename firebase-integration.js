(function () {
  const state = { user: null, profile: null, ready: false };
  const overlayId = 'firebase-auth-overlay';

  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }

  function showMessage(msg, error = false) {
    const el = document.getElementById('fb-auth-message');
    if (!el) return;
    el.textContent = msg;
    el.className = 'text-sm mt-3 ' + (error ? 'text-red-600 dark:text-red-400' : 'text-medical-600 dark:text-medical-400');
  }

  function ensureOverlay() {
    if (document.getElementById(overlayId)) return;
    const div = document.createElement('div');
    div.id = overlayId;
    div.className = 'fixed inset-0 z-[9999] bg-gray-950/80 backdrop-blur-sm flex items-center justify-center p-4';
    div.innerHTML = `
      <div class="w-full max-w-md bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div class="p-6 sm:p-8">
          <div class="text-center mb-6">
            <div class="mx-auto w-14 h-14 rounded-2xl bg-medical-600 text-white flex items-center justify-center text-2xl"><i class="fa-solid fa-graduation-cap"></i></div>
            <h2 class="text-2xl font-extrabold mt-4 text-gray-900 dark:text-white">Medical Admission Tester</h2>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Student account দিয়ে শুরু করুন</p>
          </div>
          <div class="flex gap-2 mb-5">
            <button id="fb-tab-login" class="flex-1 py-2.5 rounded-xl bg-medical-600 text-white font-bold text-sm">Login</button>
            <button id="fb-tab-register" class="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold text-sm">Register</button>
          </div>
          <form id="fb-login-form" class="space-y-3">
            <input id="fb-login-email" type="email" required placeholder="Email" class="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-transparent">
            <input id="fb-login-password" type="password" required placeholder="Password" class="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-transparent">
            <button class="w-full py-3 rounded-xl bg-medical-600 hover:bg-medical-700 text-white font-bold">Login</button>
          </form>
          <form id="fb-register-form" class="space-y-3 hidden">
            <input id="fb-reg-name" required placeholder="Student Name" class="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-transparent">
            <input id="fb-reg-email" type="email" required placeholder="Email" class="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-transparent">
            <div class="grid grid-cols-2 gap-3">
              <input id="fb-reg-college" required placeholder="College Name" class="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-transparent">
              <input id="fb-reg-board" required placeholder="Board" class="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-transparent">
              <input id="fb-reg-class" required placeholder="Class" value="HSC / XII" class="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-transparent">
              <input id="fb-reg-year" required placeholder="Academic Year" class="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-transparent">
            </div>
            <input id="fb-reg-password" type="password" minlength="6" required placeholder="Password (minimum 6 characters)" class="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-transparent">
            <button class="w-full py-3 rounded-xl bg-medical-600 hover:bg-medical-700 text-white font-bold">Create Student Account</button>
          </form>
          <div id="fb-auth-message" class="text-sm mt-3"></div>
        </div>
      </div>`;
    document.body.appendChild(div);

    const loginForm = document.getElementById('fb-login-form');
    const regForm = document.getElementById('fb-register-form');
    document.getElementById('fb-tab-login').onclick = () => { loginForm.classList.remove('hidden'); regForm.classList.add('hidden'); showMessage(''); };
    document.getElementById('fb-tab-register').onclick = () => { loginForm.classList.add('hidden'); regForm.classList.remove('hidden'); showMessage(''); };

    loginForm.onsubmit = async e => {
      e.preventDefault();
      showMessage('Logging in...');
      try {
        await auth.signInWithEmailAndPassword(document.getElementById('fb-login-email').value.trim(), document.getElementById('fb-login-password').value);
      } catch (err) { showMessage(friendlyError(err), true); }
    };
    regForm.onsubmit = async e => {
      e.preventDefault();
      showMessage('Creating account...');
      try {
        const email = document.getElementById('fb-reg-email').value.trim();
        const cred = await auth.createUserWithEmailAndPassword(email, document.getElementById('fb-reg-password').value);
        const profile = {
          uid: cred.user.uid,
          email,
          studentName: document.getElementById('fb-reg-name').value.trim(),
          college: document.getElementById('fb-reg-college').value.trim(),
          board: document.getElementById('fb-reg-board').value.trim(),
          className: document.getElementById('fb-reg-class').value.trim(),
          academicYear: document.getElementById('fb-reg-year').value.trim(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        await db.collection('students').doc(cred.user.uid).set(profile);
        await db.collection('profiles').doc(cred.user.uid).set({ history: [], usedQuestionIds: [], bookmarks: [], updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
      } catch (err) { showMessage(friendlyError(err), true); }
    };
  }


  function showLoadingOverlay() {
    if (document.getElementById(overlayId)) return;
    const div = document.createElement('div');
    div.id = overlayId;
    div.className = 'fixed inset-0 z-[9999] bg-gray-950/80 backdrop-blur-sm flex items-center justify-center p-4';
    div.innerHTML = `
      <div class="w-full max-w-sm bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 p-8 text-center">
        <div class="mx-auto w-14 h-14 rounded-2xl bg-medical-600 text-white flex items-center justify-center text-2xl animate-pulse"><i class="fa-solid fa-graduation-cap"></i></div>
        <h2 class="text-xl font-extrabold mt-4 text-gray-900 dark:text-white">Loading...</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">আপনার session যাচাই করা হচ্ছে</p>
      </div>`;
    document.body.appendChild(div);
  }

  function friendlyError(err) {
    const code = err && err.code || '';
    const map = {
      'auth/invalid-credential': 'Email বা password সঠিক নয়।',
      'auth/wrong-password': 'Password সঠিক নয়।',
      'auth/user-not-found': 'এই email-এর account পাওয়া যায়নি।',
      'auth/email-already-in-use': 'এই email দিয়ে account আগে থেকেই আছে।',
      'auth/weak-password': 'Password কমপক্ষে 6 characters দিন।',
      'auth/invalid-email': 'সঠিক email দিন।'
    };
    return map[code] || (err && err.message ? err.message : 'কাজটি সম্পন্ন হয়নি।');
  }

  async function loadRemoteQuestions() {
    try {
      const snap = await db.collection('questions').where('active', '==', true).get();
      const remote = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(q => Array.isArray(q.options) && q.options.length >= 2 && typeof q.answer === 'number');
      if (remote.length) {
        QUESTION_BANK.splice(0, QUESTION_BANK.length, ...remote);
      }
    } catch (e) {
      console.warn('Firestore questions unavailable; bundled question bank retained.', e);
    }
  }

  async function loadProfile(uid) {
    const [studentSnap, profileSnap] = await Promise.all([
      db.collection('students').doc(uid).get(),
      db.collection('profiles').doc(uid).get()
    ]);
    state.profile = { ...(studentSnap.exists ? studentSnap.data() : {}), ...(profileSnap.exists ? profileSnap.data() : {}) };
    if (!profileSnap.exists) await db.collection('profiles').doc(uid).set({ history: [], usedQuestionIds: [], bookmarks: [], updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
  }

  async function syncProfile() {
    if (!state.user) return;
    const history = JSON.parse(localStorage.getItem('med_history') || '[]');
    await db.collection('profiles').doc(state.user.uid).set({ history, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
  }

  function patchHistorySync() {
    if (!window.app || window.app.__firebasePatched) return;
    const original = window.app.saveExamAttempt.bind(window.app);
    window.app.saveExamAttempt = function (attempt) {
      original(attempt);
      syncProfile().catch(console.warn);
    };
    window.app.__firebasePatched = true;
  }

  function showApp() {
    const o = document.getElementById(overlayId);
    if (o) o.remove();
    document.body.classList.remove('overflow-hidden');
    patchHistorySync();
    if (window.app && typeof window.app.loadProgressStats === 'function') window.app.loadProgressStats();
  }

  async function start() {
    // Do NOT render the login form before Firebase restores its persisted session.
    // This prevents the login-screen flash on every page refresh.
    showLoadingOverlay();
    document.body.classList.add('overflow-hidden');
    let firstAuthState = true;
    auth.onAuthStateChanged(async user => {
      state.user = user;
      if (!user) {
        // Only show the actual login/register UI after Firebase confirms there is no session.
        ensureOverlay();
        document.body.classList.add('overflow-hidden');
        firstAuthState = false;
        return;
      }
      try {
        await loadProfile(user.uid);
        await loadRemoteQuestions();
        showApp();
      } catch (e) {
        console.error(e);
        showMessage('Firebase profile load করা যায়নি। Firestore Rules ও setup পরীক্ষা করুন।', true);
      }
    });
  }

  window.firebaseStudent = state;
  window.firebaseStudentLogout = () => auth.signOut();
  window.firebaseStudentSync = syncProfile;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
