export const SKILL_INSTALL_COMMAND =
  "npx skills add kugchennai/MeetupManager@meetup-manager -g -y";

export const SKILLS_SH_URL =
  "https://skills.sh/kugchennai/MeetupManager/meetup-manager";

export function mcpEndpointUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/mcp`;
}

export function mcpConfigSnippet(origin: string): string {
  const url = mcpEndpointUrl(origin);
  return JSON.stringify(
    {
      mcpServers: {
        "meetup-manager": {
          url,
          headers: {
            Authorization: "Bearer YOUR_ACCESS_TOKEN",
          },
        },
      },
    },
    null,
    2
  );
}

export function agentInstallPrompt(origin: string): string {
  const appOrigin = origin.replace(/\/$/, "") || "https://YOUR_MEETUP_MANAGER_HOST";
  const mcpUrl = mcpEndpointUrl(appOrigin);
  const tokenUrl = `${appOrigin}/api/auth/token`;

  return `Install Meetup Manager for this agent: the skills.sh skill AND the remote MCP server.

1) Install the skill globally (skills.sh / Skills CLI):
${SKILL_INSTALL_COMMAND}

Skill page: ${SKILLS_SH_URL}

2) Connect the MCP server (Streamable HTTP):
- URL: ${mcpUrl}
- Header: Authorization: Bearer <ACCESS_TOKEN>

Cursor / Claude Desktop mcp.json:

${mcpConfigSnippet(appOrigin)}

3) Get an access token after the user has signed in once at ${appOrigin}:
POST ${tokenUrl}
Content-Type: application/json

{ "email": "<user's Meetup Manager email>" }

Never invent a token. If you do not have one, ask the user to paste their access token.

4) Verify with the MCP tool whoami, then you can:
- create events (check whoami.minEventDurationHours)
- read/update SOP checklists
- assign tasks to teammates or self
- list overdue items
- list members, speakers, and venue partners
- send venue request / speaker invitation / event / task emails

Prefer MCP tools over raw REST when both are available.`;
}
