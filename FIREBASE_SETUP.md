# Firebase setup

## 1) Authentication
Firebase Console → Authentication → Sign-in method → enable **Email/Password**.

Guest mode remains available even if Firebase is unavailable.

## 2) Firestore
Create a Firestore database. The app uses:
- `students/{uid}` for student profile data
- `leaderboard/{uid}` for aggregated quiz points/statistics
- `quizAttempts/{uid_timestamp}` for duplicate-submit protection

## 3) Firestore rules
Start with development rules only if you understand the risk. For production, use authenticated read access for leaderboard and owner-only writes for student profiles. Quiz-point writes should ideally be moved to a trusted server/Cloud Function before treating the leaderboard as a high-stakes competitive system.

## 4) Client configuration
`js/firebase-config.js` contains the Firebase Web SDK configuration. Web SDK config values are not Admin SDK secrets. Never put service-account private keys or Admin SDK credentials in this repository.

## 5) Leaderboard behavior
The app renders the last saved leaderboard from LocalStorage immediately, then silently refreshes from Firestore. Firestore remains the source of truth; LocalStorage is only a UI cache.
