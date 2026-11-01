# ODYSSEY

음성 인터뷰로 세 가지 인생 계획을 만들고 보드에서 편집하는 모바일 퍼스트 앱입니다. 화면 너비는 최대 500px이며, 로그인은 UI만 있고 실제 인증은 구현하지 않았습니다. 현재 데이터는 브라우저의 익명 세션 쿠키로 구분합니다.

## 실행

Docker Compose를 사용합니다. 저장소 루트에서 환경 파일을 복사하고 값을 직접 설정하세요.

```sh
cp .env.example .env
docker compose up --build
```

- 앱: http://localhost:3000 · API 문서: http://localhost:8000/docs
- 마이크는 `localhost`에서 사용할 수 있으며, 원격 접속에는 HTTPS가 필요합니다.
- 실제 AI 인터뷰에는 `CODYSSEY_API_KEY`(LLM·TTS), `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`(Workers AI STT)이 필요합니다. 키가 없거나 공급자 호출이 실패하면 오류가 발생하며 mock 응답으로 대체하지 않습니다. 키는 서버 환경에만 설정하세요.
- 공통 `.env.example`의 기본 모델은 `INTERVIEWER_LLM_MODEL=claude-haiku-4`, `PLANNER_LLM_MODEL=gpt-5.5`입니다. TTS·STT 모델과 음성, 최대 질문 수(`INTERVIEW_MAX_QUESTIONS`, 기본 10)도 이 파일을 참고해 설정합니다.
- PostgreSQL 기본 사용자·DB는 `odyssey`이며 `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`로 변경합니다.

## 검사

서비스가 실행 중인 상태에서 실행합니다. 호스트에 Python·Node 도구를 설치할 필요가 없습니다.

```sh
docker compose exec -T backend sh -ec 'uv run ruff check . && uv run ruff format --check . && uv run ty check && uv run pytest tests agents/tests && uv run lint-imports'
docker compose exec -T frontend sh -ec 'pnpm exec vitest run && pnpm run typecheck && pnpm exec biome check . && pnpm run depcruise && pnpm run build'
```

DB 테스트는 `DATABASE_URL`에 연결해 독립 테스트 DB를 생성·삭제하므로 DB 생성 권한이 필요합니다. Compose 기본 사용자 `odyssey`는 이 권한을 갖습니다. 테스트의 AI 호출은 대체되므로 실제 키가 필요하지 않습니다.

Lefthook은 pre-commit에서 변경된 디렉터리의 Ruff/Biome 전체 검사를, pre-push에서 위 전체 검사를 실행 중인 컨테이너에 `exec -T`로 실행합니다. 커밋·푸시 전에 `docker compose up --build`로 서비스를 켜 두세요. CI는 이미지를 빌드하고 DB를 시작한 뒤 `docker compose run --rm --no-deps`로 각 서비스 검사를 한 번씩 실행합니다.

### 브라우저 회귀 검사

```sh
docker compose --profile test run --build --rm --no-deps e2e
```

별도 서비스 실행, API 키, 마이크, 호스트 포트 없이 실행합니다. Playwright 이미지 안에서 앱을 빌드·실행하고 데스크톱·모바일 Chromium으로 같은 시나리오를 검사합니다. CI도 위 명령을 실행합니다. Playwright 의존성과 `frontend/Dockerfile.e2e`의 이미지 버전은 함께 변경하세요.

- `e2e/planner.spec.ts`: 완료된 인터뷰 복원 → 생성 → 서로 다른 세 플랜 → A/B/C 편집 → 전체보기 복귀, 생성 중 상태, 실패 후 재시도, 보드 미생성 안내.
- `e2e/layout.spec.ts`: 실제 렌더링에서 0~60개월·59~60개월 구간과 lane별 배치·잘림 여부.
- 테스트는 브라우저의 `/api/**` 요청을 통제합니다. 실제 AI·DB 통합 검사는 아니며, 예상하지 않은 API 요청은 실패시킵니다. DB 저장은 백엔드 API 테스트로 별도 검증합니다.

### 인터뷰·플랜 품질 회귀 체크리스트

`agents/tests/test_agents.py`는 아래 세 사례에서 전체 답변 전달과 프롬프트 정책 유지, 반복·복수 질문 및 동일 활동 플랜의 교정 재시도를 자동 검사합니다. 모델 출력은 통제하므로 의미적 품질의 실측으로 보지는 않습니다. 프롬프트를 변경할 때는 실제 공급자 결과도 같은 사례로 확인하세요.

