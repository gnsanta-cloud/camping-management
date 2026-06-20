/**
 * Firebase 프로젝트 설정 예시
 * 1. Firebase Console에서 웹 앱 추가
 * 2. 아래 값을 js/firebase-config.js 에 입력 후 저장
 * 3. Authentication(이메일/비밀번호) · Firestore 활성화
 * 4. firestore.rules 배포
 *
 * apiKey는 클라이언트에 노출되어도 됩니다. 접근 제어는 Firestore Rules + Auth 로 합니다.
 */
window.FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};
window.FIREBASE_CAMPGROUND_ID = "main";
