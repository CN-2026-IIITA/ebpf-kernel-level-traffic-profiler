import { useState, useRef, useCallback } from "react";
import axios from "axios";

const API_BASE = "http://localhost:3001";

/**
 * UploadArea — Drag-and-drop file upload zone with per-file progress bars.
 *
 * Props:
 *   onUploadComplete – called after all uploads finish (triggers file list refresh)
 */
export default function UploadArea({ onUploadComplete }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploads, setUploads] = useState([]); // { id, name, progress, status, error }
  const fileInputRef = useRef(null);
  const dragCountRef = useRef(0);

  /* ── Drag handlers ── */
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current += 1;
    setIsDragOver(true);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current -= 1;
    if (dragCountRef.current <= 0) {
      dragCountRef.current = 0;
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current = 0;
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) uploadFiles(files);
  }, []);

  /* ── Click-to-browse ── */
  const handleBrowseClick = () => fileInputRef.current?.click();
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) uploadFiles(files);
    e.target.value = "";
  };

  /* ── Upload logic ── */
  const uploadFiles = async (files) => {
    const uploadEntries = files.map((file, i) => ({
      id: `${Date.now()}-${i}`,
      name: file.name,
      size: file.size,
      progress: 0,
      status: "uploading", // uploading | complete | error
      error: null,
    }));

    setUploads((prev) => [...prev, ...uploadEntries]);

    const uploadPromises = files.map((file, i) => {
      const entry = uploadEntries[i];
      const formData = new FormData();
      formData.append("files", file);

      return axios
        .post(`${API_BASE}/api/upload`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (progressEvent) => {
            const pct = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
            setUploads((prev) =>
              prev.map((u) => (u.id === entry.id ? { ...u, progress: pct } : u))
            );
          },
        })
        .then(() => {
          setUploads((prev) =>
            prev.map((u) => (u.id === entry.id ? { ...u, progress: 100, status: "complete" } : u))
          );
        })
        .catch((err) => {
          const message = err.response?.data?.error || err.message || "Upload failed";
          setUploads((prev) =>
            prev.map((u) => (u.id === entry.id ? { ...u, status: "error", error: message } : u))
          );
        });
    });

    await Promise.allSettled(uploadPromises);

    // Auto-clear completed uploads after 3 seconds
    setTimeout(() => {
      setUploads((prev) => prev.filter((u) => u.status === "uploading"));
    }, 3000);

    onUploadComplete?.();
  };

  /* ── Dismiss a single upload entry ── */
  const dismissUpload = (id) => {
    setUploads((prev) => prev.filter((u) => u.id !== id));
  };

  return (
    <div className="mb-6 animate-fade-in">
      {/* Drop zone */}
      <div
        id="upload-drop-zone"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleBrowseClick}
        className={`
          relative rounded-xl border-2 border-dashed
          px-6 py-8 text-center cursor-pointer
          transition-all duration-300 ease-out
          ${isDragOver
            ? "border-accent-teal bg-accent-teal/5 shadow-lg shadow-accent-teal/10 scale-[1.01]"
            : "border-border hover:border-border-hover hover:bg-bg-card/30"
          }
        `}
      >
        {/* Animated background pulse on drag */}
        {isDragOver && (
          <div className="absolute inset-0 rounded-xl bg-accent-teal/5 animate-pulse pointer-events-none" />
        )}

        <div className="relative flex flex-col items-center gap-3">
          <div className={`
            w-12 h-12 rounded-xl flex items-center justify-center
            transition-all duration-300
            ${isDragOver
              ? "bg-accent-teal/20 text-accent-teal scale-110"
              : "bg-bg-card text-text-muted border border-border"
            }
          `}>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <div>
            <p className={`text-sm font-medium transition-colors duration-200 ${isDragOver ? "text-accent-teal" : "text-text-primary"}`}>
              {isDragOver ? "Drop files here" : "Drag & drop log files here"}
            </p>
            <p className="text-xs text-text-muted mt-1">
              or <span className="text-accent-teal hover:underline">browse files</span> · accepts <code className="text-[10px] px-1.5 py-0.5 rounded bg-bg-card text-text-secondary">traffic_user_*.log</code>
            </p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".log"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Upload progress list */}
      {uploads.length > 0 && (
        <div className="mt-3 space-y-2">
          {uploads.map((upload) => (
            <UploadProgressBar key={upload.id} upload={upload} onDismiss={() => dismissUpload(upload.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Progress bar for a single file ── */
function UploadProgressBar({ upload, onDismiss }) {
  const isComplete = upload.status === "complete";
  const isError = upload.status === "error";

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-lg
        animate-fade-in transition-all duration-300
        ${isError
          ? "bg-danger/10 border border-danger/20"
          : isComplete
            ? "bg-success/10 border border-success/20"
            : "bg-bg-card border border-border"
        }
      `}
    >
      {/* Status icon */}
      <div className={`
        w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm
        ${isError
          ? "bg-danger/20 text-danger"
          : isComplete
            ? "bg-success/20 text-success"
            : "bg-accent-teal/20 text-accent-teal"
        }
      `}>
        {isError ? "✕" : isComplete ? "✓" : "↑"}
      </div>

      {/* File info + bar */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-medium text-text-primary truncate pr-2">{upload.name}</p>
          <span className={`text-xs font-semibold shrink-0 ${
            isError ? "text-danger" : isComplete ? "text-success" : "text-accent-teal"
          }`}>
            {isError ? "Failed" : isComplete ? "Done" : `${upload.progress}%`}
          </span>
        </div>

        {/* Progress bar track */}
        {!isError && (
          <div className="w-full h-1.5 rounded-full bg-bg-primary overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ease-out ${
                isComplete ? "bg-success" : "bg-accent-teal"
              }`}
              style={{ width: `${upload.progress}%` }}
            />
          </div>
        )}

        {/* Error message */}
        {isError && (
          <p className="text-xs text-danger/80 mt-0.5 truncate">{upload.error}</p>
        )}
      </div>

      {/* Dismiss button */}
      {(isComplete || isError) && (
        <button
          onClick={onDismiss}
          className="p-1 rounded text-text-muted hover:text-text-primary transition-colors cursor-pointer shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
