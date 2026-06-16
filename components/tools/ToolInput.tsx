import { InputHTMLAttributes, ReactNode, useId } from "react";

type ToolInputSize = "sm" | "md" | "lg";

interface ToolInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Label displayed above the input */
  label?: string;
  /** Helper / hint text below the label */
  hint?: string;
  /** Error message — turns the border red when set */
  error?: string;
  /** Icon to render inside the input, on the left */
  iconLeft?: ReactNode;
  /** Icon to render inside the input, on the right */
  iconRight?: ReactNode;
  /** Size preset */
  inputSize?: ToolInputSize;
}

const sizeClasses: Record<ToolInputSize, string> = {
  sm: "h-9 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-base",
};

export default function ToolInput({
  label,
  hint,
  error,
  iconLeft,
  iconRight,
  inputSize = "md",
  className = "",
  id,
  ...props
}: ToolInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className="flex flex-col gap-2 w-full">
      {(label || hint) && (
        <div className="flex items-center justify-between">
          {label && (
            <label htmlFor={inputId} className="toolsy-label">
              {label}
            </label>
          )}
          {hint && !error && (
            <span className="toolsy-meta">{hint}</span>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs font-semibold text-red-500 dark:text-red-400">{error}</p>
      )}

      <div className="relative">
        {iconLeft && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
            {iconLeft}
          </span>
        )}
        <input
          id={inputId}
          className={`
            toolsy-input ${sizeClasses[inputSize]}
            ${iconLeft ? "pl-10" : ""}
            ${iconRight ? "pr-10" : ""}
            ${
              error
                ? "border-red-500/60 focus:border-red-500 focus:ring-red-500/20"
                : ""
            }
            ${className}
          `}
          {...props}
        />
        {iconRight && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
            {iconRight}
          </span>
        )}
      </div>
    </div>
  );
}