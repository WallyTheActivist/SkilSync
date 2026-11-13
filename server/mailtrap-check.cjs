const nodemailer = require("nodemailer");

const e = process.env;

const transport = nodemailer.createTransport({
    host: e.SMTP_HOST,
    port: Number(e.SMTP_PORT),
    secure: e.SMTP_SECURE === "true",
    auth: {
        user: e.SMTP_USER,
        pass: e.SMTP_PASS
    }
});

(async () => {
    try {
        await transport.verify();
        console.log("SMTP connection verified successfully.");

        const result = await transport.sendMail({
            from: e.SMTP_FROM,
            to: "skillsync-test@example.com",
            subject: "SkilSync Mailtrap Connection Test",
            text: "This is a test email confirming that SkilSync can connect to Mailtrap."
        });

        console.log("Test email accepted by Mailtrap.");
        console.log("Message ID:", result.messageId);
    } catch (error) {
        console.error("SMTP test failed:", error.message);
        process.exitCode = 1;
    } finally {
        transport.close();
    }
})();
