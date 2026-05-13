import nodemailer from 'nodemailer';

function getMailerConfig() {
  const user = process.env.GMAIL_USER?.trim() ?? '';
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '') ?? '';
  return { user, pass };
}

export async function sendMail(options: {
  to: string;
  subject: string;
  html: string;
}) {
  const { user, pass } = getMailerConfig();

  if (!user || !pass) {
    throw new Error('Gmail SMTP credentials are not configured.');
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: `"Invoice System" <${user}>`,
    ...options,
  });
}
