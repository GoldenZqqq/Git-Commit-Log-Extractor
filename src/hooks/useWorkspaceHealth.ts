import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RepoInfo, WorkspaceHealthResult } from "../model";

type Params = {
  rootDirs: string[];
  indexedRepos: RepoInfo[];
  disabledRepos: string[];
};

function useWorkspaceHealthRequest(params: Params) {
  const [result, setResult] = useState<WorkspaceHealthResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const activeRequestRef = useRef<number | null>(null);
  const requestVersionRef = useRef(0);
  const resultRef = useRef<WorkspaceHealthResult | null>(null);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const rootKey = JSON.stringify(params.rootDirs);

  useEffect(() => {
    requestVersionRef.current += 1;
    activeRequestRef.current = null;
    resultRef.current = null;
    setResult(null);
    setError("");
    setLoading(false);
  }, [rootKey]);
  const refresh = useCallback(async (reposOverride?: RepoInfo[], supersede = false) => {
    if (activeRequestRef.current !== null && !supersede) return;
    const requestVersion = ++requestVersionRef.current;
    activeRequestRef.current = requestVersion;
    setLoading(true);
    setError("");
    try {
      const params = paramsRef.current;
      const nextResult = await invoke<WorkspaceHealthResult>("inspect_workspace_health", {
        options: {
          rootDirs: params.rootDirs,
          indexedRepos: reposOverride ?? params.indexedRepos,
          disabledRepos: params.disabledRepos,
        },
      });
      if (requestVersion === requestVersionRef.current) {
        resultRef.current = nextResult;
        setResult(nextResult);
      }
    } catch (requestError) {
      if (requestVersion === requestVersionRef.current) {
        setError(requestError instanceof Error ? requestError.message : String(requestError));
      }
    } finally {
      if (activeRequestRef.current === requestVersion) activeRequestRef.current = null;
      if (requestVersion === requestVersionRef.current) setLoading(false);
    }
  }, []);

  return { result, setResult, resultRef, activeRequestRef, loading, error, refresh };
}

export function useWorkspaceHealth(params: Params) {
  const request = useWorkspaceHealthRequest(params);

  const setRepoDisabled = useCallback((path: string, disabled: boolean) => {
    request.setResult((current) => {
      const next = current ? {
        ...current,
        repos: current.repos.map((repo) => repo.path === path ? { ...repo, disabled } : repo),
      } : current;
      request.resultRef.current = next;
      return next;
    });
  }, [request.resultRef, request.setResult]);

  const removeRepo = useCallback((path: string) => {
    request.setResult((current) => {
      const next = current ? {
        ...current,
        repos: current.repos.filter((repo) => repo.path !== path),
      } : current;
      request.resultRef.current = next;
      return next;
    });
  }, [request.resultRef, request.setResult]);

  const refresh = useCallback((reposOverride?: RepoInfo[]) => request.refresh(reposOverride), [request.refresh]);
  const refreshIfLoaded = useCallback((reposOverride: RepoInfo[]) => {
    if (request.resultRef.current || request.activeRequestRef.current !== null) {
      void request.refresh(reposOverride, true);
    }
  }, [request.activeRequestRef, request.refresh, request.resultRef]);

  return {
    result: request.result,
    loading: request.loading,
    error: request.error,
    refresh,
    refreshIfLoaded,
    setRepoDisabled,
    removeRepo,
  };
}
