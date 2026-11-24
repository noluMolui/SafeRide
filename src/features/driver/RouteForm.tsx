import { ArrowLeft, Save } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Field } from "../auth/ui";
import { DriverShell } from "./DriverShell";

export function RouteForm() {
  const [direction, setDirection] = useState<"morning" | "afternoon">("morning");
  const [message, setMessage] = useState("");
  const [days, setDays] = useState(["Mon", "Tue", "Wed", "Thu", "Fri"]);

  function toggleDay(day: string) {
    setDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day]);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Route saved in this frontend preview.");
  }

  return (
    <DriverShell title="New route">
      <Link className="back-link" to="/driver/routes"><ArrowLeft size={18} />Back to routes</Link>
      <form className="route-form card form-stack" onSubmit={submit}>
        <Field id="route-name" label="Route name" placeholder="e.g. Fourways to Crawford" defaultValue="" />
        <fieldset><legend className="field-label">Direction</legend><div className="segmented"><button type="button" className={direction === "morning" ? "active" : ""} onClick={() => setDirection("morning")}>Morning</button><button type="button" className={direction === "afternoon" ? "active" : ""} onClick={() => setDirection("afternoon")}>Afternoon</button></div></fieldset>
        <label className="field-block"><span className="field-label">Vehicle</span><select className="input" defaultValue="CA123456"><option value="CA123456">CA 123-456 · Toyota Quantum · 15 seats</option></select></label>
        <Field id="departure-time" label="Departure time" type="time" defaultValue="07:15" />
        <fieldset><legend className="field-label">Operating days</legend><div className="day-grid">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <button type="button" key={day} className={days.includes(day) ? "active" : ""} onClick={() => toggleDay(day)}>{day}</button>)}</div></fieldset>
        <button className="primary-button" type="submit"><Save size={19} />Save route</button>
        {message && <p className="form-message" role="status">{message}</p>}
      </form>
    </DriverShell>
  );
}
