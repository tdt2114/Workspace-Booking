export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-3xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
        <div className="space-y-4">
          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
            Workspace Booking MVP
          </span>
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-slate-900">
            Frontend baseline is ready. The next milestone is authentication.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-slate-600">
            This workspace is now connected to Supabase and the backend API can
            already read seeded building data. Use the links below to test the
            first frontend auth flow.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <a
            className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-5 transition hover:border-slate-300 hover:bg-slate-100"
            href="/login"
          >
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
              Auth
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">
              Open Login Page
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Test sign in and sign up with Supabase Auth.
            </p>
          </a>

          <a
            className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-5 transition hover:border-slate-300 hover:bg-slate-100"
            href="/dashboard"
          >
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
              Session
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">
              Open Dashboard
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Check whether the current browser session is authenticated.
            </p>
          </a>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-1">
          <a
            className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-5 transition hover:border-slate-300 hover:bg-slate-100"
            href="/bookings"
          >
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
              Bookings
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">
              Open Booking Management
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Review booking history, cancel confirmed bookings, and run lifecycle
              tools from one dedicated screen.
            </p>
          </a>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-1">
          <a
            className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-5 transition hover:border-slate-300 hover:bg-slate-100"
            href="/floor-map"
          >
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
              Floor Map
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">
              Open Interactive SVG Prototype
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Load floors and workspaces from the protected API, then bind the
              uploaded SVG map to real `svg_element_id` values.
            </p>
          </a>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-1">
          <a
            className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-5 transition hover:border-slate-300 hover:bg-slate-100"
            href="/check-in"
          >
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
              Check-in
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">
              Open QR Check-in Prototype
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Test the workspace QR check-in flow with a manual QR value before
              adding a real camera scanner.
            </p>
          </a>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-1">
          <a
            className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-5 transition hover:border-slate-300 hover:bg-slate-100"
            href="/workspace-qr"
          >
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
              QR Admin
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">
              Open Workspace QR Assets
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Preview and download the static QR image for each workspace before
              printing and placing labels in the office.
            </p>
          </a>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-1">
          <a
            className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-5 transition hover:border-slate-300 hover:bg-slate-100"
            href="/admin/setup"
          >
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
              Admin Setup
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">
              Open Operations Setup Screen
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Manage buildings, floors, workspaces, and SVG uploads from a single
              prototype screen for admin and space owner accounts.
            </p>
          </a>
        </div>
      </div>
    </main>
  );
}
