"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api-client";
import { SaveQueue } from "./save-queue";
import type { Plan } from "./types";

export function usePlanSave(boardId: string, plan: Plan) {
  const [status, setStatus] = useState<
    "saved" | "pending" | "saving" | "error"
  >("saved");
  const [error, setError] = useState("");
  const active = useRef(true);
  const revision = useRef(0);
  const last = useRef(plan);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [queue] = useState(
    () => new SaveQueue<Plan>((value) => api.savePlan(boardId, value)),
  );
  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    const version = revision.current;
    if (active.current) {
      setStatus("saving");
      setError("");
    }
    try {
      await queue.flush();
      if (active.current && version === revision.current) setStatus("saved");
      return version === revision.current;
    } catch (e) {
      if (active.current) {
        setStatus("error");
        setError(e instanceof Error ? e.message : "저장하지 못했어요.");
      }
      return false;
    }
  }, [queue]);
  useEffect(() => {
    if (last.current === plan) return;
    last.current = plan;
    revision.current++;
    queue.set(plan);
    setStatus("pending");
    timer.current = setTimeout(() => {
      void flush();
    }, 650);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [plan, queue, flush]);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      if (timer.current) clearTimeout(timer.current);
      void queue.flush().catch(() => {});
    };
  }, [queue]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (status !== "saved") event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);
  return { status, error, retry: flush };
}
