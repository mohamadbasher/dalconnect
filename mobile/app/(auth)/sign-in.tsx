// Customer sign in. The screen itself holds both the sign-in and register
// forms and swaps them locally, so the segmented control never navigates —
// see components/CustomerAuth.tsx.
import React from "react";
import { CustomerAuth } from "../../components/CustomerAuth";

export default function SignIn() {
  return <CustomerAuth initialMode="signIn" />;
}
