import { RequestTimeoutError } from './errors/timeout';
import { Http2Session } from './session';
import type { Http2SessionOptions } from './types';
import { VORR_USER_AGENT } from './utils/vorr';

describe('Integration Test Suite', () => {
	test('httpbin', async () => {
		const sess = new Http2Session('https://httpbin.org');
		const response = await sess.get('/get', { query: { test: 'value' } });
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(response.headers['content-type']).toContain('application/json');
		expect(body).toHaveProperty('url', 'https://httpbin.org/get?test=value');
		expect(body).toHaveProperty('headers');
		expect(body).toHaveProperty('headers.User-Agent', VORR_USER_AGENT);
		expect(body).toHaveProperty('args.test', 'value');
		expect(response.request.headers['user-agent']).toBe(VORR_USER_AGENT);
		expect(response.request.method).toBe('GET');
		expect(response.request.path).toBe('/get');

		sess.close();
	});

	test('should post', async () => {
		const session = new Http2Session('https://httpbin.org');
		const body = {
			message: 'Hello, HTTP/2!',
		};

		const response = await session.post('/post', {
			body,
		});

		expect(response.status).toBe(200);
		expect(response.headers['content-type']).toContain('application/json');
		expect(response.request.method).toBe('POST');
		expect(response.request.path).toBe('/post');
		expect(response.request.headers['user-agent']).toBe(VORR_USER_AGENT);
		expect(response.request.headers['content-type']).toBe('application/json');

		const responseBody = await response.json();
		expect(responseBody).toHaveProperty('json', { message: 'Hello, HTTP/2!' });
		expect(responseBody).toHaveProperty('url', 'https://httpbin.org/post');
		expect(responseBody).toHaveProperty('headers.User-Agent', VORR_USER_AGENT);

		session.close();
	});

	test('should post text', async () => {
		const session = new Http2Session('https://httpbin.org');

		const response = await session.post('/post', {
			body: 'Hello, HTTP/2!',
		});

		expect(response.status).toBe(200);
		expect(response.request.method).toBe('POST');
		expect(response.request.path).toBe('/post');
		expect(response.request.headers['user-agent']).toBe(VORR_USER_AGENT);
		expect(response.request.headers['content-type']).toBe('application/octet-stream');

		const responseBody = await response.json();
		expect(responseBody).toHaveProperty('data', 'Hello, HTTP/2!');
		expect(responseBody).toHaveProperty('url', 'https://httpbin.org/post');
		expect(responseBody).toHaveProperty('headers.User-Agent', VORR_USER_AGENT);

		session.close();
	});

	// Test 1: Multiple sequential requests on same session
	test('should handle multiple sequential requests on same session', async () => {
		const session = new Http2Session('https://httpbin.org');

		// First request

		const [response1, response2, response3] = await Promise.all([
			session.get('/get', { query: { request: '1' } }),
			session.get('/get', { query: { request: '2' } }),
			session.post('/post', {
				body: { request: '3' },
			}),
		]);

		expect(response1.status).toBe(200);
		const body1 = await response1.json();
		expect(body1).toHaveProperty('args.request', '1');

		// Second request
		expect(response2.status).toBe(200);
		const body2 = await response2.json();
		expect(body2).toHaveProperty('args.request', '2');

		// Third request with different method
		expect(response3.status).toBe(200);
		const body3 = await response3.json();
		expect(body3).toHaveProperty('json.request', '3');

		// Verify session is still alive
		expect(session.isAlive()).toBe(true);
		expect(session['requestCount'].getCount()).toBe(3);

		session.close();
	});

	// Test 4: Custom headers propagation
	test('should merge session-level and request-level headers correctly', async () => {
		const session = new Http2Session('https://httpbin.org', {
			headers: {
				'x-session-header': 'session-value',
				'x-custom': 'session',
			},
		});

		// Request with additional headers that override session header
		const response = await session.get('/get', {
			headers: {
				'x-request-header': 'request-value',
				'x-custom': 'request', // Should override session header
			},
		});

		expect(response.status).toBe(200);
		const body = (await response.json()) as Record<string, unknown>;

		// Verify session header is present
		expect(body).toHaveProperty('headers.X-Session-Header', 'session-value');

		// Verify request header is present
		expect(body).toHaveProperty('headers.X-Request-Header', 'request-value');

		// Verify request header overrides session header
		expect(body).toHaveProperty('headers.X-Custom', 'request');

		session.close();
	});

	// Test 7: Protocol validation (h2 vs h2c)
	test('should validate protocol matches URL scheme', () => {
		// h2 protocol requires HTTPS
		expect(() => {
			const opts: Http2SessionOptions = { protocol: 'h2' };
			new Http2Session('http://httpbin.org', opts);
		}).toThrow();

		// h2c protocol requires HTTP
		expect(() => {
			const opts: Http2SessionOptions = { protocol: 'h2c' };
			new Http2Session('https://httpbin.org', opts);
		}).toThrow();

		// Valid combinations should not throw
		expect(() => {
			const opts: Http2SessionOptions = { protocol: 'h2' };
			const sess1 = new Http2Session('https://httpbin.org', opts);
			sess1.close();
		}).not.toThrow();

		expect(() => {
			const opts: Http2SessionOptions = { protocol: 'h2c' };
			const sess1 = new Http2Session('http://httpbin.org', opts);
			sess1.close();
		}).not.toThrow();
	});

	// Test 8: Session lifecycle
	test('should manage session lifecycle correctly', async () => {
		const session = new Http2Session('https://httpbin.org');

		// Session should be alive after creation
		expect(session.isAlive()).toBe(true);

		// Make a request
		const response = await session.get('/get');
		expect(response.status).toBe(200);

		// Session should still be alive after request
		expect(session.isAlive()).toBe(true);

		// Close the session
		session.close();

		// Session should not be alive after close
		expect(session.isAlive()).toBe(false);

		// Further requests should fail
		await expect(session.get('/get')).rejects.toThrow('Session is not connected');
	});

	// Test 9: Request timeout behavior
	test('should handle request timeout correctly', async () => {
		const session = new Http2Session('https://httpbin.org', { timeout: 100 });

		// Use the delay endpoint to trigger timeout
		await expect(
			session.get('/delay/5'), // 5 second delay, 100ms timeout
		).rejects.toThrow(RequestTimeoutError);

		// Verify error is RequestTimeoutError with correct properties
		try {
			await session.get('/delay/5');
		} catch (error) {
			expect(error).toBeInstanceOf(RequestTimeoutError);
			expect((error as RequestTimeoutError).method).toBe('GET');
			expect((error as RequestTimeoutError).path).toBe('/delay/5');
			expect((error as RequestTimeoutError).timeout).toBe(100);
			expect((error as RequestTimeoutError).origin).toContain('https://httpbin.org');
		}

		session.close();
	});

	// Test 10: HEAD request with no response body
	test('should handle HEAD request with no response body', async () => {
		const session = new Http2Session('https://httpbin.org');

		const response = await session.head('/get');

		expect(response.status).toBe(200);
		expect(response.request.method).toBe('HEAD');

		// HEAD requests should have empty response body
		const text = await response.text();
		expect(text === undefined || text === '').toBe(true);

		// But headers should still be present
		expect(response.headers['content-type']).toBeDefined();

		// Body buffer should be empty
		expect(response.body.length).toBe(0);

		session.close();
	});

	// Test 11: Request with custom timeout exceeding default
	test('should override session timeout with request-level timeout', async () => {
		const session = new Http2Session('https://httpbin.org', { timeout: 100 });

		// Request with longer timeout should succeed (2 second delay, 5 second timeout to account for network latency)
		const response = await session.get('/delay/2', { timeout: 5000 });

		expect(response.status).toBe(200);
		expect(response.request.method).toBe('GET');

		session.close();
	});

	// Test 14: Empty body handling
	test('should handle requests with empty body correctly', async () => {
		const session = new Http2Session('https://httpbin.org');

		// GET request without body
		const getResponse = await session.get('/get');
		expect(getResponse.status).toBe(200);
		expect(getResponse.request.method).toBe('GET');

		// HEAD request without body
		const headResponse = await session.head('/get');
		expect(headResponse.status).toBe(200);
		expect(headResponse.request.method).toBe('HEAD');

		// DELETE request without body
		const deleteResponse = await session.delete('/delete');
		expect(deleteResponse.status).toBe(200);
		expect(deleteResponse.request.method).toBe('DELETE');

		session.close();
	});

	test('should handle concurrent requests within session limits', async () => {
		const session = new Http2Session('https://httpbin.org', { concurrency: 1 });
		const startTime = Date.now();
		const requests = [session.get('/delay/2'), session.get('/delay/2')];
		await Promise.all(requests);
		const duration = Date.now() - startTime;

		// With concurrency of 1, total duration should be at least 4 seconds
		expect(duration).toBeGreaterThanOrEqual(4000);

		session.close();
	});
});
