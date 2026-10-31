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
