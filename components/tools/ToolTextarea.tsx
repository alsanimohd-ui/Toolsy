import { TextareaHTMLAttributes, useId } from "react";

interface ToolTextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Label displayed above the textarea */
  label?: string;
  /** Helper / hint text below the label */
  hint?: string;
  /** Error message — turns the border red when set */
  error?: string;
  /** Show a character count badge (requires value prop) */
  showCount?: boolean;
}

/**
 * ToolTextarea
 * Styled textarea for tool inputs and outputs.
 * Supports labels, hints, error states, and optional character count.
 */
export default function ToolTextarea({
  label,
  hint,
  error,
  showCount = false,
  className = "",
  id,
  ...props
}: ToolTextareaProps) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const charCount =
    typeof props.value === "string" ? props.value.length : undefined;

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {/* Label row */}
      {(label || showCount) && (
        <div className="flex items-center justify-between">
          {label && (
            <label
              htmlFor={textareaId}
              className="text-xs font-medium text-[var(--muted)] tracking-wide uppercase"
            >
              {label}
            </label>
          )}
          {showCount && charCount !== undefined && (
            <span className="text-xs tabular-nums text-[var(--muted)]">
              {charCount.toLocaleString()} chars
            </span>
          )}
        </div>
      )}

      {/* Hint */}
      {hint && !error && (
        <p className="text-xs text-[var(--muted)]">{hint}</p>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      {/* Textarea */}
      <textarea
        id={textareaId}
        className={`
          w-full min-h-[140px] px-4 py-3
          rounded-xl border
          bg-[var(--surface-raised)] text-[var(--foreground)]
          text-sm font-mono leading-relaxed
          placeholder:text-[var(--muted)]
          resize-y
          transition-colors duration-150
          outline-none
          focus:ring-1
          ${
            error
              ? "border-red-700/60 focus:border-red-500 focus:ring-red-500/20"
              : "border-[var(--border-subtle)] focus:border-[var(--accent)] focus:ring-[var(--accent-glow)]"
          }
          disabled:opacity-50 disabled:cursor-not-allowed
          ${className}
        `}
        {...props}
      />
    </div>
  );
}
