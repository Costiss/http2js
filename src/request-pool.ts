import type { RequestManager } from './request-manager';
import { Counter } from './utils/counter';

export class RequestPool {
	private readonly concurrency;
	private readonly queue: Array<() => void> = [];

	private active: Counter;

	constructor(concurrency = 100) {
		this.concurrency = concurrency;
		this.active = new Counter(0);
	}

	async doRequest(mngr: RequestManager) {
		await this.acquire();
		return mngr.doRequest().finally(() => this.release());
	}

	private acquire() {
		if (this.active.getCount() < this.concurrency) {
			this.active.increment();
			return Promise.resolve();
		}

		return new Promise<void>((resolve) => {
			this.queue.push(() => {
				this.active.increment();
				resolve();
			});
		});
	}

	private release() {
		this.active.decrement();
		const next = this.queue.shift();
		if (next) next();
	}
}
