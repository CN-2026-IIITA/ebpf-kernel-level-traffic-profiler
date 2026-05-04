import { useState } from "react";

const NAV_ITEMS = [
  { id: "overview",  label: "Overview",  icon: "📊", active: true },
  { id: "per-user",  label: "Per User",  icon: "👤", active: false },
  { id: "top-ips",   label: "Top IPs",   icon: "🌐", active: false },
  { id: "geo-map",   label: "Geo Map",   icon: "🗺️", active: false },
  { id: "raw-log",   label: "Raw Log",   icon: "📋", active: false },
  { id: "config",    label: "Config",    icon: "⚙️", active: false },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [activeId, setActiveId] = useState("overview");

  return (
    <aside
      className={`
        flex flex-col h-screen sticky top-0
        bg-bg-sidebar border-r border-border
        transition-all duration-300 ease-in-out
        ${collapsed ? "w-[68px]" : "w-[240px]"}
      `}
    >
      {/* Logo / Brand */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-teal to-accent-blue flex items-center justify-center text-sm font-bold text-white shrink-0">
          TP
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold text-text-primary whitespace-nowrap overflow-hidden animate-fade-in">
            Traffic Profiler
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 flex flex-col gap-1 overflow-y-auto">
        {NAV_ITEMS.map((item, i) => {
          const isActive = activeId === item.id;
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => setActiveId(item.id)}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg
                text-sm font-medium transition-all duration-200 cursor-pointer
                animate-fade-in
                ${isActive
                  ? "bg-accent-teal/10 text-accent-teal shadow-[inset_2px_0_0_var(--color-accent-teal)]"
                  : "text-text-secondary hover:bg-bg-card-hover hover:text-text-primary"
                }
              `}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <span className="text-lg shrink-0">{item.icon}</span>
              {!collapsed && <span className="whitespace-nowrap overflow-hidden">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="px-2 pb-4">
        <button
          id="sidebar-toggle"
          onClick={() => setCollapsed((c) => !c)}
          className="
            w-full flex items-center justify-center gap-2 px-3 py-2
            rounded-lg text-text-muted hover:text-text-secondary hover:bg-bg-card
            transition-all duration-200 text-xs cursor-pointer
          "
        >
          <span className={`transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`}>
            ◀
          </span>
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
