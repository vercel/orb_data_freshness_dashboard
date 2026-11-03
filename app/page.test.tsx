import { afterEach, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { getDashboardSession } from "@/lib/auth"
import { querySnowflake } from "@/lib/snowflake"
import DashboardPage from "./page"

vi.mock("@/lib/auth", () => ({ getDashboardSession: vi.fn(), isAuthConfigured: vi.fn(() => true) }))
vi.mock("@/lib/snowflake", () => ({ querySnowflake: vi.fn() }))

afterEach(() => vi.unstubAllEnvs())

it("returns only a generic response without querying Snowflake for a denied visitor", async () => {
  vi.mocked(getDashboardSession).mockResolvedValue(null)
  const html = renderToStaticMarkup(await DashboardPage())

  expect(html).toContain("Access restricted")
  expect(html).toContain("/api/auth/signin")
  expect(html).not.toContain("ORB_DATA_CONNECT")
  expect(html).not.toContain("TABLE_NAME")
  expect(querySnowflake).not.toHaveBeenCalled()
})
