import { AlertTriangle, ArrowLeft, Check, Clock3, MoreVertical, UserRoundCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { DriverShell } from "./DriverShell";

type Status = "picked_up" | "dropped_off" | "absent";
type Log = { id: string; status: Status; logged_at: string };
type Learner = { learner_id: string; full_name: string; grade: string; logs: Log[] };
type Trip = { trip_id: string; route_name: string; direction: "morning" | "afternoon"; status: string; started_at: string; completed_at: string | null; completed_with_open_learners: boolean; learners: Learner[]; delays: { minutes: number; reason: string; message: string | null; created_at: string }[] };
type DelayReason = "traffic" | "vehicle_issue" | "weather" | "school_delay" | "other";
const formatTime = (value: string) => new Date(value).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg" });

export function ActiveTrip() {
  const { tripId } = useParams();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingLearner, setSavingLearner] = useState("");
  const [error, setError] = useState("");
  const [delayOpen, setDelayOpen] = useState(false);
  const [delayMinutes, setDelayMinutes] = useState(10);
  const [delayReason, setDelayReason] = useState<DelayReason>("traffic");
  const [delayMessage, setDelayMessage] = useState("");
  const [forceComplete, setForceComplete] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const learners = trip?.learners ?? [];
  const updatedCount = learners.filter((learner) => learner.logs.length > 0).length;

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      if (!supabase || !tripId) { if (active) { setError("The service is not configured."); setLoading(false); } return; }
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError || !authData.user) { setError("Please log in to view this trip."); setLoading(false); return; }
      const { data, error: tripError } = await supabase.rpc("get_driver_trip_detail", { target_trip_id: tripId });
      if (!active) return;
      if (tripError || !data) setError("Could not load this trip.");
      else setTrip(data as Trip);
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [tripId, refresh]);

  async function setStatus(learnerId: string, status: Status) {
    if (!supabase || !trip) return;
    setSavingLearner(learnerId);
    setError("");
    const { error: saveError } = await supabase.rpc("log_trip_event", {
      event_id: crypto.randomUUID(), trip_id: trip.trip_id, learner_id: learnerId, event_status: status, event_time: new Date().toISOString(),
    });
    setSavingLearner("");
    if (saveError) { setError("Could not save this check-in. Please retry."); return; }
    setRefresh((value) => value + 1);
  }

  async function undo(learner: Learner) {
    if (!supabase || !trip || !learner.logs.length) return;
    const last = learner.logs[learner.logs.length - 1]!;
    setSavingLearner(learner.learner_id);
    const { error: undoError } = await supabase.rpc("void_trip_log", { log_id: last.id });
    setSavingLearner("");
    if (undoError) { setError("Undo is only available for the latest check-in within five minutes."); return; }
    setRefresh((value) => value + 1);
  }

  async function sendDelay(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !trip) return;
    setSavingLearner("delay");
    const { error: delayError } = await supabase.rpc("send_delay_notice", { trip_id: trip.trip_id, minutes: delayMinutes, reason: delayReason, message: delayMessage || null });
    setSavingLearner("");
    if (delayError) { setError("Could not send delay notice. A trip can have up to five notices."); return; }
    setDelayOpen(false);
    setDelayMessage("");
    setRefresh((value) => value + 1);
  }

  async function completeTrip(force: boolean) {
    if (!supabase || !trip) return;
    const { error: completeError } = await supabase.rpc("complete_trip", { trip_id: trip.trip_id, force });
    if (completeError) {
      if (completeError.message.includes("learners_still_on_board")) setForceComplete(true);
      else setError("Could not complete the trip.");
      return;
    }
    setForceComplete(false);
    setRefresh((value) => value + 1);
  }

  async function cancelTrip() {
    if (!supabase || !trip) return;
    const { error: cancelError } = await supabase.rpc("cancel_trip", { trip_id: trip.trip_id });
    if (cancelError) setError("Could not cancel this trip.");
    else setRefresh((value) => value + 1);
  }

  return (
    <DriverShell title="Active trip">
      <Link className="back-link" to="/driver/dashboard"><ArrowLeft size={18} />Back to dashboard</Link>
      {loading && <p role="status">Loading trip…</p>}
      {error && <p role="alert" className="form-message">{error}</p>}
      {trip && <>
        <section className="trip-header"><div><span className={`direction-chip ${trip.direction}`}>{trip.direction}</span><h2>{trip.route_name}</h2><p>Started {formatTime(trip.started_at)} · {trip.status}</p></div><button type="button" aria-label="Cancel trip" title="Cancel trip" onClick={cancelTrip}><MoreVertical size={20} /></button></section>
        {trip.status === "active" && <><div className="trip-progress"><div><strong>{updatedCount} of {learners.length}</strong><span>Learners updated</span></div><div className="progress-track"><span style={{ width: `${learners.length ? (updatedCount / learners.length) * 100 : 0}%` }} /></div><span className="online-chip"><i />Online</span></div>
        <button className="delay-button" type="button" onClick={() => setDelayOpen(true)}><Clock3 size={18} />Send delay notice</button>
        {trip.delays.map((delay) => <p className="parent-delay" key={delay.created_at}>Delay {delay.minutes} min · {delay.reason}{delay.message ? ` · ${delay.message}` : ""}</p>)}
        <section className="checkin-list">{learners.map((learner) => {
          const current = learner.logs[learner.logs.length - 1];
          const status = current?.status;
          const terminal = status === "dropped_off" || status === "absent";
          const undoAvailable = current && Date.now() - new Date(current.logged_at).getTime() <= 5 * 60_000;
          return <article className="checkin-row" key={learner.learner_id}><span className="learner-avatar">{learner.full_name.charAt(0)}</span><div className="checkin-copy"><strong>{learner.full_name}</strong><p>Grade {learner.grade}</p>{status && <p>{status.replace("_", " ")} · {formatTime(current.logged_at)}</p>}{undoAvailable && <button className="text-button" type="button" disabled={savingLearner === learner.learner_id} onClick={() => undo(learner)}>Undo</button>}</div><div className="checkin-actions"><button type="button" className={status === "picked_up" ? "selected picked" : ""} disabled={Boolean(status) || Boolean(savingLearner)} onClick={() => setStatus(learner.learner_id, "picked_up")}><UserRoundCheck size={16} /><span>Picked Up</span></button><button type="button" className={status === "dropped_off" ? "selected dropped" : ""} disabled={status !== "picked_up" || Boolean(savingLearner)} onClick={() => setStatus(learner.learner_id, "dropped_off")}><Check size={16} /><span>Dropped Off</span></button><button type="button" className={status === "absent" ? "selected absent" : ""} disabled={Boolean(status) || Boolean(savingLearner)} onClick={() => setStatus(learner.learner_id, "absent")}><AlertTriangle size={16} /><span>Absent</span></button>{terminal && <span className="sr-only">Completed check-in</span>}</div></article>;
        })}</section><button className="primary-button complete-trip" type="button" onClick={() => completeTrip(false)}>Complete trip</button>
        {forceComplete && <div className="confirm-panel" role="alertdialog" aria-modal="true"><h2>Learners are still on board</h2><p>Complete anyway and mark the trip as completed with learners aboard?</p><div><button type="button" className="secondary-button" onClick={() => setForceComplete(false)}>Keep trip active</button><button type="button" className="delete-button" onClick={() => completeTrip(true)}>Force complete</button></div></div>}
        {delayOpen && <div className="confirm-panel" role="dialog" aria-modal="true"><form onSubmit={sendDelay}><h2>Send delay notice</h2><label className="field-block"><span className="field-label">Minutes</span><select className="input" value={delayMinutes} onChange={(event) => setDelayMinutes(Number(event.target.value))}>{[5,10,15,20,30,45,60].map((value) => <option key={value} value={value}>{value} minutes</option>)}</select></label><label className="field-block"><span className="field-label">Reason</span><select className="input" value={delayReason} onChange={(event) => setDelayReason(event.target.value as DelayReason)}>{[["traffic","Traffic"],["vehicle_issue","Vehicle issue"],["weather","Weather"],["school_delay","School delay"],["other","Other"]].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="field-block"><span className="field-label">Message (optional)</span><textarea className="input fee-note" maxLength={140} value={delayMessage} onChange={(event) => setDelayMessage(event.target.value)} /></label><div><button type="button" className="secondary-button" onClick={() => setDelayOpen(false)}>Cancel</button><button type="submit" className="primary-button" disabled={savingLearner === "delay"}>Send</button></div></form></div>}
        </>}
        {trip.status !== "active" && <p className="form-message">Trip {trip.status}{trip.completed_with_open_learners ? " · completed with learners on board" : ""}.</p>}
      </>}
    </DriverShell>
  );
}
