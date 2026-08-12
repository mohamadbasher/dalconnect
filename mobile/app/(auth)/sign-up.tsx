// Customer registration — the same screen as sign-in, opened on the register
// tab. Kept as its own route so existing links and deep links still work.
import React from "react";
import { CustomerAuth } from "../../components/CustomerAuth";

export default function SignUp() {
  return <CustomerAuth initialMode="signUp" />;
}
