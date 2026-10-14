"use client";
import { createContext, useCallback, useContext, useRef, useState } from "react";

type Task = { id: number; label: string };
type ActivityContextValue = {
  tasks: Task[];
  begin: (label: string) => number;
  end: (id: number) => void;
};

const ActivityContext = createContext<ActivityContextValue | null>(null);

/**
 * App-wide "something is happening in the background" tracker — OCR reads
 * and photo uploads run silently otherwise, and a driver watching the
 * screen has no way to tell a scan is in progress vs. just slow/stuck.
 * Any component can register a task; <ActivityBadge/> renders them as a
 * single floating indicator regardless of which page is active.
 */
export function ActivityProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const nextId = useRef(1);

  const begin = useCallback((label: string) => {
    const id = nextId.current++;
    setTasks((t) => [...t, { id, label }]);
    return id;
  }, []);

  const end = useCallback((id: number) => {
    setTasks((t) => t.filter((x) => x.id !== id));
  }, []);

  return <ActivityContext.Provider value={{ tasks, begin, end }}>{children}</ActivityContext.Provider>;
}

export function useActivity(): ActivityContextValue {
  const ctx = useContext(ActivityContext);
  if (!ctx) throw new Error("useActivity() must be used within <ActivityProvider>");
  return ctx;
}

/** Wrap an async op so it's tracked on the global indicator for its duration. */
export function useTrackedTask() {
  const { begin, end } = useActivity();
  return useCallback(
    async <T,>(label: string, fn: () => Promise<T>): Promise<T> => {
      const id = begin(label);
      try {
        return await fn();
      } finally {
        end(id);
      }
    },
    [begin, end]
  );
}

export function ActivityBadge() {
  const { tasks } = useActivity();
  if (tasks.length === 0) return null;
  return (
    <div className="fixed bottom-[calc(var(--nav-h)+12px)] md:bottom-4 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
      <div className="bg-action text-action-fg text-xs font-semibold rounded-full px-4 py-2 shadow-lg flex items-center gap-2 max-w-full">
        <span className="inline-block w-3 h-3 rounded-full border-2 border-hero-fg/40 border-t-white animate-spin shrink-0" />
        <span className="truncate">{tasks[tasks.length - 1].label}</span>
        {tasks.length > 1 && <span className="opacity-70">+{tasks.length - 1}</span>}
      </div>
    </div>
  );
}
