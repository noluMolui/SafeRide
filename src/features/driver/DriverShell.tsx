import { BusFront, CircleDollarSign, LogOut, MapPinned, Route, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

export function DriverShell({ children, title }: { children: ReactNode; title: string }) {
  const location = useLocation();
  const nav = [
    { to: "/driver/dashboard", label: "Today", icon: BusFront },
    { to: "/driver/routes", label: "Routes", icon: MapPinned },
    { to: "/driver/fees", label: "Fees", icon: CircleDollarSign },
    { to: "/driver/profile", label: "Account", icon: UserRound },
  ];

  return (
    <div className="driver-app">
      <aside className="driver-sidebar">
        <Link className="driver-brand" to="/driver/dashboard"><span><Route size={22} /></span>SafeRide</Link>
        <nav aria-label="Driver navigation">
          {nav.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className={location.pathname.startsWith(to) ? "active" : ""}><Icon size={20} />{label}</Link>
          ))}
        </nav>
        <Link className="sidebar-logout" to="/login"><LogOut size={20} />Log out</Link>
      </aside>
      <main className="driver-main">
        <header className="driver-mobile-header"><Link className="driver-brand compact" to="/driver/dashboard"><span><Route size={20} /></span>SafeRide</Link><button type="button" aria-label="Open account"><UserRound size={20} /></button></header>
        <div className="driver-content">
          <h1>{title}</h1>
          {children}
        </div>
      </main>
      <nav className="driver-bottom-nav" aria-label="Driver navigation">
        {nav.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className={location.pathname.startsWith(to) ? "active" : ""}><Icon size={20} /><span>{label}</span></Link>
        ))}
      </nav>
    </div>
  );
}
