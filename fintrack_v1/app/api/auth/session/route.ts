// app/api/auth/session/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    return NextResponse.json({
      user: {
        id: session.user.id,
        username: session.user.username,
        email: session.user.email,
        phone_number: session.user.phone_number,
        firstName: session.user.first_name,
        lastName: session.user.last_name,
      },
    });
  } catch (error) {
    console.error("Session check error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
