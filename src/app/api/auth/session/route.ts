/**
 * Session API Route
 *
 * Returns the current user session if authenticated.
 * Used by the client to check authentication status on load.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

interface SessionResponse {
  isAuthenticated: boolean;
  user: {
    id: number;
    login: string;
    avatar_url: string;
    name: string | null;
  } | null;
}

export async function GET(): Promise<NextResponse<SessionResponse>> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("github_access_token")?.value;
  const userCookie = cookieStore.get("github_user")?.value;

  if (!accessToken) {
    return NextResponse.json({
      isAuthenticated: false,
      user: null,
    });
  }

  // Try to parse user info from cookie
  if (userCookie) {
    try {
      const user = JSON.parse(userCookie);
      return NextResponse.json({
        isAuthenticated: true,
        user,
      });
    } catch {
      // If parsing fails, try to fetch fresh user data
    }
  }

  // Fetch fresh user data from GitHub to validate token
  try {
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!userResponse.ok) {
      // Token is invalid, clear cookies
      cookieStore.delete("github_access_token");
      cookieStore.delete("github_refresh_token");
      cookieStore.delete("github_user");

      return NextResponse.json({
        isAuthenticated: false,
        user: null,
      });
    }

    const userData = await userResponse.json();

    // Update user cookie
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
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      },
    );

    return NextResponse.json({
      isAuthenticated: true,
      user: {
        id: userData.id,
        login: userData.login,
        avatar_url: userData.avatar_url,
        name: userData.name,
      },
    });
  } catch {
    return NextResponse.json({
      isAuthenticated: false,
      user: null,
    });
  }
}
