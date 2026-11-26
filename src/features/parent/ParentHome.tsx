import { AlertTriangle, ArrowRight, BusFront, Clock3, Plus, Route } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { ParentShell } from "./ParentShell";

type FeedRow = {
  learner_id: string;
  learner_name: string;
  school_name: string;
  grade: string;
  route_id: string | null;
  route_name: string | null;
  direction: "morning" | "afternoon" | null;
  departure_time: string | null;
  enrollment_status: "pending" | "active" | null;
  driver_name: string | null;
  driver_phone: string | null;
  pdp_verification: string | null;
  roadworthy_verification: string | null;
  trip_id: string | null;
  trip_status: "active" | "completed" | "cancelled" | null;
  trip_started_at: string | null;
  last_log_status: "picked_up" | "dropped_off" | "absent" | null;
  last_log_at: string | null;
  delay_minutes: number | null;
  delay_reason: string | null;
  delay_message: string | null;
};

function statusLabel(row: FeedRow) {
  if (!row.route_id) return "No route linked";
  if (row.enrollment_status === "pending") return "Waiting for driver approval";
  if (row.trip_status === "cancelled") return "Trip cancelled";
  if (row.last_log_status) {
    const label = row.last_log_status.replace("_", " ").replace(/^\w/, (letter) => letter.toUpperCase());
    const time = row.last_log_at ? new Date(row.last_log_at).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg" }) : "";
    return time ? `${label} · ${time}` : label;
  }
  return row.trip_status === "active" ? "Trip started · No update" : "Not started";
}

export function ParentHome() {
  const [rows, setRows] = useState<FeedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    async function refresh() {
      if (!supabase) { if (active) { setError("Supabase is not configured in this deployment."); setLoading(false); } return; }
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError || !authData.user) { setError("Please log in to view your children's trip status."); setLoading(false); return; }
      const { data, error: queryError } = await supabase.rpc("get_parent_home");
      if (!active) return;
      if (queryError) setError("Could not load trip status. Please retry.");
      else { setRows((data ?? []) as FeedRow[]); setError(""); setUpdatedAt(new Date()); }
      setLoading(false);
    }
    void refresh();
    const interval = window.setInterval(() => { void refresh(); }, 15_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [retry]);

  const grouped = [...rows.reduce((map, row) => {
    const current = map.get(row.learner_id) ?? [];
    current.push(row);
    map.set(row.learner_id, current);
    return map;
  }, new Map<string, FeedRow[]>()).values()];

  return (
    <ParentShell title="Today's trip status">
      <div className="parent-status-bar"><span>{new Intl.DateTimeFormat("en-ZA", { dateStyle: "full", timeZone: "Africa/Johannesburg" }).format(new Date())}</span><span>{updatedAt ? `Updated ${updatedAt.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} · refreshes every 15s` : "Connecting…"}</span></div>
      <section className="parent-actions"><Link className="icon-text-button" to="/parent/children/new"><Plus size={18} />Add child</Link><Link className="icon-text-button filled" to="/parent/link"><Route size={18} />Link to a driver</Link></section>
      {loading && <p role="status">Loading children's status…</p>}
      {error && <div role="alert"><p>{error}</p><button className="text-button" type="button" onClick={() => { setLoading(true); setRetry((value) => value + 1); }}>Retry</button></div>}
      {!loading && !error && grouped.length === 0 && <section className="empty-parent-state"><h2>No children added yet</h2><p>Add a child profile, then link it to a driver's route.</p><Link className="primary-button" to="/parent/children/new">Add child</Link></section>}
      {!loading && !error && grouped.map((childRows) => {
        const first = childRows[0]!;
        return <section className="child-status-card" key={first.learner_id}>
          <div className="child-status-header"><div className="learner-avatar">{first.learner_name.charAt(0)}</div><div><h2>{first.learner_name}</h2><p>{first.school_name} · Grade {first.grade}</p></div></div>
          {childRows.filter((row) => row.route_id).map((row) => <article className="parent-trip-grid" key={`${row.learner_id}-${row.direction}`}><div><span className={`direction-chip ${row.direction}`}>{row.direction}</span><h3>{row.route_name}</h3>{row.driver_name && <p><BusFront size={16} />{row.driver_phone ? <a href={`tel:${row.driver_phone}`}>{row.driver_name} · {row.driver_phone}</a> : row.driver_name}</p>}<span className="status-pill waiting">{statusLabel(row)}</span>{row.pdp_verification && <span className="compliance-mini"><span>PrDP {row.pdp_verification}</span><span>Roadworthy {row.roadworthy_verification}</span></span>}{row.delay_minutes && <div className="delay-banner"><AlertTriangle size={18} /><p><strong>Delay · {row.delay_minutes} minutes</strong><span>{row.delay_reason}{row.delay_message ? ` · ${row.delay_message}` : ""}</span></p></div>}</div><div className="parent-trip-actions"><span><Clock3 size={16} />Departure {row.departure_time}</span><Link className="history-link" to={`/parent/children/${row.learner_id}/history`}>History <ArrowRight size={18} /></Link></div></article>)}
          {childRows.every((row) => !row.route_id) && <div className="empty-route-state"><p>No route linked yet.</p><Link to="/parent/link">Link to a driver <ArrowRight size={16} /></Link></div>}
        </section>;
      })}
    </ParentShell>
  );
}
