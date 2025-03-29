import { replaceHtmlClassByPrefix } from '../services/regex';
import { ClientPref } from '../types';


export class WikiResponse {
  private _res: Response;

  constructor(res: Response) {
    this._res = res;
  }

  public get res(): Response {
    return this._res;
  }

  public async overrideClientPrefs(clientPrefs: ClientPref[]): Promise<void> {
    const contentType = this.res.headers.get('Content-Type');
    if (!contentType || !contentType.includes('text/html')) {
      return;
    }

    let htmlText = await this.res.text();

    for (const clientPref of clientPrefs) {
      htmlText = replaceHtmlClassByPrefix(htmlText, 'html', clientPref);
    }

    this._res = new Response(htmlText, this._res);
  }
}
