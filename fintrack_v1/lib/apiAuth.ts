// lib/apiAuth.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession, User } from "./auth";

export interface AuthenticatedRequest extends NextRequest {
  user?: User;
}

// Middleware for API routes that require authentication
export async function requireAuth(
  handler: (request: AuthenticatedRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const session = await getCurrentSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized - Please log in" },
        { status: 401 }
      );
    }

    // Attach user to request for handler to use
    const authenticatedRequest = request as AuthenticatedRequest;
    authenticatedRequest.user = session.user;

    return handler(authenticatedRequest);
  };
}
