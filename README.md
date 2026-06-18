# Stock News Dashboard

미국/한국 주식 종목의 최신 뉴스를 자동으로 수집해 보여주는 개인용 대시보드.

- **월 비용 $0** — GitHub Actions + GitHub Pages만 사용
- **3시간마다 자동 갱신** — Yahoo Finance, Google News RSS 수집
- **브라우저에서 종목 추가/삭제** — GitHub API로 config 직접 수정

## 시작하기

### 1. GitHub Pages 활성화

1. 이 repo의 **Settings → Pages** 이동
2. Source: **GitHub Actions** 선택
3. 저장 후 Actions 탭에서 `Deploy to GitHub Pages` 워크플로우가 완료되면 접속 URL 확인

### 2. PAT(Personal Access Token) 발급

종목 추가/삭제 및 수동 뉴스 수집 기능에 필요합니다.

1. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens**
2. **Generate new token** 클릭
3. 아래 권한 부여:
   - **Contents**: Read and Write
   - **Actions**: Write
4. 발급된 토큰 복사 (페이지를 닫으면 다시 볼 수 없음)

### 3. 대시보드 설정

1. 배포된 대시보드 접속
2. 우측 상단 **⚙ 설정** 클릭
3. Owner(GitHub 사용자명), Repo(`stock-news-dashboard`), PAT 입력 후 저장

## 사용법

| 기능 | 방법 |
|------|------|
| 종목 추가 | 좌측 패널에서 Symbol / Name / Market 입력 후 추가 |
| 종목 삭제 | 좌측 패널의 종목 목록에서 삭제 버튼 |
| 즉시 뉴스 수집 | 상단 **지금 수집** 버튼 (GitHub Actions 수동 실행) |
| 자동 갱신 | 3시간마다 자동 수집, 브라우저는 5분마다 자동 반영 |

## 종목 코드 형식

| 마켓 | 예시 |
|------|------|
| US | `AAPL`, `TSLA`, `NVDA` |
| KR | `005930` (삼성전자), `035720` (카카오) |

한국 종목 코드는 [네이버 금융](https://finance.naver.com)에서 확인할 수 있습니다.

## 구조

```
.github/workflows/
  fetch-news.yml   # 3시간마다 RSS 수집 → news.json 커밋
  deploy.yml       # main push 시 GitHub Pages 배포
public/
  config.json      # 종목 목록 (브라우저 UI 또는 직접 수정)
  data/
    news.json      # GitHub Actions이 자동 생성
scripts/
  fetch-news.js    # RSS 수집 스크립트
src/               # React 대시보드
```
