import type { AuthInfo } from "@modelcontextprotocol/server";
import { getAuthSession } from "@/lib/auth-helpers";
import type { GlobalRole } from "@/generated/prisma/enums";

export type McpSessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  globalRole: string;
};

export async function verifyMcpToken(
  req: Request,
  bearerToken?: string
): Promise<AuthInfo | undefined> {
  const session = await getAuthSession(req);
  if (!session?.user?.id) return undefined;

  const expiresAt = session.expires
    ? Math.floor(new Date(session.expires).getTime() / 1000)
    : Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;

  return {
    token: bearerToken ?? "cookie-session",
    clientId: session.user.id,
    scopes: ["meetup"],
    expiresAt,
    extra: { user: session.user as McpSessionUser },
  };
}

export function userFromAuth(authInfo?: AuthInfo): McpSessionUser | null {
  const user = authInfo?.extra?.user as McpSessionUser | undefined;
  return user?.id ? user : null;
}

export function roleOf(user: McpSessionUser): GlobalRole {
  return user.globalRole as GlobalRole;
}
