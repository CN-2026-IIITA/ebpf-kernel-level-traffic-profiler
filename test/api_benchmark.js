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
            resolve({ error: err.message });
        });
    });
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
        const avgLatency = results.reduce((acc, res) => acc + (res.duration || 0), 0) / results.length;

        console.log(`      Success: ${successes}/${CONCURRENT_REQUESTS}`);
        console.log(`      Avg Latency: ${avgLatency.toFixed(2)}ms`);
        console.log(`      Round Time: ${roundTime}ms\n`);
        
        allResults.push(...results);
        // Small cooldown
        await new Promise(r => setTimeout(r, 500));
    }

    const finalAvg = allResults.reduce((acc, res) => acc + (res.duration || 0), 0) / allResults.length;
    console.log(`🏁 Benchmark Finished.`);
    console.log(`   Overall Average Latency: ${finalAvg.toFixed(2)}ms`);
}

runBenchmark().catch(console.error);