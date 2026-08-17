"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Zap,
  MessageSquare,
  Layers,
  Briefcase,
  LogOut,
  LayoutDashboard,
  Kanban,
  LayoutTemplate,
  User,
  Users,
  Hammer,
  PackageCheck,
} from "lucide-react";
import { logout } from "@/app/actions/logout";
import { Button } from "@/components/ui/button";

const ALL_NAV = [
  { href: "/dashboard",    label: "Dashboard",    icon: LayoutDashboard, roles: ["admin"] },
  { href: "/job-board",    label: "Job Board",    icon: Kanban,          roles: ["admin"]},
  { href: "/applications", label: "Applications", icon: Briefcase,       roles: ["admin", "assistant"] },
  { href: "/prompts",      label: "Prompts",      icon: MessageSquare,   roles: ["admin"] },
  { href: "/contexts",     label: "Contexts",     icon: Layers,          roles: ["admin"] },
  { href: "/templates",    label: "Templates",    icon: LayoutTemplate,  roles: ["admin"] },
  { href: "/generate",     label: "Generate",     icon: Zap,             roles: ["admin"] },
  { href: "/builder",       label: "Builder",       icon: Hammer,          roles: ["admin", "assistant"] },
  { href: "/batch-builder", label: "BatchBuilder",  icon: PackageCheck,    roles: ["admin", "assistant"] },
  { href: "/profile",      label: "Profile",      icon: User,            roles: ["admin"] },
  { href: "/team",         label: "Team",         icon: Users,           roles: ["admin"] },
];

interface SidebarProps {
  role: "admin" | "assistant";
  userName: string;
}

export default function Sidebar({ role, userName }: SidebarProps) {
  const pathname = usePathname();
  const nav = ALL_NAV.filter((item) => item.roles.includes(role));

  return (
    <aside className="w-44 shrink-0 bg-sidebar flex flex-col border-r border-sidebar-border">
      {/* Brand */}
      <div className="px-4 py-5 border-b border-sidebar-border flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center shrink-0">
          <Zap size={14} className="text-primary-foreground" strokeWidth={2.5} />
        </div>
        <span className="text-sm font-semibold text-sidebar-foreground leading-tight">
          AI Resume<br />Tailor
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              }`}
            >
              <Icon size={15} strokeWidth={2} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-sidebar-border space-y-1">
        {userName && (
          <p className="px-3 py-1 text-xs text-sidebar-foreground/40 truncate">{userName}</p>
        )}
        <form action={logout}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent px-3"
          >
            <LogOut size={14} />
            Sign out
          </Button>
        </form>
      </div>
    </aside>
  );
}
