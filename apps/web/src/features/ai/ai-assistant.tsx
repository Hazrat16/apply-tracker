'use client';

import {
  AI_MIN_JOB_DESCRIPTION,
  type ApplicationDetail,
  type CoverLetter,
  type CoverLetterTone,
  COVER_LETTER_TONES,
  type Resume,
  type ResumeMatch,
} from '@apply-tracker/shared';
import { Copy, Loader2, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { ButtonLink } from '@/components/button-link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { timeAgo } from '@/features/applications/format';
import { useResumes } from '@/features/resumes/hooks';
import { cn } from '@/lib/utils';
import {
  isWorking,
  useAiStatus,
  useCoverLetters,
  useDeleteCoverLetter,
  useRequestCoverLetter,
  useRequestMatch,
  useResumeMatches,
  useUpdateCoverLetter,
} from './hooks';

const TONE_LABELS: Record<CoverLetterTone, string> = {
  PROFESSIONAL: 'Professional',
  FRIENDLY: 'Friendly',
  ENTHUSIASTIC: 'Enthusiastic',
};

/** Resume matching and cover letter drafts for one application. */
export function AiAssistant({ application }: { application: ApplicationDetail }) {
  const { data: status } = useAiStatus();
  const { data: resumes, isPending } = useResumes();
  const usable = (resumes ?? []).filter((resume) => resume.hasText);
  const [picked, setPicked] = useState<string | null>(null);
  const resumeId = picked && usable.some((r) => r.id === picked) ? picked : usable[0]?.id;
  const selectId = useId();

  if (isPending || !status) return null;
  if (usable.length === 0) {
    return (
      <Notice title="Upload a resume first">
        <p>
          {resumes?.length
            ? 'Your resumes have no selectable text (scanned PDFs). Upload a text-based PDF.'
            : 'Upload your resume as a PDF to compare it with this job and draft cover letters.'}
        </p>
        <ButtonLink href="/settings" variant="outline" size="sm" className="mt-3">
          Go to settings
        </ButtonLink>
      </Notice>
    );
  }
  if ((application.jobDescription?.trim().length ?? 0) < AI_MIN_JOB_DESCRIPTION) {
    return (
      <Notice title="Add the job description">
        The AI compares your resume with the job description, so paste the posting into this
        application first (edit the application → Job description).
      </Notice>
    );
  }

  const builtin = status.provider === 'builtin';

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {builtin
          ? 'Using the free built-in matcher: it compares skills and keywords, no AI involved. A free local AI model (Ollama) can be connected on the server for smarter results.'
          : `Powered by ${status.model ?? 'an AI model'}. AI can make mistakes — check the results.`}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor={selectId}>Resume</Label>
        <Select
          items={Object.fromEntries(usable.map((r) => [r.id, r.label]))}
          value={resumeId}
          onValueChange={(value) => value && setPicked(value)}
        >
          <SelectTrigger id={selectId} className="min-w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {usable.map((resume) => (
              <SelectItem key={resume.id} value={resume.id}>
                {resume.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {resumeId && (
        <>
          <MatchCard
            applicationId={application.id}
            resumeId={resumeId}
            resumes={usable}
            onPick={setPicked}
          />
          <CoverLetterCard applicationId={application.id} resumeId={resumeId} builtin={builtin} />
        </>
      )}
    </div>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Alert>
      <Sparkles aria-hidden />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

function Working({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {label}
    </p>
  );
}

function MatchCard({
  applicationId,
  resumeId,
  resumes,
  onPick,
}: {
  applicationId: string;
  resumeId: string;
  resumes: Resume[];
  onPick: (id: string) => void;
}) {
  const { data: matches = [] } = useResumeMatches(applicationId);
  const request = useRequestMatch(applicationId);
  const match = matches.find((m) => m.resumeId === resumeId);
  const others = matches.filter(
    (m) =>
      m.resumeId !== resumeId && m.status === 'DONE' && resumes.some((r) => r.id === m.resumeId),
  );
  const working = match && isWorking(match.status);

  const run = () => request.mutate(resumeId, { onError: (error) => toast.error(error.message) });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resume match</CardTitle>
        <CardDescription>
          How well this resume fits the job description, what&apos;s missing and how to improve it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!match ? (
          <Button onClick={run} disabled={request.isPending}>
            <Sparkles aria-hidden />
            Check match
          </Button>
        ) : working ? (
          <Working label="Comparing your resume with the job…" />
        ) : match.status === 'FAILED' ? (
          <div className="space-y-2">
            <p className="text-sm text-destructive">{match.error}</p>
            <Button variant="outline" size="sm" onClick={run} disabled={request.isPending}>
              <RefreshCw aria-hidden />
              Try again
            </Button>
          </div>
        ) : (
          <MatchResult match={match} onRerun={run} rerunning={request.isPending} />
        )}

        {others.length > 0 && (
          <div className="border-t pt-3 text-sm">
            <p className="text-muted-foreground">Other resumes</p>
            <ul className="mt-1 flex flex-wrap gap-2">
              {others.map((m) => (
                <li key={m.id}>
                  <Button variant="outline" size="xs" onClick={() => onPick(m.resumeId)}>
                    {m.resumeLabel} · {m.score}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function scoreTone(score: number) {
  if (score >= 75) return 'text-green-700 dark:text-green-400';
  if (score >= 50) return 'text-amber-700 dark:text-amber-400';
  return 'text-destructive';
}

function MatchResult({
  match,
  onRerun,
  rerunning,
}: {
  match: ResumeMatch;
  onRerun: () => void;
  rerunning: boolean;
}) {
  const score = match.score ?? 0;
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        <p className={cn('text-4xl font-semibold tabular-nums', scoreTone(score))}>
          {score}
          <span className="sr-only"> out of 100</span>
          <span aria-hidden className="text-base font-normal text-muted-foreground">
            /100
          </span>
        </p>
        <p className="flex-1 text-sm">{match.summary}</p>
      </div>
      <SkillList title="Matched" skills={match.matchedSkills} variant="secondary" />
      <SkillList title="Missing" skills={match.missingSkills} variant="destructive" />
      {match.suggestions.length > 0 && (
        <div>
          <h4 className="text-sm font-medium">Suggestions</h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {match.suggestions.map((suggestion) => (
              <li key={suggestion}>{suggestion}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>Checked {match.completedAt ? timeAgo(match.completedAt) : ''}</span>
        <Button variant="ghost" size="sm" onClick={onRerun} disabled={rerunning}>
          <RefreshCw aria-hidden />
          Re-check
        </Button>
      </div>
    </div>
  );
}

function SkillList({
  title,
  skills,
  variant,
}: {
  title: string;
  skills: string[];
  variant: 'secondary' | 'destructive';
}) {
  if (skills.length === 0) return null;
  return (
    <div>
      <h4 className="text-sm font-medium">{title}</h4>
      <ul className="mt-1 flex flex-wrap gap-1.5">
        {skills.map((skill) => (
          <li key={skill}>
            <Badge variant={variant}>{skill}</Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CoverLetterCard({
  applicationId,
  resumeId,
  builtin,
}: {
  applicationId: string;
  resumeId: string;
  builtin: boolean;
}) {
  const { data: letters = [] } = useCoverLetters(applicationId);
  const request = useRequestCoverLetter(applicationId);
  const [tone, setTone] = useState<CoverLetterTone>('PROFESSIONAL');
  const [instructions, setInstructions] = useState('');
  const ids = { tone: useId(), notes: useId() };
  const busy = request.isPending || letters.some((letter) => isWorking(letter.status));

  const generate = () =>
    request.mutate(
      { resumeId, tone, instructions },
      {
        onSuccess: () => setInstructions(''),
        onError: (error) => toast.error(error.message),
      },
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cover letter</CardTitle>
        <CardDescription>
          {builtin
            ? 'A template filled in from your resume and the job description. Personalise it before sending.'
            : 'A first draft from your resume and the job description. Read it and make it yours before sending.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
          <div className="space-y-1.5">
            <Label htmlFor={ids.tone}>Tone</Label>
            <Select
              items={TONE_LABELS}
              value={tone}
              onValueChange={(value) => value && setTone(value as CoverLetterTone)}
            >
              <SelectTrigger id={ids.tone} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COVER_LETTER_TONES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {TONE_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={ids.notes}>Anything to mention? (optional)</Label>
            <Textarea
              id={ids.notes}
              rows={2}
              maxLength={1000}
              placeholder="e.g. I'm relocating to Berlin in March; I love their open-source work"
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
            />
          </div>
        </div>
        <Button onClick={generate} disabled={busy}>
          <Sparkles aria-hidden />
          {letters.length > 0 ? 'Draft another' : 'Draft cover letter'}
        </Button>

        {letters.length > 0 && (
          <ul className="space-y-4">
            {letters.map((letter) => (
              <li key={letter.id}>
                <LetterItem applicationId={applicationId} letter={letter} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function LetterItem({ applicationId, letter }: { applicationId: string; letter: CoverLetter }) {
  const [draft, setDraft] = useState<string | null>(null);
  const update = useUpdateCoverLetter(applicationId);
  const remove = useDeleteCoverLetter(applicationId);
  const text = draft ?? letter.content ?? '';
  const changed = draft !== null && draft !== letter.content;
  const textId = useId();

  return (
    <article className="space-y-2 rounded-lg border p-3" aria-labelledby={`${textId}-title`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 id={`${textId}-title`} className="text-sm font-medium">
          {TONE_LABELS[letter.tone]}
          <span className="font-normal text-muted-foreground">
            {letter.resumeLabel ? ` · from ${letter.resumeLabel}` : ''} ·{' '}
            {timeAgo(letter.createdAt)}
          </span>
        </h4>
        <div className="flex items-center">
          {letter.status === 'DONE' && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Copy cover letter"
              onClick={() =>
                navigator.clipboard.writeText(text).then(
                  () => toast.success('Copied to clipboard'),
                  () => toast.error("Couldn't copy — select the text instead"),
                )
              }
            >
              <Copy />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Delete cover letter"
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(letter.id, { onError: (error) => toast.error(error.message) })
            }
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      {isWorking(letter.status) ? (
        <Working label="Writing your cover letter…" />
      ) : letter.status === 'FAILED' ? (
        <p className="text-sm text-destructive">{letter.error}</p>
      ) : (
        <>
          <Textarea
            aria-label="Cover letter text"
            className="min-h-64 text-sm"
            value={text}
            onChange={(event) => setDraft(event.target.value)}
          />
          {changed && (
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
                Discard changes
              </Button>
              <Button
                size="sm"
                disabled={update.isPending || !text.trim()}
                onClick={() =>
                  update.mutate(
                    { id: letter.id, content: text },
                    {
                      onSuccess: () => {
                        setDraft(null);
                        toast.success('Cover letter saved');
                      },
                      onError: (error) => toast.error(error.message),
                    },
                  )
                }
              >
                Save
              </Button>
            </div>
          )}
        </>
      )}
    </article>
  );
}
