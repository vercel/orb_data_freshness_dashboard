import NextAuth from "next-auth"
import type { NextRequest } from "next/server"
import { authOptions, isAuthConfigured } from "@/lib/auth"

const handler = NextAuth(authOptions)

async function handleAuth(
  request: NextRequest,
  context: { params: Promise<{ nextauth: string[] }> },
) {
  if (!isAuthConfigured()) {
    return new Response("Authentication is unavailable.", {
      status: 503,
      headers: { "Cache-Control": "private, no-store" },
    })
  }

  return handler(request, context)
}

export { handleAuth as GET, handleAuth as POST }
