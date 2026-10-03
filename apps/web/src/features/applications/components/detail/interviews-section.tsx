'use client';

import {
  type ApplicationDetail,
  type Interview,
  type InterviewData,
  interviewInputSchema,
} from '@apply-tracker/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarClock, Clock, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormError } from '@/components/form/form-error';
import { SelectField } from '@/components/form/select-field';
import { SubmitButton } from '@/components/form/submit-button';
import { TextField } from '@/components/form/text-field';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { applyApiError } from '@/lib/form-errors';
import { cn } from '@/lib/utils';
import { applicationsApi } from '../../api';
import { INTERVIEW_OUTCOME_LABELS, INTERVIEW_TYPE_LABELS } from '../../constants';
import { formatDateTime, toDateTimeLocal } from '../../format';
import { useApplicationItemMutation } from '../../hooks';

// The form edits a local date-time; it's converted to an ISO timestamp on submit.
const formSchema = interviewInputSchema.extend({
  scheduledAt: z.string().min(1, 'Choose a date and time'),
});
type FormInput = z.input<typeof formSchema>;
type FormOutput = z.output<typeof formSchema>;

const optionalNumber = (value: unknown) => (value === '' || value == null ? null : Number(value));

function InterviewDialog({
  applicationId,
  interview,
  trigger,
}: {
  applicationId: string;
  interview?: Interview;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const notesId = useId();
  const save = useApplicationItemMutation(applicationId, (data: InterviewData) =>
    applicationsApi.saveInterview(applicationId, data, interview?.id),
  );
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: interview
      ? {
          ...interview,
          scheduledAt: toDateTimeLocal(interview.scheduledAt),
          location: interview.location ?? '',
          notes: interview.notes ?? '',
        }
      : { type: 'PHONE_SCREEN', outcome: 'PENDING', scheduledAt: '', durationMinutes: 60 },
  });

  const onSubmit = async ({ scheduledAt, ...data }: FormOutput) => {
    try {
      await save.mutateAsync({ ...data, scheduledAt: new Date(scheduledAt).toISOString() });
      toast.success(interview ? 'Interview updated' : 'Interview scheduled');
      setOpen(false);
      if (!interview) reset();
    } catch (error) {
      applyApiError(error, setError, [
        'type',
        'scheduledAt',
        'durationMinutes',
        'location',
        'notes',
        'outcome',
      ]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{interview ? 'Edit interview' : 'Schedule interview'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup className="gap-4">
            <FormError message={errors.root?.message} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                control={control}
                name="type"
                render={({ field, fieldState }) => (
                  <SelectField
                    label="Type"
                    options={INTERVIEW_TYPE_LABELS}
                    value={field.value}
                    onChange={(value) => field.onChange(value ?? 'OTHER')}
                    error={fieldState.error}
                  />
                )}
              />
              <Controller
                control={control}
                name="outcome"
                render={({ field, fieldState }) => (
                  <SelectField
                    label="Outcome"
                    options={INTERVIEW_OUTCOME_LABELS}
                    value={field.value}
                    onChange={(value) => field.onChange(value ?? 'PENDING')}
                    error={fieldState.error}
                  />
                )}
              />
              <TextField
                label="Date and time"
                type="datetime-local"
                registration={register('scheduledAt')}
                error={errors.scheduledAt}
              />
              <TextField
                label="Duration (minutes)"
                type="number"
                min={5}
                step={5}
                registration={register('durationMinutes', { setValueAs: optionalNumber })}
                error={errors.durationMinutes}
              />
              <TextField
                label="Location or meeting link"
                className="sm:col-span-2"
                registration={register('location')}
                error={errors.location}
              />
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor={notesId}>Notes</FieldLabel>
                <Textarea
                  id={notesId}
                  rows={3}
                  placeholder="Interviewers, topics, prep…"
                  {...register('notes')}
                />
              </Field>
            </div>
            <div className="flex justify-end">
              <SubmitButton pending={isSubmitting}>{interview ? 'Save' : 'Schedule'}</SubmitButton>
            </div>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const OUTCOME_STYLES: Record<Interview['outcome'], string> = {
  PENDING: 'bg-muted text-muted-foreground',
  PASSED: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  FAILED: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  CANCELLED: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
};

export function InterviewsSection({ application }: { application: ApplicationDetail }) {
  const remove = useApplicationItemMutation(application.id, (interviewId: string) =>
    applicationsApi.deleteInterview(application.id, interviewId),
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <InterviewDialog
          applicationId={application.id}
          trigger={
            <Button size="sm">
              <Plus aria-hidden />
              Schedule interview
            </Button>
          }
        />
      </div>
      {application.interviews.length === 0 ? (
        <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
          No interviews yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {application.interviews.map((interview) => (
            <li key={interview.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{INTERVIEW_TYPE_LABELS[interview.type]}</p>
                  <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="size-3.5" aria-hidden />
                      {formatDateTime(interview.scheduledAt)}
                    </span>
                    {interview.durationMinutes && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3.5" aria-hidden />
                        {interview.durationMinutes} min
                      </span>
                    )}
                    {interview.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3.5" aria-hidden />
                        {interview.location}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <span
                    className={cn(
                      'rounded px-2 py-0.5 text-xs font-medium',
                      OUTCOME_STYLES[interview.outcome],
                    )}
                  >
                    {INTERVIEW_OUTCOME_LABELS[interview.outcome]}
                  </span>
                  <InterviewDialog
                    applicationId={application.id}
                    interview={interview}
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label="Edit interview">
                        <Pencil />
                      </Button>
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete interview"
                    onClick={() =>
                      remove.mutate(interview.id, {
                        onSuccess: () => toast.success('Interview deleted'),
                      })
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
              {interview.notes && (
                <p className="mt-2 text-sm whitespace-pre-wrap">{interview.notes}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
