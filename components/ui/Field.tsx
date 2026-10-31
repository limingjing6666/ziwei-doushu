import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import { cn } from "@/lib/ui/cn";
import { IconChevronDown } from "@/components/icons";

export function Field({
  id,
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={id}
        className="flex items-baseline justify-between gap-3 text-[13px] font-medium text-ink-2"
      >
        <span>
          {label}
          {required ? (
            <span aria-hidden="true" className="ml-1 text-cinnabar">
              *
            </span>
          ) : null}
        </span>
        {hint ? (
          <span className="text-[12px] font-normal text-ink-3">{hint}</span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[12px] text-cinnabar">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const inputBase =
  "h-10 w-full rounded-sm border bg-surface px-3 text-sm text-ink transition-colors placeholder:text-ink-3 focus:outline-none focus-visible:outline-none";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function Input({ invalid, className, ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        inputBase,
        invalid
          ? "border-cinnabar focus:border-cinnabar"
          : "border-line/25 hover:border-line/40 focus:border-cinnabar",
        className,
      )}
      {...props}
    />
  );
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
  /** 包裹层额外 class（宽度等） */
  wrapperClassName?: string;
}

export function Select({
  invalid,
  className,
  wrapperClassName,
  children,
  ...props
}: SelectProps) {
  return (
    <span className={cn("relative block", wrapperClassName)}>
      <select
        aria-invalid={invalid || undefined}
        className={cn(
          inputBase,
          "appearance-none pr-9",
          invalid
            ? "border-cinnabar focus:border-cinnabar"
            : "border-line/25 hover:border-line/40 focus:border-cinnabar",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <IconChevronDown
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-3"
      />
    </span>
  );
}
