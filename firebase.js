(function () {
  if (!window.firebase || !window.FIREBASE_CONFIG) return;
  if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
  window.db = firebase.firestore();
  window.auth = firebase.auth();
})();
