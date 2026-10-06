'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Laptop, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { authApi } from '@/features/auth/api';
import { timeAgo } from '@/features/applications/format';
import { describeDevice } from './device-name';

const sessionsKey = ['auth', 'sessions'] as const;

export function SessionsSettings() {
  const queryClient = useQueryClient();
  const { data: sessions = [], isPending } = useQuery({
    queryKey: sessionsKey,
    queryFn: ({ signal }) => authApi.sessions(signal),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: sessionsKey });
  const revoke = useMutation({ mutationFn: authApi.revokeSession, onSuccess: refresh });
  const revokeOthers = useMutation({ mutationFn: authApi.revokeOtherSessions, onSuccess: refresh });
  const others = sessions.filter((session) => !session.current);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Where you&apos;re signed in</CardTitle>
        <CardDescription>
          Sign out devices you don&apos;t recognise or no longer use. They are signed out
          immediately.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isPending ? null : (
          <ul className="divide-y">
            {sessions.map((session) => (
              <li key={session.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                <Laptop className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <span className="truncate">{describeDevice(session.userAgent)}</span>
                    {session.current && <Badge variant="secondary">This device</Badge>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {session.current ? 'Active now' : `Last active ${timeAgo(session.lastUsedAt)}`}
                    {session.ipAddress ? ` · ${session.ipAddress}` : ''}
                  </p>
                </div>
                {!session.current && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={revoke.isPending}
                    aria-label={`Sign out ${describeDevice(session.userAgent)}`}
                    onClick={() =>
                      revoke.mutate(session.id, {
                        onSuccess: () => toast.success('Signed out that device'),
                        onError: (error) => toast.error(error.message),
                      })
                    }
                  >
                    Sign out
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {others.length > 1 && (
          <Button
            variant="outline"
            size="sm"
            disabled={revokeOthers.isPending}
            onClick={() =>
              revokeOthers.mutate(undefined, {
                onSuccess: () => toast.success('Signed out all other devices'),
                onError: (error) => toast.error(error.message),
              })
            }
          >
            <LogOut aria-hidden />
            Sign out all other devices
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
