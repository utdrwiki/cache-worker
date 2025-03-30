export interface LogLine {
  [key: string]: any;

  event: string;
  error?: Error;
}

export interface ClassReplacement {
  classPrefix: string;
  className: string;
}

export interface ClientPref extends ClassReplacement {}
