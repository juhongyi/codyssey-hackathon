# ODYSSEY

첨부 디자인과 `PRD.md`를 기반으로 만든 Next.js 라이프 디자인 저널 UI입니다.

## 실행

Node.js 24와 pnpm 10.34.9를 사용합니다.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

`http://localhost:3000`에서 확인할 수 있습니다. API 키나 환경변수는 필요하지 않습니다.

## 모바일 퍼스트 레이아웃

모든 화면은 최대 **480 CSS px**의 단일 열을 사용합니다. 작은 화면에서는 너비가 유동적으로 줄어들고, 큰 화면에서는 같은 480px 화면을 중앙에 배치합니다. 기본 좌우 여백은 20px이며 375px 이하에서는 16px입니다. 본문·입력 글자는 16px, 주요 버튼은 최소 높이 56px를 기준으로 합니다.

인터뷰는 `100dvh` 안에서 질문 영역만 스크롤되고 하단 조작부는 항상 접근할 수 있도록 구성했습니다. 편집 타임라인의 가로 이동은 캔버스 내부로 제한하며, 조각 추가·수정 시트도 최대 480px와 기기 하단 안전 영역을 적용합니다. 레이아웃 E2E는 360·390·430·480·1440px에서 화면 너비, 중앙 정렬, 가로 넘침, 세로 플랜 배치, 입력 글자 크기 및 시트 위치를 확인합니다.

## 화면과 동작

- `/`: 서비스 소개와 결과 보드 미리보기
- `/login`: 이메일·비밀번호 로그인 UI. 제출 시 미연동 안내와 보드 진입 제공
- `/interview`: 마이크 권한 요청, 실제 입력 음량, 음소거·재시도, 질문 읽기와 답변 완료, 결과 진입
- `/board`: 세 가지 5년 플랜, 타임라인, 네 가지 평가 관점
- `/board/a/edit` (`b`, `c`도 지원): 조각 추가·수정·복제·삭제, 드래그/방향키 이동, 실행 취소·다시 실행, 확대·스크롤·미니맵
- 존재하지 않는 경로·플랜: 404

질문 5개와 결과 플랜은 고정된 Mock 데이터입니다. 음성 인식·AI 분석·인증·서버 API는 구현하지 않았습니다. 마이크는 Web Audio API로 음량만 분석하며 녹음·업로드하지 않습니다. 질문 읽기는 브라우저의 한국어 음성 합성 지원에 따르며, 건너뛰기 버튼으로도 진행할 수 있습니다. 마이크 접근에는 localhost 또는 HTTPS가 필요합니다.

편집 변경 및 실행 기록은 편집 화면의 UI 상태에만 존재합니다. 화면 이탈·새로고침 시 초기화되며 보드에 전달하지 않습니다. 전역 저장소, localStorage, sessionStorage, 데이터베이스는 사용하지 않습니다.

## 실제 API 연결 지점

```text
src/lib/types.ts             공통 화면 모델: Plan, Piece, Question
src/lib/mock-data.ts         질문 및 플랜 예시 데이터
src/lib/planner-client.ts    비동기 데이터 조회 계약과 현재 Mock 어댑터
src/lib/interview.ts         인터뷰 진행 상태 전이
src/lib/editor.ts            편집 화면의 순수 변경·실행 기록 연산
src/components/use-resource.ts    조회 로딩·오류·재시도
src/components/use-microphone.ts  마이크 수명주기 및 음량 분석
```

화면은 `PlannerClient`의 `getPlans`, `getPlan`, `getQuestions`를 호출합니다. 조회 API를 연결할 때 `planner-client.ts`에서 HTTP 요청과 응답 → 공통 화면 모델 변환을 구현하면 됩니다. 컴포넌트에서 Mock 원본을 직접 가져오지 않습니다.

인터뷰는 현재 `advanceInterview`와 브라우저 TTS로 진행합니다. 실제 대화 API 도입 시 답변 전달·에이전트 이벤트를 인터뷰 진행 로직에 연결하고, 현재 완료 버튼과 고정 결과 연결을 교체해야 합니다. 인증과 편집 저장은 아직 계약을 가정하지 않았으며, 실제 API 정의 후 로그인 제출 및 편집 완료 동작에 연결할 수 있습니다.

`public/stone.svg`는 원본 사진 대신 이 프로젝트에서 제작한 돌 일러스트입니다. 글꼴은 Google Fonts의 Noto Sans KR와 Gowun Dodum을 사용하며, 접근 불가 시 시스템 sans-serif로 표시합니다.

## 검증

```sh
pnpm check
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

E2E 테스트는 프로덕션 서버를 3100 포트에서 실행합니다. 모바일·데스크톱에서 로그인 진입, 플랜 탐색, 조각 편집과 초기화, 마이크 권한 오류·재시도·음소거·질문 완료·트랙 해제를 검증합니다. 마이크 테스트는 Chromium의 가상 입력 장치를 사용합니다.
