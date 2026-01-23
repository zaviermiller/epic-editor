/**
 * GitHub OAuth Authorization Route
 *
 * Initiates the GitHub App OAuth flow by redirecting users to GitHub's
 * authorization page with the proper client_id and state parameter.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * Generate a random state string for CSRF protection
 */
function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export async function GET() {
  const clientId = process.env.GITHUB_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json(
      { error: "GitHub OAuth is not configured" },
      { status: 500 },
    );
  }

  // Generate state for CSRF protection
  const state = generateState();

  // Store state in a cookie for verification in the callback
  const cookieStore = await cookies();
  cookieStore.set("github_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutes
    path: "/",
  });

  // Build the GitHub authorization URL
  const params = new URLSearchParams({
    client_id: clientId,
    state: state,
    // The redirect_uri should match one configured in the GitHub App
    // If not provided, GitHub uses the first callback URL from app settings
  });

  // Add redirect_uri if configured
  const redirectUri = process.env.GITHUB_REDIRECT_URI;
  if (redirectUri) {
    params.set("redirect_uri", redirectUri);
  }

  const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;

  return NextResponse.redirect(authUrl);
}
