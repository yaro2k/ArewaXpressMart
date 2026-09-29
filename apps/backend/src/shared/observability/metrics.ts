type CounterKey = `${string}:${number}`;
const counters = new Map<CounterKey, number>();
export function recordHttpRequest(method: string, status: number): void { const key: CounterKey = `${method.toUpperCase()}:${status}`; counters.set(key, (counters.get(key) ?? 0) + 1); }
export function renderMetrics(): string { const lines = ['# HELP arewa_http_requests_total Total HTTP responses served.', '# TYPE arewa_http_requests_total counter']; for (const [key, value] of [...counters.entries()].sort()) { const [method, status] = key.split(':'); lines.push(`arewa_http_requests_total{method="${method}",status="${status}"} ${value}`); } return `${lines.join('\n')}\n`; }
export function resetMetricsForTests(): void { counters.clear(); }
