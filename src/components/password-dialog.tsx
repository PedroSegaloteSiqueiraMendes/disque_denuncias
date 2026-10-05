"use client";
import { useState } from "react";
import { KeyRound } from "lucide-react";

export function PasswordDialog({ open, onClose, required = false }: { open: boolean; onClose: () => void; required?: boolean }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [notice, setNotice] = useState("");
  const [done, setDone] = useState(false);
  const [redirect, setRedirect] = useState("/cliente/dashboard");
  const [busy, setBusy] = useState(false);
  if (!open) return null;
  const close = () => { if (required) { if (done) window.location.replace(redirect); return; } setCurrent(""); setNext(""); setConfirm(""); setNotice(""); setDone(false); onClose(); };
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setNotice("");
    if (next !== confirm) { setNotice("A confirmação não confere com a nova senha."); return; }
    if (next.length < 12) { setNotice("A nova senha precisa ter ao menos 12 caracteres."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ currentPassword: current, newPassword: next }) });
      const body = await response.json();
      if (!response.ok) { setNotice(body.error ?? "Não foi possível trocar a senha."); return; }
      setRedirect(body.redirect ?? "/cliente/dashboard"); setDone(true); setCurrent(""); setNext(""); setConfirm("");
    } catch { setNotice("Falha de conexão. Tente novamente."); }
    finally { setBusy(false); }
  }
  return <div className="modal-backdrop" onClick={close}><form className="admin-modal" onSubmit={submit} onClick={e => e.stopPropagation()}>
    <p className="eyebrow">SEGURANÇA DA CONTA</p>
    <h2>{required ? "Crie sua nova senha" : "Trocar senha"}</h2>
    {required && <p className="modal-notice">No primeiro acesso, é necessário cadastrar uma nova senha para continuar.</p>}
    {done
      ? <>
          <p className="save-success">Senha alterada com sucesso.</p>
          <p className="modal-notice">Guarde a nova senha no seu gerenciador. Sua sessão atual continua válida.</p>
          <div className="modal-actions"><button type="button" className="button button-primary" onClick={close}>Fechar</button></div>
        </>
      : <>
          <label>Senha atual<input required type="password" autoComplete="current-password" maxLength={200} value={current} onChange={e => setCurrent(e.target.value)} /></label>
          <label>Nova senha<input required type="password" autoComplete="new-password" minLength={12} maxLength={200} value={next} onChange={e => setNext(e.target.value)} /></label>
          <label>Confirmar nova senha<input required type="password" autoComplete="new-password" minLength={12} maxLength={200} value={confirm} onChange={e => setConfirm(e.target.value)} /></label>
          <p className="modal-notice">Mínimo de 12 caracteres. Evite reaproveitar senha de outro sistema.</p>
          {notice && <p className="form-error">{notice}</p>}
          <div className="modal-actions">
            {!required && <button type="button" className="button button-quiet" onClick={close}>Cancelar</button>}
            <button type="submit" className="button button-primary" disabled={busy}><KeyRound size={15} /> {busy ? "Salvando…" : "Trocar senha"}</button>
          </div>
        </>}
  </form></div>;
}
