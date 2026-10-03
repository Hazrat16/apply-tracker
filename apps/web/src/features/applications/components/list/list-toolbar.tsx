'use client';

import {
  APPLICATION_STATUSES,
  type ApplicationListParams,
  PRIORITIES,
  WORK_MODES,
} from '@apply-tracker/shared';
import { ListFilter, Search, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { PRIORITY_LABELS, STATUS_LABELS, WORK_MODE_LABELS } from '../../constants';
import { StatusDot } from '../status-badge';

interface ListToolbarProps {
  params: ApplicationListParams;
  onChange: (changes: Partial<ApplicationListParams>) => void;
}

function MultiFilter<T extends string>({
  label,
  values,
  options,
  selected,
  onChange,
  renderOption,
}: {
  label: string;
  values: readonly T[];
  options: Record<T, string>;
  selected: T[] | undefined;
  onChange: (next: T[]) => void;
  renderOption?: (value: T) => React.ReactNode;
}) {
  const chosen = selected ?? [];
  const toggle = (value: T) =>
    onChange(chosen.includes(value) ? chosen.filter((v) => v !== value) : [...chosen, value]);

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" size="sm" />}>
        <ListFilter aria-hidden />
        {label}
        {chosen.length > 0 && (
          <span className="rounded bg-primary px-1 text-[11px] text-primary-foreground tabular-nums">
            {chosen.length}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 p-1">
        <fieldset>
          <legend className="sr-only">{label}</legend>
          {values.map((value) => (
            <label
              key={value}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
            >
              <Checkbox checked={chosen.includes(value)} onCheckedChange={() => toggle(value)} />
              {renderOption?.(value)}
              {options[value]}
            </label>
          ))}
        </fieldset>
        {chosen.length > 0 && (
          <Button variant="ghost" size="sm" className="mt-1 w-full" onClick={() => onChange([])}>
            Clear
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function ListToolbar({ params, onChange }: ListToolbarProps) {
  const searchId = useId();
  const archivedId = useId();
  const [search, setSearch] = useState(params.search ?? '');
  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    if ((params.search ?? '') !== debouncedSearch)
      onChange({ search: debouncedSearch || undefined });
    // Only react to typing; `params` changes (e.g. paging) must not re-trigger a search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const hasFilters =
    !!params.search ||
    !!params.status?.length ||
    !!params.workMode?.length ||
    !!params.priority?.length ||
    params.archived;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-64">
        <label htmlFor={searchId} className="sr-only">
          Search applications
        </label>
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id={searchId}
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search role, company, location"
          className="pl-8"
        />
      </div>
      <MultiFilter
        label="Status"
        values={APPLICATION_STATUSES}
        options={STATUS_LABELS}
        selected={params.status}
        onChange={(status) => onChange({ status })}
        renderOption={(status) => <StatusDot status={status} />}
      />
      <MultiFilter
        label="Work mode"
        values={WORK_MODES}
        options={WORK_MODE_LABELS}
        selected={params.workMode}
        onChange={(workMode) => onChange({ workMode })}
      />
      <MultiFilter
        label="Priority"
        values={PRIORITIES}
        options={PRIORITY_LABELS}
        selected={params.priority}
        onChange={(priority) => onChange({ priority })}
      />
      <label htmlFor={archivedId} className="flex items-center gap-2 px-1 text-sm">
        <Checkbox
          id={archivedId}
          checked={params.archived}
          onCheckedChange={(checked) => onChange({ archived: checked === true })}
        />
        Archived only
      </label>
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSearch('');
            onChange({
              search: undefined,
              status: [],
              workMode: [],
              priority: [],
              archived: false,
            });
          }}
        >
          <X aria-hidden />
          Reset
        </Button>
      )}
    </div>
  );
}
