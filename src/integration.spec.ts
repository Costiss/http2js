import { Http2Session } from './session';

describe('Integration Test Suite', () => {
	test('local', async () => {
		const sess = new Http2Session('http://localhost:8444');

		const response = await sess.get('/');
		console.log({
			status: response.status,
			headers: response.headers,
			body: await response.text(),
		});

		sess.close();
	});

	test('httpbin', async () => {
		const sess = new Http2Session('https://httpbin.org');
		const response = await sess.get('/get');
		console.log({
			status: response.status,
			headers: response.headers,
			body: await response.text(),
		});

		sess.close();
	});
});
