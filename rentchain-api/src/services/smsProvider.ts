export interface SmsProvider {
  send(to: string, message: string): Promise<void>;
}

type StoredMessage = {
  to: string;
  message: string;
  sentAt: number;
};

class DevSmsProvider implements SmsProvider {
  private lastMessage: StoredMessage | null = null;

  async send(to: string, message: string): Promise<void> {
    // No-op send for dev; only store the last message in memory.
    this.lastMessage = { to, message, sentAt: Date.now() };
  }

  getLastMessage(): StoredMessage | null {
    return this.lastMessage;
  }
}

export const smsProvider: SmsProvider = new DevSmsProvider();
