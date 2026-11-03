import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getServerSession, type Account, type Session } from "next-auth"
import { authOptions, getDashboardSession, requireDashboardAccess } from "./auth"

vi.mock("server-only", () => ({}))
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }))

const account: Account = { provider: "google", type: "oauth", providerAccountId: "123" }
const profile = { email: "reader@vercel.com", email_verified: true, hd: "vercel.com" }
const user = { id: "123", email: profile.email, emailVerified: new Date() }
const session: Session = { user: { email: profile.email }, expires: "2099-01-01" }
const sessionContext = { user, newSession: undefined, trigger: "update" as const }
const { signIn, jwt, session: sessionCallback } = authOptions.callbacks!

beforeEach(() => {
  vi.stubEnv("NEXTAUTH_SECRET", "test-secret")
  vi.stubEnv("NEXTAUTH_URL", "http://localhost:3000")
  vi.stubEnv("GOOGLE_CLIENT_ID", "test-client")
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-client-secret")
  vi.stubEnv("DASHBOARD_ALLOWED_EMAILS", " reader@vercel.com, other@vercel.com ")
  vi.mocked(getServerSession).mockResolvedValue(null)
})

afterEach(() => vi.unstubAllEnvs())

describe("Google authentication and authorization", () => {
  it("accepts an explicitly allowed, verified Workspace identity", async () => {
    await expect(signIn!({ account, profile, user })).resolves.toBe(true)
  })

  it.each([
    { ...profile, email_verified: false },
    { ...profile, hd: "external.example" },
    { ...profile, hd: undefined },
    { ...profile, email: "unlisted@vercel.com" },
    { ...profile, email: "reader@vercel.com.external.example" },
    { ...profile, email: "reader@gmail.com" },
    undefined,
  ])("rejects an unverified or unauthorized profile: %j", async (untrustedProfile) => {
    await expect(signIn!({ account, profile: untrustedProfile, user })).resolves.toBe(false)
  })

  it("rejects identities from another provider", async () => {
    await expect(signIn!({ account: { ...account, provider: "github" }, profile, user })).resolves.toBe(false)
  })

  it("does not issue an identity when the allowlist is empty", async () => {
    vi.stubEnv("DASHBOARD_ALLOWED_EMAILS", "")
    await expect(signIn!({ account, profile, user })).resolves.toBe(false)
  })

  it("propagates only a provider-verified identity into the session", async () => {
    const token = await jwt!({ token: {}, account, profile, user })
    expect(token.dashboardEmail).toBe(profile.email)
    const result = await sessionCallback!({ ...sessionContext, session: structuredClone(session), token })
    expect(result.user?.email).toBe(profile.email)
  })

  it("ignores client session-update input", async () => {
    const token = await jwt!({
      token: {}, account: null, user, trigger: "update",
      session: { dashboardEmail: profile.email, user: { email: profile.email } },
    })
    const result = await sessionCallback!({ ...sessionContext, session: structuredClone(session), token })
    expect(result.user?.email).toBeNull()
  })

  it("rejects a token without a verified identity even if its email matches", async () => {
    const result = await sessionCallback!({
      ...sessionContext, session: structuredClone(session), token: { email: profile.email },
    })
    expect(result.user?.email).toBeNull()
  })
})

describe("server access guard", () => {
  it.each(["NEXTAUTH_SECRET", "NEXTAUTH_URL", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "DASHBOARD_ALLOWED_EMAILS"])(
    "denies access without %s, even with an existing session",
    async (variable) => {
      vi.stubEnv(variable, "")
      vi.mocked(getServerSession).mockResolvedValue(session)
      await expect(getDashboardSession()).resolves.toBeNull()
      expect(getServerSession).not.toHaveBeenCalled()
    },
  )

  it("denies an unauthenticated request", async () => {
    await expect(requireDashboardAccess()).rejects.toThrow("Access denied")
  })

  it("allows an authenticated, explicitly authorized user", async () => {
    vi.mocked(getServerSession).mockResolvedValue(session)
    await expect(requireDashboardAccess()).resolves.toBeUndefined()
  })

  it("revokes existing sessions when an address is removed", async () => {
    vi.mocked(getServerSession).mockResolvedValue(session)
    vi.stubEnv("DASHBOARD_ALLOWED_EMAILS", "other@vercel.com")
    await expect(requireDashboardAccess()).rejects.toThrow("Access denied")
  })

  it("does not authorize an external address even if it is allowlisted", async () => {
    vi.stubEnv("DASHBOARD_ALLOWED_EMAILS", "reader@external.example")
    vi.mocked(getServerSession).mockResolvedValue({ user: { email: "reader@external.example" } })
    await expect(requireDashboardAccess()).rejects.toThrow("Access denied")
  })
})
