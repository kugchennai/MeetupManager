"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Users,
  CheckCircle2,
  MessageSquare,
  Calendar,
  Hand,
  ArrowRight,
  Zap,
  Shield,
  Heart,
  BookOpen,
} from "lucide-react";

const STEPS = [
  {
    number: 1,
    title: "Attend Our Events",
    description:
      "Start by joining our community events. Get to know us, network with fellow members, and experience what we're all about.",
    icon: Calendar,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
  },
  {
    number: 2,
    title: "Volunteer Consistently",
    description:
      "Show your dedication by volunteering at a minimum of 5 events. Start with in-person volunteering on event day — helping with setup, registration, or photography. As you build trust with the team, you'll gradually be invited to help with other tasks like planning and coordination. Consistency is key, and spots are limited, so regular participation demonstrates your commitment.",
    icon: Hand,
    color: "text-green-400",
    bg: "bg-green-400/10",
  },
  {
    number: 3,
    title: "Connect With Us",
    description:
      "Reach out to our team leads or admins. Express your interest in becoming a core member and discuss how you can contribute more.",
    icon: MessageSquare,
    color: "text-purple-400",
    bg: "bg-purple-400/10",
  },
  {
    number: 4,
    title: "Get Approved",
    description:
      "Once the team recognizes your contributions and commitment, you'll be welcomed as an official member — helping us grow the technical ecosystem together.",
    icon: CheckCircle2,
    color: "text-accent",
    bg: "bg-accent/10",
  },
];

const BENEFITS = [
  {
    title: "Create & Lead Events",
    description: "Organize and manage community events from start to finish.",
  },
  {
    title: "Access Speaker Database",
    description: "Connect with and invite speakers for your events.",
  },
  {
    title: "Manage Volunteers",
    description: "Coordinate volunteer teams and assign tasks.",
  },
  {
    title: "Use SOP Templates",
    description: "Access standard operating procedures for consistent event delivery.",
  },
];

export default function HowToBecomeMemberPage() {
  const [meetupName, setMeetupName] = useState("Event Manager");
  const [logoLight, setLogoLight] = useState<string | null>(null);
  const [logoDark, setLogoDark] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(true); // default to dark

  useEffect(() => {
    // Detect system theme preference
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    fetch("/api/settings/public")
      .then((res) => res.json())
      .then((data) => {
        if (data.meetupName) setMeetupName(data.meetupName);
        if (data.logoLight) setLogoLight(data.logoLight);
        if (data.logoDark) setLogoDark(data.logoDark);
      })
      .catch(() => {});
  }, []);

  // Select logo based on theme, with fallbacks
  const logo = isDark ? (logoDark || logoLight) : (logoLight || logoDark);

  return (
    <div className="min-h-screen bg-background">
      {/* Decorative background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 h-full w-full rounded-full bg-accent/5 blur-[120px]" />
        <div className="absolute -bottom-1/2 -right-1/2 h-full w-full rounded-full bg-blue-500/5 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-border bg-surface/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center">
          <Link
            href="/"
            className="flex items-center gap-3 group"
          >
            {logo ? (
              <img src={logo} alt={meetupName} className="h-8 w-auto" />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-accent to-amber-600 flex items-center justify-center shrink-0">
                <Zap className="h-4 w-4 text-accent-fg" />
              </div>
            )}
            <span className="font-semibold font-[family-name:var(--font-display)] text-sm group-hover:text-accent transition-colors">
              {meetupName}
            </span>
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 max-w-4xl mx-auto px-6 py-12">
        {/* Hero */}
        <div className="text-center mb-16">
          {logo ? (
            <img src={logo} alt={meetupName} className="h-20 w-auto mx-auto mb-6" />
          ) : (
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-accent/10 mb-4">
              <Users className="h-7 w-7 text-accent" />
            </div>
          )}
          <h1 className="text-3xl sm:text-4xl font-bold font-[family-name:var(--font-display)] tracking-tight mb-4">
            How to Become a Member
          </h1>
          <p className="text-muted text-lg max-w-2xl mx-auto">
            Join our core team and help shape the community. Here's everything you need to know about becoming a member.
          </p>
        </div>

        {/* Our Expectation */}
        <section className="mb-16">
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                <Heart className="h-6 w-6 text-accent" />
              </div>
              <div>
                <h2 className="text-lg font-semibold font-[family-name:var(--font-display)] mb-2">
                  What We Expect From You
                </h2>
                <p className="text-muted leading-relaxed mb-4">
                  As a volunteer or member, we also want you to <strong className="text-foreground">learn</strong> and <strong className="text-foreground">give back</strong> to the community.
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="flex items-start gap-2">
                    <BookOpen className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                    <span className="text-sm text-muted">
                      <strong className="text-foreground">Learn</strong> — Grow your skills through active participation
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Heart className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                    <span className="text-sm text-muted">
                      <strong className="text-foreground">Give Back</strong> — Share knowledge and help others grow
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Steps */}
        <section className="mb-16">
          <h2 className="text-xl font-semibold font-[family-name:var(--font-display)] mb-8 flex items-center gap-2">
            <ArrowRight className="h-5 w-5 text-accent" />
            Steps to Join
          </h2>
          <div className="space-y-4">
            {STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.number}
                  className={cn(
                    "rounded-xl border border-border bg-surface p-6",
                    "hover:border-accent/30 transition-colors"
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className={cn("h-10 w-10 rounded-lg shrink-0 flex items-center justify-center", step.bg)}>
                      <Icon className={cn("h-5 w-5", step.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs font-medium text-muted bg-muted/10 px-2 py-0.5 rounded">
                          Step {step.number}
                        </span>
                        <h3 className="font-semibold">{step.title}</h3>
                      </div>
                      <p className="text-muted text-sm leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Benefits */}
        <section className="mb-16">
          <h2 className="text-xl font-semibold font-[family-name:var(--font-display)] mb-8 flex items-center gap-2">
            <Shield className="h-5 w-5 text-accent" />
            Member Benefits
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {BENEFITS.map((benefit) => (
              <div
                key={benefit.title}
                className="rounded-xl border border-border bg-surface p-5"
              >
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium mb-1">{benefit.title}</h3>
                    <p className="text-sm text-muted">{benefit.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border py-6 mt-12">
        <div className="max-w-4xl mx-auto px-6 text-center text-sm text-muted">
          <p>© {new Date().getFullYear()} {meetupName}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
