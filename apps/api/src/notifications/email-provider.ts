export type PasswordResetEmail = { email: string; name: string; resetUrl: string };

export interface EmailProvider {
  sendPasswordResetEmail(message: PasswordResetEmail): Promise<void>;
}

// Intentionally no transport, logging, credentials or storage of links.
export class UnconfiguredEmailProvider implements EmailProvider {
  async sendPasswordResetEmail(): Promise<void> {}
}
