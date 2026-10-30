import math
import subprocess
import time
import wave
from collections import deque
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import sounddevice as sd

from .config import Settings

SAMPLE_RATE = 16000
BLOCK_SECONDS = 0.1


class TurnDetector:
    """RMS speech detection with onset confirmation and trailing silence."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.started = False
        self.onset_blocks = 0
        self.silent_blocks = 0
        self.total_blocks = 0

    def feed(self, rms: float) -> bool:
        voiced = rms >= self.settings.speech_threshold
        if not self.started:
            self.onset_blocks = self.onset_blocks + 1 if voiced else 0
            if self.onset_blocks >= 2:
                self.started = True
            else:
                return False
        self.total_blocks += 1
        self.silent_blocks = 0 if voiced else self.silent_blocks + 1
        return self.silent_blocks >= math.ceil(
            self.settings.end_silence_seconds / BLOCK_SECONDS
        ) or self.total_blocks >= math.ceil(self.settings.max_turn_seconds / BLOCK_SECONDS)


def record_turn(path: Path, settings: Settings) -> tuple[datetime, datetime]:
    try:
        return _record_turn(path, settings)
    except sd.PortAudioError:
        raise RuntimeError(
            "마이크를 사용할 수 없습니다. 입력 장치와 마이크 접근 권한을 확인하세요"
        ) from None


def _record_turn(path: Path, settings: Settings) -> tuple[datetime, datetime]:
    detector = TurnDetector(settings)
    preroll = deque(maxlen=5)
    started_at = datetime.now(UTC)
    deadline = time.monotonic() + settings.start_timeout_seconds
    # Writing incrementally retains recorded audio even on interruption/device failure.
    with wave.open(str(path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(SAMPLE_RATE)
        with sd.RawInputStream(
            samplerate=SAMPLE_RATE,
            channels=1,
            dtype="int16",
            blocksize=int(SAMPLE_RATE * BLOCK_SECONDS),
        ) as stream:
            while True:
                block, overflow = stream.read(int(SAMPLE_RATE * BLOCK_SECONDS))
                if overflow:
                    raise RuntimeError("마이크 입력이 유실되었습니다. 녹음 장치를 확인하세요")
                audio = bytes(block)
                samples = np.frombuffer(audio, dtype=np.int16).astype(np.float32) / 32768
                rms = float(np.sqrt(np.mean(samples * samples)))
                was_started = detector.started
                done = detector.feed(rms)
                if not was_started:
                    preroll.append(audio)
                    if detector.started:
                        output.writeframes(b"".join(preroll))
                        started_at = datetime.now(UTC)
                else:
                    output.writeframes(audio)
                if done:
                    break
                if not detector.started and time.monotonic() >= deadline:
                    raise TimeoutError("음성 입력 대기 시간이 초과되었습니다")
    return started_at, datetime.now(UTC)


def play(path: Path) -> None:
    # macOS built-in decoder plays MP3 without an additional codec dependency.
    try:
        subprocess.run(["/usr/bin/afplay", str(path)], check=True, capture_output=True)
    except subprocess.CalledProcessError:
        raise RuntimeError(
            "음성 재생에 실패했습니다. 출력 장치와 저장된 MP3를 확인하세요"
        ) from None
