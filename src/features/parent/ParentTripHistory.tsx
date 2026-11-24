import { ArrowRight, ChevronDown, Clock3 } from "lucide-react";
import { useState } from "react";
import { ParentShell } from "./ParentShell";

const trips = [
  { date: "24 Nov", direction: "Morning", route: "Fourways to Crawford", status: "Picked up 07:24 · Dropped off 08:01", delay: "10 min delay · School traffic near Fourways" },
  { date: "24 Nov", direction: "Afternoon", route: "Crawford to Fourways", status: "Not started · 14:30", delay: "" },
  { date: "23 Nov", direction: "Morning", route: "Fourways to Crawford", status: "Picked up 07:29 · Dropped off 08:03", delay: "" },
];

export function ParentTripHistory() {
  const [child, setChild] = useState("Lethabo Mokoena");
  return (
    <ParentShell title="Trip history">
      <label className="parent-child-select"><span>Child</span><select value={child} onChange={(event) => setChild(event.target.value)}><option>Lethabo Mokoena</option><option>Thando Mokoena</option></select><ChevronDown size="18" /></label>
      <section className="parent-history-list">{trips.map((trip, index) => <article className="parent-history-card" key={`${trip.date}-${index}`}><div className="parent-history-date"><strong>{trip.date}</strong><span className={trip.direction === "Morning" ? "morning" : "afternoon"}>{trip.direction}</span></div><div><h2>{trip.route}</h2><p><Clock3 size="16" />{trip.status}</p>{trip.delay && <div className="parent-delay"><strong>Delay notice</strong><span>{trip.delay}</span></div>}</div></article>)}</section>
      <button className="secondary-button load-more" type="button">Load more <ArrowRight size="18" /></button>
    </ParentShell>
  );
}
