"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Plug, Sparkles } from "lucide-react";
import { Button, Modal } from "@/components/design-system";
import {
  SKILL_INSTALL_COMMAND,
  SKILLS_SH_URL,
  agentInstallPrompt,
  mcpConfigSnippet,
  mcpEndpointUrl,
} from "@/lib/mcp/install-prompt";

function CopyButton({
  label,
  value,
  variant = "secondary",
  size = "sm",
  disabled,
}: {
  label: string;
  value: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Button type="button" variant={variant} size={size} onClick={onCopy} disabled={disabled}>
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="text-[11px] leading-relaxed bg-background border border-border rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all font-mono text-muted">
      {children}
    </pre>
  );
}

export function McpInstallModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const prompt = agentInstallPrompt(origin);
  const mcpUrl = origin ? mcpEndpointUrl(origin) : "/api/mcp";
  const config = origin ? mcpConfigSnippet(origin) : mcpConfigSnippet("https://YOUR_HOST");

  return (
    <Modal open={open} onClose={onClose} className="p-6 max-w-lg max-h-[85vh] overflow-y-auto">
      <div className="flex items-start gap-3 mb-4">
        <div className="h-10 w-10 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
          <Plug className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h2 className="text-lg font-semibold font-[family-name:var(--font-display)]">
            Install MCP + skill
          </h2>
          <p className="text-sm text-muted mt-0.5">
            Let your coding agent create events, update SOP checklists, assign tasks, and send emails.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-lg border border-accent/25 bg-accent/8 p-3">
          <p className="text-xs font-medium mb-2 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            Fastest path: paste this into your agent
          </p>
          <p className="text-[11px] text-muted mb-3">
            Copies a prompt that installs the skills.sh skill and wires up this app&apos;s MCP server.
          </p>
          <CopyButton label="Copy prompt" value={prompt} variant="primary" size="md" disabled={!origin} />
        </div>

        <div>
          <p className="text-xs font-medium mb-1">1. Skill (skills.sh)</p>
          <p className="text-[11px] text-muted mb-2">
            Browse{" "}
            <a
              href={SKILLS_SH_URL}
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline"
            >
              meetup-manager on skills.sh
            </a>
            , then install:
          </p>
          <CodeBlock>{SKILL_INSTALL_COMMAND}</CodeBlock>
          <div className="mt-2">
            <CopyButton label="Copy command" value={SKILL_INSTALL_COMMAND} />
          </div>
        </div>

        <div>
          <p className="text-xs font-medium mb-1">2. MCP endpoint</p>
          <CodeBlock>{mcpUrl}</CodeBlock>
          <div className="mt-2">
            <CopyButton label="Copy URL" value={mcpUrl} />
          </div>
        </div>

        <div>
          <p className="text-xs font-medium mb-1">3. Agent config</p>
          <p className="text-[11px] text-muted mb-2">
            Sign in once, then get a token via <code className="text-foreground">POST /api/auth/token</code>{" "}
            with your email. Put it in the Bearer header.
          </p>
          <CodeBlock>{config}</CodeBlock>
          <div className="mt-2">
            <CopyButton label="Copy config" value={config} />
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-5">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}
