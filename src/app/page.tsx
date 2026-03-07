"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { Zap } from "lucide-react";
import { Button } from "@/components/design-system";
import Image from "next/image";

interface PublicSettings {
  meetupName: string;
  logoLight: string | null;
  logoDark: string | null;
}

function LoginContent() {
  const searchParams = useSearchParams();
  const callbackError = searchParams.get("error");
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<PublicSettings>({
    meetupName: "Meetup Manager",
    logoLight: null,
    logoDark: null,
  });
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    fetch("/api/settings/public")
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: Partial<PublicSettings>) => {
        setSettings((prev) => ({
          meetupName: data.meetupName ?? prev.meetupName,
          logoLight: data.logoLight ?? null,
          logoDark: data.logoDark ?? null,
        }));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    setIsDark(root.classList.contains("dark"));
    const observer = new MutationObserver(() => {
      setIsDark(root.classList.contains("dark"));
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const logo = isDark
    ? (settings.logoLight ?? settings.logoDark)
    : (settings.logoDark ?? settings.logoLight);

  const errorMessage =
    callbackError === "AccessDenied"
      ? "Your account has not been added yet. Contact an admin to get access."
      : callbackError
        ? "Something went wrong. Please try again."
        : null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 h-full w-full rounded-full bg-accent/8 blur-[120px]" />
        <div className="absolute -bottom-1/2 -right-1/2 h-full w-full rounded-full bg-rose-500/5 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-sm mx-auto px-6">
        <div className="text-center mb-8">
          {logo ? (
            <div className="flex justify-center mb-4">
              <Image
                src={logo}
                alt={settings.meetupName}
                width={72}
                height={72}
                className="h-18 w-auto object-contain"
                unoptimized
              />
            </div>
          ) : (
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-accent to-amber-600 mb-4">
              <Zap className="h-7 w-7 text-accent-fg" />
            </div>
          )}
          <h1 className="text-2xl font-bold font-[family-name:var(--font-display)] tracking-tight">
            {settings.meetupName}
          </h1>
          <p className="text-sm text-muted mt-1">
            Sign in to manage your community events
          </p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6 space-y-5">
          {errorMessage && (
            <p className="text-sm text-status-blocked bg-status-blocked/10 rounded-lg px-3 py-2.5 text-center">
              {errorMessage}
            </p>
          )}

          <Button
            size="lg"
            className="w-full"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              signIn("google", { callbackUrl: "/dashboard" });
            }}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {loading ? "Redirecting…" : "Sign in with Google"}
          </Button>
        </div>

        <p className="text-center text-[11px] text-muted mt-6">
          By signing in, you agree to help organize amazing meetups.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
