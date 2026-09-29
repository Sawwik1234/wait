import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const STEAM_OPENID = 'https://steamcommunity.com/openid/login';
const IDENTITY_SELECT = 'http://specs.openid.net/auth/2.0/identifier_select';

/**
 * Steam OpenID 2.0 sign-in (no API key required for authentication).
 * An optional STEAM_API_KEY unlocks persona names / avatars via ISteamUser.
 */
@Injectable()
export class SteamService {
  private readonly logger = new Logger(SteamService.name);

  constructor(private readonly config: ConfigService) {}

  /** Build the redirect URL that sends the user to Steam. */
  loginRedirect(origin: string): string {
    const params = new URLSearchParams({
      'openid.ns': 'http://specs.openid.net/auth/2.0',
      'openid.mode': 'checkid_setup',
      'openid.return_to': `${origin}/api/auth/steam/callback`,
      'openid.realm': origin,
      'openid.identity': IDENTITY_SELECT,
      'openid.claimed_id': IDENTITY_SELECT,
    });
    return `${STEAM_OPENID}?${params.toString()}`;
  }

  /**
   * Verify the assertion Steam sent back. Returns the steamid or null.
   * Verification = POST all openid.* params back with mode=check_authentication.
   */
  async verifyCallback(query: Record<string, string>): Promise<string | null> {
    const claimedId = query['openid.claimed_id'];
    if (!claimedId || !/^https:\/\/steamcommunity\.com\/openid\/id\/\d{17}$/.test(claimedId)) {
      return null;
    }

    const body = new URLSearchParams({ 'openid.mode': 'check_authentication' });
    for (const [k, v] of Object.entries(query)) {
      if (k.startsWith('openid.')) body.append(k, v);
    }

    try {
      const res = await fetch(STEAM_OPENID, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      const text = await res.text();
      if (!/is_valid\s*:\s*true/.test(text)) return null;
      return claimedId.split('/').pop() ?? null;
    } catch (e) {
      this.logger.warn(`Steam verify failed: ${e instanceof Error ? e.message : e}`);
      return null;
    }
  }

  /** Optional profile enrichment (persona name) when STEAM_API_KEY is configured. */
  async fetchPersona(steamId: string): Promise<string | null> {
    const key = this.config.get<string>('STEAM_API_KEY', '').trim();
    if (!key) return null;
    try {
      const res = await fetch(
        `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${key}&steamids=${steamId}`,
      );
      const json = (await res.json()) as {
        response?: { players?: { personaname?: string }[] };
      };
      return json.response?.players?.[0]?.personaname ?? null;
    } catch {
      return null;
    }
  }
}
