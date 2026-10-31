"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "./api-client";
import type { Interview } from "./types";
import { updateVoiceActivity, type VoiceActivity } from "./vad";

export type InterviewPhase =
  | "ready"
  | "speaking"
  | "listening"
  | "quiet"
  | "processing"
  | "muted"
  | "error"
  | "replay"
  | "generating"
  | "completed"
  | "generated";

export function useInterview() {
  const [interview, setInterview] = useState<Interview | null>(null);
  const [phase, setPhase] = useState<InterviewPhase>("ready");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [maxQuestions, setMaxQuestions] = useState<number | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const context = useRef<AudioContext | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const objectUrl = useRef<string | null>(null);
  const frame = useRef(0);
  const operation = useRef(0);
  const mounted = useRef(true);
  const retry = useRef<() => void>(() => {});

  const stopMedia = useCallback((keepContext = false) => {
    cancelAnimationFrame(frame.current);
    if (recorder.current) {
      recorder.current.onstop = null;
      recorder.current.onerror = null;
      recorder.current.ondataavailable = null;
      if (recorder.current.state !== "inactive") recorder.current.stop();
      recorder.current = null;
    }
    for (const track of stream.current?.getTracks() || []) track.stop();
    stream.current = null;
    if (context.current && !keepContext) {
      void context.current.close().catch(() => {});
      context.current = null;
    }
    if (player.current) {
      player.current.onended = null;
      player.current.onerror = null;
      player.current.pause();
      player.current = null;
    }
    if (objectUrl.current) {
      URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = null;
    }
  }, []);
  const remember = useCallback((value: Interview) => {
    setInterview(value);
    try {
      localStorage.setItem("odyssey.interview", value.id);
    } catch {
      /* The interview itself is persisted on the server. */
    }
  }, []);
  const fail = useCallback(
    (e: unknown, action: () => void) => {
      if (!mounted.current) return;
      operation.current++;
      stopMedia();
      setError(
        e instanceof DOMException &&
          (e.name === "NotAllowedError" || e.name === "PermissionDeniedError")
          ? "마이크 사용이 허용되지 않았어요. 브라우저 설정에서 권한을 허용한 뒤 다시 시도해 주세요."
          : e instanceof Error
            ? e.message
            : "다시 한번 시도해 주세요.",
      );
      retry.current = action;
      setPhase("error");
    },
    [stopMedia],
  );

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    async function restore() {
      try {
        const fresh =
          new URLSearchParams(window.location.search).get("new") === "1";
        let id: string | null = null;
        try {
          if (fresh) localStorage.removeItem("odyssey.interview");
          else id = localStorage.getItem("odyssey.interview");
        } catch {
          /* Storage is optional; interview data is always remote. */
        }
        if (fresh) window.history.replaceState(null, "", "/interview");
        const config = await api.config();
        if (cancelled) return;
        setMaxQuestions(config.maxQuestions);
        if (id) {
          const value = await api.interview(id).catch((e: unknown) => {
            if (!(e instanceof ApiError) || e.status !== 404) throw e;
            try {
              localStorage.removeItem("odyssey.interview");
            } catch {}
            return null;
          });
          if (cancelled) return;
          if (!value) return;
          remember(value);
          setPhase(
            value.status === "generated"
              ? "generated"
              : value.status === "generating"
                ? "generating"
                : value.status === "completed"
                  ? "completed"
                  : "ready",
          );
          if (value.status === "generating") {
            await api.generate(value.id);
            if (!cancelled) setPhase("generated");
          }
        }
      } catch (e) {
        if (cancelled) return;
        setError(
          e instanceof Error
            ? e.message
            : "대화를 불러오지 못했어요. 다시 불러와 주세요.",
        );
        setPhase("error");
        retry.current = () => window.location.reload();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void restore();
    return () => {
      cancelled = true;
      mounted.current = false;
      operation.current++;
      stopMedia();
    };
  }, [remember, stopMedia]);

  async function getMicrophone(token: number) {
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    )
      throw new Error(
        "이 브라우저는 음성 녹음을 지원하지 않아요. 최신 Chrome 또는 Safari에서 열어 주세요.",
      );
    const media = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    if (!mounted.current || token !== operation.current) {
      for (const track of media.getTracks()) track.stop();
      return null;
    }
    stream.current = media;
    return media;
  }

  async function submit(value: Interview, blob: Blob) {
    const token = ++operation.current;
    stopMedia(true);
    setPhase("processing");
    setError("");
    try {
      const next = await api.answer(value.id, value.questionNumber, blob);
      if (!mounted.current || token !== operation.current) return;
      remember(next);
      if (next.status === "completed" || next.status === "generating") {
        stopMedia();
        setPhase("completed");
      } else if (next.status === "generated") {
        stopMedia();
        setPhase("generated");
      } else await speak(next);
    } catch (e) {
      if (token === operation.current)
        fail(e, () => {
          void submit(value, blob);
        });
    }
  }

  async function record(value: Interview) {
    const token = ++operation.current;
    stopMedia(true);
    setPhase("processing");
    try {
      const audioContext = context.current || new AudioContext();
      context.current = audioContext;
      // Resume synchronously from the explicit mic button when autoplay suspended it.
      const resumed = audioContext.resume();
      if (audioContext.state !== "running") setPhase("muted");
      await resumed;
      if (token !== operation.current) return;
      const media = await getMicrophone(token);
      if (!media || token !== operation.current) return;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      audioContext.createMediaStreamSource(media).connect(analyser);
      const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find(
        (type) => MediaRecorder.isTypeSupported(type),
      );
      const recording = new MediaRecorder(
        media,
        mime ? { mimeType: mime } : undefined,
      );
      recorder.current = recording;
      const chunks: Blob[] = [];
      let activity: VoiceActivity = {
        heardSpeech: false,
        lastSpeechAt: 0,
        shouldStop: false,
      };
      recording.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recording.onerror = () => {
        if (token !== operation.current || !mounted.current) return;
        fail(
          new Error("녹음이 중단되었어요. 마이크를 다시 연결해 주세요."),
          () => {
            void record(value);
          },
        );
      };
      recording.onstop = () => {
        if (token !== operation.current || !mounted.current) return;
        const blob = new Blob(chunks, {
          type: recording.mimeType || "audio/webm",
        });
        if (activity.heardSpeech && blob.size) void submit(value, blob);
        else {
          stopMedia();
          setPhase("muted");
        }
      };
      recording.start(250);
      setPhase("listening");
      const samples = new Float32Array(analyser.fftSize);
      const tick = () => {
        if (token !== operation.current || recording.state !== "recording")
          return;
        analyser.getFloatTimeDomainData(samples);
        const rms = Math.sqrt(
          samples.reduce((sum, sample) => sum + sample * sample, 0) /
            samples.length,
        );
        activity = updateVoiceActivity(activity, rms, performance.now());
        if (activity.shouldStop) {
          recording.stop();
          return;
        }
        setPhase(activity.heardSpeech && rms <= 0.025 ? "quiet" : "listening");
        frame.current = requestAnimationFrame(tick);
      };
      frame.current = requestAnimationFrame(tick);
    } catch (e) {
      if (token === operation.current)
        fail(e, () => {
          void record(value);
        });
    }
  }

  async function speak(value: Interview) {
    const token = ++operation.current;
    stopMedia(true);
    setPhase("speaking");
    try {
      const response = await fetch(
        `/api/interviews/${encodeURIComponent(value.id)}/speech`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail || "질문 음성을 불러오지 못했어요.");
      }
      const blob = await response.blob();
      if (!mounted.current || token !== operation.current) return;
      const url = URL.createObjectURL(blob);
      objectUrl.current = url;
      const audio = new Audio(url);
      player.current = audio;
      audio.onended = () => {
        if (mounted.current && token === operation.current) void record(value);
      };
      audio.onerror = () => {
        if (token !== operation.current || !mounted.current) return;
        fail(new Error("질문 음성을 재생하지 못했어요."), () => {
          void speak(value);
        });
      };
      try {
        await audio.play();
      } catch {
        if (token !== operation.current) return;
        setPhase("replay");
        retry.current = () => {
          if (token !== operation.current || !mounted.current) return;
          setPhase("speaking");
          void audio.play().catch((e) => {
            if (token !== operation.current || !mounted.current) return;
            fail(e, () => {
              void speak(value);
            });
          });
        };
      }
    } catch (e) {
      if (token === operation.current)
        fail(e, () => {
          void speak(value);
        });
    }
  }

  async function start() {
    const token = ++operation.current;
    stopMedia();
    setError("");
    setPhase("processing");
    try {
      // Unlock Web Audio in the user's start gesture, before network/TTS awaits.
      const audioContext = new AudioContext();
      context.current = audioContext;
      const [media] = await Promise.all([
        getMicrophone(token),
        audioContext.resume(),
      ]);
      if (!media) return;
      const value = interview || (await api.createInterview());
      if (!mounted.current || token !== operation.current) return;
      remember(value);
      if (!value.question) {
        stopMedia();
        setPhase(value.status === "generated" ? "generated" : "completed");
        return;
      }
      await speak(value);
    } catch (e) {
      if (token === operation.current)
        fail(e, () => {
          void start();
        });
    }
  }

  async function generate() {
    if (!interview) return;
    const token = ++operation.current;
    stopMedia();
    setError("");
    setPhase("generating");
    try {
      await api.generate(interview.id);
      if (mounted.current && token === operation.current) setPhase("generated");
    } catch (e) {
      if (token === operation.current)
        fail(e, () => {
          void generate();
        });
    }
  }
  function mute() {
    operation.current++;
    stopMedia();
    setPhase("muted");
  }
  return {
    interview,
    phase,
    error,
    loading,
    maxQuestions,
    start,
    generate,
    mute,
    resume: () => interview && record(interview),
    replayQuestion: () => interview && void speak(interview),
    retry: () => retry.current(),
  };
}
