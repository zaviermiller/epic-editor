/**
 * PAT (Personal Access Token) Authentication Route
 *
 * Allows users to authenticate using a GitHub Personal Access Token
 * as an alternative to the OAuth flow.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

interface PatRequest {
  token: string;
}

interface PatResponse {
  success: boolean;
  error?: string;
  user?: {
    id: number;
    login: string;
    avatar_url: string;
    name: string | null;
  };
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<PatResponse>> {
  try {
    const body: PatRequest = await request.json();
    const { token } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { success: false, error: "Token is required" },
        { status: 400 },
      );
    }

    // Validate the token by fetching user info from GitHub
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error("GitHub API error:", errorText);

      if (userResponse.status === 401) {
        return NextResponse.json(
          { success: false, error: "Invalid or expired token" },
          { status: 401 },
        );
      }

      return NextResponse.json(
        { success: false, error: "Failed to validate token with GitHub" },
        { status: userResponse.status },
      );
    }

    const userData = await userResponse.json();

    // Set cookies for the PAT-based session
    const cookieStore = await cookies();
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 60 * 60 * 24 * 30, // 30 days for PAT
      path: "/",
    };

    cookieStore.set("github_access_token", token, cookieOptions);

    // Store user info in a separate cookie (not httpOnly for client access)
    cookieStore.set(
      "github_user",
      JSON.stringify({
        id: userData.id,
        login: userData.login,
        avatar_url: userData.avatar_url,
        name: userData.name,
      }),
      {
        ...cookieOptions,
        httpOnly: false,
      },
    );

    // Mark this as a PAT-based auth (useful for UI hints)
    cookieStore.set("github_auth_type", "pat", {
      ...cookieOptions,
      httpOnly: false,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: userData.id,
        login: userData.login,
        avatar_url: userData.avatar_url,
        name: userData.name,
      },
    });
  } catch (error) {
    console.error("PAT auth error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
