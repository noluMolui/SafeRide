import { ArrowRight, CalendarDays, ChevronRight, Clock3 } from "lucide-react";
import { Link } from "react-router-dom";
import { DriverShell } from "./DriverShell";

const trips = [
  { id: "trip-1", date: "24 Nov", route: "Fourways to Crawford", direction: "Morning", time: "07:17–08:06", picked: 8, dropped: 7, absent: 1, noUpdate: 0 },
  { id: "trip-2", date: "24 Nov", route: "Crawford to Fourways", direction: "Afternoon", time: "14:32–15:21", picked: 8, dropped: 8, absent: 1, noUpdate: 0 },
  { id: "trip-3", date: "23 Nov", route: "Fourways to Crawford", direction: "Morning", time: "07:12–08:03", picked: 9, dropped: 8, absent: 0, noUpdate: 1 },
];

export function TripHistory() {
  return (
    <DriverShell title="Trip history">
      <div className="history-toolbar"><p>Review completed morning and afternoon trips.</p><button type="button" className="icon-text-button"><CalendarDays size={18} />November 2026</button></div>
      <section className="history-list">
        {trips.map((trip) => (
          <Link className="history-card" key={trip.id} to={`/driver/trips/${trip.id}`}>
            <div className="history-date"><strong>{trip.date}</strong><span>{trip.direction}</span></div>
            <div className="history-copy"><h2>{trip.route}</h2><p><Clock3 size={16} />{trip.time}</p><div className="history-counts"><span className="picked-count">{trip.picked} picked up</span><span className="dropped-count">{trip.dropped} dropped off</span><span>{trip.absent} absent</span>{trip.noUpdate > 0 && <span>{trip.noUpdate} no update</span>}</div></div>
            <ChevronRight size={20} />
          </Link>
        ))}
      </section>
      <button className="secondary-button load-more" type="button">Load more <ArrowRight size={18} /></button>
    </DriverShell>
  );
}

export function TripDetail() {
  const timeline = [
    ["Lethabo Mokoena", "Picked up 07:24", "Dropped off 08:01"],
    ["Amahle Khumalo", "Picked up 07:31", "Dropped off 08:04"],
    ["Ruan van Wyk", "Absent", "No drop-off"],
  ];
  return (
    <DriverShell title="Trip summary">
      <div className="trip-detail-card"><span className="direction-chip morning">Morning</span><h2>Fourways to Crawford</h2><p>24 November · 07:17–08:06</p></div>
      <section className="timeline-list">{timeline.map((entry) => { const [name = "", first = "", second = ""] = entry; return <article className="timeline-row" key={name}><span className="learner-avatar">{name.charAt(0)}</span><div><strong>{name}</strong><p>{first}</p><p>{second}</p></div></article>; })}</section>
    </DriverShell>
  );
}
