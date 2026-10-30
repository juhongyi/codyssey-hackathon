# Odyssey Planner

로컬 콘솔에서 시작하는 한국어 음성 인터뷰와 **Designing Your Life** 오디세이 플래닝
에이전트입니다. 사용자의 경험·가치관·동기·성향·삶의 맥락을 탐색한 뒤 서로 다른 세 가지
5년 인생 계획의 **초안**을 JSON으로 작성합니다. 웹 서버나 Worker 배포는 필요 없습니다.

## 준비 및 실행

macOS, 마이크·스피커, Python 3.13, [uv](https://docs.astral.sh/uv/)가 필요합니다.

```sh
uv sync --python 3.13
cp .env.example .env
# .env에 COPA_API_KEY, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN 입력
uv run odyssey interview
```

macOS의 마이크 접근 요청을 허용하세요. 마이크를 열 수 없다면 시스템 설정 → 개인정보
보호 및 보안 → 마이크에서 실행 중인 터미널의 접근을 허용하세요. 녹음 장치 오류가
발생하면 시스템 기본 입력 장치와 16 kHz 입력 지원을 확인하세요.

실행 후 질문은 음성으로 들립니다. 질문이 끝나면 자연스럽게 답변하세요. Enter 등의
조작 없이, 약 1.8초 침묵하면 발화를 전송합니다. 에이전트가 말하는 동안에는 녹음하지
않으며 끼어들기를 지원하지 않습니다. 콘솔에는 진행 상태와 저장 경로만 출력합니다.

충분한 맥락이 모이면 완료 동의를 묻지 않고 종료 안내 후 플랜을 생성합니다.
"인터뷰를 마칠게요"처럼 조기 종료를 요청하면 확보한 정보로 초안을 만듭니다.
Ctrl+C는 프로세스를 중단하고 현재 데이터를 보존합니다. 발화가 하나도 없으면 플랜을
생성하지 않습니다.

## API 설정

`.env.example`의 값을 `.env`에서 설정합니다. 프로세스 환경변수가 `.env`보다 우선합니다.

| 용도 | API 및 기본 모델 |
|---|---|
| 인터뷰·플래닝 | COPA `/v1/chat/completions`, `claude-opus-4-8` |
| 음성 인식 | Cloudflare Workers AI, `@cf/openai/whisper-large-v3-turbo` |
| 음성 합성 | COPA `/api/v1/audio/tts`, `tts-1`, `alloy` |

텍스트 기본값은 제공된 모델 목록에서 최고 가격(1.5)으로 동률인 두 Opus 모델 중
`claude-opus-4-8`을 선택했습니다. `COPA_CHAT_MODEL`로 변경할 수 있습니다.
긴 구조화 응답이 잘리지 않도록 `COPA_MAX_TOKENS`는 기본 16,384로 명시합니다.
실제 게이트웨이 호출에서 생략 시 1,024토큰에 잘리는 응답을 확인했습니다.
Chat API의 모델별 JSON 모드 차이를 피하려고 프롬프트에 JSON 스키마를 제공하고,
응답을 Pydantic으로 검증합니다. 형식·근거 검증에 실패하면 최대 두 번 수정 요청합니다.
네트워크나 HTTP 오류는 자동 반복하지 않으며 원인과 저장된 데이터로 재시도할 수 있습니다.

Workers AI에는 **Account ID**와 해당 계정의 **Workers AI 권한을 가진 API Token**이
필요합니다. 녹음한 mono 16 kHz PCM WAV 전체를 base64로 인코딩하여 다음 API에 보냅니다.

```text
POST https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/@cf/openai/whisper-large-v3-turbo
{"audio":"<base64 WAV>","language":"ko","task":"transcribe"}
```

전사는 `result.text`에서 읽습니다.
[Workers AI REST 안내](https://developers.cloudflare.com/workers-ai/get-started/rest-api/)와
[Whisper 모델 규격](https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/)을
참고하세요. TTS는 제공된 COPA 규격으로 `format: "mp3"`,
`response_format: "b64_json"`을 보내고 `result.b64_json`을 저장합니다.

## 저장 및 재실행

```text
outputs/<UTC시각-고유ID>/
  audio/                 # 사용자 WAV, 에이전트 MP3
  conversation.json      # 발화 ID, 화자, 전사, 시간, 음성 경로, 처리 상태
  interview.json         # 대화 + 프로필 + 삶의 맥락 + 미래 방향 + 종료 상태
  plan.json              # 서로 다른 세 가지 5년 계획
```

음성과 전사 데이터는 API 호출 단계마다 저장합니다. API 오류나 Ctrl+C가 발생해도
수집한 자료는 보존됩니다. 전사 전 중단된 발화는 빈 text와 pending/failed 상태로 남고,
해당 WAV 파일은 보존됩니다. 음성 경로는 세션 디렉터리를 기준으로 한 상대 경로입니다.
발화 시간은 로컬 녹음·재생 단계의 시간이며 단어별 정밀 타임스탬프는 아닙니다.

```sh
# 저장한 인터뷰에서 플랜만 다시 작성 (마이크·Cloudflare 키 불필요)
uv run odyssey plan outputs/<세션>/interview.json
uv run odyssey plan outputs/<세션>/interview.json --output outputs/<세션>/plan-v2.json
```

기본 `plan` 명령은 같은 디렉터리의 `plan.json`을 교체합니다. 중단된 인터뷰도
전사된 사용자 발화가 있으면 입력할 수 있으며, 부족한 정보는 가정·미결정 질문으로
남깁니다. 인터뷰 대화 재개는 지원하지 않습니다.

`.env`와 기본 `outputs/`는 Git에서 제외됩니다. 출력 경로를 변경하면 해당 경로의
Git 제외 여부도 확인하세요. 음성은 Cloudflare로, 전사·프로필은 COPA Chat API로,
에이전트 발화 텍스트는 COPA TTS API로 전송됩니다. 녹음과 JSON은 로컬에 유지되며
필요 없어진 세션 폴더는 직접 삭제할 수 있습니다.

## 데이터와 프롬프트

스키마는 `src/odyssey_planner/schemas.py`, 한국어 프롬프트는 `prompts/`에 있습니다.
`schema_version`은 `1.0`입니다.

- **인터뷰:** `conversation`과 `state`에 전체 맥락을 저장합니다. `state.profile`의
  여섯 영역은 정체성, 가치·동기, 강점·패턴, 관심·에너지, 관계·환경, 현재 상황·제약입니다.
  각 관찰은 실제 사용자 발화 ID 근거, 해석 여부, 신뢰도를 가집니다. 현재 경로·대안·
  제약 없는 경로의 단서와 불확실성도 기록합니다. 여섯 영역에 medium 이상 근거가 있고
  세 미래 방향의 근거가 있어야 에이전트가 충분한 정보로 종료할 수 있습니다.
  단순 항목 충족 외에 중요한 공백과 모순의 탐색 여부는 모델이 판단합니다.
- **플랜:** `plans`에는 `current_path`, `alternative_path`, `unconstrained_path`를
  하나씩 담습니다. 각 계획은 제목, 요약, 근거, 1~5년 활동, 자원, 제약, 가정,
  질문과 작은 실험(`prototypes`)을 포함합니다. `open_questions`에는 미결정 사항을
  담습니다. 사용자가 매기지 않은 평가 점수는 생성하지 않습니다.

## 음성 감지 조정 및 한계

외부 실시간 음성 세션 대신 **녹음 → 전사 → 텍스트 생성 → TTS → 재생**을 사용하므로
턴 사이에 API 지연이 있습니다. 소음이 있는 환경에서는 헤드셋 사용을 권장합니다.
단순 RMS 기반 감지이므로 주변 소음도 발화로 감지할 수 있습니다.

- `ODYSSEY_SPEECH_THRESHOLD`: 낮추면 조용한 목소리를 감지하고, 높이면 소음을 줄입니다.
- `ODYSSEY_END_SILENCE_SECONDS`: 답변 중 잠깐의 쉼에 잘린다면 늘리세요.
- `ODYSSEY_START_TIMEOUT_SECONDS`: 기본 120초 동안 발화가 없으면 중단·보존합니다.
- `ODYSSEY_MAX_TURN_SECONDS`: 기본 120초에서 한 발화를 구분하여 전송합니다.

API 키를 설정한 뒤 실제 한국어 전사·TTS·마이크 동작을 확인해야 합니다. 자동화 테스트는
외부 API와 오디오 장치를 모의 처리하며 실제 서비스의 모델 제공 여부나 품질은 검증하지
않습니다.

### 실제 API 검증 (2026-10-30)

로컬 `.env` 인증정보와 가상 사용자 시나리오로 다음 호출을 확인했습니다.

- `claude-opus-4-8` Chat 호출 및 인터뷰 에이전트의 구조화된 JSON 응답 검증
- `tts-1` 한국어 MP3 생성과 macOS `afconvert`를 통한 16 kHz mono WAV 변환
- Workers AI Whisper로 해당 WAV의 한국어 전사 (616자)
- 전사된 인터뷰를 입력한 `uv run odyssey plan` 실행 및 세 가지 계획 JSON 저장
- 각 계획의 1~5년 구성, 서로 다른 세 방향, 실제 입력 발화 ID 근거 검증

초기 호출에서 출력 한도 생략 시 1,024토큰 응답 잘림이 발생해 명시적 출력 한도를
추가했습니다. 긴 플랜 생성 중 게이트웨이 504가 한 번 발생하여 프롬프트를 간결한
초안 분량으로 조정했고, 이후 동일 모델의 생성이 성공했습니다. 서비스 지연에 따라
타임아웃은 다시 발생할 수 있으며, 저장된 인터뷰로 `plan` 명령을 재실행할 수 있습니다.
실제 마이크 녹음과 스피커 청취는 이 API 검증에 포함하지 않았습니다.

## 개발 검증

```sh
uv sync --locked
uv run pytest
uv run ruff check .
uv run ruff format --check .
uv run odyssey --help
```
