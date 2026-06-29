import React from "react";
import { signInWithPopup, signOut, User } from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import { LogIn, LogOut, ShieldAlert, User as UserIcon, Sun, Moon } from "lucide-react";

interface HeaderProps {
  user: User | null;
  loading: boolean;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export default function Header({ user, loading, darkMode, onToggleDarkMode }: HeaderProps) {
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error("Authentication failed:", err);
      // Let user know of iframe issues if they block popups
      if (err.code === "auth/popup-blocked") {
        alert("The authentication popup was blocked by your browser. Please allow popups or open the app in a new tab!");
      } else {
        alert(`Authentication failed: ${err.message}`);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err: any) {
      console.error("Sign out failed:", err);
    }
  };

  return (
    <header id="header-container" className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 border-b border-indigo-900/60 sticky top-0 z-50 shadow-md shadow-indigo-950/20 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 h-18 flex items-center justify-between">
        <div id="header-logo-group" className="flex items-center space-x-3.5 group cursor-pointer">
          <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-2.5 rounded-xl shadow-lg shadow-orange-500/20 group-hover:scale-110 active:scale-95 transition-all duration-300">
            <ShieldAlert className="w-5 h-5 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-black tracking-tight text-white uppercase leading-none bg-clip-text">
              Community <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">Hero</span>
            </h1>
            <p className="text-[10px] sm:text-xs text-indigo-200/80 mt-1 font-semibold tracking-wider uppercase">Report, Verify, Fix Together</p>
          </div>
        </div>

        <div id="header-auth-actions" className="flex items-center space-x-2 sm:space-x-3">
          {/* Dark Mode Toggle Button */}
          <button
            id="dark-mode-toggle"
            onClick={onToggleDarkMode}
            aria-label="Toggle dark mode"
            className="p-2 rounded-xl text-indigo-200 hover:text-amber-400 hover:bg-white/10 active:scale-90 border border-transparent hover:border-indigo-800 transition-all cursor-pointer duration-200"
          >
            {darkMode ? (
              <Sun className="w-4.5 h-4.5 text-amber-400 animate-spin-slow" />
            ) : (
              <Moon className="w-4.5 h-4.5" />
            )}
          </button>

          {loading ? (
            <div className="flex items-center space-x-2 text-indigo-300">
              <div className="w-4 h-4 rounded-full border-2 border-indigo-800 border-t-amber-400 animate-spin" />
              <span className="text-xs font-semibold tracking-wide">Authenticating...</span>
            </div>
          ) : user ? (
            <div className="flex items-center space-x-2.5 sm:space-x-3">
              <div className="flex flex-col items-end text-right hidden sm:flex">
                <p className="text-sm font-bold text-white leading-none font-display">
                  {user.displayName || "Citizen"}
                </p>
                <p className="text-[10px] text-indigo-300 mt-0.5 font-medium">
                  {user.email}
                </p>
              </div>
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || "User"}
                  className="w-9 h-9 rounded-full border-2 border-indigo-500/50 hover:border-amber-400 shadow-md transition-all duration-300"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-indigo-950 border border-indigo-700 flex items-center justify-center shadow-inner animate-pulse-slow">
                  <UserIcon className="w-4.5 h-4.5 text-indigo-300" />
                </div>
              )}
              <button
                id="sign-out-btn"
                onClick={handleLogout}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-indigo-800 bg-indigo-950/40 text-indigo-200 hover:text-white hover:bg-indigo-900/40 hover:border-indigo-700 active:scale-95 transition-all duration-200 text-xs font-bold cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <span className="text-xs text-indigo-300 hidden lg:inline-block max-w-[150px] text-right leading-tight font-medium">
                Sign in to report or verify issues
              </span>
              <button
                id="sign-in-btn"
                onClick={handleLogin}
                className="flex items-center space-x-1.5 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-slate-950 font-extrabold px-3 py-2 rounded-xl active:scale-95 hover:scale-[1.02] duration-200 transition-all shadow-md shadow-orange-500/10 hover:shadow-orange-500/20 text-xs cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Google Sign In</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
