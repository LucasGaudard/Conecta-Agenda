import { Suspense } from "react";
import type { Metadata } from "next";
import { PasswordRecovery } from "@/components/auth/password-recovery";

export const metadata: Metadata = {
  title: "Redefinir senha | Conecta Agenda",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<p className="p-8">Carregando...</p>}>
      <PasswordRecovery mode="reset" />
    </Suspense>
  );
}
