import type { HttpMethod } from '../types';

export class RequestTimeoutError extends Error {
	constructor(
		readonly origin: string,
		readonly method: HttpMethod,
		readonly path: string,
		readonly timeout: number,
	) {
		const message = `${method} ${origin}${path} timed out after ${timeout} ms`;

		super(message);
		this.name = 'RequestTimeoutError';
	}
}
