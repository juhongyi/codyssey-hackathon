# Odyssey Planner — 콘솔 에이전트

한국어 음성 인터뷰로 필요한 정보를 모으고 서로 다른 세 가지 **5개년 삶의 초안**을
JSON으로 저장합니다. 과거 구현을 사용하지 않고 새로 작성한 독립 실행 스크립트입니다.

```text
마이크 → Workers AI STT → 인터뷰 에이전트 → interview.json
                            ↓ Codyssey TTS       ↓
                          질문 재생       플래닝 에이전트 → plan.json
```

## 설치

Python 3.13과 [uv](https://docs.astral.sh/uv/)를 사용합니다.

```bash
uv sync
cp .env.example .env
```

`.env`에 다음 인증값을 로컬에서 작성하세요. 실제 키는 공유하거나 커밋하지 마세요.

- `CODYSSEY_API_KEY`: Codyssey virtual key
- `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`: Workers AI 사용 권한이 있는 계정과 토큰

마이크·스피커와 OS 마이크 권한이 필요합니다. `sounddevice`는 PortAudio를 사용합니다.
macOS/Windows에서는 일반적으로 함께 설치되며, Linux에서 필요하면 시스템 패키지
관리자로 PortAudio를 설치하세요. 기본 입출력 장치를 사용합니다.

## 실행

```bash
uv run interview.py
uv run planner.py outputs/<session-id>/interview.json
```

- 질문을 콘솔과 음성으로 제공합니다.
- Enter로 답변 녹음을 시작하고, 다시 Enter로 종료합니다.
- 인식 결과를 확인한 뒤 Enter로 확정하거나 `r`로 재녹음합니다.
- 녹음 시작 전 `q`를 입력하면 조기 종료합니다. 모델의 종료 제안에는 `c`로 계속할 수 있습니다.
- 최대 질문 수에 도달하면 인터뷰를 마칩니다. 첫 질문·후속 질문 모두 상한에 포함됩니다.
- 답변이 하나 이상 있으면 종료 시 요약을 저장하고 별도 프로세스로 플랜을 생성합니다.
- 인터뷰가 완료된 JSON으로 플랜을 다시 생성할 때는 마이크나 Cloudflare 인증이 필요 없습니다.
- 같은 인터뷰로 다시 생성하면 성공 시 해당 세션의 `plan.json`을 교체합니다.

## 설정

`.env.example`은 설정의 기준입니다. 이미 지정된 프로세스 환경변수는 `.env`보다 우선합니다.

| 환경변수 | 기본값 / 용도 |
|---|---|
| `CODYSSEY_BASE_URL` | `https://copa.codyssey.kr` — `/v1`을 붙이지 않은 루트 URL |
| `INTERVIEW_MODEL` | `claude-haiku-4` |
| `PLANNING_MODEL` | `claude-haiku-4` |
| `TTS_MODEL`, `TTS_VOICE` | `tts-1`, `alloy` |
| `STT_MODEL` | `@cf/openai/whisper-large-v3-turbo` |
| `MAX_QUESTIONS` | `12` — 1 이상의 정수 |
| `API_TIMEOUT_SECONDS` | `120` |
| `OUTPUT_DIR` | `outputs` — 현재 작업 디렉터리 기준 |

대화는 Codyssey의 `/v1/chat/completions`를 사용합니다. TTS는 표준 OpenAI 경로 대신
`/api/v1/audio/tts`에 `format=wav`, `response_format=b64_json`을 요청하고
`result.b64_json`에서 오디오를 받습니다. 재생은 16비트 PCM WAV를 기대합니다.
STT는 Workers AI REST API에 base64 인코딩한 16kHz mono WAV를 보내고 `result.text`를 읽습니다.
Cloudflare Worker 배포는 필요하지 않습니다.

## 데이터

실행별 `outputs/<session-id>/`에 저장합니다. 원본 음성은 메모리에서만 사용합니다.
로컬 문답과 플랜은 Git에서 제외되며, API 처리에 필요한 음성과 텍스트는 각 제공업체로 전송됩니다.

**`interview.json`**
- `exchanges`: `question`, `answer`로 구성된 문답 목록
- `summary`: `current_situation`, `desired_life_and_interests`, `constraints`,
  `current_path_clues`, `alternative_path_clues`, `unconstrained_path_clues`, `unknowns`

**`plan.json`**
- `paths`: `current`, `alternative`, `unconstrained` 유형 각각 하나
- 각 경로: `kind`, `title`, `summary`, `years`(1~5년차 `year`, `direction`),
  `first_experiment`, `assumptions`(없으면 빈 배열)

프롬프트는 `prompts/`에서 직접 수정할 수 있습니다. 인터뷰는 플랜에 필요한 최소 정보를
탐색하며, 플랜은 점수나 유형 분류 없이 세 가지 대안을 제시하고 미확인 내용은 가정으로 구분합니다.
스키마 검증은 구조를 확인하며, 제안의 질과 경로 간 실질적 차이는 사람이 검토해야 합니다.

## 중단과 오류

답변 확정마다 JSON을 원자적으로 교체해 저장합니다. API 오류나 Ctrl+C 시 확정된 답변은
남지만, 최종 요약 전의 `summary: null` 파일은 플래너 입력으로 사용할 수 없습니다.
자동 인터뷰 재개는 지원하지 않습니다. `q`로 정상 종료하면 가능한 범위에서 요약·플랜을 만듭니다.

STT 실패 시 재녹음하거나 종료할 수 있습니다. 다른 API·오디오 실패는 오류를 표시하고
중단합니다. 모델의 JSON이 잘못되면 검증 오류로 한 번 수정 요청하며, 재실패 시 잘못된
플랜을 저장하지 않습니다. 응답 전체가 JSON 코드 펜스로 감싸진 경우에는 펜스만 제거한 뒤
동일한 스키마 검증을 적용합니다. 무제한 재시도는 하지 않습니다.

## 검증

```bash
uv run ruff check .
uv run ruff format --check .
uv run pytest
```

테스트는 외부 API와 오디오 장치를 대체합니다. 실제 서비스 연동은 `.env` 작성 후 위 실행
명령으로 확인하세요. 실제 마이크·스피커 사용은 로컬 환경에서 별도로 확인해야 합니다.

구현 시 실제 Codyssey 대화·요약과 TTS, Workers AI STT를 확인했습니다. 한국어 TTS의
24kHz mono 16비트 PCM WAV를 STT에 전달해 문장을 인식했고, 샘플 인터뷰에서 세 경로의
5개년 플랜 JSON을 생성·검증·저장했습니다. 마이크 녹음과 스피커 재생은 이 API 검증에
포함되지 않습니다.
