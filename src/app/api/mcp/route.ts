import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { registerMeetupTools } from "@/lib/mcp/register-tools";
import { verifyMcpToken } from "@/lib/mcp/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const handler = createMcpHandler(
  (server) => {
    registerMeetupTools(server);
  },
  {
    serverInfo: {
      name: "meetup-manager",
      version: "0.1.0",
    },
    instructions:
      "Meetup Manager MCP server. Authenticate with a Bearer access token from POST /api/auth/token (or a session cookie). Use list_sop_templates before create_event. Assign SOP work with assign_task or update_sop_task. Trigger emails with send_venue_request_email, send_speaker_invitation, send_event_created_email, or send_task_assigned_email.",
  }
);

const authHandler = withMcpAuth(handler, verifyMcpToken, {
  required: true,
  requiredScopes: ["meetup"],
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

export { authHandler as GET, authHandler as POST };
