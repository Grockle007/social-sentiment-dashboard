import nodemailer from 'nodemailer';

const gmailUser = process.env.GMAIL_USER;
const gmailPass = process.env.GMAIL_APP_PASSWORD;
const toEmail = process.env.MY_EMAIL_ADDRESS; // User's email

export async function sendDailyEmail(subject: string, htmlContent: string) {
    if (!gmailUser || !gmailPass || !toEmail) {
        console.warn("Gmail credentials missing. Email not sent.");
        console.log("Would have sent Email:", subject);
        return { success: false, error: "Missing credentials" };
    }

    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: gmailUser,
                pass: gmailPass,
            },
        });

        console.log("Attempting to send email to:", toEmail);
        const info = await transporter.sendMail({
            from: `"Tidal Mariner" <${gmailUser}>`,
            to: toEmail,
            subject: subject,
            html: htmlContent,
        });
        console.log("Email sent successfully. Message ID:", info.messageId);

        return { success: true, messageId: info.messageId };
    } catch (error: any) {
        console.error("Failed to send Email (Nodemailer Error):", error);
        return { success: false, error: error.message };
    }
}
