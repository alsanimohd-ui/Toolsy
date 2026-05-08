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
    <div className="flex flex-col gap-2 w-full">
      {/* Label row */}
      {(label || showCount) && (
        <div className="flex items-center justify-between">
          {label && (
            <label
              htmlFor={textareaId}
              className="toolsy-label"
            >
              {label}
            </label>
          )}
          {showCount && charCount !== undefined && (
            <span className="toolsy-meta tabular-nums">
              {charCount.toLocaleString()} chars
            </span>
          )}
        </div>
      )}

      {/* Hint */}
      {hint && !error && (
        <p className="text-xs text-muted">{hint}</p>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs font-semibold text-red-500 dark:text-red-400">{error}</p>
      )}

      {/* Textarea */}
      <textarea
        id={textareaId}
        className={`
          toolsy-textarea min-h-[clamp(8rem,22svh,14rem)]
          ${
            error
              ? "border-red-500/60 focus:border-red-500 focus:ring-red-500/20"
              : ""
          }
          ${className}
        `}
        {...props}
      />
    </div>
  );
}
