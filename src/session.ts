import * as http2 from 'node:http2';
import { hrtime } from 'node:process';
import { URL } from 'node:url';
import { RequestTimeoutError } from './errors/timeout';
import { Http2Response } from './response';
import type {
	Http2RequestOptions,
	Http2SessionOptions,
	HttpHeaders,
	HttpMethod,
	HttpProtocol,
} from './types';
import { createSessionMetrics } from './utils/meter';

export class Http2Session implements Disposable {
	readonly session: http2.ClientHttp2Session;
	readonly origin: URL;
	readonly protocol: HttpProtocol;

	private readonly defaultOptions: Http2SessionOptions &
		Required<Pick<Http2SessionOptions, 'timeout'>>;
	private readonly metrics: ReturnType<typeof createSessionMetrics>;
	private readonly startTime: bigint;

	private requestCount: number = 0;
	private isConnected: boolean = false;

	constructor(origin: string, options: Http2SessionOptions = {}) {
		this.origin = new URL(origin);
		this.defaultOptions = { timeout: 30000, ...options };

		// Determine protocol: h2 for HTTPS, h2c for HTTP
		// Can be overridden explicitly via options
		if (options.protocol) {
			this.protocol = options.protocol;
		} else {
			this.protocol = this.origin.protocol === 'https:' ? 'h2' : 'h2c';
		}

		// Validate protocol matches URL scheme
		const isHttps = this.origin.protocol === 'https:';
		if (this.protocol === 'h2' && !isHttps) {
			throw new Error('h2 protocol requires HTTPS URL (https://...)');
		}
		if (this.protocol === 'h2c' && isHttps) {
			throw new Error('h2c protocol requires HTTP URL (http://...)');
		}

		// Create session with appropriate options
		const connectUrl = `${this.origin.protocol}//${this.origin.hostname}:${
			this.origin.port || (isHttps ? 443 : 80)
		}`;

		this.session = http2.connect(connectUrl, options);

		this.session.on('timeout', () => {
			this.cleanup();
		});

		this.session.on('error', (_error) => {
			this.cleanup();
		});

		this.session.on('close', () => {
			this.cleanup();
		});

		this.isConnected = true;
		this.startTime = hrtime.bigint();
		this.metrics = createSessionMetrics(this.origin);
		this.metrics.incrementActiveSessions();
	}

	private async request(
		method: HttpMethod,
		path: string,
		requestOptions: Http2RequestOptions = {},
	): Promise<Http2Response> {
		return new Promise((resolve, reject) => {
			if (!this.isConnected) {
				reject(new Error('Session is not connected'));
				return;
			}
			const options = {
				...this.defaultOptions,
				...requestOptions,
			};
			const timeout = options.timeout ?? this.defaultOptions.timeout;

			// Merge default headers with request headers
			const headers: HttpHeaders = {
				...this.defaultOptions.headers,
				...options.headers,
			};
			//lowercase headers keys
			for (const [key, value] of Object.entries(headers)) {
				headers[key.toLowerCase()] = value;
			}

			const startTime = hrtime.bigint();
			const duration = () => Number(hrtime.bigint() - startTime) / 1_000_000;
			this.metrics.incrementActiveRequests();
			this.metrics.incrementTotalRequests();
			const req = this.session.request({
				':method': method,
				':path': path,
				...headers,
			});

			req.setTimeout(timeout);

			const chunks: Buffer[] = [];
			let statusCode: number = 200;
			let responseHeaders: HttpHeaders = {};

			// Handle response headers
			req.on('response', (headers: Record<string, string | string[]>) => {
				const status = headers[':status'];

				if (typeof status === 'string') {
					statusCode = parseInt(status, 10);
				} else if (Array.isArray(status) && status.length > 0) {
					statusCode = parseInt(status[0], 10);
				} else {
					statusCode = 200;
				}

				delete headers[':status'];
				responseHeaders = headers;
			});

			// Collect data
			req.on('data', (chunk: Buffer) => {
				chunks.push(chunk);
			});

			req.on('timeout', () => {
				reject(new RequestTimeoutError(this.origin.toString(), method, path, timeout));

				this.requestCount = this.requestCount + 1;
				this.metrics.decrementActiveRequests();
				this.metrics.recordRequestDuration(duration(), {
					http_method: method,
					http_route: path,
					error_type: 'timeout',
				});

				req.close();
			});

			// Handle completion
			req.on('end', () => {
				const body = Buffer.concat(chunks);
				const response = new Http2Response(statusCode, responseHeaders, body);
				resolve(response);

				this.requestCount = this.requestCount + 1;
				this.metrics.decrementActiveRequests();
				this.metrics.recordRequestDuration(duration(), {
					http_method: method,
					http_route: path,
					http_status_code: statusCode,
				});
				req.close();
			});

			// Handle errors
			req.on('error', (error) => {
				reject(error);

				this.requestCount = this.requestCount + 1;
				this.metrics.decrementActiveRequests();
				this.metrics.recordRequestDuration(duration(), {
					http_method: method,
					http_route: path,
					error_type: error.name || 'socket_error',
				});

				req.close();
			});

			// Send body if provided
			if (options.body) {
				const isJsonHeader =
					headers['content-type'] === 'application/json' || !headers['content-type'];
				if (typeof options.body === 'object' && isJsonHeader) {
					options.body = JSON.stringify(options.body);
					headers['content-type'] = 'application/json';
				}

				const body =
					typeof options.body === 'string' ? Buffer.from(options.body) : options.body;
				req.end(body);
			} else {
				req.end();
			}
		});
	}

	async get(path: string, options: Http2RequestOptions = {}): Promise<Http2Response> {
		return this.request('GET', path, options);
	}

	async post(path: string, options: Http2RequestOptions = {}): Promise<Http2Response> {
		return this.request('POST', path, options);
	}

	async put(path: string, options: Http2RequestOptions = {}): Promise<Http2Response> {
		return this.request('PUT', path, options);
	}

	async delete(path: string, options: Http2RequestOptions = {}): Promise<Http2Response> {
		return this.request('DELETE', path, options);
	}

	async patch(path: string, options: Http2RequestOptions = {}): Promise<Http2Response> {
		return this.request('PATCH', path, options);
	}

	async head(path: string, options: Http2RequestOptions = {}): Promise<Http2Response> {
		return this.request('HEAD', path, options);
	}

	async options(path: string, options: Http2RequestOptions = {}): Promise<Http2Response> {
		return this.request('OPTIONS', path, options);
	}

	close(): void {
		if (this.isConnected) {
			this.session.close();
			this.cleanup();
		}
	}

	isAlive(): boolean {
		return this.isConnected;
	}

	private cleanup() {
		const duration = Number(hrtime.bigint() - this.startTime) / 1_000_000;
		this.isConnected = false;
		this.metrics.decrementActiveSessions();
		this.metrics.recordSessionDuration(duration);
		this.metrics.recordRequestsPerSession(this.requestCount);
	}

	[Symbol.dispose](): void {
		console.log('Disposing Http2Session');
		this.close();
	}
}
