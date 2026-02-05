import { RequestPool } from './request-pool';
import { Counter } from './utils/counter';

describe(RequestPool.name, () => {
	const mngrMock = {
		doRequest: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should limit concurrent requests', async () => {
		const counter = new Counter(0);
		mngrMock.doRequest.mockImplementation(() => {
			counter.increment();
			return new Promise((resolve) => {
				setTimeout(() => resolve('done'), 500);
			});
		});

		const pool = new RequestPool(2);
		pool.doRequest(mngrMock as never);
		pool.doRequest(mngrMock as never);
		const thirdRequest = pool.doRequest(mngrMock as never);

		await vi.waitUntil(() => counter.getCount() === 2);
		expect(mngrMock.doRequest).toHaveBeenCalledTimes(2);

		await thirdRequest;

		expect(mngrMock.doRequest).toHaveBeenCalledTimes(3);
	});
});
