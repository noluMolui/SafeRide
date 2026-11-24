import { ArrowLeft, Check, Copy, Phone, RotateCw, Share2, TriangleAlert, UsersRound } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DriverShell } from "./DriverShell";

const learners = [
  { name: "Lethabo Mokoena", grade: "Grade 6", stop: "Cedar Road", flag: true },
  { name: "Amahle Khumalo", grade: "Grade 4", stop: "Montecasino Boulevard", flag: false },
  { name: "Ruan van Wyk", grade: "Grade 7", stop: "Fourways Gardens", flag: false },
];

export function RouteRoster() {
  const { id } = useParams();
  const [code, setCode] = useState("FWY7K2P9");
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(["Thando Mthembu", "Zanele Dube"]);

  async function copyCode() {
    await navigator.clipboard?.writeText(code).catch(() => undefined);
    setCopied(true);
  }

  return (
    <DriverShell title="Route roster">
      <Link className="back-link" to="/driver/routes"><ArrowLeft size={18} />Back to routes</Link>
      <div className="roster-summary"><div><span className="direction-chip morning">Morning</span><h2>Fourways to Crawford</h2><p>07:15 · Monday to Friday · CA 123-456</p></div><Link className="secondary-button small-secondary" to={`/driver/routes/${id}/edit`}>Edit route</Link></div>
      <section className="invite-card"><div><span className="invite-label">Invite code</span><strong>{code}</strong></div><div className="invite-actions"><button type="button" onClick={copyCode}><Copy size={18} />{copied ? "Copied" : "Copy"}</button><button type="button"><Share2 size={18} />Share</button><button type="button" aria-label="Regenerate invite code" onClick={() => setCode("FWY" + Math.random().toString(36).slice(2, 7).toUpperCase())}><RotateCw size={18} /></button></div></section>
      <section className="roster-section"><div className="roster-heading"><h2>Pending requests</h2><span className="count-chip">{pending.length}</span></div>{pending.length ? pending.map((name) => <article className="pending-row" key={name}><span className="learner-avatar">{name.charAt(0)}</span><div><strong>{name}</strong><p>Parent request · Grade 5</p></div><div className="pending-actions"><button type="button" aria-label={`Approve ${name}`} onClick={() => setPending((current) => current.filter((item) => item !== name))}><Check size={18} />Approve</button><button type="button" aria-label={`Reject ${name}`} onClick={() => setPending((current) => current.filter((item) => item !== name))}>Reject</button></div></article>) : <p className="empty-row">No pending requests.</p>}</section>
      <section className="roster-section"><div className="roster-heading"><h2>Active roster</h2><span className="count-chip"><UsersRound size={16} />3 / 14</span></div>{learners.map((learner, index) => <article className="learner-row" key={learner.name}><span className="stop-number">{index + 1}</span><div className="learner-info"><strong>{learner.name}</strong><p>{learner.grade} · {learner.stop}</p></div>{learner.flag && <span className="medical-icon" title="Medical or allergy information"><TriangleAlert size={18} /></span>}<a href="tel:+27821234567" aria-label={`Call ${learner.name}'s parent`}><Phone size={18} /></a></article>)}</section>
    </DriverShell>
  );
}
