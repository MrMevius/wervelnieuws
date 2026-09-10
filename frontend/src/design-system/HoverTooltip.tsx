import { ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Render outside the trigger so rounded avatars and scrolling containers cannot clip the tooltip. */
export function HoverTooltip({ label, content, children }: { label: string; content: ReactNode; children: ReactNode }) {
  const id = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });

  function cancelClose() {
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
  }

  function show() {
    cancelClose();
    setOpen(true);
  }

  function scheduleClose() {
    cancelClose();
    // Let the pointer cross the gap to read or scroll longer lists.
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  }

  useEffect(() => () => cancelClose(), []);

  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const trigger = triggerRef.current?.getBoundingClientRect();
      const tooltip = tooltipRef.current?.getBoundingClientRect();
      if (!trigger || !tooltip) return;
      const margin = 12;
      const below = trigger.bottom + 8;
      setPosition({
        left: Math.max(margin, Math.min(trigger.left, window.innerWidth - tooltip.width - margin)),
        top: below + tooltip.height <= window.innerHeight - margin
          ? below
          : Math.max(margin, trigger.top - tooltip.height - 8)
      });
    }
    function dismiss(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("keydown", dismiss);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("keydown", dismiss);
    };
  }, [open]);

  return (
    <>
      <span
        ref={triggerRef}
        className="hover-tooltip-trigger"
        tabIndex={0}
        aria-label={label}
        aria-describedby={open ? id : undefined}
        onMouseEnter={show}
        onMouseLeave={scheduleClose}
        onFocus={show}
        onBlur={scheduleClose}
        onClick={show}
      >
        {children}
      </span>
      {open && createPortal(
        <div
          ref={tooltipRef}
          id={id}
          role="tooltip"
          className="hover-tooltip"
          style={position}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          {content}
        </div>,
        document.body
      )}
    </>
  );
}
