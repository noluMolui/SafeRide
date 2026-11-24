import { AlertTriangle, ArrowLeft, Check, Clock3, MoreVertical, UserRoundCheck } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { DriverShell } from "./DriverShell";

type Status = "waiting" | "picked_up" | "dropped_off" | "absent";
const initial = [
  { name: "Lethabo Mokoena", grade: "Grade 6", status: "picked_up" as Status },
  { name: "Amahle Khumalo", grade: "Grade 4", status: "waiting" as Status },
  { name: "Ruan van Wyk", grade: "Grade 7", status: "absent" as Status },
  { name: "Thando Mthembu", grade: "Grade 5", status: "waiting" as Status },
];

export function ActiveTrip() {
  const [learners, setLearners] = useState(initial);
  const pickedUp = learners.filter((learner) => learner.status !== "waiting").length;

  function setStatus(index: number, status: Status) {
    setLearners((current) => current.map((learner, learnerIndex) => learnerIndex === index ? { ...learner, status } : learner));
  }

  return (
    <DriverShell title="Active trip">
      <Link className="back-link" to="/driver/dashboard"><ArrowLeft size={18} />Back to dashboard</Link>
      <section className="trip-header"><div><span className="direction-chip morning">Morning</span><h2>Fourways to Crawford</h2><p>Started 07:17 · 18 min elapsed</p></div><button type="button" aria-label="More trip actions"><MoreVertical size={20} /></button></section>
      <div className="trip-progress"><div><strong>{pickedUp} of {learners.length}</strong><span>Learners updated</span></div><div className="progress-track"><span style={{ width: `${(pickedUp / learners.length) * 100}%` }} /></div><span className="online-chip"><i />Online</span></div>
      <button className="delay-button" type="button"><Clock3 size={18} />Send delay notice</button>
      <section className="checkin-list">
        {learners.map((learner, index) => (
          <article className="checkin-row" key={learner.name}>
            <span className="learner-avatar">{learner.name.charAt(0)}</span>
            <div className="checkin-copy"><strong>{learner.name}</strong><p>{learner.grade}</p></div>
            <div className="checkin-actions">
              <button type="button" className={learner.status === "picked_up" ? "selected picked" : ""} onClick={() => setStatus(index, "picked_up")}> <UserRoundCheck size={16} /><span>Picked Up</span></button>
              <button type="button" className={learner.status === "dropped_off" ? "selected dropped" : ""} onClick={() => setStatus(index, "dropped_off")}> <Check size={16} /><span>Dropped Off</span></button>
              <button type="button" className={learner.status === "absent" ? "selected absent" : ""} onClick={() => setStatus(index, "absent")}> <AlertTriangle size={16} /><span>Absent</span></button>
            </div>
          </article>
        ))}
      </section>
      <button className="primary-button complete-trip" type="button">Complete trip</button>
    </DriverShell>
  );
}
