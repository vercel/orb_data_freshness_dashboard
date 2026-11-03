import "server-only"

import { getServerSession, type NextAuthOptions } from "next-auth"
import type { GoogleProfile } from "next-auth/providers/google"
import GoogleProvider from "next-auth/providers/google"

export function isAuthConfigured(): boolean {
  return Boolean(
    process.env.NEXTAUTH_SECRET &&
      process.env.NEXTAUTH_URL &&
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.DASHBOARD_ALLOWED_EMAILS?.trim(),
  )
}

function isAllowedEmail(email: unknown): email is string {
  if (typeof email !== "string" || !email.toLowerCase().endsWith("@vercel.com")) {
    return false
  }

  const allowedEmails = (process.env.DASHBOARD_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)

  return allowedEmails.includes(email.toLowerCase())
}

function isAuthorizedProfile(profile: GoogleProfile | undefined): profile is GoogleProfile {
  return Boolean(
    profile?.email_verified === true &&
      profile.hd === "vercel.com" &&
      isAllowedEmail(profile.email),
  )
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: { params: { hd: "vercel.com" } },
    }),
  ],
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  callbacks: {
    async signIn({ account, profile }) {
      return account?.provider === "google" && isAuthorizedProfile(profile as GoogleProfile | undefined)
    },
    async jwt({ token, account, profile }) {
      if (account) {
        const googleProfile = profile as GoogleProfile | undefined
        // Persist only an identity verified by the OAuth provider, never client session input.
        token.dashboardEmail =
          account.provider === "google" && isAuthorizedProfile(googleProfile)
            ? googleProfile.email.toLowerCase()
            : null
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = isAllowedEmail(token.dashboardEmail) ? token.dashboardEmail : null
      }
      return session
    },
  },
}

export async function getDashboardSession() {
  if (!isAuthConfigured()) return null

  const session = await getServerSession(authOptions)
  // Recheck the current allowlist on every request, including existing sessions.
  return isAllowedEmail(session?.user?.email) ? session : null
}

export async function requireDashboardAccess(): Promise<void> {
  if (!(await getDashboardSession())) {
    throw new Error("Access denied")
  }
}
