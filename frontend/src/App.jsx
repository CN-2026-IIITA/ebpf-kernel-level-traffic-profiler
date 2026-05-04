import { useState, useEffect, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import FileList from "./components/FileList";

const API_BASE = "http://localhost:3001";

export default function App() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/files`);
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      const data = await res.json();
      setFiles(data);
    } catch (err) {
      setError(err.message || "Failed to connect to backend");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleDelete = async (filename) => {
    try {
      const res = await fetch(`${API_BASE}/api/files/${filename}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      // Remove from local state
      setFiles((prev) => prev.filter((f) => f.filename !== filename));
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  /* Summary stats from file list */
  const totalFiles = files.length;
  const uniqueNics = [...new Set(files.map((f) => f.nic))].length;
  const uniqueUids = [...new Set(files.map((f) => f.uid))].length;
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />

        <main className="flex-1 p-6 overflow-y-auto">
          {/* Stats summary */}
          {!loading && !error && files.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 animate-fade-in">
              <StatCard label="Log Files" value={totalFiles} icon="📄" color="teal" />
              <StatCard label="Interfaces" value={uniqueNics} icon="🔌" color="blue" />
              <StatCard label="Users" value={uniqueUids} icon="👥" color="purple" />
              <StatCard label="Total Data" value={formatBytes(totalSize)} icon="💾" color="amber" />
            </div>
          )}

          {/* Section header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-text-primary">Traffic Log Files</h2>
              <p className="text-sm text-text-muted mt-0.5">
                Discovered log files from the eBPF traffic meter
              </p>
            </div>
            {!loading && !error && (
              <button
                id="refresh-btn"
                onClick={fetchFiles}
                className="
                  flex items-center gap-2 px-4 py-2 rounded-lg
                  text-sm font-medium
                  bg-bg-card text-text-secondary border border-border
                  hover:border-border-hover hover:text-text-primary hover:bg-bg-card-hover
                  active:scale-[0.97]
                  transition-all duration-150 cursor-pointer
                "
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            )}
          </div>

          {/* File list */}
          <FileList
            files={files}
            loading={loading}
            error={error}
            onRetry={fetchFiles}
            onDelete={handleDelete}
          />
        </main>

        {/* Footer */}
        <footer className="px-6 py-3 border-t border-border text-center">
          <p className="text-xs text-text-muted">
            eBPF Traffic Profiler Dashboard · Kernel-level network monitoring
          </p>
        </footer>
      </div>
    </div>
  );
}

/* ── Stat Card ── */
const ACCENT_MAP = {
  teal:   "bg-accent-teal/10 text-accent-teal border-accent-teal/20",
  blue:   "bg-accent-blue/10 text-accent-blue border-accent-blue/20",
  purple: "bg-accent-purple/10 text-accent-purple border-accent-purple/20",
  amber:  "bg-accent-amber/10 text-accent-amber border-accent-amber/20",
};

function StatCard({ label, value, icon, color }) {
  const accent = ACCENT_MAP[color] || ACCENT_MAP.teal;
  return (
    <div className={`
      rounded-xl p-4 border
      bg-bg-card/60 backdrop-blur-sm
      border-border hover:border-border-hover
      transition-all duration-200
    `}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg border ${accent}`}>
          {icon}
        </div>
        <div>
          <p className="text-xs text-text-muted font-medium uppercase tracking-wide">{label}</p>
          <p className="text-xl font-bold text-text-primary">{value}</p>
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ── */
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
