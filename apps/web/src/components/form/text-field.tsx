'use client';

import { Eye, EyeOff } from 'lucide-react';
import { type ComponentProps, useId, useState } from 'react';
import type { FieldError as RHFFieldError, UseFormRegisterReturn } from 'react-hook-form';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

interface TextFieldProps extends Omit<
  ComponentProps<typeof Input>,
  'id' | keyof UseFormRegisterReturn
> {
  label: string;
  registration: UseFormRegisterReturn;
  error?: RHFFieldError;
  description?: string;
  /** Rendered next to the label, e.g. a "Forgot password?" link. */
  labelAction?: React.ReactNode;
}

/** Labelled input wired to react-hook-form, with accessible error messaging. */
export function TextField({
  label,
  registration,
  error,
  description,
  labelAction,
  type = 'text',
  ...inputProps
}: TextFieldProps) {
  const id = useId();
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';

  return (
    <Field data-invalid={!!error}>
      <div className="flex items-center justify-between">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {labelAction}
      </div>
      <div className="relative">
        <Input
          id={id}
          type={isPassword && showPassword ? 'text' : type}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={isPassword ? 'pr-9' : undefined}
          {...inputProps}
          {...registration}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </div>
      {description && !error && <FieldDescription>{description}</FieldDescription>}
      <FieldError id={`${id}-error`} errors={[error]} />
    </Field>
  );
}
