import type { RefObject } from "react";
import type { SupportBundleEntryPreview, SupportBundlePreview } from "../model";

export type SupportBundleSectionProps = {
  dialogRef: RefObject<HTMLElement | null>;
  preview: SupportBundlePreview;
  activeEntry: SupportBundleEntryPreview;
  selectedEntry: string;
  confirmed: boolean;
  busy: "preview" | "export" | null;
  feedback: { tone: "success" | "error"; message: string } | null;
  onClose: () => void;
  onSelectEntry: (name: string) => void;
  onConfirm: (value: boolean) => void;
  onCopy: () => void;
  onOpenIssue: () => void;
  onExport: () => void;
};
