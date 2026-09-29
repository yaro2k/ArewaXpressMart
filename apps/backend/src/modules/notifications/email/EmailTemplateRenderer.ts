export interface RenderedEmail { subject: string; text: string; html: string; }
const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

export function renderVerificationEmail(input: { token: string; expiresAt: Date; appName?: string }): RenderedEmail {
  const appName = input.appName ?? 'ArewaXpressMart'; const token = escapeHtml(input.token); const expiry = input.expiresAt.toISOString();
  return { subject: `${appName} email verification`, text: `Your verification token is ${input.token}. It expires at ${expiry}.`, html: `<p>Your verification token is <strong>${token}</strong>.</p><p>It expires at ${escapeHtml(expiry)}.</p>` };
}

export interface EmailDeliveryContract { sendVerification(input: { email: string; token: string; expiresAt: Date }): Promise<void>; }
