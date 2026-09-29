import * as React from 'react';
import { cn } from '@/lib/cn';

export const inputClass =
  'flex h-9 w-full rounded-md border border-border bg-surface px-3 py-1 text-sm text-fg shadow-xs transition-colors placeholder:text-fg-faint focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-[color:var(--tone-red-fg)]';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(inputClass, className)} {...props} />;
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref,
) {
  return <textarea ref={ref} className={cn(inputClass, 'min-h-[80px] py-2 leading-relaxed', className)} {...props} />;
});

export const NativeSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function NativeSelect(
  { className, children, ...props },
  ref,
) {
  return (
    <select ref={ref} className={cn(inputClass, 'appearance-none bg-[length:16px] pr-8', className)} {...props}>
      {children}
    </select>
  );
});

export function Label({ className, required, ...props }: React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label className={cn('text-sm font-medium text-fg', className)} {...props}>
      {props.children}
      {required && <span className="ml-0.5 text-[color:var(--tone-red-fg)]">*</span>}
    </label>
  );
}

export function Field({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
  className,
}: {
  label?: string;
  htmlFor?: string;
  required?: boolean;
  error?: string | null;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <Label htmlFor={htmlFor} required={required}>
          {label}
        </Label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-[color:var(--tone-red-fg)]">{error}</p>
      ) : hint ? (
        <p className="text-xs text-fg-subtle">{hint}</p>
      ) : null}
    </div>
  );
}
