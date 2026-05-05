/**
 * api_validation.test.js
 * 
 * Comprehensive validation suite for the Backend API.
 * Tests data integrity, error handling, and file system interactions.
 */

const http = require('http');

async function request(path, method = 'GET') {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3001,
            path,
            method,
        };
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body || '{}') }));
        });
        req.on('error', reject);
        req.end();
    });
}

async function runTests() {
    console.log("🧪 Starting API Validation Tests...\n");
    let passed = 0;
    let failed = 0;

    const test = async (name, fn) => {
        try {
            await fn();
            console.log(` ✅ PASS: ${name}`);
            passed++;
        } catch (err) {
            console.log(` ❌ FAIL: ${name}\n    -> ${err.message}`);
            failed++;
        }
    };

    await test("GET /api/files returns an array", async () => {
        const res = await request('/api/files');
        if (res.status !== 200) throw new Error(`Status ${res.status}`);
        if (!Array.isArray(res.body)) throw new Error("Body is not an array");
    });

    await test("GET /api/geo/8.8.8.8 returns Google location", async () => {
        const res = await request('/api/geo/8.8.8.8');
        if (res.status !== 200) throw new Error(`Status ${res.status}`);
        if (res.body.countryName !== 'United States') throw new Error("Incorrect country");
    });

    await test("GET /api/files/invalid-name/analysis returns 400", async () => {
        const res = await request('/api/files/malicious.txt/analysis');
        if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    });

    console.log(`\n📊 Results: ${passed} passed, ${failed} failed.`);
    if (failed > 0) process.exit(1);
}

runTests().catch(err => {
    console.error("💥 Test Suite Crashed:", err);
    process.exit(1);
});
