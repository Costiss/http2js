import type { IncomingHttpHeaders } from 'node:http2';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export type HttpProtocol = 'h2' | 'h2c';

export interface Http2RequestOptions {
	headers?: Record<string, string | string[]>;
	body?: string | Buffer;
	timeout?: number;
}

export interface Http2SessionOptions {
	headers?: Record<string, string | string[]>;
	timeout?: number;
	protocol?: HttpProtocol;
	rejectUnauthorized?: boolean;
}

export interface Http2ResponseData {
	status: number;
	headers: IncomingHttpHeaders;
	body: Buffer;
}
