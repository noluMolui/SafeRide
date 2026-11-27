import { ArrowRight, ChevronDown, Clock3 } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { ParentShell } from "./ParentShell";

type HistoryEvent = { status: string; logged_at: string };
type Delay = { minutes: number; reason: string; message: string | null; created_at: string };
type Trip = { trip_id: string; trip_date: string; route_name: string; direction: "morning" | "afternoon"; trip_status: string; started_at: string; completed_at: string | null; events: HistoryEvent[]; delays: Delay[] };
type Child = { id: string; full_name: string };

export function ParentTripHistory() {
  const { id } = useParams();
  const [children, setChildren] = useState<Child[]>([]);
  const [childId, setChildId] = useState(id ?? "");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadChildren() {
      if (!supabase) { if (active) { setError("The service is not configured."); setLoading(false); } return; }
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError || !authData.user) { setError("Please log in to view trip history."); setLoading(false); return; }
      const { data, error: queryError } = await supabase.from("learners").select("id,full_name").eq("is_active", true).order("full_name");
      if (!active) return;
      if (queryError) { setError("Could not load your children."); setLoading(false); return; }
      const list = data ?? [];
      setChildren(list);
      if (!list.some((item) => item.id === childId)) setChildId(list[0]?.id ?? "");
    }
    void loadChildren();
    return () => { active = false; };
  }, [childId]);

  useEffect(() => {
    if (!childId || !supabase) { setTrips([]); setLoading(false); return; }
    let active = true;
    async function loadHistory() {
      setLoading(true);
      setError("");
      const { data, error: queryError } = await supabase!.rpc("get_parent_trip_history", { target_learner_id: childId, page_offset: 0, page_size: 20 });
      if (!active) return;
      if (queryError) setError("Could not load trip history.");
      else { const result = (data ?? []) as Trip[]; setTrips(result); setOffset(result.length); setHasMore(result.length === 20); }
      setLoading(false);
    }
    void loadHistory();
    return () => { active = false; };
  }, [childId]);

  async function loadMore() {
    if (!supabase || !childId || loading) return;
    setLoading(true);
    const { data, error: queryError } = await supabase.rpc("get_parent_trip_history", { target_learner_id: childId, page_offset: offset, page_size: 20 });
    if (queryError) setError("Could not load more trip history.");
    else { const result = (data ?? []) as Trip[]; setTrips((current) => [...current, ...result]); setOffset((current) => current + result.length); setHasMore(result.length === 20); }
    setLoading(false);
  }

  return (
    <ParentShell title="Trip history">
      <label className="parent-child-select"><span>Child</span><select value={childId} onChange={(event) => { setTrips([]); setOffset(0); setChildId(event.target.value); }}><option value="">Select child</option>{children.map((child) => <option key={child.id} value={child.id}>{child.full_name}</option>)}</select><ChevronDown size="18" /></label>
      {loading && <p role="status">Loading trip history…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && childId && trips.length === 0 && <p>No trips recorded yet.</p>}
      <section className="parent-history-list">{trips.map((trip) => <article className="parent-history-card" key={trip.trip_id}><div className="parent-history-date"><strong>{new Intl.DateTimeFormat("en-ZA", { day: "2-digit", month: "short", timeZone: "Africa/Johannesburg" }).format(new Date(`${trip.trip_date}T12:00:00`))}</strong><span className={trip.direction}>{trip.direction}</span></div><div><h2>{trip.route_name}</h2><p><Clock3 size="16" />{trip.trip_status} · {new Date(trip.started_at).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg" })}</p>{trip.events.map((event) => <p key={`${event.status}-${event.logged_at}`}>{event.status.replace("_", " ")} · {new Date(event.logged_at).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg" })}</p>)}{trip.delays.map((delay) => <div className="parent-delay" key={delay.created_at}><strong>Delay · {delay.minutes} minutes</strong><span>{delay.reason}{delay.message ? ` · ${delay.message}` : ""}</span></div>)}</div></article>)}</section>
      {hasMore && <button className="secondary-button load-more" type="button" onClick={loadMore} disabled={loading}>Load more <ArrowRight size="18" /></button>}
    </ParentShell>
  );
}
