import * as http2 from 'node:http2';
import { URL } from 'node:url';
import { RequestTimeoutError } from './errors/timeout';
import { Http2Response } from './response';
import type { Http2RequestOptions, Http2SessionOptions, HttpMethod, HttpProtocol } from './types';

export class Http2Session {
	private origin: URL;
	private session: http2.ClientHttp2Session;
	private defaultOptions: Http2SessionOptions & Required<Pick<Http2SessionOptions, 'timeout'>>;
	private isConnected: boolean = false;
	private protocol: HttpProtocol;

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

		const sessionOptions: http2.ClientSessionOptions = {
			rejectUnauthorized: options.rejectUnauthorized ?? false,
		};

		this.session = http2.connect(connectUrl, sessionOptions);

		// Handle connection errors
		this.session.on('error', (_error) => {
			this.isConnected = false;
			// Connection errors are already handled in request promises
		});

		this.isConnected = true;
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
			const headers: Record<string, string | string[]> = {
				...this.defaultOptions.headers,
				...options.headers,
			};

			// Create request
			const req = this.session.request({
				':method': method,
				':path': path,
				...headers,
			});

			req.setTimeout(timeout);

			const chunks: Buffer[] = [];
			let statusCode: number = 200;
			let responseHeaders: Record<string, string | string[]> = {};

			// Handle response headers
			req.on('response', (headers: Record<string, string | string[]>) => {
				const status = headers[':status'];
				statusCode =
					typeof status === 'string'
						? parseInt(status, 10)
						: (status as unknown as number) || 200;
				delete headers[':status'];
				responseHeaders = headers;
			});

			// Collect data
			req.on('data', (chunk: Buffer) => {
				chunks.push(chunk);
			});

			req.on('timeout', () => {
				reject(new RequestTimeoutError(this.origin.toString(), method, path, timeout));
			});

			// Handle completion
			req.on('end', () => {
				const body = Buffer.concat(chunks);
				const response = new Http2Response(statusCode, responseHeaders, body);
				resolve(response);
			});

			// Handle errors
			req.on('error', (error) => {
				reject(error);
			});

			// Send body if provided
			if (options.body) {
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
			this.isConnected = false;
		}
	}

	isAlive(): boolean {
		return this.isConnected;
	}

	getProtocol(): HttpProtocol {
		return this.protocol;
	}

	getOrigin(): string {
		return this.origin.origin;
	}
}
