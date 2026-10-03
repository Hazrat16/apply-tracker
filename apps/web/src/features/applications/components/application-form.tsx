'use client';

import {
  type CreateApplicationData,
  type CreateApplicationInput,
  createApplicationSchema,
} from '@apply-tracker/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';
import { FormError } from '@/components/form/form-error';
import { SelectField } from '@/components/form/select-field';
import { SubmitButton } from '@/components/form/submit-button';
import { TextField } from '@/components/form/text-field';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { applyApiError } from '@/lib/form-errors';
import { PRIORITY_LABELS, SOURCE_LABELS, STATUS_LABELS, WORK_MODE_LABELS } from '../constants';
import { useCompanies } from '../hooks';
import { TagPicker } from './tag-picker';

type FormInput = z.input<typeof createApplicationSchema>;

const FIELDS = [
  'companyName',
  'roleTitle',
  'status',
  'priority',
  'jobUrl',
  'location',
  'workMode',
  'source',
  'salaryMin',
  'salaryMax',
  'currency',
  'appliedAt',
  'jobDescription',
  'tagIds',
] as const;

const optionalNumber = (value: unknown) => (value === '' || value == null ? null : Number(value));
const optionalString = (value: unknown) => (value === '' || value == null ? null : value);

interface ApplicationFormProps {
  defaultValues?: Partial<CreateApplicationInput>;
  submitLabel: string;
  onSubmit: (data: CreateApplicationData) => Promise<unknown>;
}

export function ApplicationForm({ defaultValues, submitLabel, onSubmit }: ApplicationFormProps) {
  const descriptionId = useId();
  const companiesListId = useId();
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, CreateApplicationData>({
    resolver: zodResolver(createApplicationSchema),
    defaultValues: {
      companyName: '',
      roleTitle: '',
      status: 'WISHLIST',
      priority: 'MEDIUM',
      currency: 'USD',
      tagIds: [],
      ...defaultValues,
    },
  });

  const companyName = useWatch({ control, name: 'companyName' });
  const companySearch = useDebouncedValue(companyName ?? '', 250);
  const { data: companies = [] } = useCompanies(companySearch);

  const submit = async (data: CreateApplicationData) => {
    try {
      await onSubmit(data);
    } catch (error) {
      applyApiError(error, setError, FIELDS);
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} noValidate>
      <FieldGroup className="gap-5">
        <FormError message={errors.root?.message} />

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label="Company"
            autoFocus
            autoComplete="off"
            list={companiesListId}
            registration={register('companyName')}
            error={errors.companyName}
          />
          <datalist id={companiesListId}>
            {companies.map((company) => (
              <option key={company.id} value={company.name} />
            ))}
          </datalist>
          <TextField label="Role" registration={register('roleTitle')} error={errors.roleTitle} />

          <Controller
            control={control}
            name="status"
            render={({ field, fieldState }) => (
              <SelectField
                label="Status"
                options={STATUS_LABELS}
                value={field.value}
                onChange={(value) => field.onChange(value ?? 'WISHLIST')}
                error={fieldState.error}
              />
            )}
          />
          <Controller
            control={control}
            name="priority"
            render={({ field, fieldState }) => (
              <SelectField
                label="Priority"
                options={PRIORITY_LABELS}
                value={field.value}
                onChange={(value) => field.onChange(value ?? 'MEDIUM')}
                error={fieldState.error}
              />
            )}
          />

          <TextField
            label="Job posting URL"
            type="url"
            placeholder="https://"
            className="sm:col-span-2"
            registration={register('jobUrl', { setValueAs: optionalString })}
            error={errors.jobUrl}
          />

          <TextField
            label="Location"
            placeholder="City, country or Remote"
            registration={register('location')}
            error={errors.location}
          />
          <Controller
            control={control}
            name="workMode"
            render={({ field, fieldState }) => (
              <SelectField
                label="Work mode"
                options={WORK_MODE_LABELS}
                emptyLabel="Not specified"
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error}
              />
            )}
          />

          <Controller
            control={control}
            name="source"
            render={({ field, fieldState }) => (
              <SelectField
                label="Found via"
                options={SOURCE_LABELS}
                emptyLabel="Not specified"
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error}
              />
            )}
          />
          <TextField
            label="Applied on"
            type="date"
            registration={register('appliedAt', { setValueAs: optionalString })}
            error={errors.appliedAt}
          />

          <div className="grid grid-cols-[1fr_1fr_5.5rem] gap-3 sm:col-span-2">
            <TextField
              label="Salary from"
              type="number"
              inputMode="numeric"
              min={0}
              registration={register('salaryMin', { setValueAs: optionalNumber })}
              error={errors.salaryMin}
            />
            <TextField
              label="Salary to"
              type="number"
              inputMode="numeric"
              min={0}
              registration={register('salaryMax', { setValueAs: optionalNumber })}
              error={errors.salaryMax}
            />
            <TextField
              label="Currency"
              maxLength={3}
              inputClassName="uppercase"
              registration={register('currency')}
              error={errors.currency}
            />
          </div>

          <Field className="sm:col-span-2">
            <FieldLabel>Tags</FieldLabel>
            <Controller
              control={control}
              name="tagIds"
              render={({ field }) => (
                <TagPicker value={field.value ?? []} onChange={field.onChange} />
              )}
            />
          </Field>

          <Field className="sm:col-span-2" data-invalid={!!errors.jobDescription}>
            <FieldLabel htmlFor={descriptionId}>Job description</FieldLabel>
            <Textarea
              id={descriptionId}
              rows={4}
              placeholder="Paste the job description to keep it for later"
              aria-invalid={!!errors.jobDescription}
              {...register('jobDescription')}
            />
            <FieldError errors={[errors.jobDescription]} />
          </Field>
        </div>

        <div className="flex justify-end">
          <SubmitButton pending={isSubmitting}>{submitLabel}</SubmitButton>
        </div>
      </FieldGroup>
    </form>
  );
}
