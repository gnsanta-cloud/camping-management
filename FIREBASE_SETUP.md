# Firebase 자동 동기화 설정

PC·스마트폰(PWA)에서 **같은 예약·매출·상품 데이터**를 실시간으로 공유합니다.

## 1. Firebase 프로젝트 만들기

1. [Firebase Console](https://console.firebase.google.com/) → **프로젝트 추가**
2. **Authentication** → 로그인 방법 → **이메일/비밀번호** 사용 설정
3. **Firestore Database** → **프로덕션 모드**로 생성
4. **프로젝트 설정** → **내 앱** → **웹(`</>`)** 추가
5. 표시되는 `firebaseConfig` 값 복사

## 2. 앱에 설정 입력

`js/firebase-config.example.js` 를 참고해 **`js/firebase-config.js`** 수정:

```javascript
window.FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "...",
};
window.FIREBASE_CAMPGROUND_ID = "main";
```

> `apiKey`는 웹에 포함되어도 됩니다. 보안은 **Firestore Rules + 로그인**으로 합니다.

## 3. Firestore 보안 규칙 배포

Firebase Console → Firestore → **규칙** 탭에 `firestore.rules` 내용 붙여넣기 후 **게시**:

- 로그인한 사용자만 읽기/쓰기 가능

## 4. GitHub Pages에 배포

```cmd
cd d:\Camping
publish-github.cmd
```

## 5. 사용 방법

1. PC 또는 폰에서 앱 접속
2. **캠핑장 로그인** 화면 → **계정 만들기** (최초 1회) 또는 로그인
3. **같은 계정**으로 PC·폰 모두 로그인
4. 한쪽에서 예약/매출 수정 → 다른 쪽 **자동 반영**

### 최초 업로드

클라우드가 비어 있고 PC에만 데이터가 있으면  
「클라우드가 비어 있습니다. 업로드할까요?」 확인 창이 뜹니다 → **확인**

## 6. 동기화 대상

| 데이터 | 동기화 |
|--------|--------|
| 사이트·타입 | ✅ |
| 예약 | ✅ |
| 상품·카테고리 | ✅ |
| POS·매출 | ✅ |

## 7. 보안·운영 참고

- 직원용 **공용 계정 1개** 또는 개인별 계정 (모두 같은 Firestore 경로 사용)
- 외부 공개 URL 사용 시 **정보보안 사전 협의** 권장
- 예약 연락처 등 개인정보 — Firebase Console 접근 권한 관리
- 로그아웃: **설정 → Firebase 동기화 → 로그아웃**

## Firebase 미설정 시

`FIREBASE_CONFIG = null` 이면 기존처럼 **localStorage만** 사용합니다.
