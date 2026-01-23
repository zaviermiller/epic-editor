/**
 * Token API Route
 *
 * Returns the access token for use in API requests.
 * This is used by the client-side GitHub API calls.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

interface TokenResponse {
  token: string | null;
}

export async function GET(): Promise<NextResponse<TokenResponse>> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("github_access_token")?.value;

  return NextResponse.json({
    token: accessToken || null,
  });
}
