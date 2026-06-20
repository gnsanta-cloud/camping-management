# 캠핑장 관리 (PWA)

캠핑장 예약 · 사이트현황 · 매점 POS · 매출 대시보드를 브라우저에서 사용하는 웹앱입니다.

## GitHub Pages 배포

### 한 번에 배포 (권장)

1. [Git for Windows](https://git-scm.com/download/win) · [GitHub CLI](https://cli.github.com/) 설치
2. PowerShell:

```powershell
cd d:\Camping
.\scripts\publish-github.ps1
```

3. 브라우저 GitHub 로그인 승인
4. 배포 URL: `https://<GitHub아이디>.github.io/camping-management/`

저장소 이름 변경:

```powershell
.\scripts\publish-github.ps1 -RepoName "원하는-저장소명"
```

비공개 저장소:

```powershell
.\scripts\publish-github.ps1 -Private
```

> **참고:** 비공개 저장소도 GitHub Pages URL은 공개 접속될 수 있습니다. 민감 데이터는 로그인·백엔드 연동 후 사용하세요.

### 수동 배포

1. GitHub에서 새 저장소 생성
2. push:

```powershell
cd d:\Camping
git remote add origin https://github.com/<사용자>/<저장소>.git
git push -u origin main
```

3. 저장소 **Settings → Pages → main / (root)**

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
