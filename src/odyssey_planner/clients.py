import base64
import binascii
import json
from collections.abc import Callable
from pathlib import Path
from typing import TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from .config import Settings

T = TypeVar("T", bound=BaseModel)


class APIError(RuntimeError):
    pass


class Clients:
    def __init__(self, settings: Settings, http: httpx.Client):
        self.settings = settings
        self.http = http

    def _post(self, url: str, token: str, payload: dict) -> dict:
        try:
            response = self.http.post(
                url, headers={"Authorization": f"Bearer {token}"}, json=payload
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            # Never print request headers, response bodies, or virtual keys.
            raise APIError(f"API HTTP {exc.response.status_code}: {url}") from None
        except httpx.RequestError:
            raise APIError(f"API 연결 실패: {url}") from None
        try:
            result = response.json()
        except ValueError:
            raise APIError("API가 JSON이 아닌 응답을 반환했습니다") from None
        if not isinstance(result, dict):
            raise APIError("API 응답은 JSON 객체여야 합니다")
        return result

    def structured(
        self,
        prompt: str,
        data: BaseModel,
        schema: type[T],
        validate: Callable[[T], None] | None = None,
    ) -> T:
        messages = [
            {
                "role": "system",
                "content": prompt
                + "\nJSON 스키마:\n"
                + json.dumps(schema.model_json_schema(), ensure_ascii=False),
            },
            {"role": "user", "content": data.model_dump_json()},
        ]
        for attempt in range(3):
            result = self._post(
                self.settings.chat_url,
                self.settings.copa_api_key,
                {
                    "model": self.settings.chat_model,
                    "messages": messages,
                    "max_tokens": self.settings.chat_max_tokens,
                },
            )
            try:
                if result["choices"][0].get("finish_reason") == "length":
                    raise APIError("응답이 출력 한도에서 잘렸습니다. COPA_MAX_TOKENS를 늘리세요")
                content = result["choices"][0]["message"]["content"]
                if not isinstance(content, str):
                    raise TypeError
            except (KeyError, IndexError, TypeError):
                raise APIError("텍스트 API 응답에 choices[0].message.content가 없습니다") from None
            try:
                parsed = schema.model_validate_json(content)
                if validate:
                    validate(parsed)
                return parsed
            except (ValidationError, ValueError) as exc:
                if attempt == 2:
                    raise APIError("세 번의 시도 후에도 생성 JSON 검증에 실패했습니다") from None
                messages.extend(
                    [
                        {"role": "assistant", "content": content},
                        {
                            "role": "user",
                            "content": f"JSON 오류를 수정해 전체 객체를 반환하세요: {exc}",
                        },
                    ]
                )
        raise AssertionError("unreachable")

    def transcribe(self, path: Path) -> str:
        url = (
            "https://api.cloudflare.com/client/v4/accounts/"
            f"{self.settings.cloudflare_account_id}/ai/run/{self.settings.stt_model}"
        )
        result = self._post(
            url,
            self.settings.cloudflare_api_token,
            {
                "audio": base64.b64encode(path.read_bytes()).decode("ascii"),
                "language": "ko",
                "task": "transcribe",
            },
        )
        if result.get("success") is False:
            raise APIError("Workers AI 음성 인식에 실패했습니다")
        try:
            text = result["result"]["text"]
            if not isinstance(text, str):
                raise TypeError
        except (KeyError, TypeError):
            raise APIError("Workers AI 응답에 result.text가 없습니다") from None
        return text.strip()

    def synthesize(self, text: str, path: Path) -> None:
        result = self._post(
            self.settings.tts_url,
            self.settings.copa_api_key,
            {
                "model": self.settings.tts_model,
                "input": text,
                "voice": self.settings.tts_voice,
                "format": "mp3",
                "response_format": "b64_json",
            },
        )
        try:
            audio = base64.b64decode(result["result"]["b64_json"], validate=True)
            if not audio:
                raise ValueError
        except (KeyError, TypeError, ValueError, binascii.Error):
            raise APIError("TTS 응답에 유효한 result.b64_json 음성이 없습니다") from None
        path.write_bytes(audio)
