import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from './api-client';

/**
 * Maps an API error onto the form: field-level validation issues go to their fields,
 * anything else becomes a form-wide `root` error.
 */
export function applyApiError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): void {
  if (error instanceof ApiError) {
    const fieldIssues = error.issues.filter((issue) => fields.includes(issue.path as Path<T>));
    for (const issue of fieldIssues) {
      setError(issue.path as Path<T>, { message: issue.message });
    }
    if (fieldIssues.length === 0) setError('root', { message: error.message });
    return;
  }
  setError('root', { message: 'Something went wrong. Please try again.' });
}
