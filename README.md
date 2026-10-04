# Medical Admission Tester — Complete Firebase Version

This package preserves the original `Admission test.html` website and adds Firebase Authentication + Firestore.

## Included
- Original website UI, exam flow, timer, palette, result, review, progress/history, subject modes, previous/model/random modes, dark mode, responsive layout.
- Original bundled 90-question bank preserved in `data/questions.json`.
- Firebase Email/Password student registration and login.
- Student profile fields: name, college, board, class, academic year.
- Firestore-backed student profile/history.
- Firestore question loading with bundled-question fallback.
- Firestore rules that prevent students from writing questions.

## Firebase setup
1. Firebase Console → Authentication → Sign-in method → enable Email/Password.
2. Firebase Console → Firestore Database → create the database.
3. Publish the supplied `firestore.rules`.
4. The supplied `js/firebase-config.js` contains the Firebase Web App config for project `medical-admission-pro`.

## Questions
The website currently includes the original 90 questions. To make Firestore the live question source, add documents under `questions` with:
- `active`: boolean
- `answer`: number (0–3)
- `difficulty`: string
- `explanation`: string
- `options`: array of 4 strings
- `question`: string
- `source`: string
- `subject`: `biology`, `chemistry`, `physics`, `english`, or `gk`
- optional `year`

Students can only read active questions. Question creation/editing is intentionally blocked from the public frontend.

## Important
Do not add Firebase service-account/private keys to this frontend project. The Web App config is intended for client-side Firebase use; security comes from Firestore Rules and Authentication.
