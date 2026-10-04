'use client';

import { RESUME_MAX_BYTES, RESUME_MAX_PER_USER, type Resume } from '@apply-tracker/shared';
import { Check, ExternalLink, FileText, Pencil, Trash2, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { resumesApi } from '@/features/resumes/api';
import {
  useDeleteResume,
  useRenameResume,
  useResumes,
  useUploadResume,
} from '@/features/resumes/hooks';

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function ResumesSettings() {
  const { data: resumes = [], isPending } = useResumes();
  const upload = useUploadResume();
  const fileInput = useRef<HTMLInputElement>(null);
  const atLimit = resumes.length >= RESUME_MAX_PER_USER;

  const onFile = (file: File | undefined) => {
    if (fileInput.current) fileInput.current.value = '';
    if (!file) return;
    if (file.size > RESUME_MAX_BYTES) {
      toast.error('That file is over 5 MB');
      return;
    }
    upload.mutate(file, {
      onSuccess: (resume) =>
        resume.hasText
          ? toast.success(`Uploaded “${resume.label}”`)
          : toast.warning(
              `Uploaded “${resume.label}”, but it has no selectable text — AI features can't read scanned PDFs`,
            ),
      onError: (error) => toast.error(error.message),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumes</CardTitle>
        <CardDescription>
          PDF resumes (up to 5 MB, {RESUME_MAX_PER_USER} at most). Use them to check how well you
          match a job and to draft cover letters from any application.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isPending ? null : resumes.length === 0 ? (
          <p className="text-sm text-muted-foreground">You haven&apos;t uploaded a resume yet.</p>
        ) : (
          <ul className="divide-y">
            {resumes.map((resume) => (
              <ResumeRow key={resume.id} resume={resume} />
            ))}
          </ul>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => onFile(event.target.files?.[0])}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={upload.isPending || atLimit}
          onClick={() => fileInput.current?.click()}
        >
          <Upload aria-hidden />
          {upload.isPending ? 'Uploading…' : 'Upload PDF'}
        </Button>
        {atLimit && (
          <p className="text-xs text-muted-foreground">Delete a resume to upload another.</p>
        )}
      </CardContent>
    </Card>
  );
}

function ResumeRow({ resume }: { resume: Resume }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(resume.label);
  const rename = useRenameResume();
  const remove = useDeleteResume();

  const save = () => {
    const next = label.trim();
    if (!next || next === resume.label) {
      setLabel(resume.label);
      setEditing(false);
      return;
    }
    rename.mutate(
      { id: resume.id, label: next },
      {
        onSuccess: () => setEditing(false),
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <li className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
      <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        {editing ? (
          <form
            className="flex items-center gap-1"
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <Input
              value={label}
              maxLength={80}
              autoFocus
              aria-label="Resume name"
              className="h-7"
              onChange={(event) => setLabel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setLabel(resume.label);
                  setEditing(false);
                }
              }}
            />
            <Button type="submit" variant="ghost" size="icon-sm" aria-label="Save name">
              <Check />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Cancel"
              onClick={() => {
                setLabel(resume.label);
                setEditing(false);
              }}
            >
              <X />
            </Button>
          </form>
        ) : (
          <>
            <p className="truncate text-sm font-medium">{resume.label}</p>
            <p className="truncate text-xs text-muted-foreground">
              {resume.fileName} · {resume.pageCount} page{resume.pageCount === 1 ? '' : 's'} ·{' '}
              {formatSize(resume.sizeBytes)}
            </p>
          </>
        )}
      </div>
      {!resume.hasText && !editing && (
        <Badge variant="outline" title="No selectable text — AI features can't read this PDF">
          Scanned
        </Badge>
      )}
      {!editing && (
        <div className="flex shrink-0 items-center">
          <a
            href={resumesApi.fileUrl(resume.id)}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${resume.label} (new tab)`}
            className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
          >
            <ExternalLink />
          </a>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Rename ${resume.label}`}
            onClick={() => setEditing(true)}
          >
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${resume.label}`}
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(resume.id, {
                onSuccess: () => toast.success(`Deleted “${resume.label}”`),
                onError: (error) => toast.error(error.message),
              })
            }
          >
            <Trash2 />
          </Button>
        </div>
      )}
    </li>
  );
}
