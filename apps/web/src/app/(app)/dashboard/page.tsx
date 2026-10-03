import { redirect } from 'next/navigation';

// The analytics dashboard arrives in a later phase; until then the board is home.
export default function DashboardPage() {
  redirect('/board');
}
