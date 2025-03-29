export interface LogLine {
  [key: string]: any;

  event: string;
  error?: Error;
}

export interface ClientPref {
  classPrefix: string;
  className: string;
}
