"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "@phosphor-icons/react";
import { api, post } from "@/lib/api";
import { Modal } from "./WorkspaceUI";

export type Notification = {
  id: string;
  projectId: string;
  projectName: string;
  kind: string;
  taskId: string;
  requestId: string;
  message: string;
  createdAt: string;
  readAt: string | null;
};
type Feed = {
  items: Notification[];
  unreadCount: number;
  nextCursor: string | null;
};
export default function NotificationInbox({
  onOpen,
}: {
  onOpen: (item: Notification) => Promise<() => void>;
}) {
  const [open, setOpen] = useState(false),
    [unread, setUnread] = useState(true);
  const [feed, setFeed] = useState<Feed>({
    items: [],
    unreadCount: 0,
    nextCursor: null,
  });
  const [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  const generation = useRef(0),
    paged = useRef(false),
    mutating = useRef(false);
  const navigation = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!open && navigation.current) {
      const go = navigation.current;
      navigation.current = null;
      go();
    }
  }, [open]);
  const load = useCallback(
    async (cursor = "", quiet = false) => {
      const epoch = ++generation.current;
      try {
        const next = await api<Feed>(
          `/notifications?unread=${unread}${cursor ? `&before=${encodeURIComponent(cursor)}` : ""}`,
        );
        if (epoch !== generation.current) return;
        setFeed((old) =>
          quiet && paged.current
            ? { ...old, unreadCount: next.unreadCount }
            : {
                ...next,
                items: cursor
                  ? [
                      ...old.items,
                      ...next.items.filter(
                        (n) => !old.items.some((o) => o.id === n.id),
                      ),
                    ]
                  : next.items,
              },
        );
        if (cursor) paged.current = true;
        setError("");
      } catch (e) {
        if (epoch === generation.current) setError((e as Error).message);
      }
    },
    [unread],
  );
  useEffect(() => {
    paged.current = false;
    void load();
    const tick = () => {
      if (!document.hidden && !mutating.current) void load("", true);
    };
    const interval = setInterval(tick, 15000);
    window.addEventListener("focus", tick);
    return () => {
      generation.current++;
      clearInterval(interval);
      window.removeEventListener("focus", tick);
    };
  }, [load]);
  async function change(ids: string[], read: boolean) {
    mutating.current = true;
    setPending(true);
    generation.current++;
    try {
      for (let i = 0; i < ids.length; i += 100)
        await post("/notifications/read", { ids: ids.slice(i, i + 100), read });
      paged.current = false;
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      mutating.current = false;
      setPending(false);
    }
  }
  async function follow(item: Notification) {
    mutating.current = true;
    generation.current++;
    setPending(true);
    setError("");
    try {
      const go = await onOpen(item);
      await post("/notifications/read", { ids: [item.id], read: true });
      paged.current = false;
      await load();
      navigation.current = go;
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      mutating.current = false;
      setPending(false);
    }
  }
  return (
    <>
      <button
        className="cg-inbox-trigger"
        aria-label={`Notifications${feed.unreadCount ? `, ${feed.unreadCount} unread` : ""}${error ? ", refresh unavailable" : ""}`}
        onClick={() => {
          setOpen(true);
          paged.current = false;
          void load();
        }}
      >
        <Bell size={19} />
        <span>Inbox</span>
        {feed.unreadCount > 0 && (
          <b>{feed.unreadCount > 99 ? "99+" : feed.unreadCount}</b>
        )}
        {error && <small aria-hidden="true">!</small>}
      </button>
      {open && (
        <Modal title="Your inbox" close={() => setOpen(false)}>
          <p>
            Assignments, requests, replies and review submissions across your
            projects. Saved here even when you’re away. In-app updates refresh
            every 15 seconds.
          </p>
          <div className="cg-task-views">
            <button aria-pressed={unread} onClick={() => setUnread(true)}>
              Unread ({feed.unreadCount})
            </button>
            <button aria-pressed={!unread} onClick={() => setUnread(false)}>
              All activity
            </button>
            <button
              disabled={pending}
              onClick={() => {
                paged.current = false;
                void load();
              }}
            >
              Refresh
            </button>
            <button
              disabled={pending || !feed.items.some((n) => !n.readAt)}
              onClick={() =>
                change(
                  feed.items.filter((n) => !n.readAt).map((n) => n.id),
                  true,
                )
              }
            >
              Mark displayed as read
            </button>
          </div>
          {error && (
            <p className="cg-alert" role="alert">
              {error}
            </p>
          )}
          {!feed.items.length && !error && (
            <div className="cg-inbox-empty">
              <h3>
                {unread
                  ? "You’re caught up."
                  : "Your updates will appear here."}
              </h3>
              <p>
                New assignments and team decisions will link directly to the
                work. Your own actions won’t notify you.
              </p>
            </div>
          )}
          <div className="cg-inbox-list">
            {feed.items.map((n) => (
              <article key={n.id} className={n.readAt ? "" : "is-unread"}>
                <button
                  disabled={pending}
                  className="cg-inbox-open"
                  onClick={() => follow(n)}
                >
                  <span>
                    {n.projectName} ·{" "}
                    {(
                      {
                        assignment: "Assignment",
                        help: "Needs attention",
                        reply: "Lead reply",
                        review: "Ready for review",
                      } as Record<string, string>
                    )[n.kind] || n.kind}
                  </span>
                  <strong>{n.message}</strong>
                  <time dateTime={n.createdAt}>
                    {new Date(n.createdAt).toLocaleString()}
                  </time>
                  <small>
                    {n.requestId ? "Open team request" : "Open task"} →
                  </small>
                </button>
                <button
                  disabled={pending}
                  className="cg-text"
                  onClick={() => change([n.id], !n.readAt)}
                >
                  {n.readAt ? "Mark unread" : "Mark read"}
                </button>
              </article>
            ))}
          </div>
          {feed.nextCursor && (
            <button
              disabled={pending}
              className="cg-btn"
              onClick={async () => {
                setPending(true);
                await load(feed.nextCursor!);
                setPending(false);
              }}
            >
              Load older notifications
            </button>
          )}
        </Modal>
      )}
    </>
  );
}
