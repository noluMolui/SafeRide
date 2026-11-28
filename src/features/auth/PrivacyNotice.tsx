import { ArrowLeft, TriangleAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { Brand } from "./ui";

export function PrivacyNotice() {
  return (
    <main className="auth-page privacy-page">
      <header className="page-header">
        <Link className="back-button" to="/signup" aria-label="Back to sign up">
          <ArrowLeft />
        </Link>
        <Brand />
      </header>
      <h1>Privacy notice</h1>
      <p className="intro">
        How SafeRide uses personal information for scholar transport
        coordination.
      </p>
      <section className="profile-banner" role="alert">
        <TriangleAlert size={20} />
        <p>
          <strong>Publication details are incomplete</strong>
          <span>
            The SafeRide operator has not provided the responsible party's legal
            name or privacy contact. This notice is not ready for production use
            until those details and the hosting region are confirmed.
          </span>
        </p>
      </section>
      <article className="privacy-copy">
        <h2>Information handled</h2>
        <p>
          For account holders, SafeRide handles name, email address, mobile
          number, account role, and consent record. For drivers, it also handles
          business and service-area details, Professional Driving Permit
          information and documents, vehicle registration and roadworthy
          details, and verification decisions.
        </p>
        <p>
          For parents and learners, it handles the learner's name, school,
          grade, home and school addresses, emergency contact details, and any
          medical or allergy notes a parent chooses to provide. It also handles
          route enrollment, trip check-in and delay records, and fee amounts,
          status, due dates, and payment references. SafeRide does not collect
          continuous GPS location in this version.
        </p>
        <h2>Why it is used</h2>
        <p>
          Information is used to create and secure accounts, organize routes and
          enrollment requests, provide trip status and history to the relevant
          parent, provide assigned drivers the information needed for an
          approved learner, manage fee records, and review driver compliance
          documents.
        </p>
        <h2>Who can see it</h2>
        <p>
          Parents can access their own account and learner information. A driver
          can access learner details only while the learner has an active
          enrollment on that driver's route. Parents can see trip and fee
          information for their own linked learners. SafeRide administrators can
          review driver and vehicle compliance information; they do not have
          application access to learner records, trip logs, or fee records.
          Supabase provides authentication, database, and file-storage services;
          Vercel hosts the web app. The hosting regions and any international
          data-transfer arrangements must be confirmed by the SafeRide operator
          before publication.
        </p>
        <h2>Security and retention</h2>
        <p>
          Access is restricted by authenticated roles, database row-level
          security, and a private bucket for compliance documents. These
          controls reduce access but cannot guarantee that a security incident
          will never occur. Account deletion is intended to remove the account's
          application records and compliance files. Provider backups or legally
          required records may be retained for a limited period; the exact
          provider retention periods must be confirmed before production use.
        </p>
        <h2>Your choices and rights</h2>
        <p>
          Subject to applicable law, you may request access to or correction of
          your personal information, ask questions about its use, or request
          deletion. Parents should provide only information they are authorized
          to share for a learner. You may also raise a complaint with the
          Information Regulator of South Africa.
        </p>
        <h2>Responsible party and contact</h2>
        <p>
          The responsible party is the person or organization operating
          SafeRide. Its legal name and a working privacy contact have not yet
          been provided. Do not submit real personal information until the
          operator publishes those details, confirms the hosting and retention
          arrangements, and obtains an appropriate legal review of this notice.
        </p>
        <p className="privacy-version">Draft notice · 27 November 2026</p>
      </article>
      <Link className="secondary-button" to="/signup">
        Back to sign up
      </Link>
    </main>
  );
}
