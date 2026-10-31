"use client";

import { useEffect, useRef, useState } from "react";

type Status = "idle" | "recording" | "waiting" | "playing" | "error";
type Capture = {
  stream: MediaStream;
  source: MediaStreamAudioSourceNode;
  node: AudioWorkletNode;
  chunks: Float32Array[];
};

function wav(samples: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, buffer.byteLength - 8, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true);
  view.setUint32(28, 32000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, i) => {
    const clipped = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + i * 2, clipped * (clipped < 0 ? 32768 : 32767), true);
  });
  return buffer;
}

export default function Home() {
  const [status, setStatus] = useState<Status>("idle");
  const context = useRef<AudioContext | null>(null);
  const capture = useRef<Capture | null>(null);
  const starting = useRef<Promise<void> | null>(null);
  const busy = useRef(false);
  const held = useRef(false);
  const mounted = useRef(true);
  const session = useRef<string | null>(null);
  const request = useRef<AbortController | null>(null);

  function disposeCapture() {
    const current = capture.current;
    if (!current) return;
    current.stream.getTracks().forEach((track) => track.stop());
    current.source.disconnect();
    current.node.disconnect();
    current.node.port.close();
    capture.current = null;
  }

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current?.abort();
      disposeCapture();
      void context.current?.close();
    };
  }, []);

  function fail(error: unknown) {
    console.error("Voice turn failed", error);
    disposeCapture();
    if (mounted.current) setStatus("error");
  }

  function begin() {
    if (busy.current || held.current) return;
    held.current = true;
    starting.current = (async () => {
      try {
        const ctx = context.current ?? new AudioContext();
        context.current = ctx;
        // Unlock audio during the user gesture, before awaiting microphone permission.
        await ctx.resume();
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
        });
        if (!mounted.current || !held.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        try {
          await ctx.audioWorklet.addModule("/recorder.js");
          if (!mounted.current) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }
          const node = new AudioWorkletNode(ctx, "recorder", {
            channelCount: 1, channelCountMode: "explicit",
          });
          const source = ctx.createMediaStreamSource(stream);
          const chunks: Float32Array[] = [];
          node.port.onmessage = ({ data }) => {
            if (data instanceof Float32Array) chunks.push(data);
          };
          capture.current = { stream, source, node, chunks };
          source.connect(node);
          // The worklet outputs silence, keeping it active without microphone feedback.
          node.connect(ctx.destination);
          if (mounted.current) setStatus("recording");
        } catch (error) {
          stream.getTracks().forEach((track) => track.stop());
          throw error;
        }
      } catch (error) {
        fail(error);
      }
    })();
  }

  async function end(cancel = false) {
    if (!held.current) return;
    held.current = false;
    busy.current = true;
    try {
      await starting.current;
      const current = capture.current;
      const ctx = context.current;
      if (!current || !ctx) return;
      if (cancel) {
        disposeCapture();
        setStatus("idle");
        return;
      }
      setStatus("waiting");
      await new Promise<void>((resolve) => {
        current.node.port.onmessage = ({ data }) => {
          if (data === "stopped") resolve();
          else if (data instanceof Float32Array) current.chunks.push(data);
        };
        current.node.port.postMessage("stop");
      });
      disposeCapture();
      const length = current.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      if (!length) throw new Error("No microphone samples captured");
      const input = new Float32Array(length);
      let offset = 0;
      current.chunks.forEach((chunk) => { input.set(chunk, offset); offset += chunk.length; });
      // Resample the device's actual sample rate to the backend's WAV contract.
      const offline = new OfflineAudioContext(1, Math.ceil(length * 16000 / ctx.sampleRate), 16000);
      const source = offline.createBufferSource();
      source.buffer = offline.createBuffer(1, length, ctx.sampleRate);
      source.buffer.copyToChannel(input, 0);
      source.connect(offline.destination);
      source.start();
      const rendered = await offline.startRendering();
      request.current = new AbortController();
      const query = session.current ? `?session_id=${encodeURIComponent(session.current)}` : "";
      const response = await fetch(`/api/turns${query}`, {
        method: "POST",
        headers: { "Content-Type": "audio/wav" },
        body: wav(rendered.getChannelData(0)),
        signal: request.current.signal,
      });
      const result = await response.json();
      if (result.session_id) session.current = result.session_id;
      if (result.status === "completed") session.current = null;
      if (!response.ok) {
        if (response.status === 404 || response.status === 409) session.current = null;
        throw new Error(result.detail ?? `HTTP ${response.status}`);
      }
      if (!mounted.current) return;
      setStatus("playing");
      const bytes = Uint8Array.from(atob(result.audio), (char) => char.charCodeAt(0));
      const speech = ctx.createBufferSource();
      speech.buffer = await ctx.decodeAudioData(bytes.buffer);
      speech.connect(ctx.destination);
      await ctx.resume();
      await new Promise<void>((resolve) => { speech.onended = () => resolve(); speech.start(); });
      if (mounted.current) setStatus("idle");
    } catch (error) {
      fail(error);
    } finally {
      busy.current = false;
    }
  }

  const labels: Record<Status, string> = {
    idle: "누르고 말하기", recording: "놓으면 전송", waiting: "응답 대기 중",
    playing: "응답 재생 중", error: "오류 발생, 누르고 다시 말하기",
  };

  return (
    <main>
      <button
        className={`voice-button ${status}`}
        aria-label={labels[status]}
        aria-busy={status === "waiting"}
        disabled={status === "waiting" || status === "playing"}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          begin();
        }}
        onPointerUp={() => void end()}
        onPointerCancel={() => void end(true)}
        onLostPointerCapture={() => void end(true)}
        onKeyDown={(event) => {
          if ((event.key === " " || event.key === "Enter") && !event.repeat) {
            event.preventDefault(); begin();
          }
        }}
        onKeyUp={(event) => {
          if (event.key === " " || event.key === "Enter") { event.preventDefault(); void end(); }
        }}
        onBlur={() => void end(true)}
        onContextMenu={(event) => event.preventDefault()}
      >
        <span className="wave" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => <i key={i} style={{ animationDelay: `${i * 100}ms` }} />)}
        </span>
      </button>
      <span className="sr-only" role="status">{labels[status]}</span>
    </main>
  );
}
