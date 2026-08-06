import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const client = new SESClient({
  region: process.env.AWS_REGION || "us-east-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
});

export async function sendEmail(to: string, subject: string, bodyText: string): Promise<void> {
  const fromEmail = process.env.SES_FROM_EMAIL;
  if (!fromEmail) throw new Error("Missing SES_FROM_EMAIL");

  await client.send(
    new SendEmailCommand({
      Source: fromEmail,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject, Charset: "UTF-8" },
        Body: { Text: { Data: bodyText, Charset: "UTF-8" } },
      },
    })
  );
}
