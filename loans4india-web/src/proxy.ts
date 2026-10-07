import { NextResponse, type NextRequest } from "next/server";
import { envStaff, MIN_PASSWORD, staffDirectory, verifyBasic } from "@/lib/staffAuth";

/**
 * Temporary protection for the staff area: HTTP Basic auth against STAFF_USERS (or ADMIN_USER/ADMIN_PASSWORD)
 * and the accounts the master admin adds on the Staff screen.
 * Replace with proper staff accounts + MFA (PAM) before real customer data goes live.
 */
export async function proxy(req: NextRequest) {
  const weakEnv = envStaff().some((s) => s.password === "change-me-now" || (s.password ?? "").length < MIN_PASSWORD);
  if (!(await staffDirectory()).length || (process.env.NODE_ENV === "production" && weakEnv)) {
    return new NextResponse("Admin is not configured.", { status: 503 });
  }
  if (await verifyBasic(req.headers.get("authorization"))) return NextResponse.next();
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="LoansForIndia staff", charset="UTF-8"' },
  });
}

export const config = { matcher: ["/admin/:path*"] };
