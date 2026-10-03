'use client';

import {
  type ApplicationDetail,
  type Contact,
  type ContactData,
  contactInputSchema,
} from '@apply-tracker/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link2, Mail, Pencil, Phone, Plus, Trash2, UserRound } from 'lucide-react';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
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
import { applyApiError } from '@/lib/form-errors';
import { applicationsApi } from '../../api';
import { useApplicationItemMutation } from '../../hooks';

type FormInput = z.input<typeof contactInputSchema>;

function ContactDialog({
  applicationId,
  contact,
  trigger,
}: {
  applicationId: string;
  contact?: Contact;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const notesId = useId();
  const save = useApplicationItemMutation(applicationId, (data: ContactData) =>
    applicationsApi.saveContact(applicationId, data, contact?.id),
  );
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, ContactData>({
    resolver: zodResolver(contactInputSchema),
    defaultValues: {
      name: contact?.name ?? '',
      role: contact?.role ?? '',
      email: contact?.email ?? '',
      phone: contact?.phone ?? '',
      linkedinUrl: contact?.linkedinUrl ?? '',
      notes: contact?.notes ?? '',
    },
  });

  const onSubmit = async (data: ContactData) => {
    try {
      await save.mutateAsync(data);
      toast.success(contact ? 'Contact updated' : 'Contact added');
      setOpen(false);
      if (!contact) reset();
    } catch (error) {
      applyApiError(error, setError, ['name', 'role', 'email', 'phone', 'linkedinUrl', 'notes']);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{contact ? 'Edit contact' : 'Add contact'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup className="gap-4">
            <FormError message={errors.root?.message} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Name"
                autoFocus
                registration={register('name')}
                error={errors.name}
              />
              <TextField
                label="Role"
                placeholder="Recruiter, hiring manager…"
                registration={register('role')}
                error={errors.role}
              />
              <TextField
                label="Email"
                type="email"
                registration={register('email')}
                error={errors.email}
              />
              <TextField
                label="Phone"
                type="tel"
                registration={register('phone')}
                error={errors.phone}
              />
              <TextField
                label="LinkedIn profile"
                type="url"
                placeholder="https://linkedin.com/in/…"
                className="sm:col-span-2"
                registration={register('linkedinUrl')}
                error={errors.linkedinUrl}
              />
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor={notesId}>Notes</FieldLabel>
                <Textarea id={notesId} rows={2} {...register('notes')} />
              </Field>
            </div>
            <div className="flex justify-end">
              <SubmitButton pending={isSubmitting}>{contact ? 'Save' : 'Add contact'}</SubmitButton>
            </div>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ContactsSection({ application }: { application: ApplicationDetail }) {
  const remove = useApplicationItemMutation(application.id, (contactId: string) =>
    applicationsApi.deleteContact(application.id, contactId),
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ContactDialog
          applicationId={application.id}
          trigger={
            <Button size="sm">
              <Plus aria-hidden />
              Add contact
            </Button>
          }
        />
      </div>
      {application.contacts.length === 0 ? (
        <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
          No contacts yet. Add the recruiter or hiring manager so you know who to follow up with.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {application.contacts.map((contact) => (
            <li key={contact.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <UserRound className="size-4 text-muted-foreground" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{contact.name}</p>
                    {contact.role && (
                      <p className="truncate text-xs text-muted-foreground">{contact.role}</p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0">
                  <ContactDialog
                    applicationId={application.id}
                    contact={contact}
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label={`Edit ${contact.name}`}>
                        <Pencil />
                      </Button>
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${contact.name}`}
                    onClick={() =>
                      remove.mutate(contact.id, {
                        onSuccess: () => toast.success('Contact deleted'),
                      })
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                {contact.email && (
                  <li>
                    <a
                      href={`mailto:${contact.email}`}
                      className="inline-flex items-center gap-2 hover:underline"
                    >
                      <Mail className="size-3.5 text-muted-foreground" aria-hidden />
                      {contact.email}
                    </a>
                  </li>
                )}
                {contact.phone && (
                  <li>
                    <a
                      href={`tel:${contact.phone}`}
                      className="inline-flex items-center gap-2 hover:underline"
                    >
                      <Phone className="size-3.5 text-muted-foreground" aria-hidden />
                      {contact.phone}
                    </a>
                  </li>
                )}
                {contact.linkedinUrl && (
                  <li>
                    <a
                      href={contact.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 hover:underline"
                    >
                      <Link2 className="size-3.5 text-muted-foreground" aria-hidden />
                      LinkedIn profile
                    </a>
                  </li>
                )}
              </ul>
              {contact.notes && (
                <p className="mt-2 text-sm text-muted-foreground">{contact.notes}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
