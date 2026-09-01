import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { AuthAdapter, useSupabase } from "@/lib/db-adapter";
import { supabase } from "@/lib/supabase";
import { openDB } from "@/lib/db";

// Update user profile
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { username, firstName, lastName, email, phoneNumber } = await request.json();

    // Validate required fields
    if (!username || !firstName || !lastName || !email || !phoneNumber) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Check for duplicates using database-specific logic
    if (useSupabase('auth')) {
      // Check username
      const { data: usernameCheck } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .neq('id', user.id)
        .maybeSingle();

      if (usernameCheck) {
        return NextResponse.json(
          { error: "Username is already taken" },
          { status: 400 }
        );
      }

      // Check email
      const { data: emailCheck } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .neq('id', user.id)
        .maybeSingle();

      if (emailCheck) {
        return NextResponse.json(
          { error: "Email is already in use by another account" },
          { status: 400 }
        );
      }
    } else {
      const db = await openDB();

      // Check username
      const existingUsername = await db.get(
        `SELECT id FROM users WHERE username = ? AND id != ?`,
        [username, user.id]
      );

      if (existingUsername) {
        await db.close();
        return NextResponse.json(
          { error: "Username is already taken" },
          { status: 400 }
        );
      }

      // Check email
      const existingEmail = await db.get(
        `SELECT id FROM users WHERE email = ? AND id != ?`,
        [email, user.id]
      );

      await db.close();

      if (existingEmail) {
        return NextResponse.json(
          { error: "Email is already in use by another account" },
          { status: 400 }
        );
      }
    }

    // Update user profile using AuthAdapter
    await AuthAdapter.updateUser(user.id, {
      username,
      first_name: firstName,
      last_name: lastName,
      email,
      phone_number: phoneNumber,
    });

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: user.id,
        username,
        firstName,
        lastName,
        email,
        phoneNumber,
      },
    });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
