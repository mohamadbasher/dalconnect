// Unread-notification count, owned in ONE place.
//
// TopBar is rendered as the header of every tab screen, so several copies are
// mounted at once. If each subscribed for itself they'd collide on the channel
// topic (and burn one realtime subscription per screen), so the count lives
// here — a single subscription, shared by every consumer.
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { channelTopic } from "../lib/realtime";
import { useAuth } from "./AuthContext";

type NotificationsCtx = {
  unread: number;
  /** re-count from the server (e.g. after marking things read) */
  refresh: () => void;
  /** optimistic local clear, for when the user opens the notifications screen */
  clearUnread: () => void;
};

const Ctx = createContext<NotificationsCtx>({
  unread: 0,
  refresh: () => {},
  clearUnread: () => {},
});

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const uid = session?.user?.id ?? null;
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(() => {
    if (!uid) {
      setUnread(0);
      return;
    }
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .eq("is_read", false)
      .then(({ count }) => setUnread(count ?? 0));
  }, [uid]);

  useEffect(() => {
    if (!uid) {
      setUnread(0);
      return;
    }
    let alive = true;
    const load = () =>
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid)
        .eq("is_read", false)
        .then(({ count }) => {
          if (alive) setUnread(count ?? 0);
        });

    load();
    const channel = supabase
      .channel(channelTopic(`notifications-badge-${uid}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
        () => load()
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [uid]);

  return (
    <Ctx.Provider value={{ unread, refresh, clearUnread: () => setUnread(0) }}>{children}</Ctx.Provider>
  );
}

export const useNotifications = () => useContext(Ctx);
