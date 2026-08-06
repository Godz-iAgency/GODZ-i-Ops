import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const client = new SNSClient({
  region: process.env.AWS_REGION || "us-east-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
});

// Phone numbers must be E.164 format (e.g. +15125551234).
export async function sendSms(phoneNumber: string, message: string): Promise<void> {
  await client.send(
    new PublishCommand({
      PhoneNumber: phoneNumber,
      Message: message,
      MessageAttributes: {
        "AWS.SNS.SMS.SMSType": { DataType: "String", StringValue: "Transactional" },
      },
    })
  );
}
