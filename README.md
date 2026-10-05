# Medical Admission Pro

Production-ready static frontend for GitHub Pages with Firebase Authentication/Firestore integration.

## Frontend
- `index.html`
- `style.css`
- `script.js`
- `questions.json`
- `js/firebase-config.js`
- `js/firebase.js`
- `js/firebase-integration.js`

## Deploy to GitHub Pages
1. Extract the ZIP.
2. Upload the extracted files to the repository root (do not upload only the ZIP).
3. GitHub → Settings → Pages → Deploy from branch → `main` → `/ (root)`.
4. In Firebase Authentication enable Email/Password.
5. Create Firestore Database.
6. Apply the Firestore rules from `FIREBASE_SETUP.md`.

## Questions
Replace `questions.json` with a new valid JSON array. No HTML/JS question editing is required. Keep original/authorized questions only. For bilingual content, optional fields are supported:
- `question_bn`, `question_en`
- `options_bn`, `options_en`
- `explanation_bn`, `explanation_en`

If bilingual fields are absent, the app keeps the original question and can use its translation fallback when switching to English.

## Leaderboard cache
Firestore is the source of truth. The browser stores a local cache so the leaderboard appears immediately, then refreshes silently in the background.
