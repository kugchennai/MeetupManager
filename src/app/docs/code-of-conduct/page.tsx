"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Zap, Scale, ShieldCheck } from "lucide-react";

const DEFAULT_COC_CONTENT = `
<p>We are committed to a welcoming, safe, and inclusive community experience for everyone.</p>
<ul>
  <li>Treat members, volunteers, speakers, and guests with respect.</li>
  <li>Avoid harassment, intimidation, discrimination, or personal attacks.</li>
  <li>Do not share private information without consent.</li>
  <li>Help us maintain a constructive, collaborative atmosphere.</li>
</ul>
<p>If you witness or experience a violation, contact an event lead, organizer, or admin as soon as possible.</p>
<p>Violations may result in warnings, removal from events/channels, temporary suspension, or permanent removal from the community.</p>
`;

function sanitizeHtmlContent(input: string): string {
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[\s\S]*?>[\s\S]*?<\/embed>/gi, "")
    .replace(/\son\w+=(["']).*?\1/gi, "")
    .replace(/\son\w+=([^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, '$1="#"');
}

export default function CodeOfConductPage() {
  const { data: session } = useSession();
  const [meetupName, setMeetupName] = useState("Event Manager");
  const [logoLight, setLogoLight] = useState<string | null>(null);
  const [logoDark, setLogoDark] = useState<string | null>(null);
  const [codeOfConductContent, setCodeOfConductContent] = useState("");
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const root = document.documentElement;
    setIsDark(root.classList.contains("dark"));
    const observer = new MutationObserver(() => {
      setIsDark(root.classList.contains("dark"));
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    fetch("/api/settings/public")
      .then((res) => res.json())
      .then((data) => {
        if (data.meetupName) setMeetupName(data.meetupName);
        if (data.logoLight) setLogoLight(data.logoLight);
        if (data.logoDark) setLogoDark(data.logoDark);
        if (typeof data.codeOfConductContent === "string") {
          setCodeOfConductContent(data.codeOfConductContent);
        }
      })
      .catch(() => {});
  }, []);

  const logo = isDark ? (logoLight || logoDark) : (logoDark || logoLight);
  const content = (codeOfConductContent || DEFAULT_COC_CONTENT).trim();
  const safeHtml = sanitizeHtmlContent(content);
  const isSuperAdmin = session?.user?.globalRole === "SUPER_ADMIN";

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 h-full w-full rounded-full bg-accent/5 blur-[120px]" />
        <div className="absolute -bottom-1/2 -right-1/2 h-full w-full rounded-full bg-emerald-500/5 blur-[120px]" />
      </div>

      <header className="relative z-10 border-b border-border bg-surface/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-center">
          <Link href="/" className="flex items-center gap-3 group">
            {logo ? (
              <img src={logo} alt={meetupName} className="h-12 w-auto" />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-accent to-amber-600 flex items-center justify-center shrink-0">
                <Zap className="h-5 w-5 text-accent-fg" />
              </div>
            )}
            <span className="font-semibold font-[family-name:var(--font-display)] text-sm group-hover:text-accent transition-colors">
              {meetupName}
            </span>
          </Link>
        </div>
      </header>

      <main className="relative z-10 max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-accent/10 mb-4">
            <Scale className="h-7 w-7 text-accent" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold font-[family-name:var(--font-display)] tracking-tight mb-4">
            Public Code of Conduct
          </h1>
          <p className="text-muted text-lg max-w-2xl mx-auto">
            Our community is built on trust, respect, and accountability. This
            code applies to all events, online spaces, and team interactions.
          </p>
        </div>

        <section className="mb-16">
          <div className="rounded-xl border border-border bg-surface p-6 sm:p-8">
            {isSuperAdmin && (
              <div className="flex items-center gap-2 mb-5">
                <ShieldCheck className="h-5 w-5 text-accent" />
                <p className="text-sm font-medium">This policy is managed in workspace settings.</p>
              </div>
            )}
            <div
              className="text-sm text-muted leading-relaxed space-y-4 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:text-accent [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-accent [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-accent [&_h4]:font-semibold [&_h4]:text-accent [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_a]:text-accent [&_a]:underline [&_strong]:text-foreground"
              dangerouslySetInnerHTML={{ __html: safeHtml }}
            />
          </div>
        </section>

      </main>

      <footer className="relative z-10 border-t border-border py-6 mt-12">
        <div className="max-w-4xl mx-auto px-6 text-center text-sm text-muted">
          <p>
            By participating in {meetupName}, you agree to uphold this Code of
            Conduct.
          </p>
        </div>
      </footer>
    </div>
  );
}
