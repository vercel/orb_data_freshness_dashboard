import { Suspense } from "react"
import { querySnowflake } from "@/lib/snowflake"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"

interface TableFreshness {
  TABLE_NAME: string
  LATEST_TIMESTAMP: string | number | Date
  TIMESTAMP_COLUMN: string
}

async function getTableFreshness(): Promise<TableFreshness[]> {
  // Tables with CREATED_AT (preferred)
  // Tables with only UPDATED_AT: ADJUSTMENT_SOURCE, COUPON_REDEMPTION_SOURCE, COUPON_SOURCE, 
  //   DAILY_LINE_ITEM_REVENUE_SOURCE, SUBSCRIPTION_VERSION_SOURCE
  const query = `
    SELECT 'ADJUSTMENT_SOURCE' AS TABLE_NAME, MAX(UPDATED_AT) AS LATEST_TIMESTAMP, 'UPDATED_AT' AS TIMESTAMP_COLUMN FROM DWH_PREP.ORB_DATA_CONNECT.ADJUSTMENT_SOURCE
    UNION ALL
    SELECT 'COUPON_REDEMPTION_SOURCE', MAX(UPDATED_AT), 'UPDATED_AT' FROM DWH_PREP.ORB_DATA_CONNECT.COUPON_REDEMPTION_SOURCE
    UNION ALL
    SELECT 'COUPON_SOURCE', MAX(UPDATED_AT), 'UPDATED_AT' FROM DWH_PREP.ORB_DATA_CONNECT.COUPON_SOURCE
    UNION ALL
    SELECT 'CREDIT_LEDGER_ENTRY_SOURCE', MAX(CREATED_AT), 'CREATED_AT' FROM DWH_PREP.ORB_DATA_CONNECT.CREDIT_LEDGER_ENTRY_SOURCE
    UNION ALL
    SELECT 'CUSTOMER_BALANCE_TRANSACTION_SOURCE', MAX(CREATED_AT), 'CREATED_AT' FROM DWH_PREP.ORB_DATA_CONNECT.CUSTOMER_BALANCE_TRANSACTION_SOURCE
    UNION ALL
    SELECT 'CUSTOMER_SOURCE', MAX(CREATED_AT), 'CREATED_AT' FROM DWH_PREP.ORB_DATA_CONNECT.CUSTOMER_SOURCE
    UNION ALL
    SELECT 'DAILY_LINE_ITEM_REVENUE_SOURCE', MAX(UPDATED_AT), 'UPDATED_AT' FROM DWH_PREP.ORB_DATA_CONNECT.DAILY_LINE_ITEM_REVENUE_SOURCE
    UNION ALL
    SELECT 'INVOICE_LINE_ITEM_BILLING_SOURCE', MAX(UPDATED_AT), 'UPDATED_AT' FROM DWH_PREP.ORB_DATA_CONNECT.INVOICE_LINE_ITEM_BILLING_SOURCE
    UNION ALL
    SELECT 'INVOICE_METADATA_SOURCE', MAX(CREATED_AT), 'CREATED_AT' FROM DWH_PREP.ORB_DATA_CONNECT.INVOICE_METADATA_SOURCE
    UNION ALL
    SELECT 'PLAN_SOURCE', MAX(CREATED_AT), 'CREATED_AT' FROM DWH_PREP.ORB_DATA_CONNECT.PLAN_SOURCE
    UNION ALL
    SELECT 'PRICE_INTERVAL_SOURCE', MAX(CREATED_AT), 'CREATED_AT' FROM DWH_PREP.ORB_DATA_CONNECT.PRICE_INTERVAL_SOURCE
    UNION ALL
    SELECT 'SUBSCRIPTION_SOURCE', MAX(CREATED_AT), 'CREATED_AT' FROM DWH_PREP.ORB_DATA_CONNECT.SUBSCRIPTION_SOURCE
    UNION ALL
    SELECT 'SUBSCRIPTION_VERSION_SOURCE', MAX(UPDATED_AT), 'UPDATED_AT' FROM DWH_PREP.ORB_DATA_CONNECT.SUBSCRIPTION_VERSION_SOURCE
    ORDER BY LATEST_TIMESTAMP DESC
  `
  return querySnowflake<TableFreshness>(query)
}

