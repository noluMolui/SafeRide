import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Login } from "./features/auth/Login";
import { Signup, type SignupValues, emptySignup } from "./features/auth/Signup";
import { DriverCompliance } from "./features/auth/DriverCompliance";
import { signupSchema } from "./features/auth/validation";
import { ResetPassword } from "./features/auth/ResetPassword";
import { JoinLink } from "./features/auth/JoinLink";

export function App() {
  const [signup, setSignup] = useState<SignupValues>(emptySignup);
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup values={signup} onChange={setSignup} />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/join/:code" element={<JoinLink />} />
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
