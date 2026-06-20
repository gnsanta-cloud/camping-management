# 캠핑장 관리 (PWA)

캠핑장 예약 · 사이트현황 · 매점 POS · 매출 대시보드를 브라우저에서 사용하는 웹앱입니다.

## GitHub Pages 배포

1. GitHub에 새 저장소 생성
2. 이 폴더 내용 push (`*.xlsx`는 `.gitignore`로 제외됨)
3. 저장소 **Settings → Pages → Build and deployment**
   - Source: **Deploy from a branch**
   - Branch: **main** / **/(root)**
4. 배포 URL: `https://<사용자>.github.io/<저장소명>/`

## PWA 설치 (스마트폰)

1. 위 HTTPS 주소를 Chrome/Safari에서 열기
2. **홈 화면에 추가** / **앱 설치**
3. 아이콘으로 실행

## 로컬 테스트 (PWA 포함)

```bash
npx --yes serve .
```

브라우저에서 `http://localhost:3000` 접속 (Service Worker는 localhost에서 동작)

## 데이터

- 예약·매출 등은 브라우저 **localStorage**에 저장됩니다.
- 기기마다 데이터가 따로 있습니다. 백업은 **설정 → 데이터 내보내기**를 사용하세요.

## 파일

| 파일 | 설명 |
|------|------|
| `manifest.webmanifest` | PWA 앱 정보 |
| `sw.js` | 오프라인 캐시 |
| `icons/` | 앱 아이콘 |
