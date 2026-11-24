import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Login } from "./features/auth/Login";
import { Signup, type SignupValues, emptySignup } from "./features/auth/Signup";
import { DriverCompliance } from "./features/auth/DriverCompliance";
import { signupSchema } from "./features/auth/validation";
import { ResetPassword } from "./features/auth/ResetPassword";
import { JoinLink } from "./features/auth/JoinLink";
import { DriverDashboard } from "./features/driver/DriverDashboard";
import { RouteList } from "./features/driver/RouteList";
import { RouteForm } from "./features/driver/RouteForm";
import { RouteRoster } from "./features/driver/RouteRoster";
import { ActiveTrip } from "./features/driver/ActiveTrip";
import { TripHistory, TripDetail } from "./features/driver/TripHistory";
import { ComplianceProfile } from "./features/driver/ComplianceProfile";
import { FeeLedger } from "./features/driver/FeeLedger";
import { FeeEntry } from "./features/driver/FeeEntry";
import { ParentHome } from "./features/parent/ParentHome";
import { ChildProfile } from "./features/parent/ChildProfile";
import { ChildrenList } from "./features/parent/ChildrenList";
import { LinkDriver } from "./features/parent/LinkDriver";
import { ParentTripHistory } from "./features/parent/ParentTripHistory";
import { ParentFees } from "./features/parent/ParentFees";
import { ParentAccount } from "./features/parent/ParentAccount";
import { AdminVerification } from "./features/admin/AdminVerification";

export function App() {
  const [signup, setSignup] = useState<SignupValues>(emptySignup);
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup values={signup} onChange={setSignup} />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/join/:code" element={<JoinLink />} />
      <Route path="/driver/dashboard" element={<DriverDashboard />} />
      <Route path="/driver/routes" element={<RouteList />} />
      <Route path="/driver/routes/new" element={<RouteForm />} />
      <Route path="/driver/routes/:id/edit" element={<RouteForm />} />
      <Route path="/driver/routes/:id" element={<RouteRoster />} />
      <Route path="/driver/trip/:tripId" element={<ActiveTrip />} />
      <Route path="/driver/trips" element={<TripHistory />} />
      <Route path="/driver/trips/:id" element={<TripDetail />} />
      <Route path="/driver/profile" element={<ComplianceProfile />} />
      <Route path="/driver/fees" element={<FeeLedger />} />
      <Route path="/driver/fees/new" element={<FeeEntry />} />
      <Route path="/driver/fees/:id" element={<FeeEntry />} />
      <Route path="/parent/home" element={<ParentHome />} />
      <Route path="/parent/children" element={<ChildrenList />} />
      <Route path="/parent/children/new" element={<ChildProfile />} />
      <Route path="/parent/children/:id/edit" element={<ChildProfile />} />
      <Route path="/parent/link" element={<LinkDriver />} />
      <Route path="/parent/children/:id/history" element={<ParentTripHistory />} />
      <Route path="/parent/fees" element={<ParentFees />} />
      <Route path="/parent/account" element={<ParentAccount />} />
      <Route path="/admin/verifications" element={<AdminVerification />} />
      <Route
        path="/signup/driver"
        element={
          signup.role === "driver" && signupSchema.safeParse(signup).success ? (
            <DriverCompliance />
          ) : (
            <Navigate to="/signup" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
