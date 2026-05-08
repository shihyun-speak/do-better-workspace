import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const ALLOWLIST = new Set(
  [
    "shihyun.l@usespeak.com",
    "sunjae@usespeak.com",
    "hemmi@usespeak.com",
    "mina@usespeak.com",
  ].map((e) => e.toLowerCase()),
);

async function notifyDeniedSignIn(payload: {
  email: string;
  name: string | null;
}): Promise<void> {
  const url = process.env.SLACK_AUTH_ALERT_WEBHOOK;
  if (!url) return;
  const text =
    `🚫 *Contractor dashboard sign-in denied*\n` +
    `Email: \`${payload.email}\`\n` +
    (payload.name ? `Name: ${payload.name}\n` : "") +
    `Time: ${new Date().toISOString()}\n` +
    `Add them to the allowlist in \`auth.ts\` if they should have access.`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, username: "Contractor Dashboard" }),
    });
  } catch {
    // Swallow — alerting is best-effort and must never block sign-in.
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    // Allow sign-in only for explicitly-allowlisted emails. NextAuth treats
    // returning false as "deny" — Google login completes but session creation
    // fails, sending the user back to /login with an error.
    async signIn({ profile }) {
      const email = profile?.email?.toLowerCase();
      if (!email) return false;
      if (!profile?.email_verified) return false;
      if (ALLOWLIST.has(email)) return true;
      // Don't await — fire-and-forget so the user redirect isn't blocked
      // if Slack is slow.
      void notifyDeniedSignIn({ email, name: profile?.name || null });
      return false;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  // 30-day session.
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
});
