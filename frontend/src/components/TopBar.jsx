export default function TopBar() {
  return (
    <header className="h-16 bg-bg-secondary/80 backdrop-blur-md border-b border-border flex items-center justify-between px-6 sticky top-0 z-30">
      {/* Left – Page Title */}
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-text-primary">Dashboard</h1>
        <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase bg-accent-teal/15 text-accent-teal border border-accent-teal/20">
          Live
        </span>
      </div>

      {/* Center – Placeholder Controls */}
      <div className="hidden md:flex items-center gap-2">
        {/* Time range presets */}
        {["5m", "1h", "24h"].map((label) => (
          <button
            key={label}
            className="
              px-3 py-1.5 rounded-md text-xs font-medium
              bg-bg-card text-text-secondary border border-border
              hover:border-border-hover hover:text-text-primary
              transition-all duration-150 cursor-pointer
            "
          >
            {label}
          </button>
        ))}
        <div className="w-px h-5 bg-border mx-1" />
        <button className="
          px-3 py-1.5 rounded-md text-xs font-medium
          bg-bg-card text-text-muted border border-border
          hover:border-border-hover hover:text-text-secondary
          transition-all duration-150 cursor-pointer
        ">
          Custom Range
        </button>
      </div>

      {/* Right – NIC selector placeholder */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-card border border-border">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="text-xs font-medium text-text-secondary">NIC:</span>
          <span className="text-xs font-semibold text-text-primary">All</span>
          <svg className="w-3 h-3 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </header>
  );
}
