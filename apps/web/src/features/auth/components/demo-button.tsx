'use client';

import { useMutation } from '@tanstack/react-query';
import { PlayCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { authApi } from '../api';
import { useAuthProviders, useSetMe } from '../hooks';

/** Signs the visitor in to a fresh demo account; hidden when the server disables demos. */
export function DemoButton({
  size = 'default',
  variant = 'outline',
  className,
}: Pick<React.ComponentProps<typeof Button>, 'size' | 'variant' | 'className'>) {
  const { data: providers } = useAuthProviders();
  const setMe = useSetMe();
  const router = useRouter();
  const start = useMutation({
    mutationFn: authApi.startDemo,
    onSuccess: (user) => {
      setMe(user);
      router.push('/board');
    },
    onError: (error) => toast.error(error.message),
  });

  if (!providers?.demo) return null;

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={className}
      disabled={start.isPending || start.isSuccess}
      onClick={() => start.mutate()}
    >
      <PlayCircle aria-hidden />
      {start.isPending || start.isSuccess ? 'Setting up your demo…' : 'Try the demo'}
    </Button>
  );
}
