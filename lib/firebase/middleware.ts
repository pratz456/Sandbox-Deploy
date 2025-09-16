import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({
    request,
  });

  try {
    // For Firebase client-side auth, we'll check for the Firebase auth token in cookies
    // Firebase sets a token in localStorage/sessionStorage, but for server-side checks we need cookies
    const firebaseToken = request.cookies.get('firebase-auth-token')?.value ||
                         request.cookies.get('__session')?.value;
    
    // Check if accessing protected routes without auth token
    if (!firebaseToken && shouldRedirectToLogin(request)) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/login";
      url.searchParams.set('redirect', request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }

    // Optional: Verify token with Firebase Admin SDK for enhanced security
    // Uncomment this section if you want server-side token verification
    /*
    if (firebaseToken && shouldRedirectToLogin(request)) {
      try {
        const { verifyIdToken } = await import('./admin');
        const verification = await verifyIdToken(firebaseToken);
        
        if (!verification.success) {
          // Invalid token, redirect to login
          const url = request.nextUrl.clone();
          url.pathname = "/auth/login";
          url.searchParams.set('redirect', request.nextUrl.pathname);
          return NextResponse.redirect(url);
        }
      } catch (adminError) {
        console.error('Firebase Admin verification failed:', adminError);
        // Continue without server-side verification
      }
    }
    */

    return response;
  } catch (error) {
    console.error('Error in Firebase middleware:', error);
    
    // On error, redirect to login if accessing protected routes
    if (shouldRedirectToLogin(request)) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/login";
      url.searchParams.set('redirect', request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
    
    return response;
  }
}

function shouldRedirectToLogin(request: NextRequest): boolean {
  return (
    request.nextUrl.pathname !== "/" &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/auth") &&
    request.nextUrl.pathname.startsWith("/protected")
  );
}