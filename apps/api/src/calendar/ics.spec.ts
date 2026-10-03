import { buildIcs, foldLine, icsDate, icsText } from './ics.js';

describe('ics helpers', () => {
  it('formats UTC timestamps', () => {
    expect(icsDate(new Date('2026-10-06T14:30:05.123Z'))).toBe('20261006T143005Z');
  });

  it('escapes text values', () => {
    expect(icsText('Room 4; floor 2, Berlin\nBring ID \\ passport')).toBe(
      'Room 4\\; floor 2\\, Berlin\\nBring ID \\\\ passport',
    );
  });

  it('folds long lines at 75 octets without splitting multi-byte characters', () => {
    const line = `SUMMARY:${'é'.repeat(80)}`;
    const folded = foldLine(line).split('\r\n');
    const encoder = new TextEncoder();
    expect(folded.length).toBeGreaterThan(1);
    for (const part of folded) expect(encoder.encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.slice(1).every((part) => part.startsWith(' '))).toBe(true);
    expect(folded.map((part, i) => (i === 0 ? part : part.slice(1))).join('')).toBe(line);
  });

  it('builds a calendar with events and alarms', () => {
    const ics = buildIcs(
      [
        {
          uid: 'interview-1@applytracker',
          start: new Date('2026-10-06T14:00:00Z'),
          end: new Date('2026-10-06T15:00:00Z'),
          summary: 'Technical interview — Acme',
          location: 'https://meet.example.com/abc',
          description: 'Senior Engineer, bring portfolio',
          alarmMinutesBefore: 60,
        },
      ],
      { name: 'ApplyTracker', now: new Date('2026-10-01T00:00:00Z') },
    );
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTART:20261006T140000Z\r\nDTEND:20261006T150000Z');
    expect(ics).toContain('DESCRIPTION:Senior Engineer\\, bring portfolio');
    expect(ics).toContain('TRIGGER:-PT60M');
    expect(ics).not.toMatch(/[^\r]\n/); // CRLF line endings only
  });
});
