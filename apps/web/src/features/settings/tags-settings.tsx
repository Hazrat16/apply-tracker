'use client';

import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TagBadge } from '@/features/applications/components/tag-badge';
import { useDeleteTag, useTags } from '@/features/tags/hooks';

export function TagsSettings() {
  const { data: tags = [], isPending } = useTags();
  const remove = useDeleteTag();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tags</CardTitle>
        <CardDescription>
          Create tags from any application form. Deleting a tag removes it from every application.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isPending ? null : tags.length === 0 ? (
          <p className="text-sm text-muted-foreground">You haven&apos;t created any tags yet.</p>
        ) : (
          <ul className="divide-y">
            {tags.map((tag) => (
              <li
                key={tag.id}
                className="flex items-center justify-between py-2 first:pt-0 last:pb-0"
              >
                <TagBadge tag={tag} className="text-xs" />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete tag ${tag.name}`}
                  disabled={remove.isPending}
                  onClick={() =>
                    remove.mutate(tag.id, {
                      onSuccess: () => toast.success(`Deleted tag “${tag.name}”`),
                      onError: (error) => toast.error(error.message),
                    })
                  }
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
