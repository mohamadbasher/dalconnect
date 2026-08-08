// Customers no longer browse professionals by category — picking a service goes
// straight to the request form, where every nearby pro in that trade is invited
// to quote. This route is kept so old links/notifications still land somewhere
// sensible.
import React from "react";
import { Redirect, useLocalSearchParams } from "expo-router";

export default function CategoryRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const categoryId = Number(id);
  return (
    <Redirect
      href={Number.isFinite(categoryId) ? `/create-booking?categoryId=${categoryId}` : "/create-booking"}
    />
  );
}
