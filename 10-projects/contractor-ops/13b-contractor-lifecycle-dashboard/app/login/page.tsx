import { signIn, signOut } from "@/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

async function requestAccessAction(formData: FormData): Promise<void> {
  "use server";

  const name = String(formData.get("name") ?? "").trim().slice(0, 200);
  const email = String(formData.get("email") ?? "").trim().slice(0, 200);
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 1000);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!name || !emailOk || !reason) {
    redirect("/login?request=invalid");
  }

  const url = process.env.SLACK_AUTH_ALERT_WEBHOOK;
  if (url) {
    const text =
      `📨 *Contractor dashboard access request*\n` +
      `Name: ${name}\n` +
      `Email: \`${email}\`\n` +
      `Reason: ${reason}\n` +
      `Time: ${new Date().toISOString()}\n` +
      `If approved, add the email to the allowlist in \`auth.ts\`.`;
    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, username: "Contractor Dashboard" }),
      });
    } catch {
      // Best-effort — fall through to the success page either way.
    }
  }

  redirect("/login?request=sent");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string;
    error?: string;
    request?: string;
    signedout?: string;
  }>;
}) {
  const { next, error, request, signedout } = await searchParams;

  const denied = error === "AccessDenied";
  const otherError = !!error && !denied;
  const requestSent = request === "sent";
  const requestInvalid = request === "invalid";
  const showForm = request === "open" || requestInvalid;
  const justSignedOut = signedout === "1";

  const safeNext =
    next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">
          Global Contractor Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {showForm
            ? "Request access to the dashboard."
            : justSignedOut
              ? "You've been signed out."
              : "Sign in with your Speak Google account."}
        </p>

        {denied && !showForm && !requestSent && (
          <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
            <p className="font-medium">Account not on the access list.</p>
            <p className="mt-1 text-rose-800">
              This dashboard is restricted to a small group on the Speak People Ops team. If you should have access, request it below.
            </p>
          </div>
        )}

        {otherError && !showForm && !requestSent && !justSignedOut && (
          <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800">
            Sign-in failed. Try again.
          </p>
        )}

        {requestSent && (
          <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
            <p className="font-medium">Request sent.</p>
            <p className="mt-1 text-emerald-800">
              Thanks — we&apos;ll review it and get back to you. You can close this tab.
            </p>
          </div>
        )}

        {!showForm && !requestSent && (
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: safeNext });
            }}
            className="mt-4"
          >
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              <GoogleGlyph />
              Sign in with Google
            </button>
          </form>
        )}

        {showForm && (
          <form action={requestAccessAction} className="mt-4 space-y-3">
            {requestInvalid && (
              <p className="rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800">
                All fields are required and email must be valid.
              </p>
            )}
            <div>
              <label htmlFor="name" className="block text-xs font-medium text-slate-700">
                Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                maxLength={200}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-slate-700">
                Work email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                maxLength={200}
                placeholder="you@usespeak.com"
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="reason" className="block text-xs font-medium text-slate-700">
                Why you need access
              </label>
              <textarea
                id="reason"
                name="reason"
                required
                maxLength={1000}
                rows={3}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="flex-1 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Send request
              </button>
              <a
                href="/login"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </a>
            </div>
          </form>
        )}

        {!showForm && !requestSent && (
          <p className="mt-3 text-center text-[11px] text-slate-400">
            Don&apos;t have access?{" "}
            <a href="/login?request=open" className="underline hover:text-slate-600">
              Request it
            </a>
          </p>
        )}
      </div>
    </main>
  );
}

function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#fff"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.79 2.72v2.27h2.9c1.7-1.57 2.69-3.88 2.69-6.63z"
      />
      <path
        fill="#fff"
        d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.9-2.27c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.34A9 9 0 0 0 9 18z"
        opacity=".8"
      />
      <path
        fill="#fff"
        d="M3.95 10.69A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.16.29-1.69V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03l3-2.34z"
        opacity=".6"
      />
      <path
        fill="#fff"
        d="M9 3.58c1.32 0 2.51.45 3.45 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97l3 2.34C4.66 5.18 6.65 3.58 9 3.58z"
        opacity=".4"
      />
    </svg>
  );
}
