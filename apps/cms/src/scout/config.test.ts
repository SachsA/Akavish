import { describe, expect, it } from 'vitest'
import { botIn, scoutConfig } from './config'

const BOT = {
  DISCORD_BOT_TOKEN: 't',
  DISCORD_APPLICATION_ID: '1',
  DISCORD_PUBLIC_KEY: 'k',
  SCOUT_DISCORD_CHANNEL_ID: '10',
  SCOUT_DISCORD_OWNER_ID: 'o',
}

describe('Discord channels', () => {
  it('posts in the scout channel when no other is set', () => {
    const bot = scoutConfig(BOT).bot!
    for (const c of ['live', 'budget', 'report'] as const)
      expect(botIn(bot, c).channelId).toBe('10')
  })

  it('gives live, budget alerts and the weekly report their own channel', () => {
    const bot = scoutConfig({
      ...BOT,
      SCOUT_DISCORD_LIVE_CHANNEL_ID: '20',
      SCOUT_DISCORD_BUDGET_CHANNEL_ID: '30',
      SCOUT_DISCORD_REPORT_CHANNEL_ID: '40',
    }).bot!
    expect(bot.channelId).toBe('10') // digests and drafts stay
    expect(botIn(bot, 'live').channelId).toBe('20')
    expect(botIn(bot, 'budget').channelId).toBe('30')
    expect(botIn(bot, 'report').channelId).toBe('40')
  })
})
