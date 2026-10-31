"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export function useMicrophone() {
  const [status, setStatus] = useState<
    "idle" | "requesting" | "active" | "muted" | "error"
  >("idle");
  const [level, setLevel] = useState(0);
  const [error, setError] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const frameRef = useRef(0);
  const mounted = useRef(true);
  const requesting = useRef(false);
  const stop = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    for (const track of streamRef.current?.getTracks() ?? []) {
      track.onended = null;
      track.stop();
    }
    streamRef.current = null;
    void contextRef.current?.close().catch(() => {});
    contextRef.current = null;
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stop();
    };
  }, [stop]);

  const start = useCallback(async () => {
    if (requesting.current) return false;
    requesting.current = true;
    stop();
    setStatus("requesting");
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "이 브라우저에서는 마이크를 사용할 수 없어요. HTTPS 환경과 최신 브라우저를 확인해 주세요.",
        );
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      if (!mounted.current) {
        for (const track of stream.getTracks()) track.stop();
        return false;
      }
      streamRef.current = stream;
      const context = new AudioContext();
      contextRef.current = context;
      await context.resume();
      if (!mounted.current) {
        stop();
        return false;
      }
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      context.createMediaStreamSource(stream).connect(analyser);
      const values = new Uint8Array(analyser.fftSize);
      let previous = 0;
      const sample = (time: number) => {
        if (time - previous > 80) {
          analyser.getByteTimeDomainData(values);
          const rms = Math.sqrt(
            values.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) /
              values.length,
          );
          setLevel(Math.min(1, rms * 7));
          previous = time;
        }
        frameRef.current = requestAnimationFrame(sample);
      };
      frameRef.current = requestAnimationFrame(sample);
      for (const track of stream.getAudioTracks())
        track.onended = () => {
          stop();
          setLevel(0);
          setStatus("error");
          setError(
            "마이크 연결이 끊어졌어요. 연결을 확인한 뒤 다시 시도해 주세요.",
          );
        };
      setStatus("active");
      return true;
    } catch (cause) {
      stop();
      if (mounted.current) {
        setError(
          cause instanceof DOMException && cause.name === "NotAllowedError"
            ? "브라우저 설정에서 마이크 사용을 허용한 뒤 다시 시도해 주세요."
            : cause instanceof DOMException && cause.name === "NotFoundError"
              ? "연결된 마이크가 없어요. 마이크 연결을 확인한 뒤 다시 시도해 주세요."
              : cause instanceof Error
                ? cause.message
                : "마이크 연결을 확인해 주세요.",
        );
        setStatus("error");
      }
      return false;
    } finally {
      requesting.current = false;
    }
  }, [stop]);

  const toggle = useCallback(() => {
    const tracks = streamRef.current?.getAudioTracks();
    if (!tracks?.length) return;
    const enabled = !tracks[0].enabled;
    for (const track of tracks) track.enabled = enabled;
    setStatus(enabled ? "active" : "muted");
    if (!enabled) setLevel(0);
  }, []);
  return { status, level, error, start, stop, toggle };
}
