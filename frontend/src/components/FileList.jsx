/**
 * FileList – Displays discovered traffic log files as styled cards.
 *
 * Props:
 *   files    – array of { filename, nic, uid, size, modified }
 *   loading  – boolean, show skeleton placeholders
 *   error    – string | null, error message to display
 *   onRetry  – function, called when user clicks retry
 *   onDelete – function(filename), called when user clicks delete
 */

export default function FileList({ files, loading, error, onRetry, onDelete, onSelect, selectedFilename }) {
  /* ── Error state ── */
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-danger/10 flex items-center justify-center mb-4">
          <span className="text-3xl">⚠️</span>
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-1">Connection Error</h3>
        <p className="text-sm text-text-muted mb-6 text-center max-w-sm">{error}</p>
        <button
          id="retry-btn"
          onClick={onRetry}
          className="
            px-5 py-2 rounded-lg text-sm font-medium
            bg-accent-teal text-white
            hover:bg-accent-teal/90 active:scale-[0.97]
            transition-all duration-150 cursor-pointer
          "
        >
          Retry Connection
        </button>
      </div>
    );
  }

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl p-5 h-44 skeleton" style={{ animationDelay: `${i * 200}ms` }} />
        ))}
      </div>
    );
  }

  /* ── Empty state ── */
  if (!files || files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-bg-card flex items-center justify-center mb-4 border border-border">
          <span className="text-3xl">📁</span>
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-1">No Log Files Found</h3>
        <p className="text-sm text-text-muted text-center max-w-sm">
          Start the traffic meter to generate log files. They'll appear here automatically.
        </p>
      </div>
    );
  }

  /* ── File cards ── */
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {files.map((file, i) => (
        <FileCard
          key={file.filename}
          file={file}
          index={i}
          selected={file.filename === selectedFilename}
          onDelete={() => onDelete(file.filename)}
          onSelect={() => onSelect?.(file)}
        />
      ))}
    </div>
  );
}

/* ── Individual file card ── */
function FileCard({ file, index, onDelete, onSelect, selected }) {
  const formattedSize = formatBytes(file.size);
  const formattedTime = formatDate(file.modified);

  return (
    <div
      onClick={onSelect}
      className={`
        group relative rounded-xl p-5
        bg-bg-card/60 backdrop-blur-sm
        border hover:border-border-hover
        hover:bg-bg-card-hover hover:shadow-lg hover:shadow-accent-teal/5
        transition-all duration-300 ease-out cursor-pointer
        animate-fade-in
        ${selected
          ? "border-accent-teal/50 shadow-lg shadow-accent-teal/10 ring-1 ring-accent-teal/20"
          : "border-border"
        }
      `}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Top row: filename + delete */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-text-primary truncate pr-2" title={file.filename}>
            {file.filename}
          </h3>
          <p className="text-xs text-text-muted mt-0.5">{formattedTime}</p>
        </div>
        <button
          id={`delete-${file.filename}`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="
            opacity-0 group-hover:opacity-100
            p-1.5 rounded-lg
            text-text-muted hover:text-danger hover:bg-danger/10
            transition-all duration-200 cursor-pointer shrink-0
          "
          title="Delete log file"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2 mb-4">
        <span className="
          inline-flex items-center gap-1 px-2.5 py-1 rounded-md
          text-[11px] font-semibold tracking-wide uppercase
          bg-accent-teal/10 text-accent-teal border border-accent-teal/20
        ">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          {file.nic}
        </span>
        <span className="
          inline-flex items-center gap-1 px-2.5 py-1 rounded-md
          text-[11px] font-semibold tracking-wide uppercase
          bg-accent-purple/10 text-accent-purple border border-accent-purple/20
        ">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          UID {file.uid}
        </span>
      </div>

      {/* Size bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-sm font-medium text-text-secondary">{formattedSize}</span>
        </div>
        <div className="w-2 h-2 rounded-full bg-success/60 animate-pulse" title="Active" />
      </div>

      {/* Hover glow accent line */}
      <div className="
        absolute bottom-0 left-4 right-4 h-px
        bg-gradient-to-r from-transparent via-accent-teal/0 to-transparent
        group-hover:via-accent-teal/40
        transition-all duration-500
      " />
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

function formatDate(isoString) {
  const d = new Date(isoString);
  const now = new Date();
  const diff = now - d;

  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
