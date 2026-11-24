import { BusFront, CircleDollarSign, House, Route, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

export function ParentShell({ children, title }: { children: ReactNode; title: string }) {
  const location = useLocation();
  const nav = [
    { to: "/parent/home", label: "Home", icon: House },
    { to: "/parent/children", label: "Children", icon: UserRound },
    { to: "/parent/fees", label: "Fees", icon: CircleDollarSign },
    { to: "/parent/account", label: "Account", icon: Route },
  ];

  return (
    <div className="parent-app">
      <aside className="parent-sidebar">
        <Link className="parent-brand" to="/parent/home"><span><BusFront size={22} /></span>SafeRide</Link>
        <nav aria-label="Parent navigation">{nav.map(({ to, label, icon: Icon }) => <Link key={to} to={to} className={location.pathname.startsWith(to) ? "active" : ""}><Icon size={20} />{label}</Link>)}</nav>
      </aside>
      <main className="parent-main">
        <header className="parent-mobile-header"><Link className="parent-brand compact" to="/parent/home"><span><BusFront size={20} /></span>SafeRide</Link><span className="online-chip"><i />Live</span></header>
        <div className="parent-content"><h1>{title}</h1>{children}</div>
      </main>
      <nav className="parent-bottom-nav" aria-label="Parent navigation">{nav.map(({ to, label, icon: Icon }) => <Link key={to} to={to} className={location.pathname.startsWith(to) ? "active" : ""}><Icon size={20} /><span>{label}</span></Link>)}</nav>
    </div>
  );
}
