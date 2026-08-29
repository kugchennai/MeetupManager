import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth-helpers";
import { sendVenueRequestEmail } from "@/lib/emails/send-venue-request";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  const { id: eventId, linkId } = await params;
  const session = await getAuthSession(req);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const result = await sendVenueRequestEmail(session.user, eventId, linkId, {
    subject: typeof body.subject === "string" ? body.subject : "",
    message: typeof body.message === "string" ? body.message : "",
    cc: body.cc,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    success: true,
    sentTo: result.sentTo,
    cc: result.cc,
  });
}
