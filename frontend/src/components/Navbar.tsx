"use client"

import React, { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Link } from "react-router-dom"
import { Laptop2, LayoutGrid, Radio, Users, BookOpen, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/AuthContext"
import { useToast } from "@/hooks/use-toast"

// Navigation items for the floating pill navbar in the center
const navItems = [
  { name: "Features", url: "#features", icon: LayoutGrid },
  { name: "Tracks", url: "#tracks", icon: Radio },
  { name: "Community", url: "#community", icon: Users },
  { name: "Resources", url: "#resources", icon: BookOpen },
]

// TypeScript: Props interface for the Navbar component.
// `className` is optional extra classes passed from the parent.
// `onOpenAuth` is the callback from App.tsx that opens the AuthModal.
interface NavbarProps {
  className?: string;
  onOpenAuth: (view: 'login' | 'register') => void;
}

// Navbar — The top navigation bar on the LandingPage.
// It has 3 sections: Logo (left), Floating pill nav (center), Auth buttons (right).
// When the user is logged in, it shows their username and a Logout button instead.
export default function Navbar({ className, onOpenAuth }: NavbarProps) {
  const [activeTab, setActiveTab] = useState(navItems[0].name)
  // eslint-disable-next-line no-unused-vars
  const [isMobile, setIsMobile] = useState(false)
  const { user, logout } = useAuth()
  const { toast } = useToast()

  // Listen for window resize to track mobile breakpoint
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Calls the AuthContext logout function which clears the JWT cookie and user state
  const handleLogout = async () => {
    const result = await logout()
    if (result.success) {
      toast({
        title: "Logged out",
        description: "You have been logged out successfully",
      })
    }
  }

  return (
    <div className={cn("fixed top-0 left-0 right-0 z-50 pt-6 px-4 md:px-8", className)}>
      
      {/* Container for the 3 distinct sections */}
      <div className="max-w-7xl mx-auto flex items-center justify-between relative">
        
        {/* 1. LEFT: Logo */}
        <Link to="/" className="flex items-center gap-2 group relative z-50">
          <div className="bg-blue-500/10 p-2 rounded-lg group-hover:bg-blue-500/20 transition-colors backdrop-blur-md border border-white/5">
            <Laptop2 className="h-6 w-6 text-blue-400" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent hidden sm:block">
            StudySync
          </span>
        </Link>

        {/* 2. CENTER: Floating pill with 4 nav links + animated glow indicator */}
        <div className="absolute left-1/2 -translate-x-1/2 top-0">
          <div className="flex items-center gap-1 bg-slate-900/80 border border-white/10 backdrop-blur-xl py-1.5 px-1.5 rounded-full shadow-lg shadow-black/20">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.name

              return (
                <a
                  key={item.name}
                  href={item.url}
                  onClick={() => setActiveTab(item.name)}
                  className={cn(
                    "relative cursor-pointer text-sm font-semibold px-4 py-2 rounded-full transition-colors",
                    "text-slate-400 hover:text-white",
                    isActive && "text-blue-200",
                  )}
                >
                  <span className="hidden md:inline">{item.name}</span>
                  <span className="md:hidden">
                    <Icon size={20} strokeWidth={2.5} />
                  </span>
                  
                  {/* Animated "lamp" glow effect — moves between active nav items */}
                  {isActive && (
                    <motion.div
                      layoutId="lamp"
                      className="absolute inset-0 w-full bg-white/5 rounded-full -z-10"
                      initial={false}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 30,
                      }}
                    >
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-blue-500 rounded-t-full hidden md:block">
                        <div className="absolute w-12 h-6 bg-blue-500/20 rounded-full blur-md -top-2 -left-2" />
                        <div className="absolute w-8 h-6 bg-blue-500/20 rounded-full blur-md -top-1" />
                        <div className="absolute w-4 h-4 bg-blue-500/20 rounded-full blur-sm top-0 left-2" />
                      </div>
                    </motion.div>
                  )}
                </a>
              )
            })}
          </div>
        </div>

        {/* 3. RIGHT: Shows auth buttons OR username+logout depending on auth state */}
        <div className="flex items-center gap-3 relative z-50">
          {user ? (
            <>
              {/* Show the logged-in user's name */}
              <div className="hidden sm:flex items-center gap-2 bg-slate-900/50 px-4 py-2 rounded-full border border-white/10">
                <span className="text-sm text-slate-200">{user.username}</span>
              </div>
              <Button
                onClick={handleLogout}
                variant="ghost"
                className="text-slate-300 hover:text-white hover:bg-white/10 rounded-full"
              >
                <LogOut size={18} />
                <span className="hidden sm:inline ml-2">Logout</span>
              </Button>
            </>
          ) : (
            <>
              {/* Not logged in — show Login and Get Started buttons */}
              <Button
                variant="ghost"
                onClick={() => onOpenAuth('login')}
                className="text-slate-300 hover:text-white hover:bg-white/10 rounded-full"
              >
                Login
              </Button>

              <Button
                onClick={() => onOpenAuth('register')}
                className="bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-lg shadow-blue-500/20 border-0"
              >
                Get Started
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}