import { ReactNode, useEffect, useId, useMemo, useRef } from "react";
import { createPortal } from "react-dom";

const openHoursModals: string[] = [];

/** Shared modal primitive for work-hours flows; preserves the established dialog contract. */
export function AccessibleModal({ title, onClose, children, committing = false }: { title: string; onClose: () => void; children: ReactNode; committing?: boolean }) {
  const modalId = useId();
  const headingId = `${modalId}-heading`;
  const dialogRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(document.activeElement as HTMLElement | null);
  const portalHost = useMemo(() => {
    const host = document.createElement("div");
    host.dataset.hoursModalHost = modalId;
    return host;
  }, [modalId]);
  const onCloseRef = useRef(onClose);
  const committingRef = useRef(committing);
  onCloseRef.current = onClose;
  committingRef.current = committing;

  useEffect(() => {
    document.body.appendChild(portalHost);
    openHoursModals.push(modalId);
    const dialog = dialogRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])') ?? []);
    const background = Array.from(document.body.children).filter((element) => element !== portalHost) as HTMLElement[];
    const previous = background.map((element) => ({ element, inert: element.inert, ariaHidden: element.getAttribute("aria-hidden") }));
    background.forEach((element) => { element.inert = true; element.setAttribute("aria-hidden", "true"); });
    (dialog?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? dialog?.querySelector<HTMLElement>("h2") ?? focusable()[0])?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (openHoursModals.at(-1) !== modalId) return;
      if (event.key === "Escape") { event.preventDefault(); if (!committingRef.current) onCloseRef.current(); return; }
      if (event.key !== "Tab") return;
      const controls = focusable();
      if (!controls.length) { event.preventDefault(); dialog?.focus(); return; }
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const stackIndex = openHoursModals.lastIndexOf(modalId);
      if (stackIndex >= 0) openHoursModals.splice(stackIndex, 1);
      previous.forEach(({ element, inert, ariaHidden }) => {
        element.inert = inert;
        if (ariaHidden === null) element.removeAttribute("aria-hidden"); else element.setAttribute("aria-hidden", ariaHidden);
      });
      portalHost.remove();
      const trigger = returnFocusRef.current;
      if (trigger?.isConnected && !trigger.hasAttribute("disabled")) trigger.focus();
      else document.querySelector<HTMLElement>("[data-hours-focus-fallback]:not([disabled])")?.focus();
    };
  }, [modalId, portalHost]);

  return createPortal(<div className="work-hours-modal-backdrop"><section ref={dialogRef} className="panel work-hours-modal" role="dialog" aria-modal="true" aria-labelledby={headingId} tabIndex={-1}><h2 id={headingId} tabIndex={-1}>{title}</h2>{children}</section></div>, portalHost);
}
