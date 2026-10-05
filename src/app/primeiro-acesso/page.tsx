"use client";
import { PasswordDialog } from "@/components/password-dialog";

export default function FirstAccessPage() {
  return <main className="login-shell"><section className="login-side"><div className="login-form-wrap"><p className="eyebrow">PRIMEIRO ACESSO</p><h1>Proteja sua conta</h1><p className="login-sub">Cadastre uma senha pessoal para continuar.</p></div></section><PasswordDialog open required onClose={() => undefined} /></main>;
}
