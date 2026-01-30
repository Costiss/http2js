import type { HttpHeaders, QueryParams } from '../types';

export const HttpUtils = {
	lowercaseHeaders(headers: HttpHeaders): HttpHeaders {
		const normalized: HttpHeaders = {};
		for (const [key, value] of Object.entries(headers)) {
			normalized[key.toLowerCase()] = value;
		}
		return normalized;
	},
	buildPath(path: string, query?: QueryParams): string {
		if (!query || Object.keys(query).length === 0) {
			return path;
		}
		const url = new URL(path, 'http://localhost');
		for (const [key, value] of Object.entries(query)) {
			if (value === undefined) continue;
			if (
				typeof value === 'string' ||
				typeof value === 'number' ||
				typeof value === 'boolean'
			) {
				url.searchParams.append(key, String(value));
			} else {
				url.searchParams.append(key, JSON.stringify(value));
			}
		}
		return url.pathname + url.search;
	},
};
