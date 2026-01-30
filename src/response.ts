import type { IncomingHttpHeaders } from 'node:http2';
import type { RequestConfig, RequestContext } from './request-manager';
import type { HttpHeaders } from './types';

export class Http2Response {
	private statusCode: number;
	private responseHeaders: IncomingHttpHeaders;
	private buffer: Buffer;
	readonly request: RequestConfig;

	constructor(
		status: number,
		headers: IncomingHttpHeaders,
		body: Buffer,
		request: RequestConfig,
	) {
		this.statusCode = status;
		this.responseHeaders = headers;
		this.buffer = body;
		this.request = request;
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

	async text(): Promise<string | undefined> {
		if (this.buffer.length === 0) return undefined;
		return this.buffer.toString('utf-8');
	}

	async json<T = unknown>(): Promise<T> {
		const text = await this.text();
		if (!text) return undefined as unknown as T;
		return JSON.parse(text) as T;
	}

	get body(): Buffer {
		return this.buffer;
	}

	static fromRequestContext(ctx: RequestContext, config: RequestConfig): Http2Response {
		return new Http2Response(ctx.statusCode as number, ctx.headers, ctx.rawBody, config);
	}
}
