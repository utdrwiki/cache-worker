import { LogLine } from "../types";

export function log(line: LogLine) {
	console[line.error ? 'error' : 'log'](JSON.stringify(line));
}
