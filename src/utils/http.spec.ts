import { HttpUtils } from './http';

describe('HttpUtils', () => {
	describe('buildPath', () => {
		test('should build path without query parameters', () => {
			const path = '/api/resource';
			const result = HttpUtils.buildPath(path);
			expect(result).toBe('/api/resource');
		});

		test('should build path with query parameters', () => {
			const path = '/api/resource';
			const query = { key1: 'value1', key2: 42, key3: true };
			const result = HttpUtils.buildPath(path, query);
			expect(result).toBe('/api/resource?key1=value1&key2=42&key3=true');
		});

		test('should handle empty query parameters', () => {
			const path = '/api/resource';
			const query = {};
			const result = HttpUtils.buildPath(path, query);
			expect(result).toBe('/api/resource');
		});

		test('should ignore undefined query parameters', () => {
			const path = '/api/resource';
			const query = { key1: 'value1', key2: undefined, key3: 'value3' };
			const result = HttpUtils.buildPath(path, query);
			expect(result).toBe('/api/resource?key1=value1&key3=value3');
		});

		test('should serialize complex query parameters as JSON strings', () => {
			const path = '/api/resource';
			const query = { key1: { nested: 'object' }, key2: [1, 2, 3] };
			const result = HttpUtils.buildPath(path, query);
			expect(result).toBe(
				'/api/resource?key1=%7B%22nested%22%3A%22object%22%7D&key2=%5B1%2C2%2C3%5D',
			);
		});
	});
});
