import type { User } from '@apply-tracker/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function ConnectedAccounts({ user }: { user: User }) {
  const google = user.providers.includes('GOOGLE');
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign-in methods</CardTitle>
        <CardDescription>Ways you can sign in to your account.</CardDescription>
      </CardHeader>
      <CardContent className="divide-y">
        <div className="flex items-center justify-between py-3 first:pt-0">
          <span className="text-sm">Email and password</span>
          <Badge variant={user.hasPassword ? 'secondary' : 'outline'}>
            {user.hasPassword ? 'Enabled' : 'Not set'}
          </Badge>
        </div>
        <div className="flex items-center justify-between py-3 last:pb-0">
          <span className="text-sm">Google</span>
          <Badge variant={google ? 'secondary' : 'outline'}>
            {google ? 'Connected' : 'Not connected'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
