import { ArrowRight, CalendarDays, ChevronRight, Clock3 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { DriverShell } from "./DriverShell";

type TripSummary = { trip_id: string; trip_date: string; route_name: string; direction: "morning" | "afternoon"; status: string; started_at: string; completed_at: string | null; completed_with_open_learners: boolean; picked_up_count: number; dropped_off_count: number; absent_count: number; no_update_count: number };
type TripDetailData = { trip_id: string; trip_date: string; route_name: string; direction: "morning" | "afternoon"; status: string; started_at: string; completed_at: string | null; completed_with_open_learners: boolean; learners: { learner_id: string; full_name: string; grade: string; logs: { status: string; logged_at: string }[] }[]; delays: { minutes: number; reason: string; message: string | null; created_at: string }[] };

const formatDate = (date: string) => new Intl.DateTimeFormat("en-ZA", { day: "2-digit", month: "short", year: "numeric", timeZone: "Africa/Johannesburg" }).format(new Date(`${date}T12:00:00`));
const formatTime = (value: string | null) => value ? new Date(value).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg" }) : "In progress";

export function TripHistory() {
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      if (!supabase) { if (active) { setError("The service is not configured."); setLoading(false); } return; }
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError || !authData.user) { setError("Please log in to view trip history."); setLoading(false); return; }
      const { data, error: queryError } = await supabase.rpc("get_driver_trip_history", { page_offset: 0, page_size: 20 });
      if (!active) return;
      if (queryError) setError("Could not load trip history. Please retry.");
      else { const result = (data ?? []) as TripSummary[]; setTrips(result); setOffset(result.length); setHasMore(result.length === 20); }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [retry]);

  async function loadMore() {
    if (!supabase || loading) return;
    setLoading(true);
    const { data, error: queryError } = await supabase.rpc("get_driver_trip_history", { page_offset: offset, page_size: 20 });
    if (queryError) setError("Could not load more trip history.");
    else { const result = (data ?? []) as TripSummary[]; setTrips((current) => [...current, ...result]); setOffset((current) => current + result.length); setHasMore(result.length === 20); }
    setLoading(false);
  }

  return (
    <DriverShell title="Trip history">
      <div className="history-toolbar"><p>Trips from the last 90 days.</p><span className="icon-text-button"><CalendarDays size={18} />Last 90 days</span></div>
      {loading && <p role="status">Loading trips…</p>}
      {error && <div role="alert"><p>{error}</p><button className="text-button" type="button" onClick={() => { setLoading(true); setRetry((value) => value + 1); }}>Retry</button></div>}
      {!loading && !error && trips.length === 0 && <p>No trips recorded yet.</p>}
      {!error && <section className="history-list">{trips.map((trip) => <Link className="history-card" key={trip.trip_id} to={`/driver/trips/${trip.trip_id}`}><div className="history-date"><strong>{formatDate(trip.trip_date)}</strong><span>{trip.direction}</span></div><div className="history-copy"><h2>{trip.route_name}</h2><p><Clock3 size={16} />{formatTime(trip.started_at)}–{formatTime(trip.completed_at)} · {trip.status}</p><div className="history-counts"><span className="picked-count">{trip.picked_up_count} picked up</span><span className="dropped-count">{trip.dropped_off_count} dropped off</span><span>{trip.absent_count} absent</span>{trip.no_update_count > 0 && <span>{trip.no_update_count} no update</span>}</div>{trip.completed_with_open_learners && <strong>Completed with learners on board</strong>}</div><ChevronRight size={20} /></Link>)}</section>}
      {hasMore && <button className="secondary-button load-more" type="button" onClick={loadMore} disabled={loading}>Load more <ArrowRight size={18} /></button>}
    </DriverShell>
  );
}

export function TripDetail() {
  const { id } = useParams();
  const [trip, setTrip] = useState<TripDetailData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabase || !id) { setError("The service is not configured."); return; }
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) { if (active) setError("Please log in to view this trip."); return; }
      const { data, error: queryError } = await supabase.rpc("get_driver_trip_detail", { target_trip_id: id });
      if (!active) return;
      if (queryError || !data) setError("Could not load this trip.");
      else setTrip(data as TripDetailData);
    }
    void load();
    return () => { active = false; };
  }, [id]);
  return (
    <DriverShell title="Trip summary">
      {error && <p role="alert">{error}</p>}
      {!trip && !error && <p role="status">Loading trip…</p>}
      {trip && <><div className="trip-detail-card"><span className={`direction-chip ${trip.direction}`}>{trip.direction}</span><h2>{trip.route_name}</h2><p>{formatDate(trip.trip_date)} · {formatTime(trip.started_at)}–{formatTime(trip.completed_at)} · {trip.status}</p>{trip.completed_with_open_learners && <strong>Completed with learners on board</strong>}</div><section className="timeline-list">{trip.learners.map((learner) => <article className="timeline-row" key={learner.learner_id}><span className="learner-avatar">{learner.full_name.charAt(0)}</span><div><strong>{learner.full_name}</strong><p>Grade {learner.grade}</p>{learner.logs.map((log) => <p key={`${log.status}-${log.logged_at}`}>{log.status.replace("_", " ")} · {formatTime(log.logged_at)}</p>)}</div></article>)}</section>{trip.delays.map((delay) => <div className="parent-delay" key={delay.created_at}><strong>Delay · {delay.minutes} minutes</strong><span>{delay.reason}{delay.message ? ` · ${delay.message}` : ""}</span></div>)}</>}
    </DriverShell>
  );
}
