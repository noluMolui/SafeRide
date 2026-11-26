import { ArrowLeft, CheckCircle2, Search, ShieldCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { Field } from "../auth/ui";
import { ParentShell } from "./ParentShell";

export function LinkDriver() {
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<{ driver_name: string; driver_phone: string; registration_number: string; make_model: string; route_name: string; direction: "morning" | "afternoon"; departure_time: string; days_of_week: number[]; pdp_expiry_date: string; pdp_verification: string; roadworthy_expiry_date: string; roadworthy_verification: string } | null>(null);
  const [children, setChildren] = useState<{ id: string; full_name: string }[]>([]);
  const [enrollments, setEnrollments] = useState<{ learner_id: string; direction: string; status: string }[]>([]);
  const [childId, setChildId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadChildren() {
      if (!supabase) { if (active) setError("The service is not configured."); return; }
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError || !authData.user) { setError("Please log in to link a route."); return; }
      const [childResult, enrollmentResult] = await Promise.all([
        supabase.from("learners").select("id,full_name").eq("is_active", true).order("full_name"),
        supabase.from("route_enrollments").select("learner_id,direction,status"),
      ]);
      if (!active) return;
      if (childResult.error || enrollmentResult.error) { setError("Could not load your children. Please try again."); return; }
      setChildren(childResult.data ?? []);
      setEnrollments(enrollmentResult.data ?? []);
    }
    void loadChildren();
    return () => { active = false; };
  }, []);

  async function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSent(false);
    setPreview(null);
    setChildId("");
    if (!/^[A-HJ-NP-Z2-9]{8}$/.test(code)) { setError("Enter a valid 8-character invite code."); return; }
    if (!supabase) { setError("The service is not configured."); return; }
    setBusy(true);
    setError("");
    const { data, error: lookupError } = await supabase.rpc("lookup_invite", { code });
    setBusy(false);
    if (lookupError || !data) { setError("Could not look up this code. Please try again."); return; }
    if (data.error === "rate_limited") { setError("Too many attempts. Try again later."); return; }
    if (data.error) { setError("This code isn't valid."); return; }
    setPreview(data);
  }

  async function confirm() {
    if (!supabase || !childId) { setError("Select a child to continue."); return; }
    setBusy(true);
    setError("");
    const { data, error: requestError } = await supabase.rpc("redeem_invite", { code, learner_id: childId });
    setBusy(false);
    if (requestError?.code === "23505") { setError("This child is already linked to a route in that direction."); return; }
    if (requestError || !data) { setError("Could not send your request. Please try again."); return; }
    if (data.error === "rate_limited") { setError("Too many attempts. Try again later."); return; }
    if (data.error) { setError("This code isn't valid."); return; }
    setSent(true);
  }

  return (
    <ParentShell title="Link to a driver">
      <Link className="back-link" to="/parent/children"><ArrowLeft size={18} />Back to children</Link>
      {sent ? <section className="route-request-success"><span><CheckCircle2 size={28} /></span><h2>Request sent</h2><p>Waiting for driver approval.</p><Link className="primary-button" to="/parent/children">View children</Link></section> : <>
        <form className="link-code-form card" onSubmit={lookup}><Field id="invite-code" label="Driver invite code" value={code} maxLength={8} onChange={(event) => { setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")); setPreview(null); }} placeholder="8 characters" /><button className="primary-button" type="submit" disabled={busy}><Search size="18" />{busy ? "Looking up..." : "Look up"}</button></form>
        {error && <p className="field-error" role="alert">{error}</p>}
        {preview && <section className="driver-preview"><div className="driver-preview-header"><div className="learner-avatar">{preview.driver_name.charAt(0)}</div><div><h2>{preview.driver_name}</h2><p>{preview.driver_phone}</p></div><span className="verified-badge"><ShieldCheck size="16" />{preview.pdp_verification}</span></div><div className="driver-preview-grid"><p><span>Vehicle</span><strong>{preview.make_model} · {preview.registration_number}</strong></p><p><span>Route</span><strong>{preview.route_name} · {preview.direction}</strong></p><p><span>Departure</span><strong>{preview.departure_time}</strong></p><p><span>Compliance</span><strong>PrDP {preview.pdp_verification} · Roadworthy {preview.roadworthy_verification}</strong></p><p><span>Expiry dates</span><strong>PrDP {preview.pdp_expiry_date} · Roadworthy {preview.roadworthy_expiry_date}</strong></p></div><label className="field-block"><span className="field-label">Select child</span><select className="input" value={childId} onChange={(event) => setChildId(event.target.value)}><option value="">Select child</option>{children.map((child) => { const conflict = enrollments.some((entry) => entry.learner_id === child.id && entry.direction === preview.direction && entry.status !== "removed"); return <option key={child.id} value={child.id} disabled={conflict}>{child.full_name}{conflict ? " - already linked" : ""}</option>; })}</select></label><button type="button" className="primary-button" onClick={confirm} disabled={busy || !childId}>Confirm request</button></section>}
      </>}
    </ParentShell>
  );
}
