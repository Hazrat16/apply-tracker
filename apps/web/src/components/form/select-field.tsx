'use client';

import { useId } from 'react';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const NONE = '__none__';

interface SelectFieldProps<T extends string> {
  label: string;
  value: T | null | undefined;
  onChange: (value: T | null) => void;
  options: Record<T, string>;
  /** Adds a "none" choice that maps to `null`. */
  emptyLabel?: string;
  error?: { message?: string };
}

/** Labelled select for a fixed set of options (enum fields). */
export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  emptyLabel,
  error,
}: SelectFieldProps<T>) {
  const id = useId();
  const items: Record<string, string> = emptyLabel ? { [NONE]: emptyLabel, ...options } : options;

  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        items={items}
        value={value ?? (emptyLabel ? NONE : null)}
        onValueChange={(next) => onChange(next === NONE || next == null ? null : (next as T))}
      >
        <SelectTrigger id={id} className="w-full" aria-invalid={!!error}>
          <SelectValue placeholder={emptyLabel ?? 'Select…'} />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(items).map(([optionValue, optionLabel]) => (
            <SelectItem key={optionValue} value={optionValue}>
              {optionLabel as string}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldError errors={[error]} />
    </Field>
  );
}
