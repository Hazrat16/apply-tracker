'use client';

import {
  type ApplicationDetail,
  type JobExtractionMethod,
  type JobLinkInput,
  jobLinkInputSchema,
  type JobPreview,
  type JobTextInput,
  jobTextInputSchema,
} from '@apply-tracker/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, CircleAlert, Copy, Info, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormError } from '@/components/form/form-error';
import { SubmitButton } from '@/components/form/submit-button';
import { TextField } from '@/components/form/text-field';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ApplicationForm } from '@/features/applications/components/application-form';
import { useCreateApplication } from '@/features/applications/hooks';
import { applyApiError } from '@/lib/form-errors';
import { jobImportApi } from './api';
import { draftToFormValues } from './shared-link';

const METHOD_LABELS: Record<JobExtractionMethod, string> = {
  STRUCTURED_DATA: "the page's structured job data",
  PAGE_CONTENT: 'the page content',
  META_TAGS: "the page's title and summary",
  AI: 'AI',
};

function LinkForm({
  defaultUrl,
  onPreview,
}: {
  defaultUrl?: string;
  onPreview: (preview: JobPreview) => void;
}) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<JobLinkInput>({
    resolver: zodResolver(jobLinkInputSchema),
    defaultValues: { url: defaultUrl ?? '' },
  });

  const submit = async ({ url }: JobLinkInput) => {
    try {
      onPreview(await jobImportApi.previewLink(url));
    } catch (error) {
      applyApiError(error, setError, ['url']);
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} noValidate>
      <FieldGroup className="gap-4">
        <FormError message={errors.root?.message} />
        <TextField
          label="Job link"
          type="url"
          inputMode="url"
          autoFocus
          placeholder="https://www.linkedin.com/jobs/view/…"
          description="LinkedIn, Indeed, Facebook, company career pages and most job boards."
          registration={register('url')}
          error={errors.url}
        />
        <div className="flex justify-end">
          <SubmitButton pending={isSubmitting}>
            {isSubmitting ? 'Reading job…' : 'Read job'}
          </SubmitButton>
        </div>
      </FieldGroup>
    </form>
  );
}

function TextForm({
  defaultText,
  defaultUrl,
  onPreview,
}: {
  defaultText?: string;
  defaultUrl?: string;
  onPreview: (preview: JobPreview) => void;
}) {
  const textId = useId();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<JobTextInput>({
    resolver: zodResolver(jobTextInputSchema),
    defaultValues: { text: defaultText ?? '', url: defaultUrl || undefined },
  });

  const submit = async (input: JobTextInput) => {
    try {
      onPreview(await jobImportApi.previewText(input));
    } catch (error) {
      applyApiError(error, setError, ['text', 'url']);
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} noValidate>
      <FieldGroup className="gap-4">
        <FormError message={errors.root?.message} />
        <Field data-invalid={!!errors.text}>
          <FieldLabel htmlFor={textId}>Job posting text</FieldLabel>
          <Textarea
            id={textId}
            rows={8}
            placeholder="Open the job (e.g. a Facebook group post), select all of its text, copy and paste it here."
            aria-invalid={!!errors.text}
            {...register('text')}
          />
          <FieldError errors={[errors.text]} />
        </Field>
        <TextField
          label="Link (optional)"
          type="url"
          registration={register('url', { setValueAs: (value: string) => value || undefined })}
          error={errors.url}
        />
        <div className="flex justify-end">
          <SubmitButton pending={isSubmitting}>
            <Sparkles aria-hidden />
            {isSubmitting ? 'Reading text…' : 'Read text'}
          </SubmitButton>
        </div>
      </FieldGroup>
    </form>
  );
}

function PreviewNotices({ preview }: { preview: JobPreview }) {
  const sources = preview.methods.map((method) => METHOD_LABELS[method]);
  return (
    <div className="space-y-3">
      {preview.duplicate && (
        <Alert>
          <Copy />
          <AlertTitle>You already saved this job</AlertTitle>
          <AlertDescription>
            <span>
              {preview.duplicate.roleTitle} at {preview.duplicate.companyName}.{' '}
              <Link
                href={`/applications/${preview.duplicate.id}`}
                className="underline underline-offset-4"
              >
                Open it
              </Link>{' '}
              or save it again below.
            </span>
          </AlertDescription>
        </Alert>
      )}
      {preview.message && (
        <Alert variant={preview.fetched ? 'default' : 'destructive'}>
          <CircleAlert />
          <AlertDescription>{preview.message}</AlertDescription>
        </Alert>
      )}
      {sources.length > 0 && (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Info className="size-4 shrink-0" aria-hidden />
          Filled in from {sources.join(', ')}. Check the details before saving.
        </p>
      )}
    </div>
  );
}

interface JobImportFlowProps {
  initialUrl?: string;
  initialText?: string;
  /** Read the initial link immediately (e.g. when shared from another app). */
  autoStart?: boolean;
  onCreated: (application: ApplicationDetail) => void;
}

/** Link (or pasted text) → editable preview → saved application. */
export function JobImportFlow({
  initialUrl,
  initialText,
  autoStart,
  onCreated,
}: JobImportFlowProps) {
  const [preview, setPreview] = useState<JobPreview | null>(null);
  const [tab, setTab] = useState<'link' | 'text'>(initialText && !initialUrl ? 'text' : 'link');
  const { data: capabilities } = useQuery({
    queryKey: ['job-import-capabilities'],
    queryFn: jobImportApi.capabilities,
    staleTime: Infinity,
  });
  const create = useCreateApplication();

  const autoPreview = useMutation({ mutationFn: jobImportApi.previewLink, onSuccess: setPreview });
  const started = useRef(false);
  useEffect(() => {
    if (autoStart && initialUrl && !started.current) {
      started.current = true;
      autoPreview.mutate(initialUrl);
    }
  }, [autoStart, initialUrl, autoPreview]);

  if (preview) {
    return (
      <div className="space-y-5">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setPreview(null)}>
          <ArrowLeft aria-hidden />
          Use a different link
        </Button>
        <PreviewNotices preview={preview} />
        <ApplicationForm
          key={JSON.stringify(preview.draft)}
          submitLabel="Save to Wishlist"
          defaultValues={draftToFormValues(preview.draft)}
          onSubmit={async (data) => onCreated(await create.mutateAsync(data))}
        />
      </div>
    );
  }

  if (autoPreview.isPending) {
    return (
      <p role="status" className="py-10 text-center text-sm text-muted-foreground">
        Reading the job posting…
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {autoPreview.error && <FormError message={autoPreview.error.message} />}
      <Tabs value={tab} onValueChange={(value) => setTab(value as 'link' | 'text')}>
        {capabilities?.ai && (
          <TabsList>
            <TabsTrigger value="link">From a link</TabsTrigger>
            <TabsTrigger value="text">Paste job text</TabsTrigger>
          </TabsList>
        )}
        <TabsContent value="link" className="pt-4">
          <LinkForm defaultUrl={initialUrl} onPreview={setPreview} />
        </TabsContent>
        <TabsContent value="text" className="pt-4">
          <TextForm defaultText={initialText} defaultUrl={initialUrl} onPreview={setPreview} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
