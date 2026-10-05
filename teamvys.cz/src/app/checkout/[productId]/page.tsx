import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Stáhněte aplikaci Team VYS',
};

export default function CheckoutPage() {
  redirect('/aplikace');
}