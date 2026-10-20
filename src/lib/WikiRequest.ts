import { parseCookie, Cookies } from 'cookie';
import { ClientPref } from '../types';
import { WikiResponse } from './WikiResponse';

const DISQUALIFYING_QUERY_KEYS = [
  'action',
  'veaction',
  'diff',
  'curid',
  'oldid',
  'debug',
  'redirect',
  'useparsoid',
  'uselang',
  'useskin',
  'withgadget',
];

interface Article {
  ns: string;
  title: string;
}

enum EligibilityReason {
  HasDisqualifyingQueryKey = 'query',
  HasPrivateCookie = 'cookie',
  NotInCachedNamespace = 'namespace',
  Eligible = 'eligible',
}

export class WikiRequest {
  private req: Request;
  private readonly env: Env;
  private readonly isDev: boolean;
  public readonly cookies: Cookies = {};
  public readonly url: URL;
  public readonly isEligibleForCache: boolean;
  private readonly eligibilityReason: EligibilityReason;
  private _captchaKey: CryptoKey | null = null;

  constructor(req: Request, env: Env) {
    this.req = req;
    this.env = env;

    const cookieHeader = this.req.headers.get('Cookie');
    if (cookieHeader) {
      this.cookies = parseCookie(cookieHeader);
    }

    this.url = new URL(this.req.url);
    this.isDev = this.url.host.startsWith('dev.') || env.IS_DEV;
    this.eligibilityReason = this.getEligibility();
    this.isEligibleForCache = this.eligibilityReason === EligibilityReason.Eligible;
  }

  extractArticle(title: string | null): Article | null {
    if (!title) {
      return { ns: '', title: 'Main_Page' };
    }

    let [ns, articleTitle] = title.split(':');
    if (articleTitle === '') {
      // Invalid title
      return null;
    } else if (!articleTitle) {
      // No namespace given (main)
      articleTitle = ns;
      ns = '';
    }

    return { ns, title: articleTitle };
  }

  get targetArticle(): Article | null {
    if (this.url.pathname === '/index.php') {
      const title = this.url.searchParams.get('title');
      return this.extractArticle(title);
    } else if (this.url.pathname === '/') {
      // NOTE: Not every wiki uses Main_Page as the main page.
      return { ns: '', title: 'Main_Page' };
    } else if (this.url.pathname.startsWith('/w/')) {
      // NOTE: We are not decoding the article URL here, because we don't
      // actually use the title. If we need consistent results on both the
      // index.php path and this path, we would need to decode the URI here.
      // However, we would also have to handle errors with malformed URIs, so
      // we're not doing it right now.
      return this.extractArticle(this.url.pathname.slice(3));
    }
    return null;
  }

  private async getCaptchaKey() {
    if (!this._captchaKey) {
      const encodedKey = new TextEncoder().encode(this.env.BOT_SIGNING_KEY);
      this._captchaKey = await crypto.subtle.importKey('raw', encodedKey, {
        name: 'HMAC',
        hash: 'SHA-256',
      }, false, ['sign', 'verify']);
    }
    return this._captchaKey;
  }

  private getCaptchaPayload(timestamp: number): Uint8Array {
    const ip = this.req.headers.get('cf-connecting-ip') ?? '';
    return new TextEncoder().encode(`${ip}:${timestamp}`);
  }

  public async checkBot(): Promise<boolean> {
    if (this.eligibilityReason === EligibilityReason.HasPrivateCookie) {
      return false;
    }
    if (JSON.parse(this.env.BOT_QUERY_PARAM_ALLOWLIST)
      .some((p: string) => this.url.searchParams.has(p))) {
      return false;
    }
    if (!JSON.parse(this.env.BOT_QUERY_PARAM_BLOCKLIST)
      .some((p: string) => this.url.searchParams.has(p))) {
      return false;
    }
    if (this.cookies['utdrforest-sig'] && this.cookies['utdrforest-ts']) {
      const captchaKey = await this.getCaptchaKey();
      const timestamp = Number(this.cookies['utdrforest-ts']);
      if (timestamp && Date.now() - timestamp < 24 * 60 * 60 * 1000) {
        const payload = this.getCaptchaPayload(timestamp);
        const signature = Buffer.from(this.cookies['utdrforest-sig'], 'hex').buffer;
        if (await crypto.subtle.verify('HMAC', captchaKey, signature, payload)) {
          return false;
        }
      }
    }
    return true;
  }

  public async getCaptchaSignature(timestamp: number): Promise<string> {
    const captchaKey = await this.getCaptchaKey();
    const payload = this.getCaptchaPayload(timestamp);
    const signature = await crypto.subtle.sign('HMAC', captchaKey, payload);
    return Buffer.from(signature).toString('hex');
  }

  getEligibility(): EligibilityReason {
    const cookieNames = this.isDev ?
      this.env.PRIVATE_COOKIE_NAMES_DEV :
      this.env.PRIVATE_COOKIE_NAMES;
    for (const cookieName of cookieNames) {
      if (this.cookies[cookieName]) {
        return EligibilityReason.HasPrivateCookie;
      }
    }

    if (DISQUALIFYING_QUERY_KEYS.some(key => this.url.searchParams.has(key))) {
      return EligibilityReason.HasDisqualifyingQueryKey;
    }

    const article = this.targetArticle;
    const cachedNamespaces: string[] = this.env.CACHED_NAMESPACES;
    if (!article || !cachedNamespaces.includes(article.ns)) {
      return EligibilityReason.NotInCachedNamespace;
    }

    return EligibilityReason.Eligible;
  }

  getClientPrefs(): ClientPref[] {
    const clientPrefsCookie = this.cookies[this.isDev ?
      this.env.CLIENT_PREFS_COOKIE_NAME_DEV :
      this.env.CLIENT_PREFS_COOKIE_NAME];
    if (!clientPrefsCookie) {
      return [];
    }

    const classNames = clientPrefsCookie.split(',').map(className => className.trim());

    const clientPrefs: ClientPref[] = [];

    for (const classPrefix of this.env.CLIENT_PREFS_CLASS_PREFIXES) {
      for (const className of classNames) {
        if (className.startsWith(classPrefix)) {
          clientPrefs.push({
            className,
            classPrefix
          });
          break;
        }
      }
    }

    return clientPrefs;
  }

  async fetch(): Promise<WikiResponse> {
    // Change index.php lookups to go to `/w/` instead.
    const targetArticle = this.targetArticle;
    if (this.isEligibleForCache && targetArticle && this.url.pathname === '/index.php') {
      const { ns, title } = targetArticle;
      this.url.pathname = `/w/${ns ? `${ns}:` : ""}${title}`;
      this.url.search = "";
      this.req = new Request(this.url.toString(), this.req);
    }

    if (this.env.IS_DEV) {
      // Avoid redirect loops in development
      return new WikiResponse(new Response(
        '<!DOCTYPE html><html><head><title>cache-worker</title></head><body>Nothing here!</body></html>',
        {
          headers: {
            'Content-Type': 'text/html',
          }
        }
      ));
    }
    const headers = new Headers(this.req.headers);
    headers.set('X-Eligibility-Reason', this.eligibilityReason);
    const res = await fetch(this.req, {
      cf: {
        cacheTtlByStatus: this.isEligibleForCache ? {
          '200': this.env.PAGE_TTL,
          '300-399': -1,
          '404': this.env.MISSING_PAGE_TTL,
          '500-599': -1,
        } : undefined,
        cacheEverything: this.isEligibleForCache,
      },
      headers,
    });

    return new WikiResponse(res);
  }
}
