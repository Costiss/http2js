import { EventEmitter } from 'node:events';
import type { IncomingHttpHeaders } from 'node:http';
import type { ClientHttp2Stream } from 'node:http2';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RequestTimeoutError } from './errors/timeout';
import { RequestManager } from './request-manager';
import { Http2Response } from './response';
import type { Http2Session } from './session';

// Helper function to create a mock stream
function createMockStream(): ClientHttp2Stream {
	const emitter = new EventEmitter();
	const stream = {
		setTimeout: vi.fn((timeout, callback) => {
			emitter.once('timeout', callback);
		}),
		on: vi.fn((event, callback) => {
			emitter.on(event, callback);
		}),
		once: vi.fn((event, callback) => {
			emitter.once(event, callback);
		}),
		emit: (event: string, ...args: unknown[]) => {
			emitter.emit(event, ...args);
		},
		end: vi.fn(),
		close: vi.fn(),
		write: vi.fn(),
	} as unknown as ClientHttp2Stream;

	return stream;
}

// Helper function to create a mock session
function createMockSession(options = {}): Http2Session {
	const mockSession = {
		origin: new URL('https://api.example.com'),
		session: {
			request: vi.fn(),
		},
		defaultOptions: {
			headers: {
				'user-agent': 'vorr',
			},
			timeout: 30000,
			...options,
		},
	} as unknown as Http2Session;

	return mockSession;
}