| 사례 | 대표 답변 | 확인할 질문·플랜 |
| --- | --- | --- |
| 짧고 모호함 | “잘 모르겠어요. 그냥 좀 쉬고 싶어요.” | 쉬운 말로 최근 경험 하나만 묻고 직업·수입을 추측하지 않는다. 저비용 탐색에서 시작한다. |
| 강한 현실 제약 | “부모님 돌봄 때문에 이사할 수 없고 주 2시간, 월 3만원만 쓸 수 있어요.” | 이미 밝힌 제약을 다시 묻지 않는다. 세 플랜 모두 이사·돌봄·시간·예산 제약을 지키고 실험 범위를 구체화한다. |
| 상충하는 희망 | “안정적인 수입을 유지하고 싶지만 직장을 그만두고 여행도 하고 싶어요.” | 우선순위 하나를 확인하며 결론을 강요하지 않는다. 안정 유지·점진 전환·작은 여행 실험 등 서로 다른 경로를 제시한다. |

공통 체크: **한 번에 한 핵심 / 답변한 내용 반복 없음 / 답변 근거·미확인 가정 구분 / 세 경로의 실질적 차이 / 초기 탐색→실험→확장 활동 / 실험의 시간·비용·판단 기준**. 자동 검증은 명백한 반복을 걸러내며 의미가 같은 재표현까지 판정하지는 않습니다. 기존 모델과 최대 질문 수, JSON 교정 1회 정책을 유지합니다.

## 데이터와 API

서버 PostgreSQL에 인터뷰·답변·보드·편집 결과를 저장하고 원본 음성은 호스트 `./storage/audio`에 보관합니다. 컨테이너를 재시작해도 DB 볼륨과 음성 파일은 유지됩니다. 새 인터뷰로 보드를 만들어도 이전 보드 기록은 남으며, 현재 보드 API는 해당 세션의 최신 보드를 반환합니다. `docker compose down -v`는 DB 볼륨을 삭제합니다.

| 메서드 | 경로 | 용도 |
| --- | --- | --- |
| GET | `/health` | DB 연결 상태 |
| GET | `/api/config` | 최대 질문 수 |
| POST | `/api/interviews` | 인터뷰 시작 |
| GET | `/api/interviews/{id}` | 인터뷰 상태 |
| GET | `/api/interviews/{id}/speech` | 현재 질문 TTS |
| POST | `/api/interviews/{id}/answers` | 원본 음성 본문 제출 (`Content-Type: audio/*`, `X-Question-Number`) |
| POST | `/api/interviews/{id}/board` | 보드 생성 |
| GET | `/api/boards/current` | 최신 보드 조회 |
| PUT | `/api/boards/{board_id}/plans/{plan_id}` | 계획 전체 저장 |

정확한 요청·응답 스키마는 API 문서를 참고하세요. 세션 유지를 위해 API 요청에 쿠키를 포함해야 합니다.

### 플랜 자기평가

편집 화면에서 자원·호감·자신감·일관성을 각각 0~10 정수로 입력합니다. 미평가 항목의 **평가하기**를 누르면 0점부터 시작하며, 이후 슬라이더로 조정합니다. 입력한 항목만 자동 저장하고 전체보기의 세 플랜 카드에서 비교합니다. AI는 점수를 생성하지 않습니다.

`scores`는 평가한 항목만 포함합니다. 예를 들어 `{"resources": 0, "confidence": 8}`에서 자원은 0점이고 호감·일관성은 미평가입니다.

### #19 배포 시 기존 AI 평가 일회성 정리

기존 DB에는 AI 평가와 사용자 평가를 구분하는 정보가 없습니다. **사용자 자기평가 기능을 최초 공개하기 전에 한 번만** 실행합니다. 이후 다시 실행하면 사용자 평가도 지워지므로 서버 시작 시 자동 실행하지 않습니다.

운영 배포 시 새 코드를 받은 뒤, 다음 순서로 실행합니다. 평소 운영에 사용하는 환경 파일과 Compose 프로젝트명을 동일하게 유지합니다.

```sh
docker compose -f compose.prod.yaml stop caddy frontend backend
docker compose -f compose.prod.yaml build backend frontend
docker compose -f compose.prod.yaml up -d db
docker compose -f compose.prod.yaml run --rm --no-deps backend uv run python clear_ai_scores.py
docker compose -f compose.prod.yaml up -d
```

스크립트는 모든 과거 보드의 `plans[*].scores`를 빈 객체로 만들고 `raw_plan.plans[*].scores`를 제거합니다. 그 외 플랜 내용·순서·메타데이터, 인터뷰·음성은 보존하며 전체 정리는 단일 트랜잭션으로 처리합니다. 실행 완료 기록은 배포 기록에 남깁니다. 개발 DB에서는 서비스 실행 후 `docker compose exec -T backend uv run python clear_ai_scores.py`로 실행할 수 있습니다.
