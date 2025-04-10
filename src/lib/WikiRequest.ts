import { parse } from 'cookie';
import { ClientPref } from '../types';
import { WikiResponse } from './WikiResponse';

const DISQUALIFYING_QUERY_KEYS = [
  'action',
  'veaction',
  'diff',
  'curid',
  'oldid',
  'debug',
  'redirect'
];

export class WikiRequest {
  private req: Request;
  private env: Env;
  public readonly cookies: Record<string, string | undefined> = {};
  public readonly url: URL;

  constructor(req: Request, env: Env) {
    this.req = req;
    this.env = env;

    const cookieHeader = this.req.headers.get('Cookie');
    if (cookieHeader) {
      this.cookies = parse(cookieHeader);
    }

    this.url = new URL(this.req.url);
  }

  get targetArticle(): { ns: string; title: string; } | null {
    if (this.url.pathname === '/index.php') {
      const title = this.url.searchParams.get('title');

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
    } else if (this.url.pathname.startsWith('/w/') || this.url.pathname === '/') {
      return { ns: '', title: this.url.pathname.split('/w/')[1] || 'Main_Page' };
    }
      return null;
  }

  get isEligibleForCache(): boolean {
    for (const cookieName of this.env.PRIVATE_COOKIE_NAMES) {
      if (this.cookies[cookieName]) {
        return false;
      }
    }

    const article = this.targetArticle;
    if (!article) {
      return false;
    }

    if (DISQUALIFYING_QUERY_KEYS.some(key => this.url.searchParams.has(key))) {
      return false;
    }

    const cachedNamespaces: string[] = this.env.CACHED_NAMESPACES;
    if (!cachedNamespaces.includes(article.ns)) {
      return false;
    }

    return true;
  }

  getClientPrefs(): ClientPref[] {
    const clientPrefsCookie = this.cookies[this.env.CLIENT_PREFS_COOKIE_NAME];
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

    const res = await fetch(this.req, {
      cf: {
        cacheTtlByStatus: this.isEligibleForCache ? {
          '200': this.env.PAGE_TTL,
          '300-399': -1,
          '404': this.env.MISSING_PAGE_TTL,
          '500-599': -1,
        } : undefined,
        cacheEverything: this.isEligibleForCache,
      }
    });

    return new WikiResponse(res);
  }
}
