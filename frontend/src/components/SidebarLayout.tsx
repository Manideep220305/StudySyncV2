import React, { useState } from "react";
import { Sidebar, SidebarBody, SidebarLink, useSidebar } from "./ui/Sidebar";
import {
  LayoutDashboard,
  Library,
  Trophy,
  User,
  LogOut,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "../lib/utils";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

interface SidebarLayoutProps {
  children: React.ReactNode;
  contentClassName?: string;
}

export function SidebarLayout({ children, contentClassName }: SidebarLayoutProps) {
  const [open, setOpen] = useState(false);
  const { logout } = useAuth();         // pulls logout() from AuthContext
  const navigate = useNavigate();       // for redirecting after logout

  const links = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: <LayoutDashboard className="text-slate-200 h-5 w-5 flex-shrink-0" />,
    },
    {
      label: "Study Rooms",
      href: "/rooms",
      icon: <Library className="text-slate-200 h-5 w-5 flex-shrink-0" />,
    },
    {
      label: "Leaderboard",
      href: "/leaderboard",
      icon: <Trophy className="text-slate-200 h-5 w-5 flex-shrink-0" />,
    },
    {
      label: "Profile",
      href: "/profile",
      icon: <User className="text-slate-200 h-5 w-5 flex-shrink-0" />,
    },
  ];

  // Calls AuthContext logout (clears JWT cookie via backend),
  // then navigates to landing page.
  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className={cn("flex flex-col md:flex-row w-full h-screen overflow-hidden")}>
      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-10">
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
            <SidebarLogo />
            <div className="mt-8 flex flex-col gap-2">
              {links.map((link, idx) => (
                <SidebarLink key={idx} link={link} />
              ))}
            </div>
          </div>

          {/*
            Logout — rendered as a button, NOT a Link.
            Clicking it calls handleLogout which:
            1. Calls AuthContext.logout() → hits backend /logout → clears httpOnly cookie
            2. Sets user to null in AuthContext
            3. navigate('/') → lands back on the landing page
            ProtectedRoute then blocks /dashboard for unauthenticated users.
          */}
          <div>
            <button
              onClick={handleLogout}
              className="flex items-center justify-start gap-2 group/sidebar py-2 w-full"
            >
              <LogOut className="text-slate-200 h-5 w-5 flex-shrink-0" />
              <motion.span
                animate={{
                  display: open ? "inline-block" : "none",
                  opacity: open ? 1 : 0,
                }}
                className="text-slate-200 text-sm group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre !p-0 !m-0"
              >
                Logout
              </motion.span>
            </button>
          </div>
        </SidebarBody>
      </Sidebar>

      {/* Main content area — bg-transparent so aurora shows through */}
      <div className="flex flex-1 overflow-auto bg-transparent text-white">
        <div className={cn('p-4 md:p-8 flex flex-col gap-2 flex-1 w-full h-full', contentClassName)}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// SIDEBAR LOGO
// ─────────────────────────────────────────────

export const SidebarLogo = () => {
  const { open, animate } = useSidebar();

  return (
    <Link
      to="/dashboard"
      className="flex items-center justify-start gap-2 group/sidebar py-1"
    >
      <div className="h-6 w-6 bg-blue-600 rounded-lg flex-shrink-0 flex items-center justify-center">
        <span className="text-white font-bold text-xs">S</span>
      </div>
      <motion.span
        animate={{
          display: animate ? (open ? "inline-block" : "none") : "inline-block",
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        className="font-bold text-lg text-white whitespace-pre transition duration-150"
      >
        StudySync
      </motion.span>
    </Link>
  );
};