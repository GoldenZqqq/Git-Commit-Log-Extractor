import { useCallback, useRef, useState } from "react";

export type AppTaskKind = "scan" | "generate" | "polish" | "export" | "interaction";
export type ActiveTaskState = Readonly<Partial<Record<AppTaskKind, string>>>;

const TASK_KINDS: readonly AppTaskKind[] = ["scan", "generate", "polish", "export", "interaction"];
const STATUS_PRIORITY: readonly AppTaskKind[] = ["generate", "scan", "polish", "export", "interaction"];
const TASK_CONFLICTS: Record<AppTaskKind, readonly AppTaskKind[]> = {
  scan: ["scan", "generate"],
  generate: TASK_KINDS,
  polish: ["generate", "polish", "export"],
  export: ["generate", "polish", "export"],
  interaction: ["generate", "interaction"],
};

type StartTaskResult =
  | { started: true }
  | { started: false; conflictLabel: string };

export function taskIsActive(tasks: ActiveTaskState, kind: AppTaskKind) {
  return Boolean(tasks[kind]);
}

export function taskCanStart(tasks: ActiveTaskState, kind: AppTaskKind) {
  return findTaskConflict(tasks, kind) === null;
}

export function activeTaskLabel(tasks: ActiveTaskState) {
  const kind = STATUS_PRIORITY.find((candidate) => taskIsActive(tasks, candidate));
  return kind ? tasks[kind] ?? "" : "";
}

export function hasActiveTasks(tasks: ActiveTaskState) {
  return TASK_KINDS.some((kind) => taskIsActive(tasks, kind));
}

export function useTaskActivity() {
  const tasksRef = useRef<ActiveTaskState>({});
  const [activeTasks, setActiveTasks] = useState<ActiveTaskState>({});

  const tryStartTask = useCallback((kind: AppTaskKind, label: string): StartTaskResult => {
    const conflict = findTaskConflict(tasksRef.current, kind);
    if (conflict) {
      return { started: false, conflictLabel: tasksRef.current[conflict] ?? "当前操作" };
    }
    const next = { ...tasksRef.current, [kind]: label };
    tasksRef.current = next;
    setActiveTasks(next);
    return { started: true };
  }, []);

  const finishTask = useCallback((kind: AppTaskKind) => {
    if (!tasksRef.current[kind]) return;
    const next = { ...tasksRef.current };
    delete next[kind];
    tasksRef.current = next;
    setActiveTasks(next);
  }, []);

  return { activeTasks, tryStartTask, finishTask };
}

function findTaskConflict(tasks: ActiveTaskState, kind: AppTaskKind): AppTaskKind | null {
  return TASK_CONFLICTS[kind].find((candidate) => taskIsActive(tasks, candidate)) ?? null;
}
