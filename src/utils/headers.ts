import type { HttpHeaders } from '../types';

export const HeadersUtils = {
	lowercase(headers: HttpHeaders): HttpHeaders {
		const normalized: HttpHeaders = {};
		for (const [key, value] of Object.entries(headers)) {
			normalized[key.toLowerCase()] = value;
		}
		return normalized;
	},
};
