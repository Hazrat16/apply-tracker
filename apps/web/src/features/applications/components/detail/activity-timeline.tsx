'use client';

import { type ApplicationDetail, type Note, noteInputSchema } from '@apply-tracker/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, CalendarClock, MessageSquare, Pencil, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, FieldError } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { applicationsApi } from '../../api';
import { INTERVIEW_TYPE_LABELS, STATUS_LABELS } from '../../constants';
import { formatDateTime, timeAgo } from '../../format';
import { useApplicationItemMutation } from '../../hooks';

type TimelineItem =
  | { kind: 'note'; at: string; note: Note }
  | { kind: 'status'; at: string; from: string | null; to: string }
  | { kind: 'interview'; at: string; label: string };

/** Notes, status changes and interviews, newest first. */
export function buildTimeline(app: ApplicationDetail): TimelineItem[] {
  return [
    ...app.notes.map((note) => ({ kind: 'note' as const, at: note.createdAt, note })),
    ...app.statusHistory.map((change) => ({
      kind: 'status' as const,
      at: change.changedAt,
      from: change.fromStatus && STATUS_LABELS[change.fromStatus],
      to: STATUS_LABELS[change.toStatus],
    })),
    ...app.interviews.map((interview) => ({
      kind: 'interview' as const,
      at: interview.scheduledAt,
      label: `${INTERVIEW_TYPE_LABELS[interview.type]} interview`,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));
}

function NoteForm({
  defaultValue = '',
  submitLabel,
  onSubmit,
  onCancel,
}: {
  defaultValue?: string;
  submitLabel: string;
  onSubmit: (body: string) => Promise<unknown>;
  onCancel?: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(noteInputSchema), defaultValues: { body: defaultValue } });

  return (
    <form
      onSubmit={handleSubmit(async ({ body }) => {
        try {
          await onSubmit(body);
          reset({ body: '' });
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Could not save the note');
        }
      })}
      className="space-y-2"
    >
      <Field data-invalid={!!errors.body}>
        <Textarea
          aria-label="Note"
          placeholder="Add a note — interview prep, feedback, next steps…"
          rows={3}
          aria-invalid={!!errors.body}
          {...register('body')}
        />
        <FieldError errors={[errors.body]} />
      </Field>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

function NoteEntry({ applicationId, note }: { applicationId: string; note: Note }) {
  const [editing, setEditing] = useState(false);
  const update = useApplicationItemMutation(applicationId, (body: string) =>
    applicationsApi.updateNote(applicationId, note.id, { body }),
  );
  const remove = useApplicationItemMutation(applicationId, () =>
    applicationsApi.deleteNote(applicationId, note.id),
  );

  if (editing) {
    return (
      <NoteForm
        defaultValue={note.body}
        submitLabel="Save"
        onSubmit={async (body) => {
          await update.mutateAsync(body);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="group rounded-lg border bg-card p-3">
      <p className="text-sm whitespace-pre-wrap">{note.body}</p>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground" title={formatDateTime(note.createdAt)}>
          {timeAgo(note.createdAt)}
          {note.updatedAt !== note.createdAt && ' · edited'}
        </span>
        <div className="flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Edit note"
            onClick={() => setEditing(true)}
          >
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Delete note"
            onClick={() =>
              remove.mutate(undefined, { onSuccess: () => toast.success('Note deleted') })
            }
          >
            <Trash2 />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ActivityTimeline({ application }: { application: ApplicationDetail }) {
  const addNote = useApplicationItemMutation(application.id, (body: string) =>
    applicationsApi.addNote(application.id, { body }),
  );
  const items = buildTimeline(application);

  return (
    <div className="space-y-6">
      <NoteForm submitLabel="Add note" onSubmit={(body) => addNote.mutateAsync(body)} />

      <ol className="relative space-y-4 border-l pl-6">
        {items.map((item) => {
          const key = item.kind === 'note' ? item.note.id : `${item.kind}-${item.at}`;
          const Icon =
            item.kind === 'note'
              ? MessageSquare
              : item.kind === 'interview'
                ? CalendarClock
                : item.from
                  ? ArrowRight
                  : Sparkles;
          return (
            <li key={key} className="relative">
              <span className="absolute top-0.5 -left-[2.0625rem] flex size-6 items-center justify-center rounded-full border bg-background">
                <Icon className="size-3 text-muted-foreground" aria-hidden />
              </span>
              {item.kind === 'note' ? (
                <NoteEntry applicationId={application.id} note={item.note} />
              ) : (
                <p className="text-sm">
                  {item.kind === 'status' ? (
                    item.from ? (
                      <>
                        Moved from <strong>{item.from}</strong> to <strong>{item.to}</strong>
                      </>
                    ) : (
                      <>
                        Added to <strong>{item.to}</strong>
                      </>
                    )
                  ) : (
                    <>
                      <strong>{item.label}</strong>{' '}
                      {new Date(item.at) > new Date() ? 'scheduled for' : 'on'}{' '}
                      {formatDateTime(item.at)}
                    </>
                  )}
                  {item.kind === 'status' && (
                    <span
                      className="ml-2 text-xs text-muted-foreground"
                      title={formatDateTime(item.at)}
                    >
                      {timeAgo(item.at)}
                    </span>
                  )}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
