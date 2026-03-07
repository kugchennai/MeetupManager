import * as React from "react";
import {
  EmailLayout,
  styles,
  colors,
  Text,
  Hr,
} from "../components/layout";

interface VolunteerWelcomeProps {
  name: string;
  role?: string | null;
  inviterName: string;
  appUrl: string;
  appName?: string;
  logoUrl?: string;
  leadPhone?: string | null;
  adminPhone?: string | null;
}

export function VolunteerWelcomeEmail({
  name,
  role,
  inviterName,
  appUrl,
  appName,
  logoUrl,
  leadPhone,
  adminPhone,
}: VolunteerWelcomeProps) {
  return (
    <EmailLayout preview={`Welcome to the team, ${name}!`} appName={appName} logoUrl={logoUrl}>
      <Text style={styles.h1}>Welcome Aboard! 🎉</Text>

      <Text style={styles.paragraph}>
        Hi <strong>{name}</strong>,
      </Text>

      <Text style={styles.paragraph}>
        You&apos;ve been added as a <strong>volunteer</strong>
        {role ? ` (${role})` : ""} by{" "}
        <strong>{inviterName}</strong>. We&apos;re excited to have you on the team!
      </Text>

      <Hr style={styles.hr} />

      <Text style={styles.h2}>What&apos;s next?</Text>

      <div style={styles.infoBox}>
        <Text style={{ ...styles.paragraph, margin: "0 0 8px 0" }}>
          • You may be assigned to upcoming events
        </Text>
        <Text style={{ ...styles.paragraph, margin: "0 0 8px 0" }}>
          • You'll receive email notifications for task assignments
        </Text>
        <Text style={{ ...styles.paragraph, margin: "0" }}>
          • Keep an eye on your inbox for event reminders
        </Text>
      </div>

      {(leadPhone || adminPhone) && (
        <div style={{ ...styles.infoBox, backgroundColor: "#F9FAFB", borderColor: "#E5E7EB" }}>
          <Text style={{ ...styles.paragraph, fontWeight: "600", color: colors.text, marginBottom: "8px" }}>
            Contact Information
          </Text>
          {leadPhone && (
            <Text style={{ ...styles.paragraph, margin: "0 0 4px 0", fontSize: "14px" }}>
              <strong>Event Lead:</strong> {leadPhone}
            </Text>
          )}
          {adminPhone && (
            <Text style={{ ...styles.paragraph, margin: "0", fontSize: "14px" }}>
              <strong>Admin:</strong> {adminPhone}
            </Text>
          )}
        </div>
      )}

      <Hr style={styles.hr} />

      <Text style={styles.paragraph}>
        If you have any questions, reach out to your event lead or reply to this
        email.
      </Text>

      <div style={{ textAlign: "center" as const, marginTop: "24px" }}>
        <a
          href={appUrl}
          style={{
            display: "inline-block",
            backgroundColor: colors.accent,
            color: "#FFFFFF",
            fontWeight: 600,
            fontSize: "14px",
            padding: "12px 28px",
            borderRadius: "8px",
            textDecoration: "none",
          }}
        >
          Visit Meetup Manager
        </a>
      </div>
    </EmailLayout>
  );
}
