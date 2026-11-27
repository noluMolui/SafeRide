import { ArrowLeft, Check, Copy, Phone, RotateCw, Share2, TriangleAlert, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { DriverShell } from "./DriverShell";

type RouteDetails = { id: string; name: string; direction: "morning" | "afternoon"; departure_time: string; invite_active: boolean; vehicle_id: string };
type PendingRequest = { enrollment_id: string; first_name: string; grade: string; school_name: string; parent_name: string };
type ActiveEnrollment = { id: string; learner_id: string; stop_sequence: number | null };
type Learner = { id: string; full_name: string; grade: string; school_name: string; home_address: string; school_address: string; emergency_contact_name: string; emergency_contact_phone: string; medical_notes: string | null; allergy_notes: string | null };

export function RouteRoster() {
  const { id } = useParams();
  const [route, setRoute] = useState<RouteDetails | null>(null);
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [activeEnrollments, setActiveEnrollments] = useState<ActiveEnrollment[]>([]);
  const [learners, setLearners] = useState<Learner[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      if (!supabase || !id) { if (active) { setError("The service is not configured."); setLoading(false); } return; }
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError || !authData.user) { setError("Please log in to view this route."); setLoading(false); return; }
      const [routeResult, codeResult, pendingResult, enrollmentResult] = await Promise.all([
        supabase.from("routes").select("id,name,direction,departure_time,invite_active,vehicle_id").eq("id", id).maybeSingle(),
        supabase.rpc("get_route_invite_code", { route_id: id }),
        supabase.rpc("get_pending_requests", { target_route_id: id }),
        supabase.from("route_enrollments").select("id,learner_id,stop_sequence").eq("route_id", id).eq("status", "active").order("stop_sequence", { nullsFirst: false }),
      ]);
      if (!active) return;
      if (routeResult.error || !routeResult.data || codeResult.error || pendingResult.error || enrollmentResult.error) {
        setError("Could not load this route. Please try again."); setLoading(false); return;
      }
      const activeRows: ActiveEnrollment[] = enrollmentResult.data ?? [];
      const learnerResult = activeRows.length
        ? await supabase.from("learners").select("id,full_name,grade,school_name,home_address,school_address,emergency_contact_name,emergency_contact_phone,medical_notes,allergy_notes").in("id", activeRows.map((entry) => entry.learner_id))
        : { data: [], error: null };
      if (!active) return;
      if (learnerResult.error) { setError("Could not load the roster. Please try again."); setLoading(false); return; }
      setRoute(routeResult.data);
      setCode(codeResult.data ?? "");
      setPending(pendingResult.data ?? []);
      setActiveEnrollments(activeRows);
      setLearners(learnerResult.data ?? []);
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [id, version]);

  async function copyCode() {
    try { await navigator.clipboard.writeText(code); setCopied(true); }
    catch { setError("Could not copy the invite code."); }
  }

  async function decide(enrollmentId: string, decision: "approve" | "reject" | "remove") {
    if (!supabase) return;
    setBusy(true);
    setError("");
    const { error: requestError } = await supabase.rpc("decide_enrollment", { enrollment_id: enrollmentId, decision });
    setBusy(false);
    if (requestError) { setError(requestError.message.includes("route_full") ? "This route is full." : "Could not update this request. Please try again."); return; }
    setVersion((current) => current + 1);
  }

  async function regenerate() {
    if (!supabase || !id) return;
    setBusy(true);
    const { data, error: requestError } = await supabase.rpc("regenerate_invite", { route_id: id });
    setBusy(false);
    if (requestError || !data) { setError("Could not regenerate the invite code."); return; }
    setCode(data);
    setCopied(false);
  }

  async function toggleInvite() {
    if (!supabase || !id || !route) return;
    setBusy(true);
    const { data, error: requestError } = await supabase.from("routes").update({ invite_active: !route.invite_active }).eq("id", id).select("id").maybeSingle();
    setBusy(false);
    if (requestError || !data) { setError("Could not update the invite."); return; }
    setRoute({ ...route, invite_active: !route.invite_active });
  }

  return (
    <DriverShell title="Route roster">
      <Link className="back-link" to="/driver/routes"><ArrowLeft size={18} />Back to routes</Link>
      {loading && <p role="status">Loading route...</p>}
      {error && <p className="form-message" role="alert">{error}</p>}
      {!loading && route && <>
      <div className="roster-summary"><div><span className={`direction-chip ${route.direction}`}>{route.direction === "morning" ? "Morning" : "Afternoon"}</span><h2>{route.name}</h2><p>{route.departure_time.slice(0, 5)}</p></div><Link className="secondary-button small-secondary" to={`/driver/routes/${id}/edit`}>Edit route</Link></div>
      <section className="invite-card"><div><span className="invite-label">Invite code</span><strong>{code}</strong><label><input type="checkbox" checked={route.invite_active} onChange={toggleInvite} disabled={busy} /> Invite active</label></div><div className="invite-actions"><button type="button" onClick={copyCode} disabled={!code}><Copy size={18} />{copied ? "Copied" : "Copy"}</button><a href={`https://wa.me/?text=${encodeURIComponent(`${window.location.origin}/join/${code}`)}`} target="_blank" rel="noreferrer" className="secondary-button small-secondary"><Share2 size={18} />Share</a><button type="button" aria-label="Regenerate invite code" title="Regenerate invite code" disabled={busy} onClick={regenerate}><RotateCw size={18} /></button></div></section>
      <section className="roster-section"><div className="roster-heading"><h2>Pending requests</h2><span className="count-chip">{pending.length}</span></div>{pending.length ? pending.map((request) => <article className="pending-row" key={request.enrollment_id}><span className="learner-avatar">{request.first_name.charAt(0)}</span><div><strong>{request.first_name}</strong><p>{request.school_name} · Grade {request.grade} · {request.parent_name}</p></div><div className="pending-actions"><button type="button" aria-label={`Approve ${request.first_name}`} disabled={busy} onClick={() => decide(request.enrollment_id, "approve")}><Check size={18} />Approve</button><button type="button" aria-label={`Reject ${request.first_name}`} disabled={busy} onClick={() => decide(request.enrollment_id, "reject")}>Reject</button></div></article>) : <p className="empty-row">No pending requests.</p>}</section>
      <section className="roster-section"><div className="roster-heading"><h2>Active roster</h2><span className="count-chip"><UsersRound size={16} />{activeEnrollments.length}</span></div>{activeEnrollments.map((entry, index) => { const learner = learners.find((item) => item.id === entry.learner_id); return learner ? <article className="learner-row" key={entry.id}><span className="stop-number">{entry.stop_sequence ?? index + 1}</span><div className="learner-info"><strong>{learner.full_name}</strong><p>Grade {learner.grade} · {learner.school_name}</p><p>{route.direction === "morning" ? learner.home_address : learner.school_address}</p></div>{(learner.medical_notes || learner.allergy_notes) && <span className="medical-icon" title="Medical or allergy information"><TriangleAlert size={18} /></span>}<a href={`tel:${learner.emergency_contact_phone}`} aria-label={`Call ${learner.emergency_contact_name}`}><Phone size={18} /></a><button type="button" className="text-button" disabled={busy} onClick={() => decide(entry.id, "remove")}>Remove</button></article> : null; })}{activeEnrollments.length === 0 && <p className="empty-row">No learners yet.</p>}</section>
      </>}
    </DriverShell>
  );
}
