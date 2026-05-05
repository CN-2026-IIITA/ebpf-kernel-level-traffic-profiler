import { useState, useEffect, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import FileList from "./components/FileList";
import FileDetails from "./components/FileDetails";
import UploadArea from "./components/UploadArea";

const API_BASE = "http://localhost:3001";

export default function App() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [activeSection, setActiveSection] = useState("overview");
  const [sectionLoading, setSectionLoading] = useState(false);
  const [sectionRows, setSectionRows] = useState([]);

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

  useEffect(() => {
    let cancelled = false;

    const loadSectionRows = async () => {
      if (activeSection === "overview" || files.length === 0) {
        setSectionRows([]);
        return;
      }

      setSectionLoading(true);
      try {
        const responses = await Promise.all(
          files.map(async (file) => {
            const res = await fetch(`${API_BASE}/api/files/${encodeURIComponent(file.filename)}/rows?limit=300`);
            if (!res.ok) return [];
            const data = await res.json();
            return (data.rows || []).map((row, index) => ({
              ...row,
              fileIndex: index,
              filename: file.filename,
            }));
          })
        );

        if (!cancelled) {
          setSectionRows(responses.flat());
        }
      } catch {
        if (!cancelled) {
          setSectionRows([]);
        }
      } finally {
        if (!cancelled) {
          setSectionLoading(false);
        }
      }
    };

    loadSectionRows();

    return () => {
      cancelled = true;
    };
  }, [activeSection, files]);

  const handleNavigate = (sectionId) => {
    setActiveSection(sectionId);
    if (sectionId !== "overview") {
      setSelectedFile(null);
    }
  };

  const renderSection = () => {
    if (activeSection === "overview") {
      return (
        <>
          {!loading && !error && files.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 animate-fade-in">
              <StatCard label="Log Files" value={totalFiles} icon="📄" color="teal" />
              <StatCard label="Interfaces" value={uniqueNics} icon="🔌" color="blue" />
              <StatCard label="Users" value={uniqueUids} icon="👥" color="purple" />
              <StatCard label="Total Data" value={formatBytes(totalSize)} icon="💾" color="amber" />
            </div>
          )}

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

          <UploadArea onUploadComplete={fetchFiles} />

          <FileList
            files={files}
            loading={loading}
            error={error}
            onRetry={fetchFiles}
            onDelete={handleDelete}
            onSelect={setSelectedFile}
            selectedFilename={selectedFile?.filename}
          />
        </>
      );
    }

    const sectionLabels = {
      "per-user": "Per User",
      "top-ips": "Top IPs",
      "geo-map": "Geo Map",
      "raw-log": "Raw Log",
      config: "Config",
    };

    return (
      <div className="space-y-4 animate-fade-in">
        <div className="rounded-xl border border-border bg-bg-card/70 p-6">
          <h2 className="text-xl font-semibold text-text-primary">
            {sectionLabels[activeSection] || "Section"}
          </h2>
          <p className="mt-2 text-sm text-text-muted max-w-2xl">
            This view is populated from the log files currently discovered on the system.
          </p>
        </div>

        {sectionLoading ? (
          <div className="rounded-xl border border-border bg-bg-card/60 p-6 text-sm text-text-muted">
            Loading log data...
          </div>
        ) : (
          <SectionView
            section={activeSection}
            files={files}
            rows={sectionRows}
            totalFiles={totalFiles}
            uniqueNics={uniqueNics}
            uniqueUids={uniqueUids}
            totalSize={totalSize}
          />
        )}
      </div>
    );
  };

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar activeId={activeSection} onNavigate={handleNavigate} />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar activeSection={activeSection} />

        <main className="flex-1 p-6 overflow-y-auto">
          {renderSection()}
        </main>

        {/* Footer */}
        <footer className="px-6 py-3 border-t border-border text-center">
          <p className="text-xs text-text-muted">
            eBPF Traffic Profiler Dashboard · Kernel-level network monitoring
          </p>
        </footer>
      </div>

      {/* File details slide-out panel */}
      <FileDetails
        file={selectedFile}
        onClose={() => setSelectedFile(null)}
      />
    </div>
  );
}

