'use client';

import { Check, Plus, Tags } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCreateTag, useTags } from '@/features/tags/hooks';
import { cn } from '@/lib/utils';
import { TagBadge } from './tag-badge';

interface TagPickerProps {
  value: string[];
  onChange: (tagIds: string[]) => void;
}

/** Choose existing tags or create a new one by typing its name. */
export function TagPicker({ value, onChange }: TagPickerProps) {
  const { data: tags = [] } = useTags();
  const createTag = useCreateTag();
  const [query, setQuery] = useState('');
  const inputId = useId();

  const selected = tags.filter((tag) => value.includes(tag.id));
  const filtered = tags.filter((tag) =>
    tag.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const canCreate =
    query.trim().length > 0 &&
    !tags.some((tag) => tag.name.toLowerCase() === query.trim().toLowerCase());

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((tagId) => tagId !== id) : [...value, id]);

  const create = async () => {
    try {
      const tag = await createTag.mutateAsync(query.trim());
      onChange([...value, tag.id]);
      setQuery('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create tag');
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {selected.map((tag) => (
        <TagBadge key={tag.id} tag={tag} />
      ))}
      <Popover>
        <PopoverTrigger render={<Button type="button" variant="outline" size="sm" />}>
          <Tags aria-hidden />
          {selected.length ? 'Edit tags' : 'Add tags'}
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <label htmlFor={inputId} className="sr-only">
            Search or create a tag
          </label>
          <Input
            id={inputId}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                if (canCreate) void create();
              }
            }}
            placeholder="Search or create…"
            maxLength={30}
          />
          <ul
            className="mt-2 max-h-48 overflow-y-auto"
            role="listbox"
            aria-multiselectable
            aria-label="Tags"
          >
            {filtered.map((tag) => {
              const isSelected = value.includes(tag.id);
              return (
                <li key={tag.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => toggle(tag.id)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                  >
                    <Check className={cn('size-4', !isSelected && 'invisible')} aria-hidden />
                    <TagBadge tag={tag} />
                  </button>
                </li>
              );
            })}
          </ul>
          {canCreate && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-1 w-full justify-start"
              onClick={() => void create()}
              disabled={createTag.isPending}
            >
              <Plus aria-hidden />
              Create “{query.trim()}”
            </Button>
          )}
          {!canCreate && filtered.length === 0 && (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">
              Type a name to create a tag.
            </p>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
