import { ButtonHTMLAttributes, ReactNode } from "react";

type ToolButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ToolButtonSize = "sm" | "md" | "lg";

interface ToolButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  /** Visual style */
  variant?: ToolButtonVariant;
  /** Size preset */
  size?: ToolButtonSize;
  /** Show loading spinner and disable interaction */
  loading?: boolean;
  /** Icon to render before the label */
  iconLeft?: ReactNode;
  /** Icon to render after the label */
  iconRight?: ReactNode;
}

const variantClasses: Record<ToolButtonVariant, string> = {
  primary: `
    bg-[var(--accent)] text-white
    hover:bg-[var(--accent-hover)]
    shadow-lg shadow-[var(--accent-glow)]
    disabled:bg-[var(--border-subtle)] disabled:shadow-none disabled:text-[var(--muted)]
  `,
  secondary: `
    border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--foreground)]
    hover:border-[var(--accent)] hover:text-[var(--accent-hover)]
    disabled:opacity-40
  `,
  ghost: `
    text-[var(--muted)]
    hover:text-[var(--foreground)] hover:bg-[var(--surface-raised)]
    disabled:opacity-40
  `,
  danger: `
    border border-red-900/50 bg-red-950/30 text-red-400
    hover:bg-red-900/40 hover:text-red-300
    disabled:opacity-40
  `,
};

const sizeClasses: Record<ToolButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs rounded-lg gap-1.5",
  md: "px-5 py-2.5 text-sm rounded-xl gap-2",
  lg: "px-7 py-3.5 text-base rounded-xl gap-2.5",
};

/**
 * ToolButton
 * Consistent button component for all tool actions.
 * Supports primary, secondary, ghost, and danger variants with
 * optional loading state and left/right icons.
 */
export default function ToolButton({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  iconLeft,
  iconRight,
  className = "",
  disabled,
  ...props
}: ToolButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      disabled={isDisabled}
      className={`
        inline-flex items-center justify-center font-medium
        transition-all duration-200 cursor-pointer
        disabled:cursor-not-allowed
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <svg
          className="w-4 h-4 animate-spin shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8H4z"
          />
        </svg>
      ) : (
        iconLeft && <span className="shrink-0">{iconLeft}</span>
      )}
      <span>{children}</span>
      {!loading && iconRight && (
        <span className="shrink-0">{iconRight}</span>
      )}
    </button>
  );
}