function SectionView({ section, files, rows, totalFiles, uniqueNics, uniqueUids, totalSize }) {
  if (section === "per-user") {
    const userStats = Object.values(
      files.reduce((acc, file) => {
        const key = file.uid;
        if (!acc[key]) {
          acc[key] = { uid: file.uid, files: 0, bytes: 0, nics: new Set() };
        }
        acc[key].files += 1;
        acc[key].bytes += file.size;
        acc[key].nics.add(file.nic);
        return acc;
      }, {})
    ).sort((a, b) => Number(b.bytes) - Number(a.bytes));

    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {userStats.map((user) => (
          <div key={user.uid} className="rounded-xl border border-border bg-bg-card/70 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-text-muted">UID {user.uid}</p>
                <h3 className="text-lg font-semibold text-text-primary">Per-user traffic</h3>
              </div>
              <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-accent-purple/10 text-accent-purple border border-accent-purple/20">
                {user.files} files
              </span>
            </div>
            <div className="mt-4 space-y-3">
              <MetaRow label="Interfaces" value={[...user.nics].join(", ")} />
              <MetaRow label="Files size" value={formatBytes(user.bytes)} />
              <MetaRow label="Status" value="Active logs available" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (section === "top-ips" || section === "geo-map") {
    const ipStats = rows.reduce((acc, row) => {
      const dst = row.dst_ip || "unknown";
      const src = row.src_ip || "unknown";
      acc[dst] = acc[dst] || { ip: dst, bytes: 0, hits: 0, type: dst.includes(":") ? "IPv6" : "IPv4" };
      acc[dst].bytes += Number(row.bytes || 0);
      acc[dst].hits += 1;
      acc[src] = acc[src] || { ip: src, bytes: 0, hits: 0, type: src.includes(":") ? "IPv6" : "IPv4" };
      return acc;
    }, {});

    const rankedIps = Object.values(ipStats)
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 8);

    return (
      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <div className="rounded-xl border border-border bg-bg-card/70 p-5">
          <h3 className="text-lg font-semibold text-text-primary mb-4">
            {section === "top-ips" ? "Top destination IPs" : "Geo map summary"}
          </h3>
          <div className="space-y-3">
            {rankedIps.map((item) => (
              <div key={item.ip} className="space-y-1.5">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="font-medium text-text-primary truncate">{item.ip}</span>
                  <span className="text-text-muted">{formatBytes(item.bytes)}</span>
                </div>
                <div className="h-2 rounded-full bg-bg-primary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent-teal to-accent-blue"
                    style={{ width: `${Math.max(8, (item.bytes / (rankedIps[0]?.bytes || 1)) * 100)}%` }}
                  />
                </div>
                <div className="text-xs text-text-muted flex items-center gap-2">
                  <span>{item.type}</span>
                  <span>•</span>
                  <span>{item.hits} packets</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-bg-card/70 p-5">
          <h3 className="text-lg font-semibold text-text-primary mb-4">Overview stats</h3>
          <div className="space-y-3">
            <MetaRow label="Log files" value={String(totalFiles)} />
            <MetaRow label="Interfaces" value={String(uniqueNics)} />
            <MetaRow label="Users" value={String(uniqueUids)} />
            <MetaRow label="Total size" value={formatBytes(totalSize)} />
            <MetaRow label="Rows loaded" value={String(rows.length)} />
          </div>
          <div className="mt-4 rounded-lg border border-dashed border-border px-4 py-5 text-sm text-text-muted">
            A live Leaflet map can be plugged in here once GeoIP data is available.
          </div>
        </div>
      </div>
    );
  }

  if (section === "raw-log") {
    const recentRows = [...rows].sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp))).slice(0, 12);

    return (
      <div className="rounded-xl border border-border bg-bg-card/70 overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-lg font-semibold text-text-primary">Raw log preview</h3>
          <p className="text-sm text-text-muted">Showing the newest rows across all discovered logs.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg-primary/50 text-text-muted uppercase text-[11px] tracking-wide">
              <tr>
                <th className="text-left px-5 py-3">Timestamp</th>
                <th className="text-left px-5 py-3">Direction</th>
                <th className="text-left px-5 py-3">Bytes</th>
                <th className="text-left px-5 py-3">Source</th>
                <th className="text-left px-5 py-3">Destination</th>
                <th className="text-left px-5 py-3">UID</th>
              </tr>
            </thead>
            <tbody>
              {recentRows.map((row, index) => (
                <tr key={`${row.filename}-${row.timestamp}-${index}`} className="border-t border-border/70">
                  <td className="px-5 py-3 text-text-secondary font-mono text-xs">{formatTimestamp(row.timestamp)}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-1 rounded-md text-[11px] font-semibold uppercase ${row.direction === "in" ? "bg-accent-blue/10 text-accent-blue" : "bg-accent-teal/10 text-accent-teal"}`}>
                      {row.direction || "out"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-text-secondary">{formatBytes(Number(row.bytes || 0))}</td>
                  <td className="px-5 py-3 text-text-secondary font-mono text-xs">{row.src_ip}</td>
                  <td className="px-5 py-3 text-text-secondary font-mono text-xs">{row.dst_ip}</td>
                  <td className="px-5 py-3 text-text-secondary">UID {row.uid}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (section === "config") {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-bg-card/70 p-5">
          <h3 className="text-lg font-semibold text-text-primary mb-3">Current config</h3>
          <div className="space-y-3 text-sm text-text-secondary">
            <MetaRow label="Backend" value="http://localhost:3001" />
            <MetaRow label="Log directory" value="/tmp" />
            <MetaRow label="Tracked files" value={`${files.length} discovered`} />
            <MetaRow label="File naming" value="traffic_user_<nic>_<uid>.log" />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-bg-card/70 p-5">
          <h3 className="text-lg font-semibold text-text-primary mb-3">Demo note</h3>
          <p className="text-sm text-text-muted leading-6">
            For your teaching demo, the app now shows working navigation plus real metadata and
            parsed log rows. The next step would be to add a true live map, websocket updates, and
            backend aggregation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Log Files" value={totalFiles} icon="📄" color="teal" />
      <StatCard label="Interfaces" value={uniqueNics} icon="🔌" color="blue" />
      <StatCard label="Users" value={uniqueUids} icon="👥" color="purple" />
      <StatCard label="Total Data" value={formatBytes(totalSize)} icon="💾" color="amber" />
    </div>
  );
}

function MetaRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 py-2 last:border-0">
      <span className="text-text-muted">{label}</span>
      <span className="text-text-primary text-right break-all">{value}</span>
    </div>
  );
}

function formatTimestamp(timestamp) {
  if (!timestamp) return "-";
  const [secondsPart, nanosPart = "0"] = String(timestamp).split(".");
  const date = new Date(Number(secondsPart) * 1000);
  const milliseconds = String(nanosPart).padEnd(3, "0").slice(0, 3);
  const time = date.toTimeString().slice(0, 8);
  return `${time}.${milliseconds}`;
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
