const { Resend } = require("resend");
const { fromAddress } = require("../utils/email");

const escapeHtml = (value) =>
    String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

exports.submitContactForm = async (req, res) => {
    try {
        const { name, email, company, industry, message } = req.body;

        if (!name || !email || !message) {
            return res.status(400).json({ message: "Name, email, and message are required." });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: "Please provide a valid email address." });
        }

        if (!process.env.RESEND_API_KEY || !process.env.CONTACT_RECEIVER_EMAIL) {
            console.error("Contact form delivery is unavailable: Resend is not configured.");
            return res.status(503).json({
                message: "Contact form delivery is temporarily unavailable. Please try again later.",
            });
        }

        const safe = {
            name: escapeHtml(name.trim()),
            email: escapeHtml(email.trim()),
            company: company ? escapeHtml(company.trim()) : "Not provided",
            industry: industry ? escapeHtml(industry.trim()) : "Not provided",
            message: escapeHtml(message.trim()).replace(/\n/g, "<br>"),
        };
        let FROM_ADDRESS;
        try {
            FROM_ADDRESS = fromAddress(); // same verified-domain sender as OTP emails
        } catch (e) {
            console.error(`Contact form delivery is unavailable: ${e.message}`);
            return res.status(503).json({ message: "Contact form delivery is temporarily unavailable. Please try again later." });
        }
        const resend = new Resend(process.env.RESEND_API_KEY);

        const { error: notifyError } = await resend.emails.send({
            from: FROM_ADDRESS,
            to: process.env.CONTACT_RECEIVER_EMAIL,
            replyTo: email.trim(),
            subject: `New Consultation Request from ${safe.name}`,
            html: `
                <h2>New Consultation Request</h2>
                <table style="border-collapse:collapse;width:100%;max-width:600px">
                    <tr><td style="padding:8px;font-weight:bold;width:120px">Name</td><td style="padding:8px">${safe.name}</td></tr>
                    <tr><td style="padding:8px;font-weight:bold">Email</td><td style="padding:8px"><a href="mailto:${safe.email}">${safe.email}</a></td></tr>
                    <tr><td style="padding:8px;font-weight:bold">Company</td><td style="padding:8px">${safe.company}</td></tr>
                    <tr><td style="padding:8px;font-weight:bold">Industry</td><td style="padding:8px">${safe.industry}</td></tr>
                    <tr><td style="padding:8px;font-weight:bold;vertical-align:top">Message</td><td style="padding:8px">${safe.message}</td></tr>
                </table>
            `,
        });

        if (notifyError) {
            console.error("Resend failed to send the contact notification.");
            return res.status(502).json({
                message: "Unable to deliver your message right now. Please try again later.",
            });
        }

        const { error: replyError } = await resend.emails.send({
            from: FROM_ADDRESS,
            to: email.trim(),
            subject: "We received your consultation request — ESG Officials",
            html: `
                <p>Hi ${safe.name},</p>
                <p>Thank you for reaching out to ESG Officials. We have received your consultation request and will get back to you within 1–2 business days.</p>
                <p><strong>Your message:</strong><br>${safe.message}</p>
                <p>Best regards,<br>ESG Officials Team</p>
            `,
        });

        if (replyError) {
            console.error("Resend failed to send the contact auto-reply.");
        }

        res.status(200).json({
            message: "Thank you! Your consultation request has been received. We will be in touch soon.",
        });
    } catch (error) {
        console.error("Contact Form Error:", error.message);
        res.status(500).json({ message: "Failed to send your message. Please try again later." });
    }
};
