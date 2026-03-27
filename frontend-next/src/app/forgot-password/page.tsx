// filepath: frontend-next/src/app/forgot-password/page.tsx
import ResetPassword from '@/components/ResetPassword';

export const metadata = {
  title: 'Recuperar Senha | ClinNext',
  description: 'Recupere acesso à sua conta ClinNext com um código de reset',
};

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen">
      <ResetPassword />
    </main>
  );
}
