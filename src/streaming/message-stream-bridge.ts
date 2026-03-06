/**
 * Message Stream Bridge - Monitors Telegram/Reddit for new messages
 * Used by strategy executor for message-triggered strategies
 */

import { EventEmitter } from 'events';

export interface MessageEvent {
  source: 'telegram' | 'reddit';
  chatId?: string;
  subreddit?: string;
  messageId: string;
  text: string;
  author?: string;
  timestamp: Date;
}

export interface MessageFilter {
  chatIds?: string[];
  keywords?: string[];
  regex?: string;
}

type MessageHandler = (msg: MessageEvent) => void;

/** Bridge for real-time message monitoring - polls DB when Telegram client isn't available */
export class MessageStreamBridge extends EventEmitter {
  private pool: any = null;
  private pollIntervalMs = 15_000; // 15s
  private pollTimer: NodeJS.Timeout | null = null;
  private lastMessageId = 0;
  private telegramPoolName = 'telegram';

  /** Set DB pool (from TelegramModule or similar) */
  setPool(pool: any): void {
    this.pool = pool;
  }

  /** Check if message bridge has a DB pool for polling */
  hasPool(): boolean {
    return this.pool != null;
  }

  /** Start polling for new messages */
  start(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => this.poll(), this.pollIntervalMs);
    this.poll();
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /** Check if any new message matches the filter - returns matching messages since lastCheck */
  async getMatchingMessagesSince(
    filter: MessageFilter,
    since: Date
  ): Promise<MessageEvent[]> {
    if (!this.pool) return [];

    try {
      const sinceStr = since.toISOString();
      let query = `
        SELECT id, message_id, chat_id, chat_title, user_id, username, text, date
        FROM telegram_messages
        WHERE created_at > $1
      `;
      const params: any[] = [sinceStr];

      if (filter.chatIds?.length) {
        const placeholders = filter.chatIds.map((_, i) => `$${params.length + i + 1}`).join(',');
        query += ` AND chat_id::text IN (${placeholders})`;
        filter.chatIds.forEach((c) => params.push(c));
      }

      if (filter.keywords?.length) {
        const conditions = filter.keywords.map(
          (_, i) => `text ILIKE $${params.length + i + 1}`
        );
        query += ` AND (${conditions.join(' OR ')})`;
        filter.keywords.forEach((k) => params.push(`%${k}%`));
      }

      if (filter.regex) {
        try {
          query += ` AND text ~* $${params.length + 1}`;
          params.push(filter.regex);
        } catch (_) {}
      }

      query += ` ORDER BY created_at ASC LIMIT 100`;

      const res = await this.pool.query(query, params);
      const rows = res.rows || [];

      return rows.map((r: any) => ({
        source: 'telegram' as const,
        chatId: String(r.chat_id),
        messageId: `${r.chat_id}_${r.message_id}`,
        text: r.text || '',
        author: r.username,
        timestamp: r.date ? new Date(r.date) : new Date(),
      }));
    } catch (_) {
      return [];
    }
  }

  private async poll(): Promise<void> {
    if (!this.pool) return;
    try {
      const res = await this.pool.query(
        `SELECT id, message_id, chat_id, chat_title, username, text, date
         FROM telegram_messages WHERE id > $1 ORDER BY id ASC LIMIT 50`,
        [this.lastMessageId]
      );
      const rows = res.rows || [];
      for (const r of rows) {
        if (r.id > this.lastMessageId) this.lastMessageId = r.id;
        const ev: MessageEvent = {
          source: 'telegram',
          chatId: String(r.chat_id),
          messageId: `${r.chat_id}_${r.message_id}`,
          text: r.text || '',
          author: r.username,
          timestamp: r.date ? new Date(r.date) : new Date(),
        };
        this.emit('message', ev);
      }
    } catch (_) {}
  }
}

export const messageStreamBridge = new MessageStreamBridge();
