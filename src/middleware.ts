import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Only the CRM and login need the session check. The public site and webhooks stay fast.
  matcher: ["/crm/:path*", "/login"],
};
