import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }
  return transporter;
}

export async function sendMagicLinkEmail(to: string, url: string): Promise<void> {
  const from = process.env.SMTP_FROM || "MelodIQ <no-reply@melodiq.app>";
  await getTransporter().sendMail({
    from,
    to,
    subject: "Your MelodIQ sign-in link",
    text: `Sign in to MelodIQ: ${url}\n\nThis link expires in 15 minutes and can only be used once.`,
    html: `
      <p>Click the button below to sign in to MelodIQ. This link expires in 15 minutes and can only be used once.</p>
      <p><a href="${url}" style="display:inline-block;padding:10px 20px;background:#ec4899;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Sign in to MelodIQ</a></p>
      <p>Or copy this link: ${url}</p>
    `,
  });
}
