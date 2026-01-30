import type http2 from 'node:http2';
import type { IncomingHttpHeaders } from 'node:http2';

export type HeaderValue = string | string[];
export type HttpHeaders = Record<string, HeaderValue>;

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export type HttpProtocol = 'h2' | 'h2c';

export type QueryParams = Record<string, unknown>;

export interface Http2RequestOptions {
	headers?: HttpHeaders;
	body?: string | Buffer | object;
	timeout?: number;
	query?: QueryParams;
}

export type Http2SessionOptions = {
	headers?: HttpHeaders;
	timeout?: number;
	protocol?: HttpProtocol;
	rejectUnauthorized?: boolean;
} & http2.ClientSessionOptions;

export interface Http2ResponseData {
	status: number;
	headers: IncomingHttpHeaders;
	body: Buffer;
}

export interface Http2SessionHealth {
	connected: boolean;
	activeStreams: number;
	lastError: Error | null;
	origin: string;
	protocol: HttpProtocol;
}

export type Http2SessionEventMap = {
	connect: [];
	close: [];
	error: [Error];
};
