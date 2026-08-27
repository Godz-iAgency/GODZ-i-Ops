import { NextRequest, NextResponse } from "next/server";
import { createVerify } from "crypto";
import { suppressByEmail } from "@/lib/airtable";
import { sendTelegramMessage } from "@/lib/telegram";

// SES publishes bounce and complaint events to an SNS topic that POSTs here.
// The endpoint is public, so every message is signature-verified before it is
// believed -- otherwise anyone could forge a complaint and poison the list, or
// forge silence and hide a real one.

const CERT_HOST = /^sns\.[a-z0-9-]+\.amazonaws\.com$/;

type SnsEnvelope = {
  Type: string;
  MessageId: string;
  TopicArn: string;
  Subject?: string;
  Message: string;
  Timestamp: string;
  SignatureVersion: string;
  Signature: string;
  SigningCertURL: string;
  SubscribeURL?: string;
  Token?: string;
};

const SIGNED_KEYS: Record<string, string[]> = {
  Notification: ["Message", "MessageId", "Subject", "Timestamp", "TopicArn", "Type"],
  SubscriptionConfirmation: ["Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type"],
  UnsubscribeConfirmation: ["Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type"],
};

function canonical(msg: SnsEnvelope): string | null {
  const keys = SIGNED_KEYS[msg.Type];
  if (!keys) return null;
  let out = "";
  for (const key of keys) {
    const value = (msg as unknown as Record<string, string | undefined>)[key];
    // Subject is signed only when the message actually carries one.
    if (value === undefined || value === null) continue;
    out += `${key}\n${value}\n`;
  }
  return out;
}

async function verifySignature(msg: SnsEnvelope): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(msg.SigningCertURL);
  } catch {
    return false;
  }
  // Without this check the signature proves nothing: an attacker would simply
  // point SigningCertURL at a certificate they control.
  if (url.protocol !== "https:" || !CERT_HOST.test(url.hostname)) return false;

  const body = canonical(msg);
  if (!body) return false;

  const res = await fetch(url.toString());
  if (!res.ok) return false;
  const cert = await res.text();

  const algorithm = msg.SignatureVersion === "2" ? "RSA-SHA256" : "RSA-SHA1";
  const verifier = createVerify(algorithm);
  verifier.update(body, "utf8");
  try {
    return verifier.verify(cert, msg.Signature, "base64");
  } catch {
    return false;
  }
}

type SesEvent = {
  notificationType?: string;
  eventType?: string;
  bounce?: {
    bounceType?: string;
    bounceSubType?: string;
    bouncedRecipients?: Array<{ emailAddress?: string }>;
  };
  complaint?: {
    complainedRecipients?: Array<{ emailAddress?: string }>;
    complaintFeedbackType?: string;
  };
};

export async function POST(req: NextRequest) {
  let msg: SnsEnvelope;
  try {
    msg = JSON.parse(await req.text()) as SnsEnvelope;
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  if (!(await verifySignature(msg))) {
    return NextResponse.json({ error: "Bad signature" }, { status: 403 });
  }

  // Only trust topics from this account's SES setup.
  const expectedTopic = process.env.SES_SNS_TOPIC_ARN;
  if (expectedTopic && msg.TopicArn !== expectedTopic) {
    return NextResponse.json({ error: "Unexpected topic" }, { status: 403 });
  }

  if (msg.Type === "SubscriptionConfirmation" && msg.SubscribeURL) {
    const sub = new URL(msg.SubscribeURL);
    if (sub.protocol === "https:" && sub.hostname.endsWith(".amazonaws.com")) {
      await fetch(msg.SubscribeURL);
    }
    return NextResponse.json({ ok: true, confirmed: true });
  }

  if (msg.Type !== "Notification") {
    return NextResponse.json({ ok: true });
  }

  let event: SesEvent;
  try {
    event = JSON.parse(msg.Message) as SesEvent;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const kind = event.notificationType || event.eventType;
  let suppressed = 0;

  if (kind === "Bounce") {
    const type = event.bounce?.bounceType;
    const addresses = (event.bounce?.bouncedRecipients || [])
      .map((r) => r.emailAddress)
      .filter((a): a is string => !!a);

    // Transient bounces are things like a full mailbox -- retryable, and not a
    // reason to burn the contact permanently. Only hard failures suppress.
    if (type === "Permanent") {
      for (const address of addresses) {
        suppressed += await suppressByEmail(address, `Bounce: ${event.bounce?.bounceSubType || "Permanent"}`, true);
      }
    }
  } else if (kind === "Complaint") {
    const addresses = (event.complaint?.complainedRecipients || [])
      .map((r) => r.emailAddress)
      .filter((a): a is string => !!a);
    for (const address of addresses) {
      suppressed += await suppressByEmail(address, `Complaint: ${event.complaint?.complaintFeedbackType || "abuse"}`, false);
    }
    // A complaint is someone hitting "spam". That is the metric AWS watches
    // most closely, so it should never pass by unnoticed.
    if (addresses.length) {
      try {
        await sendTelegramMessage(
          `⚠️ *Spam complaint*\n\n${addresses.join(", ")}\n\nSuppressed from all future sends. Worth reviewing what was sent.`
        );
      } catch {
        // A failed alert must not make SNS retry the whole notification.
      }
    }
  }

  return NextResponse.json({ ok: true, kind, suppressed });
}
