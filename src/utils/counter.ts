export class Counter {
	private count: number;

	constructor(initialCount: number = 0) {
		this.count = initialCount;
	}

	public increment(by: number = 1): void {
		this.count += by;
	}

	public decrement(by: number = 1): void {
		this.count -= by;
	}

	public getCount(): number {
		return this.count;
	}

	public reset(): void {
		this.count = 0;
	}
}
