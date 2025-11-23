import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;
const toNumber = process.env.MY_PHONE_NUMBER; // User's number

export async function sendDailySMS(message: string) {
    if (!accountSid || !authToken || !fromNumber || !toNumber) {
        console.warn("Twilio credentials missing. SMS not sent.");
        console.log("Would have sent SMS:", message);
        return { success: false, error: "Missing credentials" };
    }

    try {
        const client = twilio(accountSid, authToken);
        const response = await client.messages.create({
            body: message,
            from: fromNumber,
            to: toNumber,
        });
        return { success: true, sid: response.sid };
    } catch (error: any) {
        console.error("Failed to send SMS:", error);
        return { success: false, error: error.message };
    }
}
