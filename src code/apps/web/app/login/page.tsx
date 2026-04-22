"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Mode = "sign-in" | "sign-up";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const title = useMemo(
    () => (mode === "sign-in" ? "Sign in to continue" : "Create a new account"),
    [mode],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setError(null);

    if (mode === "sign-in") {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setIsSubmitting(false);
        return;
      }

      setMessage("Signed in successfully.");
      router.push("/dashboard");
      router.refresh();
      setIsSubmitting(false);
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setIsSubmitting(false);
      return;
    }

    if (data.session) {
      setMessage("Account created and signed in successfully.");
      router.push("/dashboard");
      router.refresh();
      setIsSubmitting(false);
      return;
    }

    setMessage("Account created. Check your email if confirmation is enabled.");
    setIsSubmitting(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[2rem] bg-[#0f172a] p-8 text-white shadow-[0_24px_80px_rgba(15,23,42,0.25)]">
          <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-sm font-medium tracking-[0.14em] text-slate-200 uppercase">
            Workspace Booking
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight">
            {title}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
            This page is the first real frontend milestone. Use it to verify
            Supabase Auth, user sync, and session handling before building the
            booking interface.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-medium uppercase tracking-[0.14em] text-slate-400">
                Test users
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-200">
                admin@demo.com
                <br />
                manager@demo.com
                <br />
                employee@demo.com
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-medium uppercase tracking-[0.14em] text-slate-400">
                Expected result
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-200">
                Successful sign in should redirect to `/dashboard` and display
                the active session email.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <div className="flex gap-2 rounded-full bg-slate-100 p-1">
            <button
              className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
                mode === "sign-in"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              onClick={() => {
                setMode("sign-in");
                setMessage(null);
                setError(null);
              }}
              type="button"
            >
              Sign in
            </button>
            <button
              className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
                mode === "sign-up"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              onClick={() => {
                setMode("sign-up");
                setMessage(null);
                setError(null);
              }}
              type="button"
            >
              Sign up
            </button>
          </div>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            {mode === "sign-up" ? (
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Full name
                </span>
                <input
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400"
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Nguyen Van A"
                  type="text"
                  value={fullName}
                />
              </label>
            ) : null}

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Email
              </span>
              <input
                autoComplete="email"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400"
                data-testid="login-email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@demo.com"
                required
                type="email"
                value={email}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Password
              </span>
              <input
                autoComplete={
                  mode === "sign-in" ? "current-password" : "new-password"
                }
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400"
                data-testid="login-password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Your password"
                required
                type="password"
                value={password}
              />
            </label>

            {message ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {message}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            <button
              className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              data-testid="login-submit"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting
                ? "Processing..."
                : mode === "sign-in"
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
