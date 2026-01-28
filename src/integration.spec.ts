import { Http2Session } from './session';

describe('Integration Test Suite', () => {
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

	test('jsonplaceholder', async () => {
		const session = new Http2Session('https://jsonplaceholder.typicode.com');

		const response = await session.get('/posts/1');
		console.log(`Status: ${response.status}`);
		console.log(`Headers:`, response.headers);

		const post = await response.json();
		console.log(post);

		session.close();
	});

	test('post request', async () => {
		const session = new Http2Session('https://httpbin.org');

		const body = {
			message: 'Hello, HTTP/2!',
		};

		const response = await session.post('/post', {
			body,
		});

		console.log(`Status: ${response.status}`);
		console.log(`Headers:`, response.headers);

		const responseBody = await response.json();
		console.log(responseBody);

		session.close();
	});
});
