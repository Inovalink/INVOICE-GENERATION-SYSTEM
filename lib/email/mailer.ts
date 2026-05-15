import nodemailer from 'nodemailer';

export class MailerConfigError extends Error {
  constructor() {
    super('Gmail SMTP credentials are not configured.');
    this.name = 'MailerConfigError';
  }
}

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
    throw new MailerConfigError();
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
