# Odyssey Planner — 음성 인터뷰 앱

중앙 버튼을 누르는 동안 말하고 놓으면, FastAPI가 음성을 인식하고 에이전트의 다음
질문을 음성으로 돌려줍니다. 인터뷰가 끝나면 요약과 서로 다른 세 가지 **5개년 삶의 경로**를
백엔드 JSON 파일로 저장합니다.

```text
Next.js: 마이크 녹음 → WAV 업로드 → 대기 → 응답 음성 재생
                         ↓                    ↑
FastAPI: 세션 → STT → 인터뷰 엔진 → TTS
                         ↓ 종료
                    요약 → 계획 엔진 → JSON 저장
```

## 설치 및 실행

Python 3.13, uv, Node.js 20.9 이상, npm이 필요합니다.

```bash
uv sync
cp .env.example .env
npm --prefix frontend ci
```

루트 `.env`에 `CODYSSEY_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`을
작성한 뒤, 저장소 루트에서 두 터미널로 실행합니다.

```bash
uv run uvicorn backend.api:app --host 127.0.0.1 --port 8000
```

```bash
npm --prefix frontend run dev
```

브라우저에서 **http://127.0.0.1:3000**을 열고 마이크 권한을 허용하세요.
브라우저 마이크는 localhost 또는 HTTPS에서 사용할 수 있습니다. 로컬 데모는 FastAPI를
단일 프로세스로 실행합니다. Next.js가 `/api/*`를 `127.0.0.1:8000`으로 프록시합니다.
최종 요약·계획 생성 시간을 고려해 Next.js 프록시 응답 제한은 15분으로 설정합니다.

### 버튼 동작

- 첫 누름부터 녹음하며, 놓으면 자동 전송합니다. 처음에는 현재 상황이나 원하는 삶을 말하세요.
- 녹음 중에는 파란색, API 대기 중에는 회전 애니메이션, 응답 재생 중에는 음성 애니메이션입니다.
- 처리와 재생 중에는 버튼이 비활성화됩니다. Space/Enter를 누르고 놓는 조작도 지원합니다.
- 화면에는 버튼만 표시합니다. 질문·인식된 답변·처리 단계·저장 경로는 백엔드 로그에서 확인합니다.
- 모델이 종료를 판단하거나 최대 턴 수에 도달하면 요약과 계획을 저장하고 완료 음성을 재생합니다.
  음성으로 인터뷰 종료를 요청할 수도 있습니다.
- 완료 후 다음 녹음, 또는 새로고침 후 녹음은 새 대화를 시작합니다.
- 실패는 버튼이 붉게 바뀌며, 다음 누름으로 다시 녹음할 수 있습니다. 자동 재전송은 없습니다.
  브라우저 마이크·재생 오류는 브라우저 콘솔, 외부 API 오류는 백엔드 로그에서 확인합니다.

## 구조

```text
backend/
  api.py           # 세션, 요청, 엔진 호출, 저장, 로그
  audio.py         # Workers AI STT / Codyssey TTS
  interview.py     # 텍스트 대화 이력 → 질문, 종료 판단, 요약
  planner.py       # 요약된 인터뷰 → 3개 경로
  prompts/         # 인터뷰·계획 프롬프트
  tests/           # 엔진과 API 테스트
frontend/
  app/             # 버튼, 녹음, 업로드, 응답 재생
  public/recorder.js # AudioWorklet 마이크 캡처
outputs/           # 세션별 JSON (Git 제외)
```

에이전트 모듈은 터미널 입력, 로컬 오디오 장치, 파일 저장, 서브프로세스 실행을 담당하지
않습니다. FastAPI가 엔진을 함수로 호출합니다. 마이크와 재생은 사용자 브라우저가 담당하며
서버에 PortAudio가 필요하지 않습니다.

## API

**`POST /api/turns?session_id=<UUID>`**

- `Content-Type: audio/wav`, 본문은 모노·16kHz·16비트 PCM WAV 바이트입니다.
- 첫 요청은 `session_id`를 생략합니다. 후속 요청은 응답에서 받은 ID를 전달합니다.
- 브라우저는 실제 장치 샘플레이트로 캡처하고 16kHz로 리샘플링하여 WAV를 만듭니다.
- 녹음 요청당 최대 10 MiB입니다.

```json
{
  "session_id": "UUID",
  "status": "active",
  "audio": "base64-encoded WAV"
}
```

종료 응답의 `status`는 `completed`입니다. 요약과 계획은 응답에 포함하지 않습니다.
잘못된 WAV는 400, 없는 세션은 404, 완료된 세션은 409, 외부 서비스 등 처리 실패는 502입니다.
502 응답에는 저장된 체크포인트가 있으면 `session_id`와 현재 `status`를 포함합니다.

## 설정

`.env.example`을 기준으로 설정합니다. 프로세스 환경변수는 `.env`보다 우선합니다.

| 환경변수 | 기본값 / 용도 |
|---|---|
| `CODYSSEY_BASE_URL` | `https://copa.codyssey.kr` — `/v1` 없는 루트 URL |
| `CODYSSEY_API_KEY` | Codyssey virtual key (필수) |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | Workers AI 계정·토큰 (필수) |
| `INTERVIEW_MODEL`, `PLANNING_MODEL` | `claude-haiku-4` |
| `TTS_MODEL`, `TTS_VOICE` | `tts-1`, `alloy` |
| `STT_MODEL` | `@cf/openai/whisper-large-v3-turbo` |
| `MAX_QUESTIONS` | `12` — 시작 발화를 포함한 최대 사용자 턴 수 |
| `API_TIMEOUT_SECONDS` | `120` — 외부 API 호출별 제한 |
| `OUTPUT_DIR` | `outputs` — 백엔드 실행 디렉터리 기준 |

대화는 `/v1/chat/completions`, TTS는 `/api/v1/audio/tts`에
`format=wav`, `response_format=b64_json`을 사용합니다. STT는 Workers AI REST API로
base64 WAV를 보내고 `result.text`를 읽습니다. 키는 백엔드에서만 사용합니다.

## 저장 및 실패 처리

`outputs/<session-id>/interview.json`에는 `exchanges`, `summary`, 다음 `question`, `status`를
저장합니다. 첫 발화의 질문 표시는 `사용자의 시작 발화`입니다. 인식된 답변은 모델 호출 전에
원자적으로 저장하고 요약·다음 질문도 갱신합니다. 원본 음성은 디스크에 저장하지 않습니다.

`plan.json`에는 `current`, `alternative`, `unconstrained` 경로와 각 경로의 1~5년차 방향,
첫 실험, 가정을 저장합니다. 계획 생성 실패 시 요약과 문답은 보존됩니다. 모델 JSON은
스키마로 검증하고 한 번만 수정 요청하며, 검증되지 않은 계획을 저장하지 않습니다.

다음 녹음은 같은 페이지의 세션에서 이어집니다. 새로고침 시 이전 세션을 복원하지 않으며,
저장된 데이터는 남습니다. 실패 직전에 저장된 질문은 로그로 확인할 수 있습니다.
여러 동시 요청은 단일 프로세스 내에서 순차 처리됩니다.

## 검증

```bash
uv run ruff check .
uv run ruff format --check .
uv run pytest
npm --prefix frontend run typecheck
npm --prefix frontend run build
```

Python 테스트는 외부 API를 대체하여 음성 API 계약, 다음 질문, 자동 종료, 저장과 실패 시
체크포인트 보존을 검증합니다. 실제 공급자 연동에는 로컬 `.env`가 필요합니다.
