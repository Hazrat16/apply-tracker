'use client';

import { type Reminder } from '@apply-tracker/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormError } from '@/components/form/form-error';
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
import { toDateTimeLocal } from '@/features/applications/format';
import { applyApiError } from '@/lib/form-errors';
import { useCreateReminder, useUpdateReminder } from './hooks';
import { reminderPresets } from './presets';

const formSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  dueAt: z.string().min(1, 'Choose a date and time'),
  note: z.string().max(2000),
});
type FormValues = z.infer<typeof formSchema>;

interface ReminderDialogProps {
  trigger: React.ReactElement;
  reminder?: Reminder;
  applicationId?: string;
  defaultTitle?: string;
}

export function ReminderDialog({
  trigger,
  reminder,
  applicationId,
  defaultTitle,
}: ReminderDialogProps) {
  const [open, setOpen] = useState(false);
  const noteId = useId();
  const create = useCreateReminder();
  const update = useUpdateReminder();
  const presets = reminderPresets();
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: reminder?.title ?? defaultTitle ?? '',
      dueAt: toDateTimeLocal(
        (reminder ? new Date(reminder.dueAt) : presets[1]!.date).toISOString(),
      ),
      note: reminder?.note ?? '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    const body = {
      title: values.title,
      note: values.note,
      dueAt: new Date(values.dueAt).toISOString(),
    };
    try {
      if (reminder) await update.mutateAsync({ id: reminder.id, ...body });
      else await create.mutateAsync({ ...body, applicationId: applicationId ?? null });
      toast.success(reminder ? 'Reminder updated' : 'Reminder set', {
        description: new Date(body.dueAt).toLocaleString(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
      });
      setOpen(false);
      if (!reminder) reset();
    } catch (error) {
      applyApiError(error, setError, ['title', 'dueAt', 'note']);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{reminder ? 'Edit reminder' : 'Set a reminder'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup className="gap-4">
            <FormError message={errors.root?.message} />
            <TextField
              label="Remind me to"
              autoFocus
              registration={register('title')}
              error={errors.title}
            />
            <div className="space-y-2">
              <TextField
                label="When"
                type="datetime-local"
                registration={register('dueAt')}
                error={errors.dueAt}
              />
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick choices">
                {presets.map((preset) => (
                  <Button
                    key={preset.label}
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() =>
                      setValue('dueAt', toDateTimeLocal(preset.date.toISOString()), {
                        shouldValidate: true,
                      })
                    }
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
            <Field>
              <FieldLabel htmlFor={noteId}>Note (optional)</FieldLabel>
              <Textarea id={noteId} rows={2} {...register('note')} />
            </Field>
            <p className="text-xs text-muted-foreground">
              You&apos;ll get an in-app notification and an email when it&apos;s due.
            </p>
            <div className="flex justify-end">
              <SubmitButton pending={isSubmitting}>
                {reminder ? 'Save' : 'Set reminder'}
              </SubmitButton>
            </div>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
