import { useCallback, useState } from "react";
import type { SupportBundleEventInput, SupportBundleEventLevel } from "../model";

const EVENT_LIMIT = 50;
const MESSAGE_LIMIT = 500;

type RecordLevel = SupportBundleEventLevel | "loading";

export function useSupportEvents() {
  const [events, setEvents] = useState<SupportBundleEventInput[]>([]);

  const record = useCallback((message: string, level: RecordLevel) => {
    if (level === "loading") return;
    const normalized = truncateMessage(message.trim());
    if (!normalized) return;
    const nextEvent: SupportBundleEventInput = {
      occurredAt: new Date().toISOString(),
      level,
      message: normalized,
    };
    setEvents((current) => appendEvent(current, nextEvent));
  }, []);

  return { events, record };
}

function appendEvent(
  current: SupportBundleEventInput[],
  nextEvent: SupportBundleEventInput,
) {
  const previous = current[current.length - 1];
  const withoutDuplicate = previous?.level === nextEvent.level && previous.message === nextEvent.message
    ? current.slice(0, -1)
    : current;
  return [...withoutDuplicate, nextEvent].slice(-EVENT_LIMIT);
}

function truncateMessage(message: string) {
  const characters = Array.from(message);
  if (characters.length <= MESSAGE_LIMIT) return message;
  return `${characters.slice(0, MESSAGE_LIMIT - 3).join("")}...`;
}
