import { ArrowLeft, Link2, LogIn, UserPlus } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Brand } from "./ui";

export function JoinLink() {
  const { code = "" } = useParams();

  return (
    <main className="auth-page">
      <header className="page-header">
        <Link className="back-button" to="/login" aria-label="Back to login"><ArrowLeft /></Link>
        <Brand />
      </header>
      <h1>Join a SafeRide route</h1>
      <p className="intro">Use the invite link supplied by your child&apos;s driver.</p>
      <section className="card join-card">
        <span className="join-icon"><Link2 size={24} /></span>
        <h2>Route invite</h2>
        <p className="join-code">{code.toUpperCase()}</p>
        <p className="join-copy">Log in or create an account to link a child to this route.</p>
        <Link className="primary-button" to={`/login?join=${encodeURIComponent(code)}`}>
          <LogIn size={20} /> Log in
        </Link>
        <Link className="secondary-button" to={`/signup?join=${encodeURIComponent(code)}`}>
          <UserPlus size={20} /> Create account
        </Link>
      </section>
    </main>
  );
}
