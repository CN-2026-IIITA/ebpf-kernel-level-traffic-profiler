require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { parse } = require("csv-parse/sync");

const app = express();
const PORT = process.env.PORT || 3001;
const LOG_DIR = path.resolve(__dirname, process.env.LOG_DIR || "/tmp");

// Regex to extract NIC and UID from log filenames
const LOG_FILE_PATTERN = /^traffic_user_(.+)_(\d+)\.log$/;

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
 * GET /api/files/:filename/rows
 * Returns parsed CSV rows for a specific log file.
 */
app.get("/api/files/:filename/rows", async (req, res) => {
  const { filename } = req.params;
  const limit = Math.max(1, Math.min(Number(req.query.limit) || 500, 5000));
  const rowFields = ["direction", "bytes", "src_ip", "dst_ip", "timestamp", "total_in", "total_out"];

  if (!LOG_FILE_PATTERN.test(filename)) {
    return res.status(400).json({ error: "Invalid filename format" });
  }

  const filePath = path.join(LOG_DIR, filename);

  try {
    const match = filename.match(LOG_FILE_PATTERN);
    const content = await fs.promises.readFile(filePath, "utf8");
    const rows = parse(content, {
      columns: rowFields,
      skip_empty_lines: true,
      trim: true,
      from_line: 1,
    })
      .slice(-limit)
      .map((row) => ({
        ...row,
        nic: match[1],
        uid: match[2],
        bytes: Number(row.bytes || 0),
        total_in: Number(row.total_in || 0),
        total_out: Number(row.total_out || 0),
      }));

    res.json({ filename, rows });
  } catch (err) {
    if (err.code === "ENOENT") {
      return res.status(404).json({ error: "File not found" });
    }
    console.error("Error reading log rows:", err.message);
    res.status(500).json({ error: "Failed to read log rows", detail: err.message });
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
