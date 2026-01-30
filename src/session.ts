import * as http2 from 'node:http2';
import { hrtime } from 'node:process';
import { URL } from 'node:url';
import { RequestManager } from './request-manager';
import type { Http2Response } from './response';
import type { Http2RequestOptions, Http2SessionOptions, HttpMethod, HttpProtocol } from './types';
import { createSessionMetrics } from './utils/meter';
import { VORR_USER_AGENT } from './utils/vorr';

export class Http2Session implements Disposable {
	readonly session: http2.ClientHttp2Session;
	readonly origin: URL;
	readonly protocol: HttpProtocol;
	readonly defaultOptions: Http2SessionOptions & Required<Pick<Http2SessionOptions, 'timeout'>>;
	private readonly metrics: ReturnType<typeof createSessionMetrics>;
	private readonly startTime: bigint;

	private requestCount: number = 0;
	private isConnected: boolean = false;

	constructor(origin: string, options: Http2SessionOptions = {}) {
		this.origin = new URL(origin);
		this.defaultOptions = {
			headers: {
				'user-agent': VORR_USER_AGENT,
				...options.headers,
			},
			timeout: 30000,
			...options,
		};

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
		options: Http2RequestOptions = {},
	): Promise<Http2Response> {
		if (!this.isConnected) {
			throw new Error('Session is not connected');
		}

		const mngr = new RequestManager(this, {
			method,
			path,
			options,
		});

		this.requestCount = this.requestCount + 1;
		const response = await mngr.doRequest();

		return response;
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
