"use client";
import { useEffect, useState } from "react";

export function useResource<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt explicitly triggers a retry of the same loader.
  useEffect(() => {
    let active = true;
    setData(undefined);
    setError(false);
    load()
      .then((result) => {
        if (active) setData(result);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [load, attempt]);
  return { data, error, retry: () => setAttempt((value) => value + 1) };
}
