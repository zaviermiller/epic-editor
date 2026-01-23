/**
 * Logout API Route
 *
 * Clears the authentication cookies to sign out the user.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = await cookies();

  // Clear all auth-related cookies
  cookieStore.delete("github_access_token");
  cookieStore.delete("github_refresh_token");
  cookieStore.delete("github_user");
  cookieStore.delete("github_auth_type");

  return NextResponse.json({ success: true });
}

// Also support GET for simple logout links
export async function GET() {
  const cookieStore = await cookies();

  // Clear all auth-related cookies
  cookieStore.delete("github_access_token");
  cookieStore.delete("github_refresh_token");
  cookieStore.delete("github_user");
  cookieStore.delete("github_auth_type");

  return NextResponse.redirect(
    new URL("/", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  );
}
