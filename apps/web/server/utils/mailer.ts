import nodemailer, { type Transporter } from 'nodemailer'

let transport: Transporter | undefined

function getTransport() {
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'localhost',
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' }
      : undefined,
  })
  return transport
}

export async function sendMail(to: string, subject: string, text: string, html: string) {
  await getTransport().sendMail({
    from: process.env.MAIL_FROM ?? 'One More Brain <no-reply@localhost>',
    to,
    subject,
    text,
    html,
  })
}
