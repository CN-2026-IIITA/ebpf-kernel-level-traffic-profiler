/**
 * api_benchmark.js
 * 
 * A stress-testing utility to measure backend performance under high load.
 * This script simulates multiple concurrent users accessing the dashboard.
 */

const http = require('http');

const API_BASE = 'http://localhost:3001';
const CONCURRENT_REQUESTS = 10;
const TOTAL_ROUNDS = 5;
const VERBOSE = false; // toggle detailed logs

async function fetchStats() {
    return new Promise((resolve) => {
        const start = Date.now();
        http.get(`${API_BASE}/api/files`, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                const duration = Date.now() - start;
                resolve({
                    status: res.statusCode,
                    size: data.length,
                    duration
                });
            });
        }).on('error', (err) => {
            resolve({ error: err.message, duration: 0 });
        });
    });
}

function percentile(arr, p) {
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index] || 0;
}

async function runBenchmark() {
    console.log(`🔥 Starting API Benchmark...`);
    console.log(`   Concurrency: ${CONCURRENT_REQUESTS}`);
    console.log(`   Rounds: ${TOTAL_ROUNDS}\n`);

    const allResults = [];

    for (let r = 1; r <= TOTAL_ROUNDS; r++) {
        console.log(`[Round ${r}] Dispatching ${CONCURRENT_REQUESTS} requests...`);
        
        const startTime = Date.now();
        const promises = Array.from({ length: CONCURRENT_REQUESTS }).map(() => fetchStats());
        const results = await Promise.all(promises);
        const roundTime = Date.now() - startTime;

        const successes = results.filter(res => res.status === 200).length;
        const errors = results.filter(res => res.error).length;

        const latencies = results.map(r => r.duration || 0);
        const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        const minLatency = Math.min(...latencies);
        const maxLatency = Math.max(...latencies);
        const p95 = percentile(latencies, 95);

        const rps = (CONCURRENT_REQUESTS / (roundTime / 1000)).toFixed(2);

        console.log(`      Success: ${successes}/${CONCURRENT_REQUESTS}`);
        console.log(`      Errors: ${errors}`);
        console.log(`      Avg Latency: ${avgLatency.toFixed(2)}ms`);
        console.log(`      Min/Max: ${minLatency}ms / ${maxLatency}ms`);
        console.log(`      P95 Latency: ${p95}ms`);
        console.log(`      RPS: ${rps}`);
        console.log(`      Round Time: ${roundTime}ms\n`);

        if (VERBOSE) {
            console.log(results);
        }

        allResults.push(...results);

        // Small cooldown
        await new Promise(r => setTimeout(r, 500));
    }

    const allLatencies = allResults.map(r => r.duration || 0);
    const finalAvg = allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length;

    console.log(`🏁 Benchmark Finished.`);
    console.log(`   Overall Average Latency: ${finalAvg.toFixed(2)}ms`);
    console.log(`   Overall P95 Latency: ${percentile(allLatencies, 95)}ms`);
}

runBenchmark().catch(console.error);