describe('RequestManager', () => {
	let mockSession: Http2Session;
	let mockStream: ClientHttp2Stream;

	beforeEach(() => {
		mockSession = createMockSession();
		mockStream = createMockStream();
		vi.mocked(mockSession.session.request).mockReturnValue(mockStream);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('constructor', () => {
		it('should initialize with correct properties', () => {
			const manager = new RequestManager(mockSession, {
				method: 'GET',
				path: '/api/users',
			});

			expect(manager.method).toBe('GET');
			expect(manager.path).toBe('/api/users');
			expect(manager.session).toBe(mockSession);
			expect(manager.timeout).toBe(30000);
		});

		it('should merge headers from options with session defaults', () => {
			const manager = new RequestManager(mockSession, {
				method: 'POST',
				path: '/api/users',
				options: {
					headers: {
						authorization: 'Bearer token123',
						'content-type': 'application/json',
					},
				},
			});

			expect(manager.headers).toEqual({
				authorization: 'Bearer token123',
				'content-type': 'application/json',
				'user-agent': 'vorr',
			});
		});

		it('should use custom timeout over session default', () => {
			const manager = new RequestManager(mockSession, {
				method: 'GET',
				path: '/api/users',
				options: {
					timeout: 5000,
				},
			});

			expect(manager.timeout).toBe(5000);
		});

		it('should lowercase header keys', () => {
			const manager = new RequestManager(mockSession, {
				method: 'GET',
				path: '/api/users',
				options: {
					headers: {
						'Content-Type': 'application/json',
						Authorization: 'Bearer token',
					},
				},
			});

			expect(manager.headers).toEqual(
				expect.objectContaining({
					'content-type': 'application/json',
					authorization: 'Bearer token',
				}),
			);
		});
	});

	describe('doRequest', () => {
		it('should create a request with correct method and path', async () => {
			const manager = new RequestManager(mockSession, {
				method: 'GET',
				path: '/api/users',
			});

			const requestPromise = manager.doRequest();

			// Simulate response
			const responseHeaders = {
				':status': '200',
				'content-type': 'application/json',
			} as unknown as IncomingHttpHeaders;
			mockStream.emit('response', responseHeaders);
			mockStream.emit('end');

			const response = await requestPromise;

			expect(vi.mocked(mockSession.session.request)).toHaveBeenCalledWith(
				expect.objectContaining({
					':method': 'GET',
					':path': '/api/users',
				}),
			);
			expect(response).toBeInstanceOf(Http2Response);
			expect(response.status).toBe(200);
		});

		it('should set timeout on stream', async () => {
			const manager = new RequestManager(mockSession, {
				method: 'GET',
				path: '/api/users',
				options: {
					timeout: 5000,
				},
			});

			const requestPromise = manager.doRequest();

			expect(vi.mocked(mockStream.setTimeout)).toHaveBeenCalledWith(
				5000,
				expect.any(Function),
			);

			// Simulate response to avoid hanging
			const responseHeaders = {
				':status': '200',
			} as unknown as IncomingHttpHeaders;
			mockStream.emit('response', responseHeaders);
			mockStream.emit('end');

			await requestPromise;
		});

		it('should handle successful response with headers and body', async () => {
			const manager = new RequestManager(mockSession, {
				method: 'GET',
				path: '/api/users',
			});

			const requestPromise = manager.doRequest();

			const responseHeaders = {
				':status': '200',
				'content-type': 'application/json',
				'x-custom-header': 'custom-value',
			} as unknown as IncomingHttpHeaders;
			mockStream.emit('response', responseHeaders);
			mockStream.emit('data', Buffer.from('{"id": 1, "name": "John"}'));
			mockStream.emit('end');

			const response = await requestPromise;

			expect(response.status).toBe(200);
			expect(response.headers['content-type']).toBe('application/json');
			expect(response.headers['x-custom-header']).toBe('custom-value');
			expect(response.body?.toString()).toBe('{"id": 1, "name": "John"}');
		});

		it('should handle response headers as array', async () => {
			const manager = new RequestManager(mockSession, {
				method: 'GET',
				path: '/api/users',
			});

			const requestPromise = manager.doRequest();

			const responseHeaders = {
				':status': ['200'],
				'content-type': 'application/json',
			} as unknown as IncomingHttpHeaders;
			mockStream.emit('response', responseHeaders);
			mockStream.emit('end');

			const response = await requestPromise;

			expect(response.status).toBe(200);
		});

		it('should handle invalid status code gracefully', async () => {
			const manager = new RequestManager(mockSession, {
				method: 'GET',
				path: '/api/users',
			});

			const requestPromise = manager.doRequest();

			const responseHeaders = {
				':status': undefined,
			} as unknown as IncomingHttpHeaders;
			mockStream.emit('response', responseHeaders);
			mockStream.emit('end');

			const response = await requestPromise;

			expect(response.status).toBe(-1);
		});

		it('should handle response with multiple data chunks', async () => {
			const manager = new RequestManager(mockSession, {
				method: 'GET',
				path: '/api/users',
			});

			const requestPromise = manager.doRequest();

			const responseHeaders = {
				':status': '200',
			} as unknown as IncomingHttpHeaders;
			mockStream.emit('response', responseHeaders);
			mockStream.emit('data', Buffer.from('chunk1'));
			mockStream.emit('data', Buffer.from('chunk2'));
			mockStream.emit('data', Buffer.from('chunk3'));
			mockStream.emit('end');

			const response = await requestPromise;

			expect(response.body?.toString()).toBe('chunk1chunk2chunk3');
		});

		it('should end stream when no body is provided', async () => {
			const manager = new RequestManager(mockSession, {
				method: 'GET',
				path: '/api/users',
			});

			const requestPromise = manager.doRequest();

			const responseHeaders = {
				':status': '200',
			} as unknown as IncomingHttpHeaders;
			mockStream.emit('response', responseHeaders);
			mockStream.emit('end');

			await requestPromise;

			expect(vi.mocked(mockStream.end)).toHaveBeenCalledWith();
		});

		it('should convert string body to Buffer and send', async () => {
			const manager = new RequestManager(mockSession, {
				method: 'POST',
				path: '/api/users',
				options: {
					body: 'test body',
					headers: {
						'content-type': 'text/plain',
					},
				},
			});

			const requestPromise = manager.doRequest();

			const responseHeaders = {
				':status': '201',
			} as unknown as IncomingHttpHeaders;
			mockStream.emit('response', responseHeaders);
			mockStream.emit('end');

			await requestPromise;

			// Verify stream.end was called with the body as Buffer
			expect(vi.mocked(mockStream.end)).toHaveBeenCalled();
			const calls = vi.mocked(mockStream.end).mock.calls;
			expect(calls.length).toBeGreaterThan(0);
		});

		it('should send request body when provided', async () => {
			const manager = new RequestManager(mockSession, {
				method: 'POST',
				path: '/api/users',
				options: {
					body: 'test body',
					headers: {
						'content-type': 'text/plain',
					},
				},
			});

			const requestPromise = manager.doRequest();

			const responseHeaders = {
				':status': '201',
			} as unknown as IncomingHttpHeaders;
			mockStream.emit('response', responseHeaders);
			mockStream.emit('end');

			await requestPromise;

			// Verify stream.end was called (indicating body handling occurred)
			expect(vi.mocked(mockStream.end)).toHaveBeenCalled();
			expect(vi.mocked(mockStream.end).mock.calls[0][0]).toEqual(Buffer.from('test body'));
		});

		it('should handle timeout error', async () => {
			const manager = new RequestManager(mockSession, {
				method: 'GET',
				path: '/api/users',
				options: {
					timeout: 5000,
				},
			});

			const requestPromise = manager.doRequest();

			// Trigger timeout
			const timeoutCallback = vi.mocked(mockStream.setTimeout).mock.calls[0]?.[1];
			if (timeoutCallback) {
				(timeoutCallback as () => void)();
			}

			await expect(requestPromise).rejects.toThrow(RequestTimeoutError);

			expect(vi.mocked(mockStream.close)).toHaveBeenCalled();
		});

		it('should handle stream error', async () => {
			const manager = new RequestManager(mockSession, {
				method: 'GET',
				path: '/api/users',
			});

			const requestPromise = manager.doRequest();

			const error = new Error('Connection reset');
			mockStream.emit('error', error);

			await expect(requestPromise).rejects.toThrow('Connection reset');

			expect(vi.mocked(mockStream.close)).toHaveBeenCalled();
		});

		it('should close stream on request completion', async () => {
			const manager = new RequestManager(mockSession, {
				method: 'GET',
				path: '/api/users',
			});

			const requestPromise = manager.doRequest();

			const responseHeaders = {
				':status': '200',
			} as unknown as IncomingHttpHeaders;
			mockStream.emit('response', responseHeaders);
			mockStream.emit('end');

			await requestPromise;

			expect(vi.mocked(mockStream.close)).toHaveBeenCalled();
		});

		it('should include custom headers in request', async () => {
			const manager = new RequestManager(mockSession, {
				method: 'POST',
				path: '/api/users',
				options: {
					headers: {
						authorization: 'Bearer token123',
						'x-request-id': 'abc-123',
					},
				},
			});

			const requestPromise = manager.doRequest();

			const responseHeaders = {
				':status': '201',
			} as unknown as IncomingHttpHeaders;
			mockStream.emit('response', responseHeaders);
			mockStream.emit('end');

			await requestPromise;

			expect(vi.mocked(mockSession.session.request)).toHaveBeenCalledWith({
				':method': 'POST',
				':path': '/api/users',
				authorization: 'Bearer token123',
				'x-request-id': 'abc-123',
				'user-agent': 'vorr',
			});
		});

		it('should handle response with empty body', async () => {
			const manager = new RequestManager(mockSession, {
				method: 'DELETE',
				path: '/api/users/1',
			});

			const requestPromise = manager.doRequest();

			const responseHeaders = {
				':status': '204',
			} as unknown as IncomingHttpHeaders;
			mockStream.emit('response', responseHeaders);
			mockStream.emit('end');

			const response = await requestPromise;

			expect(response.status).toBe(204);
			expect(response.body?.length).toBe(0);
		});

		it('should not override existing content-type for non-JSON bodies', async () => {
			const manager = new RequestManager(mockSession, {
				method: 'POST',
				path: '/api/users',
				options: {
					body: Buffer.from('xml data'),
					headers: {
						'content-type': 'application/xml',
					},
				},
			});

			const requestPromise = manager.doRequest();

			const responseHeaders = {
				':status': '201',
			} as unknown as IncomingHttpHeaders;
			mockStream.emit('response', responseHeaders);
			mockStream.emit('end');

			await requestPromise;

			expect(manager.headers['content-type']).toBe('application/xml');
		});

		it('should use application/json as default content-type for objects', async () => {
			const manager = new RequestManager(mockSession, {
				method: 'POST',
				path: '/api/users',
				options: {
					body: { id: 1 },
				},
			});

			const requestPromise = manager.doRequest();

			const responseHeaders = {
				':status': '201',
			} as unknown as IncomingHttpHeaders;
			mockStream.emit('response', responseHeaders);
			mockStream.emit('end');

			await requestPromise;

			expect(manager.headers['content-type']).toBe('application/json');
			expect(vi.mocked(mockStream.end).mock.calls[0][0]).toEqual(
				Buffer.from(JSON.stringify({ id: 1 })),
			);
		});
	});
});
