import { createElement, useCallback, useEffect, useRef, type ReactNode, type MouseEvent, type Ref } from "react";

export type MaterialButtonVariant = "filled" | "tonal" | "outlined" | "text" | "danger" | "icon";
export type MaterialButtonSize = "default" | "compact";

type MaterialButtonProps = {
  children: ReactNode;
  variant?: MaterialButtonVariant;
  size?: MaterialButtonSize;
  className?: string;
  buttonRef?: Ref<HTMLElement>;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  title?: string;
  "aria-label"?: string;
  "aria-pressed"?: boolean;
  "aria-expanded"?: boolean;
  "aria-controls"?: string;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  onMouseDown?: (event: MouseEvent<HTMLButtonElement>) => void;
};

const tagForVariant: Record<MaterialButtonVariant, string> = {
  filled: "md-filled-button",
  tonal: "md-filled-tonal-button",
  outlined: "md-outlined-button",
  text: "md-text-button",
  danger: "md-filled-button",
  icon: "md-icon-button"
};

/**
 * The application's small React boundary around Material Web buttons.
 * It gives product code a stable API while Material Web supplies the actual
 * accessible web component and interaction states.
 */
export function MaterialButton({
  children,
  variant = "filled",
  size = "default",
  className,
  buttonRef,
  disabled,
  type = "button",
  title,
  "aria-label": ariaLabel,
  "aria-pressed": ariaPressed,
  "aria-expanded": ariaExpanded,
  "aria-controls": ariaControls,
  onClick,
  onMouseDown
}: MaterialButtonProps) {
  const elementRef = useRef<HTMLElement | null>(null);
  const setElementRef = useCallback((element: HTMLElement | null) => {
    elementRef.current = element;
    if (typeof buttonRef === "function") buttonRef(element);
    else if (buttonRef) buttonRef.current = element;
  }, [buttonRef]);

  useEffect(() => {
    const reflectAriaState = () => {
      const element = elementRef.current;
      if (!element) return;

      // Material Web renders the native control inside its shadow DOM. Reflect
      // button semantics on the host as well, so ARIA state remains observable
      // to assistive technology and React test environments.
      element.setAttribute("role", "button");
      if (ariaPressed === undefined) {
        element.removeAttribute("aria-pressed");
      } else {
        element.setAttribute("aria-pressed", String(ariaPressed));
      }
    };

    reflectAriaState();
    // Lit upgrades its custom element asynchronously. Re-apply the host
    // attributes after that first update, which otherwise clears unknown host
    // properties supplied by React.
    const timeoutId = window.setTimeout(reflectAriaState, 0);
    return () => window.clearTimeout(timeoutId);
  }, [ariaPressed]);

  return createElement(
    tagForVariant[variant],
    {
      ref: setElementRef,
      className: ["material-button", `material-button--${variant}`, `material-button--${size}`, className].filter(Boolean).join(" "),
      type,
      title,
      disabled,
      tabIndex: disabled ? -1 : 0,
      "aria-label": ariaLabel,
      "aria-expanded": ariaExpanded,
      "aria-controls": ariaControls,
      onClick: (event: MouseEvent<HTMLButtonElement>) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
        if (type === "submit" && !event.defaultPrevented) {
          event.preventDefault();
          elementRef.current?.closest("form")?.requestSubmit();
        }
      },
      onMouseDown
    },
    <span className="material-button-content">{children}</span>
  );
}
