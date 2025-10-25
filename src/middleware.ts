import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const isAuth = !!token
    const isAuthPage = req.nextUrl.pathname.startsWith("/login")
    const isApiAuthRoute = req.nextUrl.pathname.startsWith("/api/auth")

    // Allow API auth routes
    if (isApiAuthRoute) {
      return NextResponse.next()
    }

    // Redirect authenticated users away from login page
    if (isAuthPage && isAuth) {
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }

    // Redirect unauthenticated users to login page
    if (!isAuthPage && !isAuth) {
      return NextResponse.redirect(new URL("/login", req.url))
    }

    // Role-based access control
    if (isAuth && token) {
      const { pathname } = req.nextUrl
      const userRole = token.role as string

      // Admin routes
      if (pathname.startsWith("/admin") && userRole !== "ADMIN") {
        return NextResponse.redirect(new URL("/dashboard", req.url))
      }

      // Create route - available for all roles
      if (pathname.startsWith("/create") && !["REQUESTER", "ACCOUNTING", "BUDGET", "TREASURY", "MAYOR", "ADMIN", "DEPARTMENT_HEAD", "FINANCE_HEAD", "GSO", "HR", "BAC", "SECRETARY"].includes(userRole)) {
        return NextResponse.redirect(new URL("/dashboard", req.url))
      }
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Allow access to login page and API auth routes without token
        if (req.nextUrl.pathname.startsWith("/login") || 
            req.nextUrl.pathname.startsWith("/api/auth")) {
          return true
        }
        
        // Require token for all other routes
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
}
