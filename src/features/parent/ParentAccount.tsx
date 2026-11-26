import { LockKeyhole, LogOut, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Field } from "../auth/ui";
import { normalizeSouthAfricanPhone } from "../auth/validation";
import { supabase } from "../../lib/supabase";
import { ParentShell } from "./ParentShell";

type ParentProfile = { id: string; full_name: string; phone_e164: string };

export function ParentAccount() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ParentProfile | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setMessage("");
      if (!supabase) {
        if (active) { setMessage("The service is not configured."); setLoading(false); }
        return;
      }
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError || !authData.user) {
        setMessage("Please log in to view your account.");
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.from("profiles")
        .select("id,full_name,phone_e164")
        .eq("id", authData.user.id)
        .maybeSingle();
      if (!active) return;
      if (error || !data) setMessage("Could not load your account details.");
      else {
        const loadedProfile = data as ParentProfile;
        setProfile(loadedProfile);
        setName(loadedProfile.full_name);
        setPhone(loadedProfile.phone_e164);
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [retry]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !profile) return;
    const cleanName = name.trim();
    const cleanPhone = normalizeSouthAfricanPhone(phone);
    if (cleanName.length < 2 || cleanName.length > 100) {
      setMessage("Enter a name between 2 and 100 characters.");
      return;
    }
    if (!/^\\+27[6-8]\\d{8}$/.test(cleanPhone)) {
      setMessage("Enter a valid South African mobile number.");
      return;
    }
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase.from("profiles")
      .update({ full_name: cleanName, phone_e164: cleanPhone })
      .eq("id", profile.id)
      .select("id,full_name,phone_e164")
      .maybeSingle();
    setBusy(false);
    if (error || !data) {
      setMessage("Could not save your profile. Please try again.");
      return;
    }
    const savedProfile = data as ParentProfile;
    setProfile(savedProfile);
    setName(savedProfile.full_name);
    setPhone(savedProfile.phone_e164);
    setMessage("Profile updated.");
  }

  async function logOut() {
    if (!supabase) { setMessage("The service is not configured."); return; }
    setBusy(true);
    const { error } = await supabase.auth.signOut();
    setBusy(false);
    if (error) { setMessage("Could not log out. Please try again."); return; }
    navigate("/login", { replace: true });
  }

  return (
    <ParentShell title="Account">
      {loading && <p role="status">Loading account details…</p>}
      {message && <div role="alert" className="form-message">{message}{!profile && !loading && <button className="text-button" type="button" onClick={() => setRetry((current) => current + 1)}>Retry</button>}</div>}
      {profile && <>
        <form className="parent-account-form card form-stack" onSubmit={submit}>
          <Field id="parent-name" label="Full name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} />
          <Field id="parent-phone" label="Mobile phone" type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
          <button className="primary-button" type="submit" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button>
        </form>
        <section className="parent-settings-card"><h2>Privacy</h2><a href="#privacy"><LockKeyhole size={18} />Read the POPIA privacy notice</a></section>
        <section className="danger-zone"><div><h2>Account actions</h2><p>Log out or contact support to request permanent account deletion.</p></div><div className="danger-actions"><button className="secondary-button" type="button" onClick={logOut} disabled={busy}><LogOut size={18} />Log out</button><button type="button" className="delete-button" onClick={() => setMessage("Account deletion is not enabled yet. Contact support to request removal of your data.")}><Trash2 size={18} />Delete account</button></div></section>
      </>}
    </ParentShell>
  );
}
