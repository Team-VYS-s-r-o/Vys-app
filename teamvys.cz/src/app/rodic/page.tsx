import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Rodič',
};

// Rodičovský portál běží výhradně v aplikaci — web nákupy ani správu nenabízí.
export default function ParentDashboardPage() {
  redirect('/aplikace');
}
