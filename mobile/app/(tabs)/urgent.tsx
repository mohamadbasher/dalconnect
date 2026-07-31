import React from "react";
import { Redirect } from "expo-router";

// The urgent tab is a shortcut to create an open request — its tab button
// navigates straight to /create-booking. This redirect is only a fallback
// in case the route is ever focused directly.
export default function Urgent() {
  return <Redirect href="/create-booking" />;
}