function parseSnowflakeTimestamp(timestamp: string | number | Date): Date {
  // Handle if it's already a Date
  if (timestamp instanceof Date) {
    return timestamp
  }
  
  // Handle if it's a number (epoch seconds or milliseconds)
  if (typeof timestamp === "number") {
    // If it's in seconds (less than year 3000 in ms), convert to ms
    if (timestamp < 100000000000) {
      return new Date(timestamp * 1000)
    }
    return new Date(timestamp)
  }
  
  // Handle string format "epoch.nanoseconds offset"
  if (typeof timestamp === "string") {
    const [epochPart] = timestamp.split(" ")
    const [seconds] = epochPart.split(".")
    return new Date(Number(seconds) * 1000)
  }
  
  return new Date()
}

function formatDate(date: Date): string {
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

function getRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)

  if (diffHours < 1) {
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    return `${diffMinutes}m ago`
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`
  }
  return `${diffDays}d ago`
}

function getFreshnessStatus(date: Date): { label: string; color: string } {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)

  if (diffHours < 24) {
    return { label: "Fresh", color: "bg-emerald-500/20 text-emerald-400" }
  }
  if (diffHours < 72) {
    return { label: "Stale", color: "bg-amber-500/20 text-amber-400" }
  }
  return { label: "Outdated", color: "bg-red-500/20 text-red-400" }
}

function StatusDot({ date }: { date: Date }) {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)

  let color = "bg-emerald-500"
  if (diffHours >= 72) {
    color = "bg-red-500"
  } else if (diffHours >= 24) {
    color = "bg-amber-500"
  }

  return (
    <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
  )
}

function TableSkeleton() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 13 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-none" />
      ))}
    </div>
  )
}

async function FreshnessTable() {
  let data: TableFreshness[]
  
  try {
    data = await getTableFreshness()
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    const isTokenMissing = errorMessage.includes("ENOENT") && errorMessage.includes("token")
    
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="rounded-full bg-amber-500/10 p-3 mb-4">
          <svg className="h-6 w-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-foreground font-medium mb-1">
          {isTokenMissing ? "Snowflake Not Connected" : "Connection Error"}
        </h3>
        <p className="text-muted-foreground text-sm max-w-sm">
          {isTokenMissing 
            ? "The Snowflake session token is not available. This dashboard requires a valid Snowflake connection."
            : errorMessage}
        </p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-border/50 hover:bg-transparent">
          <TableHead className="text-muted-foreground font-normal text-xs uppercase tracking-wider">Table</TableHead>
          <TableHead className="text-muted-foreground font-normal text-xs uppercase tracking-wider">Latest Record</TableHead>
          <TableHead className="text-muted-foreground font-normal text-xs uppercase tracking-wider">Column</TableHead>
          <TableHead className="text-muted-foreground font-normal text-xs uppercase tracking-wider text-right">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => {
          const date = parseSnowflakeTimestamp(row.LATEST_TIMESTAMP)
          const status = getFreshnessStatus(date)
          return (
            <TableRow key={row.TABLE_NAME} className="border-border/50">
              <TableCell>
                <div className="flex items-center gap-3">
                  <StatusDot date={date} />
                  <code className="font-mono text-sm text-foreground">
                    {row.TABLE_NAME}
                  </code>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-foreground font-mono text-sm">
                    {formatDate(date)}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {getRelativeTime(date)}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                  {row.TIMESTAMP_COLUMN}
                </code>
              </TableCell>
              <TableCell className="text-right">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.color}`}>
                  {status.label}
                </span>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <header className="mb-10">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Orb Data Connect
          </h1>
          <p className="mt-2 text-muted-foreground">
            Data freshness for{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground">
              DWH_PREP.ORB_DATA_CONNECT
            </code>
          </p>
        </header>

        <div className="rounded-lg border border-border/50 overflow-hidden">
          <Suspense fallback={<TableSkeleton />}>
            <FreshnessTable />
          </Suspense>
        </div>
        
        <footer className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
          <span>13 tables</span>
          <span className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              Fresh (&lt;24h)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
              Stale (1-3d)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
              Outdated (&gt;3d)
            </span>
          </span>
        </footer>
      </div>
    </main>
  )
}
