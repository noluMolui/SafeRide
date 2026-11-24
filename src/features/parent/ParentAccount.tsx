import { LockKeyhole, LogOut, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Field } from "../auth/ui";
import { ParentShell } from "./ParentShell";

export function ParentAccount() {
  const [message, setMessage] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Profile updated in this frontend preview.");
  }

  return (
    <ParentShell title="Account">
      <form className="parent-account-form card form-stack" onSubmit={submit}>
        <Field id="parent-name" label="Full name" defaultValue="Naledi Mokoena" autoComplete="name" />
        <Field id="parent-phone" label="Mobile phone" type="tel" defaultValue="082 123 4567" autoComplete="tel" />
        <button className="primary-button" type="submit">Save profile</button>
        {message && <p className="form-message" role="status">{message}</p>}
      </form>
      <section className="parent-settings-card"><h2>Privacy</h2><a href="#privacy"><LockKeyhole size={18} />Read the POPIA privacy notice</a></section>
      <section className="danger-zone"><div><h2>Account actions</h2><p>Log out or permanently remove all account data.</p></div><div className="danger-actions"><Link className="secondary-button" to="/login"><LogOut size={18} />Log out</Link><button type="button" className="delete-button" onClick={() => setConfirmDelete(true)}><Trash2 size={18} />Delete account</button></div></section>
      {confirmDelete && <div className="confirm-panel" role="alertdialog" aria-modal="true"><h2>Delete SafeRide account?</h2><p>This preview cannot delete a real account. A live account deletion will remove your profile, children, route links, trip history and fee records.</p><div><button type="button" className="secondary-button" onClick={() => setConfirmDelete(false)}>Cancel</button><button type="button" className="delete-button" onClick={() => setConfirmDelete(false)}>Confirm delete</button></div></div>}
    </ParentShell>
  );
}
