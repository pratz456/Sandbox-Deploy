import { updateSession } from "@/lib/firebase/middleware";
import { type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * - api/openai routes (OpenAI analysis endpoints)
     * - api/setup-tables and api/test-accounts-table (setup and test endpoints)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|api/openai|api/setup-tables|api/test-accounts-table|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
