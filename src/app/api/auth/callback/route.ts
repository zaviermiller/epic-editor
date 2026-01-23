/**
 * GitHub OAuth Callback Route
 *
 * Handles the callback from GitHub after user authorization.
 * Exchanges the authorization code for an access token and stores it.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  error?: string;
  error_description?: string;
}

interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
  html_url: string;
  name: string | null;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Handle OAuth errors from GitHub
  if (error) {
    const errorUrl = new URL("/", request.url);
    errorUrl.searchParams.set("auth_error", errorDescription || error);
    return NextResponse.redirect(errorUrl);
  }

  // Validate code and state
  if (!code || !state) {
    const errorUrl = new URL("/", request.url);
    errorUrl.searchParams.set(
      "auth_error",
      "Missing authorization code or state",
    );
    return NextResponse.redirect(errorUrl);
  }

  // Verify state to prevent CSRF attacks
  const cookieStore = await cookies();
  const storedState = cookieStore.get("github_oauth_state")?.value;

  if (!storedState || storedState !== state) {
    const errorUrl = new URL("/", request.url);
    errorUrl.searchParams.set("auth_error", "Invalid state parameter");
    return NextResponse.redirect(errorUrl);
  }

  // Clear the state cookie
  cookieStore.delete("github_oauth_state");

  // Exchange code for access token
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    const errorUrl = new URL("/", request.url);
    errorUrl.searchParams.set("auth_error", "OAuth not configured");
    return NextResponse.redirect(errorUrl);
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
        }),
      },
    );

    const tokenData: GitHubTokenResponse = await tokenResponse.json();

    if (tokenData.error) {
      const errorUrl = new URL("/", request.url);
      errorUrl.searchParams.set(
        "auth_error",
        tokenData.error_description || tokenData.error,
      );
      return NextResponse.redirect(errorUrl);
    }

    // Fetch user info to validate token
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!userResponse.ok) {
      const errorUrl = new URL("/", request.url);
      errorUrl.searchParams.set("auth_error", "Failed to fetch user info");
      return NextResponse.redirect(errorUrl);
    }

    const userData: GitHubUser = await userResponse.json();

    // Store the access token in an HTTP-only cookie
    cookieStore.set("github_access_token", tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: tokenData.expires_in || 60 * 60 * 24 * 7, // Default 7 days if no expiry
      path: "/",
    });

    // Store refresh token if provided (for token refresh flow)
    if (tokenData.refresh_token) {
      cookieStore.set("github_refresh_token", tokenData.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: tokenData.refresh_token_expires_in || 60 * 60 * 24 * 180, // Default 180 days
        path: "/",
      });
    }

    // Store user info in a non-HTTP-only cookie for client access
    // (Only store non-sensitive data)
    cookieStore.set(
      "github_user",
      JSON.stringify({
        id: userData.id,
        login: userData.login,
        avatar_url: userData.avatar_url,
        name: userData.name,
      }),
      {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: tokenData.expires_in || 60 * 60 * 24 * 7,
        path: "/",
      },
    );

    // Redirect to home page with success
    const successUrl = new URL("/", request.url);
    successUrl.searchParams.set("auth", "success");
    return NextResponse.redirect(successUrl);
  } catch (err) {
    console.error("OAuth callback error:", err);
    const errorUrl = new URL("/", request.url);
    errorUrl.searchParams.set("auth_error", "Authentication failed");
    return NextResponse.redirect(errorUrl);
  }
}
