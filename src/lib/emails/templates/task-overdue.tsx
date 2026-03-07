import * as React from "react";
import {
  EmailLayout,
  DetailTable,
  DetailItem,
  styles,
  Text,
  Hr,
  Link,
} from "../components/layout";

interface TaskOverdueProps {
  taskTitle: string;
  deadline: string;
  overdueDays: number;
  eventName: string;
  taskUrl: string;
  priority: string;
  isEscalation?: boolean;
  appName?: string;
  logoUrl?: string;
  leadPhone?: string | null;
  adminPhone?: string | null;
}

export function TaskOverdueEmail({
  taskTitle,
  deadline,
  overdueDays,
  eventName,
  taskUrl,
  priority,
  isEscalation = false,
  appName,
  logoUrl,
  leadPhone,
  adminPhone,
}: TaskOverdueProps) {
  return (
    <EmailLayout preview={`OVERDUE: ${taskTitle} is ${overdueDays} day(s) past deadline`} appName={appName} logoUrl={logoUrl}>
      <Text style={styles.h1}>Task Overdue 🚨</Text>

      <div style={styles.dangerBox}>
        <Text style={{ fontSize: "16px", fontWeight: "700", margin: 0, color: "#991B1B" }}>
          &ldquo;{taskTitle}&rdquo; is {overdueDays} day{overdueDays !== 1 ? "s" : ""} overdue!
        </Text>
      </div>

      {isEscalation && (
        <div style={styles.warningBox}>
          <Text style={{ ...styles.paragraph, margin: 0, fontWeight: "600" }}>
            ⚠️ This is an escalation notice. The event lead has been CC&apos;d on this message.
          </Text>
        </div>
      )}

      <Text style={styles.paragraph}>
        The following task has passed its deadline and needs immediate attention.
        Please complete it as soon as possible or reach out to your team lead
        if you need help.
      </Text>

      <DetailTable>
        <DetailItem label="Task" value={taskTitle} />
        <DetailItem label="Event" value={eventName} />
        <DetailItem label="Priority" value={priority} />
        <DetailItem label="Deadline" value={deadline} />
        <DetailItem label="Overdue By" value={`${overdueDays} day${overdueDays !== 1 ? "s" : ""}`} />
        {leadPhone && <DetailItem label="Lead Phone" value={leadPhone} />}
        {adminPhone && <DetailItem label="Admin Phone" value={adminPhone} />}
      </DetailTable>

      <Hr style={styles.hr} />

      <div style={{ textAlign: "center", margin: "24px 0" }}>
        <Link href={taskUrl} style={styles.buttonDanger}>
          Complete Task Now
        </Link>
      </div>

      <Text style={styles.muted}>
        You&apos;re receiving this because this overdue task is assigned to you.
      </Text>
    </EmailLayout>
  );
}

export default TaskOverdueEmail;
