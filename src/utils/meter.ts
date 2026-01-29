import { type Attributes, metrics } from '@opentelemetry/api';

export const meter = metrics.getMeter('vor');

const requestDurationHistogram = meter.createHistogram('http_client_request_duration', {
	description: 'Duration of HTTP client requests',
	unit: 'ms',
});

const activeRequestsGauge = meter.createUpDownCounter('http_client_active_requests', {
	description: 'Number of active HTTP client requests',
});

const totalRequestsCounter = meter.createCounter('http_client_total_requests', {
	description: 'Total number of HTTP client requests',
});

export function createRequestMetrics(origin: URL) {
	const protocol = origin.protocol === 'https:' ? 'h2' : 'h2c';
	const attrs: Attributes = {
		http_flavor: protocol,
		net_peer_name: origin.hostname,
		net_peer_port: origin.port,
		network_protocol_version: protocol,
		network_protocol_name: origin.protocol.replace(':', ''),
	};

	return {
		recordRequestDuration: (value: number, attributes?: Attributes) =>
			requestDurationHistogram.record(value, { ...attrs, ...attributes }),
		incrementActiveRequests: (value: number = 1, attributes?: Attributes) =>
			activeRequestsGauge.add(value, { ...attrs, ...attributes }),
		incrementTotalRequests: (value: number = 1, attributes?: Attributes) =>
			totalRequestsCounter.add(value, { ...attrs, ...attributes }),
		decrementActiveRequests: (value: number = 1, attributes?: Attributes) =>
			activeRequestsGauge.add(-value, { ...attrs, ...attributes }),
	};
}

const sessionsDurationHistogram = meter.createHistogram('http_client_session_duration', {
	description: 'Duration of HTTP client sessions',
	unit: 'ms',
});

const activeSessionsGauge = meter.createUpDownCounter('http_client_active_sessions', {
	description: 'Number of active HTTP client sessions',
});

const requestsPerSession = meter.createHistogram('http_client_requests_per_session', {
	description: 'Number of requests per HTTP client session',
	unit: '1',
});

export function createSessionMetrics(origin: URL) {
	const protocol = origin.protocol === 'https:' ? 'h2' : 'h2c';
	const attrs: Attributes = {
		http_flavor: protocol,
		net_peer_name: origin.hostname,
		net_peer_port: origin.port,
		network_protocol_version: protocol,
		network_protocol_name: origin.protocol.replace(':', ''),
	};

	return {
		recordSessionDuration: (value: number, attributes?: Attributes) =>
			sessionsDurationHistogram.record(value, { ...attrs, ...attributes }),
		recordRequestsPerSession: (value: number, attributes?: Attributes) =>
			requestsPerSession.record(value, { ...attrs, ...attributes }),
		incrementActiveSessions: (value: number = 1, attributes?: Attributes) =>
			activeSessionsGauge.add(value, { ...attrs, ...attributes }),
		decrementActiveSessions: (value: number = 1, attributes?: Attributes) =>
			activeSessionsGauge.add(-value, { ...attrs, ...attributes }),
	};
}
