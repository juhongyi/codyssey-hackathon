import pytest
from dotenv import load_dotenv
from pydantic import ValidationError

from odyssey_planner.config import Settings


def test_question_limit_default(monkeypatch):
    monkeypatch.setattr("odyssey_planner.config.load_dotenv", lambda: None)
    monkeypatch.delenv("ODYSSEY_MAX_QUESTIONS", raising=False)
    assert Settings.from_env().max_questions == 10


def test_question_limit_dotenv_and_environment_precedence(tmp_path, monkeypatch):
    dotenv = tmp_path / ".env"
    dotenv.write_text("ODYSSEY_MAX_QUESTIONS=3\n")
    monkeypatch.setattr("odyssey_planner.config.load_dotenv", lambda: load_dotenv(dotenv))
    monkeypatch.delenv("ODYSSEY_MAX_QUESTIONS", raising=False)
    assert Settings.from_env().max_questions == 3
    monkeypatch.setenv("ODYSSEY_MAX_QUESTIONS", "7")
    assert Settings.from_env().max_questions == 7


@pytest.mark.parametrize("value", ["0", "-1", "1.5", "abc", ""])
def test_invalid_question_limit(value, monkeypatch):
    monkeypatch.setattr("odyssey_planner.config.load_dotenv", lambda: None)
    monkeypatch.setenv("ODYSSEY_MAX_QUESTIONS", value)
    with pytest.raises(ValidationError, match="max_questions"):
        Settings.from_env()
