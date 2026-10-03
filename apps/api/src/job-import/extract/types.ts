import type { JobDraft } from '@apply-tracker/shared';

/** Fields one extractor found; missing fields are absent or null. */
export type DraftPart = Partial<JobDraft>;

/** Fills fields of `target` that are still empty from `part`. Returns whether anything was added. */
export function mergeDraft(target: DraftPart, part: DraftPart): boolean {
  let added = false;
  for (const [key, value] of Object.entries(part) as [keyof JobDraft, unknown][]) {
    if (value == null || value === '') continue;
    if (target[key] == null || target[key] === '') {
      (target as Record<string, unknown>)[key] = value;
      added = true;
    }
  }
  return added;
}

/** "Remote", "Hybrid" or "On-site" when the text says so explicitly. */
export function inferWorkMode(...texts: (string | null | undefined)[]): JobDraft['workMode'] {
  const text = texts.filter(Boolean).join(' ');
  if (/\bremote\b/i.test(text)) return 'REMOTE';
  if (/\bhybrid\b/i.test(text)) return 'HYBRID';
  if (/\b(on-?site|in-office)\b/i.test(text)) return 'ONSITE';
  return null;
}
