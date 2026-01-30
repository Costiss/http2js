import type { IncomingHttpHeaders } from 'node:http';
import type { ClientHttp2Stream, IncomingHttpStatusHeader } from 'node:http2';
import { hrtime } from 'node:process';
import { RequestTimeoutError } from './errors/timeout';
import { Http2Response } from './response';
import type { Http2Session } from './session';
import type { Http2RequestOptions, HttpHeaders, HttpMethod } from './types';
import { HeadersUtils } from './utils/headers';
import { createRequestMetrics } from './utils/meter';

type RequestMetrics = ReturnType<typeof createRequestMetrics>;

export type RequestContext = {
	duration: () => number;
	stream: ClientHttp2Stream;
	headers: HttpHeaders;
	rawBody: Buffer;
	error?: Error;
	statusCode?: number;
};

export interface RequestConfig {
	session: Http2Session;
	method: HttpMethod;
	path: string;
	options: Http2RequestOptions;
	headers: HttpHeaders;
	timeout: number;
}

export class RequestManager implements RequestConfig {
	readonly session: Http2Session;
	readonly method: HttpMethod;
	readonly path: string;
	readonly options: Http2RequestOptions;
	readonly headers: HttpHeaders;
	readonly timeout: number;
	private readonly metrics: RequestMetrics;

	constructor(
		session: Http2Session,
		{
			method,
			path,
			options,
		}: { method: HttpMethod; path: string; options?: Http2RequestOptions },
	) {
		this.method = method;
		this.path = path;
		this.session = session;
		this.options = {
			...session.defaultOptions,
			...options,
			headers: {
				...session.defaultOptions.headers,
				...options?.headers,
			},
		};
		this.headers = HeadersUtils.lowercase(this.options?.headers || {});
		this.timeout = options?.timeout || session.defaultOptions.timeout;
		this.metrics = createRequestMetrics(this.session.origin);
	}

	public getRequestConfig(): RequestConfig {
		return {
			session: this.session,
			method: this.method,
			headers: this.headers,
			options: this.options,
			path: this.path,
			timeout: this.timeout,
		};
	}

	public doRequest = () =>
		new Promise<Http2Response>((resolve, reject) => {
			const { duration } = this.preRequestHook();
			const stream = this.session.session.request({
				':method': this.method,
				':path': this.path,
				...this.headers,
			});
			const ctx: RequestContext = {
				duration,
				stream,
				headers: {},
				rawBody: Buffer.alloc(0),
			};

			stream.setTimeout(this.timeout, () => {
				this.postRequestHook(ctx);
				reject(RequestTimeoutError.fromRequestManager(this));
			});

			stream.on('response', (headers) => {
				this.handleResponseHeaders(headers, ctx);
			});

			stream.on('data', (chunk: Buffer) => {
				this.handleResponseData(chunk, ctx);
			});

			stream.on('end', () => {
				this.postRequestHook(ctx);
				resolve(Http2Response.fromRequestContext(ctx, this.getRequestConfig()));
			});

			stream.on('error', (error) => {
				ctx.error = error;
				this.postRequestHook(ctx);
				reject(error);
			});

			this.handleRequestBody(ctx);
		});

	private preRequestHook(): { duration: () => number } {
		const startTime = hrtime.bigint();
		const duration = () => Number(hrtime.bigint() - startTime) / 1_000_000;
		this.metrics.incrementActiveRequests();
		this.metrics.incrementTotalRequests();

		return { duration };
	}

	private postRequestHook(ctx: RequestContext): void {
		this.metrics.decrementActiveRequests();
		this.metrics.recordRequestDuration(ctx.duration(), {
			http_method: this.method,
			http_route: this.path,
			http_status_code: ctx.statusCode,
			error_type: ctx.error?.name,
		});
		ctx.stream.close();
	}

	private handleResponseHeaders(
		headers: IncomingHttpHeaders & IncomingHttpStatusHeader,
		ctx: RequestContext,
	): void {
		const status = headers[':status'];

		if (typeof status === 'string') {
			ctx.statusCode = parseInt(status, 10);
		} else if (Array.isArray(status) && status.length > 0) {
			ctx.statusCode = parseInt(status[0], 10);
		} else {
			ctx.statusCode = -1;
		}

		delete headers[':status'];
		ctx.headers = headers as HttpHeaders;
	}

	private handleResponseData(chunk: Buffer, ctx: RequestContext): void {
		ctx.rawBody = Buffer.concat([ctx.rawBody, chunk]);
	}

	private handleRequestBody(ctx: RequestContext) {
		if (!this.options.body) {
			ctx.stream.end();
			return;
		}

		const isJsonHeader =
			this.headers['content-type'] === 'application/json' || !this.headers['content-type'];
		if (typeof this.options.body === 'object' && isJsonHeader) {
			try {
				this.options.body = JSON.stringify(this.options.body);
				this.headers['content-type'] = 'application/json';
			} catch (_) {}
		}

		if (!this.headers['content-type'])
			this.headers['content-type'] = 'application/octet-stream';

		const bytes = Buffer.isBuffer(this.options.body)
			? this.options.body
			: Buffer.from(String(this.options.body));

		this.headers['content-length'] = String(bytes.length);

		ctx.stream.end(bytes);
	}
}
