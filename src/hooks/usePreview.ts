import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export type PreviewData =
  | {
      kind: "text";
      title: string;
      path: string;
      file_type: string;
      content: string;
      truncated: boolean;
    }
  | {
      kind: "image";
      title: string;
      path: string;
      file_type: string;
      data_url: string;
    }
  | {
      kind: "pdf";
      title: string;
      path: string;
      file_type: string;
      data_url: string;
      text_excerpt?: string | null;
    }
  | {
      kind: "unsupported";
      title: string;
      path: string;
      file_type: string;
      message: string;
      text_excerpt?: string | null;
    }
  | {
      kind: "error";
      title: string;
      path: string;
      file_type: string;
      message: string;
    };

export function usePreview(path: string | null) {
  const cacheRef = useRef(new Map<string, PreviewData>());
  const requestIdRef = useRef(0);
  const [data, setData] = useState<PreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizeError = (err: unknown) =>
    String(err)
      .replace(/^Error invoking remote method '[^']+':\s*/i, "")
      .trim();

  useEffect(() => {
    if (!path) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const cached = cacheRef.current.get(path);
    if (cached) {
      setData(cached);
      setIsLoading(false);
      setError(null);
      return;
    }

    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);

    invoke<PreviewData>("get_preview", { path })
      .then((preview) => {
        if (requestId !== requestIdRef.current) return;
        cacheRef.current.set(path, preview);
        setData(preview);
      })
      .catch((err: unknown) => {
        if (requestId !== requestIdRef.current) return;
        setError(normalizeError(err));
        setData(null);
      })
      .finally(() => {
        if (requestId !== requestIdRef.current) return;
        setIsLoading(false);
      });
  }, [path]);

  return { data, isLoading, error };
}
