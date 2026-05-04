require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3001;
const LOG_DIR = path.resolve(__dirname, process.env.LOG_DIR || "/tmp");

// Regex to extract NIC and UID from log filenames
const LOG_FILE_PATTERN = /^traffic_user_(.+)_(\d+)\.log$/;

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

app.listen(PORT, () => {
  console.log(`Traffic Profiler Backend running on http://localhost:${PORT}`);
  console.log(`Watching log directory: ${LOG_DIR}`);
});
