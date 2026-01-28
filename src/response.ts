import type { IncomingHttpHeaders } from 'node:http2';
import type { HttpHeaders } from './types';

export class Http2Response {
	private statusCode: number;
	private responseHeaders: IncomingHttpHeaders;
	private buffer: Buffer;

	constructor(status: number, headers: IncomingHttpHeaders, body: Buffer) {
		this.statusCode = status;
		this.responseHeaders = headers;
		this.buffer = body;
	}

	get status(): number {
		return this.statusCode;
	}

	get headers(): HttpHeaders {
		const result: HttpHeaders = {};
		for (const [key, value] of Object.entries(this.responseHeaders)) {
			if (value === undefined) continue;
			result[key] = value;
		}
		return result;
	}

	async text(): Promise<string> {
		return this.buffer.toString('utf-8');
	}

	async json<T = unknown>(): Promise<T> {
		const text = await this.text();
		return JSON.parse(text) as T;
	}

	get body(): Buffer {
		return this.buffer;
	}
}
