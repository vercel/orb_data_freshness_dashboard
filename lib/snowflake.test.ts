import { beforeEach, expect, it, vi } from "vitest"
import fs from "fs"
import snowflake from "snowflake-sdk"
import { requireDashboardAccess } from "./auth"
import { querySnowflake } from "./snowflake"

vi.mock("server-only", () => ({}))
vi.mock("./auth", () => ({ requireDashboardAccess: vi.fn() }))
vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("fs", () => ({ default: { readFileSync: vi.fn(() => "test-token") } }))
vi.mock("snowflake-sdk", () => ({ default: { configure: vi.fn(), createConnection: vi.fn() } }))

beforeEach(() => {
  vi.mocked(requireDashboardAccess).mockResolvedValue(undefined)
})

it("denies unauthorized queries before reading credentials or creating a connection", async () => {
  vi.mocked(requireDashboardAccess).mockRejectedValue(new Error("Access denied"))

  await expect(querySnowflake("SELECT 1")).rejects.toMatchObject({ message: "Access denied" })
  expect(fs.readFileSync).not.toHaveBeenCalled()
  expect(snowflake.createConnection).not.toHaveBeenCalled()
})

it("executes and cleans up a query for an authorized request", async () => {
  const rows = [{ TABLE_NAME: "TEST_TABLE", LATEST_TIMESTAMP: "123", TIMESTAMP_COLUMN: "CREATED_AT" }]
  const connection = {
    connect: vi.fn((callback) => callback(null, connection)),
    execute: vi.fn(({ complete }) => complete(null, { getColumns: () => [] }, rows)),
    destroy: vi.fn((callback) => callback(null)),
  }
  vi.mocked(snowflake.createConnection).mockReturnValue(connection as unknown as snowflake.Connection)

  await expect(querySnowflake("SELECT 1")).resolves.toEqual(rows)
  expect(requireDashboardAccess).toHaveBeenCalledOnce()
  expect(connection.execute).toHaveBeenCalledWith(expect.objectContaining({ sqlText: "SELECT 1" }))
  expect(connection.destroy).toHaveBeenCalledOnce()
})
