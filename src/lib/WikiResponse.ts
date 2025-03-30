import { replaceHtmlClasses } from '../services/regex';
import { ClientPref } from '../types';


export class WikiResponse {
  private _res: Response;

  constructor(res: Response) {
    this._res = res;
  }

  public get res(): Response {
    return this._res;
  }

  public overrideClientPrefs(clientPrefs: ClientPref[]) {
    const contentType = this.res.headers.get('Content-Type');
    if (!contentType || !contentType.includes('text/html')) {
      return;
    }

    this._res = replaceHtmlClasses(this._res, clientPrefs);
  }
}
