import type { MailMessage } from './mail.service.js';

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );

function layout(title: string, body: string, action: { label: string; url: string }): string {
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f5f5f5;font-family:system-ui,sans-serif;color:#171717">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px">
    <h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(title)}</h1>
    ${body}
    <p style="margin:24px 0"><a href="${escapeHtml(action.url)}" style="background:#171717;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block">${escapeHtml(action.label)}</a></p>
    <p style="font-size:12px;color:#737373">If the button doesn't work, paste this link into your browser:<br>${escapeHtml(action.url)}</p>
  </div>
</body></html>`;
}

const greeting = (name: string | null) => (name ? `Hi ${name},` : 'Hi,');

export function verifyEmailMessage(to: string, name: string | null, url: string): MailMessage {
  return {
    to,
    subject: 'Verify your email for ApplyTracker',
    text: `${greeting(name)}\n\nConfirm your email address by opening this link (valid for 24 hours):\n${url}\n`,
    html: layout(
      'Verify your email',
      `<p>${escapeHtml(greeting(name))}</p><p>Confirm your email address to finish setting up ApplyTracker. This link is valid for 24 hours.</p>`,
      { label: 'Verify email', url },
    ),
  };
}

export function resetPasswordMessage(to: string, name: string | null, url: string): MailMessage {
  return {
    to,
    subject: 'Reset your ApplyTracker password',
    text: `${greeting(name)}\n\nReset your password by opening this link (valid for 1 hour):\n${url}\n\nIf you didn't request this, you can ignore this email.\n`,
    html: layout(
      'Reset your password',
      `<p>${escapeHtml(greeting(name))}</p><p>We received a request to reset your password. This link is valid for 1 hour.</p><p>If you didn't request this, you can safely ignore this email.</p>`,
      { label: 'Reset password', url },
    ),
  };
}
