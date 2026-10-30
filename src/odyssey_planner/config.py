import os
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel, Field


class Settings(BaseModel):
    copa_api_key: str = ""
    chat_url: str = "https://copa.codyssey.kr/v1/chat/completions"
    chat_model: str = "claude-opus-4-8"
    chat_max_tokens: int = Field(default=16384, gt=0)
    tts_url: str = "https://copa.codyssey.kr/api/v1/audio/tts"
    tts_model: str = "tts-1"
    tts_voice: str = "alloy"
    cloudflare_account_id: str = ""
    cloudflare_api_token: str = ""
    stt_model: str = "@cf/openai/whisper-large-v3-turbo"
    output_dir: Path = Path("outputs")
    speech_threshold: float = Field(default=0.015, gt=0, lt=1)
    end_silence_seconds: float = Field(default=1.8, ge=0.3)
    start_timeout_seconds: float = Field(default=120, gt=0)
    max_turn_seconds: float = Field(default=120, ge=5)

    @classmethod
    def from_env(cls) -> "Settings":
        load_dotenv()
        names = {
            "copa_api_key": "COPA_API_KEY",
            "chat_url": "COPA_CHAT_URL",
            "chat_model": "COPA_CHAT_MODEL",
            "chat_max_tokens": "COPA_MAX_TOKENS",
            "tts_url": "COPA_TTS_URL",
            "tts_model": "COPA_TTS_MODEL",
            "tts_voice": "COPA_TTS_VOICE",
            "cloudflare_account_id": "CLOUDFLARE_ACCOUNT_ID",
            "cloudflare_api_token": "CLOUDFLARE_API_TOKEN",
            "stt_model": "CLOUDFLARE_STT_MODEL",
            "output_dir": "ODYSSEY_OUTPUT_DIR",
            "speech_threshold": "ODYSSEY_SPEECH_THRESHOLD",
            "end_silence_seconds": "ODYSSEY_END_SILENCE_SECONDS",
            "start_timeout_seconds": "ODYSSEY_START_TIMEOUT_SECONDS",
            "max_turn_seconds": "ODYSSEY_MAX_TURN_SECONDS",
        }
        return cls.model_validate(
            {key: os.environ[name] for key, name in names.items() if name in os.environ}
        )

    def require_credentials(self, *, voice: bool) -> None:
        missing = []
        if not self.copa_api_key.strip():
            missing.append("COPA_API_KEY")
        if voice:
            if not self.cloudflare_account_id.strip():
                missing.append("CLOUDFLARE_ACCOUNT_ID")
            if not self.cloudflare_api_token.strip():
                missing.append("CLOUDFLARE_API_TOKEN")
        if missing:
            raise ValueError("환경변수를 설정하세요: " + ", ".join(missing))
