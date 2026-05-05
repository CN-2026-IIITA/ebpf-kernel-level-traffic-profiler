import { useState, useEffect } from "react";

const API_BASE = "http://localhost:3001";

/**
 * FileDetails — Slide-out side panel showing detailed file info.
 *
 * Props:
 *   file     – selected file object { filename, nic, uid, size, modified } or null
 *   onClose  – callback to deselect / close the panel
 */
export default function FileDetails({ file, onClose }) {
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);

  // Animate in when file changes
  useEffect(() => {
    if (file) {
      // Small delay so the CSS transition triggers
      const t = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(t);
    } else {
      setVisible(false);
    }
  }, [file]);

  if (!file) return null;

  const filePath = `/tmp/${file.filename}`;
  const fileUrl = `${API_BASE}/api/files/${file.filename}`;
  const isImage = /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(file.filename);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-secure contexts
      const textarea = document.createElement("textarea");
      textarea.value = fileUrl;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setVisible(false);
    // Wait for the slide-out animation before unmounting
    setTimeout(() => onClose(), 280);
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={`
          fixed inset-0 z-40
          bg-black/40 backdrop-blur-sm
          transition-opacity duration-300
          ${visible ? "opacity-100" : "opacity-0 pointer-events-none"}
        `}
        onClick={handleClose}
      />

      {/* Side panel */}
      <aside
        className={`
          fixed top-0 right-0 z-50
          h-screen w-full max-w-md
          bg-bg-secondary border-l border-border
          flex flex-col
          shadow-2xl shadow-black/40
          transition-transform duration-300 ease-out
          ${visible ? "translate-x-0" : "translate-x-full"}
        `}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 h-16 border-b border-border shrink-0">
          <h2 className="text-base font-semibold text-text-primary">File Details</h2>
          <button
            id="file-details-close"
            onClick={handleClose}
            className="
              p-2 rounded-lg
              text-text-muted hover:text-text-primary hover:bg-bg-card
              transition-all duration-200 cursor-pointer
            "
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* Filename */}
          <div className="mb-6 animate-fade-in">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-accent-teal/20 to-accent-blue/20 border border-accent-teal/20 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-accent-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-text-primary break-all">{file.filename}</h3>
            <p className="text-xs text-text-muted mt-1">Traffic log file</p>
          </div>

          {/* Image preview (if applicable) */}
          {isImage && (
            <div className="mb-6 animate-fade-in" style={{ animationDelay: "50ms" }}>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-2 block">
                Preview
              </label>
              <div className="rounded-xl border border-border bg-bg-card overflow-hidden">
                <img
                  src={fileUrl}
                  alt={file.filename}
                  className="w-full h-auto max-h-64 object-contain bg-bg-primary"
                  onError={(e) => {
                    e.target.style.display = "none";
                  }}
                />
              </div>
            </div>
          )}

          {/* Metadata grid */}
          <div className="space-y-4 mb-6 animate-fade-in" style={{ animationDelay: "100ms" }}>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted block">
              Properties
            </label>

            <DetailRow label="Interface (NIC)" value={file.nic} badge badgeColor="teal" />
            <DetailRow label="User ID" value={`UID ${file.uid}`} badge badgeColor="purple" />
            <DetailRow label="File Size" value={formatBytes(file.size)} />
            <DetailRow label="Last Modified" value={formatFullDate(file.modified)} />
            <DetailRow label="System Path" value={filePath} mono />
          </div>

          {/* URL + Copy */}
          <div className="animate-fade-in" style={{ animationDelay: "150ms" }}>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-2 block">
              API Endpoint
            </label>
            <div className="flex items-stretch gap-2">
              <div className="
                flex-1 min-w-0 px-3 py-2.5 rounded-lg
                bg-bg-card border border-border
                text-sm text-text-secondary font-mono
                break-all select-all
                leading-relaxed
              ">
                {fileUrl}
              </div>
              <button
                id="copy-url-btn"
                onClick={handleCopy}
                className={`
                  shrink-0 px-4 rounded-lg text-sm font-medium
                  flex items-center gap-2
                  transition-all duration-200 cursor-pointer
                  ${copied
                    ? "bg-success/15 text-success border border-success/30"
                    : "bg-accent-teal/10 text-accent-teal border border-accent-teal/20 hover:bg-accent-teal/20"
                  }
                `}
              >
                {copied ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>

          {/* File path copy */}
          <div className="mt-4 animate-fade-in" style={{ animationDelay: "200ms" }}>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-2 block">
              System Path
            </label>
            <CopyableField value={filePath} />
          </div>
        </div>

        {/* ── Footer actions ── */}
        <div className="px-6 py-4 border-t border-border shrink-0">
          <button
            onClick={handleClose}
            className="
              w-full py-2.5 rounded-lg text-sm font-medium
              bg-bg-card text-text-secondary border border-border
              hover:border-border-hover hover:text-text-primary hover:bg-bg-card-hover
              active:scale-[0.98]
              transition-all duration-150 cursor-pointer
            "
          >
            Close
          </button>
        </div>
      </aside>
    </>
  );
}

/* ── Detail row ── */
const BADGE_COLORS = {
  teal: "bg-accent-teal/10 text-accent-teal border border-accent-teal/20",
  purple: "bg-accent-purple/10 text-accent-purple border border-accent-purple/20",
  blue: "bg-accent-blue/10 text-accent-blue border border-accent-blue/20",
  amber: "bg-accent-amber/10 text-accent-amber border border-accent-amber/20",
};

function DetailRow({ label, value, badge, badgeColor, mono }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-text-muted">{label}</span>
      {badge ? (
        <span className={`
          inline-flex items-center px-2.5 py-1 rounded-md
          text-[11px] font-semibold tracking-wide uppercase
          ${BADGE_COLORS[badgeColor] || BADGE_COLORS.teal}
        `}>
          {value}
        </span>
      ) : (
        <span className={`text-sm font-medium text-text-primary ${mono ? "font-mono text-xs break-all text-right max-w-[55%]" : ""}`}>
          {value}
        </span>
      )}
    </div>
  );
}

/* ── Copyable field with inline button ── */
function CopyableField({ value }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-stretch gap-2">
      <div className="
        flex-1 min-w-0 px-3 py-2.5 rounded-lg
        bg-bg-card border border-border
        text-xs text-text-secondary font-mono
        break-all select-all leading-relaxed
      ">
        {value}
      </div>
      <button
        onClick={handleCopy}
        className={`
          shrink-0 px-3 rounded-lg text-xs font-medium
          flex items-center gap-1.5
          transition-all duration-200 cursor-pointer
          ${copied
            ? "bg-success/15 text-success border border-success/30"
            : "bg-bg-card text-text-muted border border-border hover:text-text-primary hover:border-border-hover"
          }
        `}
      >
        {copied ? (
          <>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Copied!
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy
          </>
        )}
      </button>
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

function formatFullDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
