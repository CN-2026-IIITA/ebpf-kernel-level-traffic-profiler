require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3001;
const LOG_DIR = path.resolve(__dirname, process.env.LOG_DIR || "/tmp");

// Regex to extract NIC and UID from log filenames
const LOG_FILE_PATTERN = /^traffic_user_(.+)_(\d+)\.log$/;

/**
 * Helper: Parse CSV log and extract remote IPs
 */
async function analyzeLogFile(filePath) {
  const content = await fs.promises.readFile(filePath, "utf-8");
  const lines = content.trim().split("\n");
  const ipMap = {};

  lines.forEach((line) => {
    const parts = line.split(",");
    if (parts.length < 4) return;

    const [direction, bytesStr, srcIp, dstIp] = parts;
    const bytes = parseInt(bytesStr, 10) || 0;
    
    // Remote IP is dst if outgoing, src if incoming
    const remoteIp = direction === "out" ? dstIp : srcIp;

    // Basic filter for private IPs (rough check)
    if (
      remoteIp.startsWith("192.168.") ||
      remoteIp.startsWith("10.") ||
      remoteIp.startsWith("127.") ||
      remoteIp.startsWith("172.1") || // Simplified 172.16-31
      remoteIp.startsWith("fe80:") ||
      remoteIp === "::1"
    ) {
      return;
    }

    if (!ipMap[remoteIp]) {
      ipMap[remoteIp] = { ip: remoteIp, bytes: 0, count: 0 };
    }
    ipMap[remoteIp].bytes += bytes;
    ipMap[remoteIp].count += 1;
  });

  return Object.values(ipMap).sort((a, b) => b.bytes - a.bytes);
}

// Multer storage — saves uploaded files directly to LOG_DIR with their original name
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, LOG_DIR),
  filename: (_req, file, cb) => cb(null, file.originalname),
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (!LOG_FILE_PATTERN.test(file.originalname)) {
      return cb(new Error("Filename must match traffic_user_<nic>_<uid>.log"));
    }
    cb(null, true);
  },
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max
});

app.use(cors());
app.use(express.json());

/**
 * GET /api/files
 * Returns a JSON array of discovered log files with parsed metadata.
 */
app.get("/api/files", async (req, res) => {
  try {
    const entries = await fs.promises.readdir(LOG_DIR);

    const files = await Promise.all(
      entries
        .filter((name) => LOG_FILE_PATTERN.test(name))
        .map(async (name) => {
          const match = name.match(LOG_FILE_PATTERN);
          const filePath = path.join(LOG_DIR, name);

          try {
            const stat = await fs.promises.stat(filePath);
            return {
              filename: name,
              nic: match[1],
              uid: match[2],
              size: stat.size,
              modified: stat.mtime.toISOString(),
            };
          } catch {
            return null;
          }
        })
    );

    res.json(files.filter(Boolean));
  } catch (err) {
    console.error("Error reading log directory:", err.message);
    res.status(500).json({ error: "Failed to read log directory", detail: err.message });
  }
});

/**
 * GET /api/files/:filename/analysis
 * Returns analyzed IP data from a specific log file.
 */
app.get("/api/files/:filename/analysis", async (req, res) => {
  const { filename } = req.params;
  if (!LOG_FILE_PATTERN.test(filename)) {
    return res.status(400).json({ error: "Invalid filename format" });
  }

  const filePath = path.join(LOG_DIR, filename);
  try {
    const analysis = await analyzeLogFile(filePath);
    res.json(analysis);
  } catch (err) {
    console.error("Analysis error:", err.message);
    res.status(500).json({ error: "Failed to analyze log file" });
  }
});

/**
 * GET /api/geo/:ip
 * Proxy to fetch geo-location data from freeipapi.com
 */
app.get("/api/geo/:ip", async (req, res) => {
  try {
    const { ip } = req.params;
    const response = await fetch(`https://freeipapi.com/api/json/${ip}`);
    if (!response.ok) throw new Error("Geo API failed");
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Geo lookup failed" });
  }
});

/**
 * DELETE /api/files/:filename
 * Deletes a specific log file. Validates that the filename matches the expected pattern.
 */
app.delete("/api/files/:filename", async (req, res) => {
  const { filename } = req.params;

  if (!LOG_FILE_PATTERN.test(filename)) {
    return res.status(400).json({ error: "Invalid filename format" });
  }

  const filePath = path.join(LOG_DIR, filename);

  try {
    await fs.promises.unlink(filePath);
    res.json({ success: true, deleted: filename });
  } catch (err) {
    if (err.code === "ENOENT") {
      return res.status(404).json({ error: "File not found" });
    }
    console.error("Error deleting file:", err.message);
    res.status(500).json({ error: "Failed to delete file", detail: err.message });
  }
});

/**
 * POST /api/upload
 * Accepts one or more log files via multipart/form-data.
 * Files must be named traffic_user_<nic>_<uid>.log.
 */
app.post("/api/upload", (req, res) => {
  upload.array("files", 20)(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: err.message });
    }
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files provided" });
    }

    const results = await Promise.all(
      req.files.map(async (f) => {
        const match = f.originalname.match(LOG_FILE_PATTERN);
        const stat = await fs.promises.stat(f.path);
        return {
          filename: f.originalname,
          nic: match[1],
          uid: match[2],
          size: stat.size,
          modified: stat.mtime.toISOString(),
        };
      })
    );

    console.log(`Uploaded ${results.length} file(s):`, results.map((r) => r.filename).join(", "));
    res.json({ success: true, files: results });
  });
});

app.listen(PORT, () => {
  console.log(`Traffic Profiler Backend running on http://localhost:${PORT}`);
  console.log(`Watching log directory: ${LOG_DIR}`);
});
