# 스마트 도서관 좌석 예약 시스템 (Library Seat Reservation)

구글 스프레드시트('시트1') 및 Google Apps Script(GAS) 백엔드와 실시간으로 연동되는 반응형 도서관 열람실 좌석 예약 웹 애플리케이션입니다.

## 🚀 Vercel 배포 가이드

1. **GitHub 저장소에 Push**
   - 변경된 코드(`package.json`, `package-lock.json`, `vercel.json`, `vite.config.ts`)를 GitHub `main` 브랜치에 커밋 및 푸시합니다.
2. **Vercel 자동 배포**
   - GitHub와 연동된 Vercel 프로젝트에서 자동으로 배포가 진행됩니다.
   - 설정된 `vercel.json`에 의해 빌드 명령어(`npm run build`)와 출력 디렉토리(`dist`)가 자동으로 인식됩니다.

## 📁 주요 파일 구성

- `src/`: React 19 + TypeScript + Tailwind CSS 인터랙티브 예약 시스템 프론트엔드
- `public/Index.html`: Google Apps Script 배포용 단일 HTML 파일
- `Code.gs`: 구글 스프레드시트('시트1') 연동 및 중복 예약 방지 락(LockService) 백엔드 스크립트
- `vercel.json`: Vercel 배포 및 SPA 라우팅 설정 파일
- `package-lock.json`: Vercel 빌드 시 의존성 충돌(ERESOLVE) 방지용 락파일
