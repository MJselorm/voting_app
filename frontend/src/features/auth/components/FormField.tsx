import type { InputHTMLAttributes, ReactNode } from "react";
import { useId } from "react";

import { Input } from "../../../components/ui/input";

export function FormField({
  label,
  error,
  hint,
  inputProps,
}: {
  label: string;
  error?: string;
  hint?: string;
  inputProps: InputHTMLAttributes<HTMLInputElement>;
}) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <label className="text-[13px] font-semibold text-foreground" htmlFor={id}>{label}</label>
      <Input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...inputProps}
      />
      {hint && !error && <span id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</span>}
      {error && <span id={`${id}-error`} className="text-xs font-medium text-red-700">{error}</span>}
    </div>
  );
}

export function FormHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-6">
      <span className="mb-2 block text-[11px] font-extrabold tracking-[.13em] text-muted-foreground">{eyebrow}</span>
      <h1 className="mb-1.5 font-display text-[27px] font-extrabold tracking-tight text-foreground">{title}</h1>
      <p className="m-0 text-sm leading-6 text-muted-foreground">{children}</p>
    </div>
  );
}
