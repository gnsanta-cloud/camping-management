# JSONBin.io 자동 동기화 (5분 설정)

PC·스마트폰에서 **같은 데이터**를 자동으로 맞춥니다. Firebase보다 설정이 간단합니다.

## 1. JSONBin 가입

1. [https://jsonbin.io](https://jsonbin.io) 접속 → **Sign Up** (무료)
2. 로그인 후 대시보드 이동

## 2. Bin 만들기

1. **Create Bin** 클릭
2. 내용에 `{}` 입력 후 저장
3. Bin URL에서 **Bin ID** 복사  
   예: `https://jsonbin.io/abc123def456` → `abc123def456`

## 3. Access Key 만들기

1. 대시보드 → **API Keys** → **Create Access Key**
2. 권한: **Read + Write**
3. 생성된 **Access Key** 복사 (한 번만 표시됨 — 메모해 두세요)

## 4. 앱에 연결

### 방법 A — 설정 화면 (권장)

1. 앱 **설정** 메뉴 → **JSONBin 동기화**
2. **Bin ID**, **Access Key** 입력 → **연결**
3. **스마트폰**에서도 같은 Bin ID · Access Key 입력 → **연결**

### 방법 B — 코드 (선택)

`js/jsonbin-config.example.js` 참고해 `js/jsonbin-config.js` 수정

## 5. 동작

| 동작 | 설명 |
|------|------|
| 저장 | 예약·매출 등 변경 시 **약 1초 후** JSONBin 업로드 |
| 자동 불러오기 | **20초마다** + 화면 다시 볼 때 |
| 수동 | 설정 → **지금 불러오기** / **지금 업로드** |

클라우드가 비어 있으면 PC 데이터 **업로드** 확인 창이 뜹니다.

## 6. URL

- PC: `https://gnsanta-cloud.github.io/camping-management/`
- 폰 PWA: `…/sites.html`  
  (같은 Bin ID·Key 입력하면 동일 데이터)

## 7. 보안 참고

- Access Key는 **앱 설정에 저장**됩니다 (브라우저 localStorage).
- Bin은 본인 Access Key 없이는 수정할 수 없습니다.
- Key 유출 시 JSONBin에서 **키 재발급**하세요.

## 8. 문제 해결

| 증상 | 해결 |
|------|------|
| 업로드 실패 | Bin ID·Access Key 확인, Write 권한 확인 |
| 데이터 안 맞음 | 설정 → **지금 불러오기** |
| 연결 해제 | 설정 → **연결 해제** |
