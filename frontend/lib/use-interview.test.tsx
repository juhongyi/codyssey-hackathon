import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api } from "./api-client";
import type { Interview } from "./types";
import { useInterview } from "./use-interview";

vi.mock("./api-client", async (original) => ({
  ...(await original<typeof import("./api-client")>()),
  api: {
    config: vi.fn(),
    interview: vi.fn(),
    createInterview: vi.fn(),
    answer: vi.fn(),
    generate: vi.fn(),
  },
}));
let flow: ReturnType<typeof useInterview>;
let root: ReactTestRenderer;
let audio: {
  onended: (() => void) | null;
  onerror: (() => void) | null;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
};
let tracks: { stop: ReturnType<typeof vi.fn> }[];
let contexts: { close: ReturnType<typeof vi.fn> }[];
const value: Interview = {
  id: "session",
  status: "ready",
  question: "무엇을 좋아하나요?",
  questionNumber: 1,
  maxQuestions: 3,
  answeredCount: 0,
};
function Harness() {
  flow = useInterview();
  return null;
}
beforeEach(() => {
  vi.clearAllMocks();
  tracks = [];
  contexts = [];
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("window", {
    location: { search: "", reload: vi.fn() },
    history: { replaceState: vi.fn() },
  });
  vi.stubGlobal("localStorage", {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: vi.fn(async () => {
        const track = { stop: vi.fn() };
        tracks.push(track);
        return { getTracks: () => [track] };
      }),
    },
  });
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 1),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () => new Response(new Blob(["speech"], { type: "audio/mpeg" })),
    ),
  );
  vi.stubGlobal(
    "Audio",
    class {
      onended = null;
      onerror = null;
      play = vi.fn(async () => {});
      pause = vi.fn();
      constructor() {
        audio = this;
      }
    },
  );
  vi.stubGlobal(
    "AudioContext",
    class {
      state = "running";
      resume = vi.fn(async () => {});
      close = vi.fn(async () => {});
      createAnalyser = () => ({
        fftSize: 2048,
        getFloatTimeDomainData: vi.fn(),
      });
      createMediaStreamSource = () => ({ connect: vi.fn() });
      constructor() {
        contexts.push(this);
      }
    },
  );
  vi.stubGlobal(
    "MediaRecorder",
    class {
      static isTypeSupported = () => true;
      state = "inactive";
      onstop = null;
      onerror = null;
      ondataavailable = null;
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
      }
    },
  );
  vi.mocked(api.config).mockResolvedValue({ maxQuestions: 3 });
  vi.mocked(api.createInterview).mockResolvedValue(value);
});
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  vi.unstubAllGlobals();
});
async function mount() {
  await act(async () => {
    root = create(<Harness />);
  });
}

it("honors a completed creation response without requesting question speech", async () => {
  vi.mocked(api.createInterview).mockResolvedValue({
    ...value,
    status: "completed",
    question: null,
    questionNumber: 0,
  });
  await mount();
  await act(async () => flow.start());
  expect(flow.phase).toBe("completed");
  expect(fetch).not.toHaveBeenCalled();
  expect(tracks.every((track) => track.stop.mock.calls.length > 0)).toBe(true);
});

it("ignores a queued playback error after muting and releases every microphone track", async () => {
  await mount();
  await act(async () => flow.start());
  const staleError = audio.onerror;
  await act(async () => flow.mute());
  await act(async () => staleError?.());
  expect(flow.phase).toBe("muted");
  expect(tracks.every((track) => track.stop.mock.calls.length > 0)).toBe(true);
});

it("starts listening once speech ends and ignores stale player callbacks", async () => {
  await mount();
  await act(async () => flow.start());
  const ended = audio.onended;
  const staleError = audio.onerror;
  await act(async () => ended?.());
  expect(flow.phase).toBe("listening");
  await act(async () => {
    ended?.();
    staleError?.();
  });
  expect(flow.phase).toBe("listening");
  await act(async () => flow.mute());
  expect(tracks.every((track) => track.stop.mock.calls.length > 0)).toBe(true);
});

it("unlocks the audio context from the start gesture and retains it until speech ends", async () => {
  await mount();
  await act(async () => flow.start());
  expect(contexts).toHaveLength(1);
  expect(contexts[0].close).not.toHaveBeenCalled();
  await act(async () => audio.onended?.());
  expect(contexts).toHaveLength(1);
  expect(flow.phase).toBe("listening");
  await act(async () => flow.mute());
  expect(contexts[0].close).toHaveBeenCalledOnce();
});
