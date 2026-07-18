import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "details > summary:first-of-type",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const MODAL_SELECTOR = "[role='dialog'][aria-modal='true'],[role='alertdialog'][aria-modal='true']";
const POPOVER_ATTRIBUTE = "data-dismissible-popover";

type ModalDialogOptions = {
  open: boolean;
  onClose: () => void;
  closeEnabled?: boolean;
};

type PopoverOptions = {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  restoreFocusRef?: RefObject<HTMLElement | null>;
  itemSelector?: string;
  initialFocusSelector?: string;
};

export function useModalDialog({ open, onClose, closeEnabled = true }: ModalDialogOptions) {
  const dialogRef = useRef<HTMLElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const closeEnabledRef = useRef(closeEnabled);
  onCloseRef.current = onClose;
  closeEnabledRef.current = closeEnabled;

  useLayoutEffect(() => {
    if (!open || !dialogRef.current) return;
    const dialog = dialogRef.current;
    const activeElement = document.activeElement;
    restoreFocusRef.current = activeElement instanceof HTMLElement && !dialog.contains(activeElement)
      ? activeElement
      : null;
    focusInitialElement(dialog);

    function handleKeyDown(event: KeyboardEvent) {
      if (!isTopmostModal(dialog)) return;
      if (event.key === "Escape") {
        if (dialog.querySelector(`[${POPOVER_ATTRIBUTE}='true']`)) return;
        if (!closeEnabledRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key === "Tab") trapFocus(event, dialog);
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      restoreConnectedFocus(restoreFocusRef.current);
      restoreFocusRef.current = null;
    };
  }, [open]);

  return dialogRef;
}

export function usePopover({
  open,
  onClose,
  anchorRef,
  restoreFocusRef = anchorRef,
  itemSelector,
  initialFocusSelector,
}: PopoverOptions) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const restoreOnCleanupRef = useRef(true);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open || !popoverRef.current) return;
    return setupPopover({
      popover: popoverRef.current,
      anchorRef,
      restoreFocusRef,
      restoreOnCleanupRef,
      onCloseRef,
      itemSelector,
      initialFocusSelector,
    });
  }, [anchorRef, initialFocusSelector, itemSelector, open, restoreFocusRef]);

  return popoverRef;
}

function setupPopover(options: {
  popover: HTMLElement;
  anchorRef: RefObject<HTMLElement | null>;
  restoreFocusRef: RefObject<HTMLElement | null>;
  restoreOnCleanupRef: RefObject<boolean>;
  onCloseRef: RefObject<() => void>;
  itemSelector?: string;
  initialFocusSelector?: string;
}) {
  const { popover, anchorRef, restoreFocusRef, restoreOnCleanupRef, onCloseRef } = options;
  const close = (restore: boolean) => {
    restoreOnCleanupRef.current = restore;
    onCloseRef.current();
  };
  restoreOnCleanupRef.current = true;
  popover.setAttribute(POPOVER_ATTRIBUTE, "true");
  const focusFrame = options.initialFocusSelector
    ? window.requestAnimationFrame(() => focusMatchingElement(popover, options.initialFocusSelector ?? ""))
    : null;
  const onPointerDown = (event: PointerEvent) => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (!popover.contains(target) && !anchorRef.current?.contains(target)) close(false);
  };
  const onKeyDown = (event: KeyboardEvent) => handlePopoverKeyDown({ event, popover, options, close });
  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("keydown", onKeyDown, true);
  return () => {
    if (focusFrame !== null) window.cancelAnimationFrame(focusFrame);
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("keydown", onKeyDown, true);
    popover.removeAttribute(POPOVER_ATTRIBUTE);
    if (restoreOnCleanupRef.current) restoreConnectedFocus(restoreFocusRef.current);
  };
}

function handlePopoverKeyDown({ event, popover, options, close }: {
  event: KeyboardEvent;
  popover: HTMLElement;
  options: Pick<PopoverOptions, "anchorRef" | "itemSelector">;
  close: (restore: boolean) => void;
}) {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    close(true);
    return;
  }
  if (options.itemSelector && navigatePopoverItems(event, popover, options.itemSelector)) return;
  if (event.key !== "Tab") return;
  window.setTimeout(() => {
    const active = document.activeElement;
    if (active instanceof Node && (popover.contains(active) || options.anchorRef.current?.contains(active))) return;
    close(false);
  }, 0);
}

function focusInitialElement(dialog: HTMLElement) {
  const preferred = dialog.querySelector<HTMLElement>("[data-dialog-initial-focus], [autofocus]");
  const target = preferred && isFocusable(preferred) ? preferred : getFocusableElements(dialog)[0];
  (target ?? dialog).focus();
}

function focusMatchingElement(container: HTMLElement, selector: string) {
  const target = container.querySelector<HTMLElement>(selector);
  if (target && isFocusable(target)) target.focus();
}

function trapFocus(event: KeyboardEvent, dialog: HTMLElement) {
  const focusable = getFocusableElements(dialog);
  if (focusable.length === 0) {
    event.preventDefault();
    dialog.focus();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  if (event.shiftKey && (active === first || !dialog.contains(active))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
    event.preventDefault();
    first.focus();
  }
}

function navigatePopoverItems(event: KeyboardEvent, popover: HTMLElement, selector: string) {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return false;
  const items = Array.from(popover.querySelectorAll<HTMLElement>(selector)).filter(isFocusable);
  if (items.length === 0) return false;
  const currentIndex = items.indexOf(document.activeElement as HTMLElement);
  let nextIndex = currentIndex;
  if (event.key === "Home") nextIndex = 0;
  else if (event.key === "End") nextIndex = items.length - 1;
  else if (event.key === "ArrowDown") nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
  else nextIndex = currentIndex < 0 ? items.length - 1 : (currentIndex - 1 + items.length) % items.length;
  event.preventDefault();
  event.stopPropagation();
  items[nextIndex].focus();
  return true;
}

function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(isFocusable);
}

function isFocusable(element: HTMLElement) {
  return !element.hasAttribute("disabled")
    && element.getAttribute("aria-hidden") !== "true"
    && element.getClientRects().length > 0;
}

function isTopmostModal(dialog: HTMLElement) {
  const dialogs = Array.from(document.querySelectorAll<HTMLElement>(MODAL_SELECTOR)).filter(
    (candidate) => candidate.isConnected && candidate.getClientRects().length > 0,
  );
  return dialogs[dialogs.length - 1] === dialog;
}

function restoreConnectedFocus(element: HTMLElement | null) {
  if (element?.isConnected) element.focus();
}
