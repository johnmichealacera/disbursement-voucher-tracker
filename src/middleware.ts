import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const isAuth = !!token
    const isAuthPage = req.nextUrl.pathname.startsWith("/login")
    const isApiAuthRoute = req.nextUrl.pathname.startsWith("/api/auth")
    const pathname = req.nextUrl.pathname

    // Allow static files (images, fonts, etc.)
    const isStaticFile = /\.(jpg|jpeg|png|gif|svg|ico|webp|woff|woff2|ttf|eot|pdf)$/i.test(pathname)
    if (isStaticFile) {
      return NextResponse.next()
    }

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
        const pathname = req.nextUrl.pathname
        
        // Allow static files without authentication
        const isStaticFile = /\.(jpg|jpeg|png|gif|svg|ico|webp|woff|woff2|ttf|eot|pdf)$/i.test(pathname)
        if (isStaticFile) {
          return true
        }
        
        // Allow access to login page and API auth routes without token
        if (pathname.startsWith("/login") || 
            pathname.startsWith("/api/auth")) {
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
     * - Static file extensions (handled in middleware function)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}
