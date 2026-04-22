"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { getBrowserApiBaseUrl } from "@/lib/api-base-url";

export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [meResponse, setMeResponse] = useState<string | null>(null);
  const [meError, setMeError] = useState<string | null>(null);
  const [checkingMe, setCheckingMe] = useState(false);

  const apiBaseUrl = useMemo(() => getBrowserApiBaseUrl(), []);

  useEffect(() => {
    let mounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, updatedSession) => {
      if (mounted) {
        setSession(updatedSession);
        setLoading(false);
      }
    });

    void supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (mounted) {
        setSession(currentSession);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function handleRefreshSession() {
    setLoading(true);
    setCopyMessage(null);
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();
    setSession(currentSession);
    setLoading(false);
  }

  async function handleCopyToken() {
    if (!session?.access_token) {
      setCopyMessage("No token to copy.");
      return;
    }

    await navigator.clipboard.writeText(session.access_token);
    setCopyMessage("Access token copied.");
  }

  async function handleCheckMe() {
    if (!session?.access_token) {
      setMeError("No active token found.");
      setMeResponse(null);
      return;
    }

    if (!apiBaseUrl) {
      setMeError("Missing NEXT_PUBLIC_API_BASE_URL.");
      setMeResponse(null);
      return;
    }

    setCheckingMe(true);
    setMeError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/me`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const payload = await response.json();

      if (!response.ok) {
        setMeError(
          typeof payload?.message === "string"
            ? payload.message
            : "Protected request failed.",
        );
        setMeResponse(JSON.stringify(payload, null, 2));
        return;
      }

      setMeResponse(JSON.stringify(payload, null, 2));
    } catch {
      setMeError("Could not reach backend /me endpoint.");
      setMeResponse(null);
    } finally {
      setCheckingMe(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-3xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
        <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
          Session Check
        </span>

        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-900">
          Frontend auth is wired to Supabase.
        </h1>

        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
          Use this page to confirm whether the browser currently holds an
          authenticated Supabase session.
        </p>

        <div className="mt-8 rounded-3xl bg-slate-950 p-6 text-slate-100">
          {loading ? (
            <p className="text-sm text-slate-300">Loading session...</p>
          ) : session ? (
            <div className="space-y-3">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
                Authenticated user
              </p>
              <p className="text-2xl font-semibold">{session.user.email}</p>
              <p className="text-sm text-slate-300">
                User ID: {session.user.id}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
                Session status
              </p>
              <p className="text-2xl font-semibold">No active session</p>
            </div>
          )}
        </div>

        <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Debug token
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Use this access token to test the protected backend endpoint
                <code className="mx-1 rounded bg-slate-200 px-1.5 py-0.5 text-slate-800">
                  GET /me
                </code>
                with a Bearer header.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-white"
                onClick={() => void handleRefreshSession()}
                type="button"
              >
                Refresh session
              </button>
              <button
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={!session?.access_token}
                onClick={() => void handleCopyToken()}
                type="button"
              >
                Copy access token
              </button>
              <button
                className="rounded-full bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={!session?.access_token || checkingMe}
                onClick={() => void handleCheckMe()}
                type="button"
              >
                {checkingMe ? "Checking /me..." : "Test GET /me"}
              </button>
            </div>
          </div>

          <div className="mt-5 rounded-2xl bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Current token
            </p>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all text-xs leading-6 text-slate-700">
              {session?.access_token ?? "No active token"}
            </pre>
          </div>

          {copyMessage ? (
            <p className="mt-3 text-sm text-emerald-700">{copyMessage}</p>
          ) : null}

          {meError ? (
            <p className="mt-3 text-sm text-rose-700">{meError}</p>
          ) : null}

          {meResponse ? (
            <div className="mt-4 rounded-2xl bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Backend /me response
              </p>
              <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all text-xs leading-6 text-slate-700">
                {meResponse}
              </pre>
            </div>
          ) : null}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <a
            className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
            href="/login"
          >
            Go to login
          </a>
          <a
            className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            href="/bookings"
          >
            Open bookings
          </a>
          <a
            className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            href="/workspace-qr"
          >
            Open QR manager
          </a>
          <button
            className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            onClick={() => void handleSignOut()}
            type="button"
          >
            Sign out
          </button>
        </div>
      </div>
    </main>
  );
}
