import type { RequestManager } from '../request-manager';
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

	static fromRequestManager(mng: RequestManager): RequestTimeoutError {
		return new RequestTimeoutError(
			mng.session.origin.toString(),
			mng.method,
			mng.path,
			mng.timeout,
		);
	}
}
