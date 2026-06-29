import React, { useState, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, query, orderBy, onSnapshot, limit, doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "./firebase";
import { Report, DashboardStats, Contributor } from "./types";
import Header from "./components/Header";
import Dashboard from "./components/Dashboard";
import ReportForm from "./components/ReportForm";
import ReportList from "./components/ReportList";
import { AlertCircle, Eye, Info, BarChart3, PlusCircle, MapPin } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<"dashboard" | "report" | "map-feed">("dashboard");
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [reports, setReports] = useState<Report[]>([]);
  const [reportsLoading, setReportsLoading] = useState<boolean>(true);
  const [syncError, setSyncError] = useState<string>("");
  const [topContributors, setTopContributors] = useState<Contributor[]>([]);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    return false;
  });

  // Toggle Dark Mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  // 1. Listen to Authentication Changes & Sync Profile to Firestore
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
      
      if (user) {
        try {
          const userRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(userRef);
          if (!docSnap.exists()) {
            await setDoc(userRef, {
              uid: user.uid,
              displayName: user.displayName || "Citizen Hero",
              photoURL: user.photoURL || null,
              email: user.email || null,
              points: 0,
              updatedAt: serverTimestamp(),
            });
          } else {
            await setDoc(userRef, {
              displayName: user.displayName || "Citizen Hero",
              photoURL: user.photoURL || null,
              email: user.email || null,
              updatedAt: serverTimestamp(),
            }, { merge: true });
          }
        } catch (err) {
          console.error("Error syncing user profile on login:", err);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Listen to Real-time Reports Changes from Firestore (Newest First)
  useEffect(() => {
    setReportsLoading(true);
    setSyncError("");

    const q = query(collection(db, "reports"), orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const reportsList: Report[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          reportsList.push({
            id: doc.id,
            photo: data.photo || "",
            category: data.category || "other",
            severity: data.severity || "medium",
            description: data.description || "",
            status: data.status || "Reported",
            location: data.location || { latitude: 0, longitude: 0, address: "Unknown" },
            reportedBy: data.reportedBy || { uid: "", email: "", displayName: "", photoURL: "" },
            createdAt: data.createdAt,
            confirmedBy: data.confirmedBy || [],
            videoUrl: data.videoUrl || "",
          });
        });
        setReports(reportsList);
        setReportsLoading(false);
      },
      (error: any) => {
        console.error("Real-time snapshot error:", error);
        setSyncError("Failed to synchronize with live database. If this is a fresh setup, please wait or check your network.");
        setReportsLoading(false);
        handleFirestoreError(error, OperationType.LIST, "reports");
      }
    );

    return () => unsubscribe();
  }, []);

  // 3. Listen to Top 5 Contributors by Points
  useEffect(() => {
    const usersQuery = query(
      collection(db, "users"),
      orderBy("points", "desc"),
      limit(5)
    );

    const unsubscribe = onSnapshot(
      usersQuery,
      (snapshot) => {
        const contributorsList: Contributor[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          contributorsList.push({
            uid: doc.id,
            displayName: data.displayName || "Anonymous Hero",
            photoURL: data.photoURL || null,
            email: data.email || null,
            points: data.points || 0,
          });
        });
        setTopContributors(contributorsList);
      },
      (error) => {
        console.error("Error listening to leaderboard:", error);
        handleFirestoreError(error, OperationType.LIST, "users");
      }
    );

    return () => unsubscribe();
  }, []);

  // 3. Compute dynamic live dashboard statistics from reports list
  const stats: DashboardStats = {
    reported: reports.filter((r) => r.status === "Reported").length,
    verified: reports.filter((r) => r.status === "Verified").length,
    fixed: reports.filter((r) => r.status === "Fixed").length,
  };

  const handleRefresh = () => {
    // onSnapshot is real-time, but we can trigger a state refresh or simple log
    console.log("Reports list refreshed in real-time.");
  };

  return (
    <div className="min-h-screen bg-soft-bg dark:bg-slate-950 flex flex-col font-sans antialiased text-slate-800 dark:text-slate-100 transition-colors duration-200">
      {/* Google Sign-in / User Profile Header */}
      <Header 
        user={currentUser} 
        loading={authLoading} 
        darkMode={darkMode} 
        onToggleDarkMode={() => setDarkMode(!darkMode)} 
      />

      {/* Tab Bar - Desktop: sticky below header; Mobile: fixed at bottom */}
      <div className="sticky top-18 z-40 bg-soft-bg/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 py-3 hidden md:block transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl border border-slate-200/60 dark:border-slate-800/60">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "dashboard"
                  ? "bg-white dark:bg-slate-850 text-indigo-650 dark:text-indigo-400 shadow-xs border border-slate-200/50 dark:border-slate-750/50"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Dashboard</span>
            </button>
            <button
              onClick={() => setActiveTab("report")}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "report"
                  ? "bg-white dark:bg-slate-850 text-indigo-650 dark:text-indigo-400 shadow-xs border border-slate-200/50 dark:border-slate-750/50"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>Report</span>
            </button>
            <button
              onClick={() => setActiveTab("map-feed")}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "map-feed"
                  ? "bg-white dark:bg-slate-850 text-indigo-650 dark:text-indigo-400 shadow-xs border border-slate-200/50 dark:border-slate-750/50"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <MapPin className="w-4 h-4" />
              <span>Map & Feed</span>
            </button>
          </div>
          
          <div className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider hidden lg:block">
            {activeTab === "dashboard" && "Community Live Analytics"}
            {activeTab === "report" && "Submit Community Incident"}
            {activeTab === "map-feed" && "Geographic Hazard Tracker"}
          </div>
        </div>
      </div>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 pb-24 md:pb-8 space-y-6">
        
        {/* Sync Errors Warning bar */}
        {syncError && (
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 flex items-start space-x-3 text-rose-700">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold">Database Synchronization Warning</p>
              <p className="text-xs mt-1 text-rose-600 leading-relaxed">{syncError}</p>
            </div>
          </div>
        )}

        {/* Tab Page Contents with Motion Transitions */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="space-y-6"
          >
            {activeTab === "dashboard" && (
              <Dashboard stats={stats} topContributors={topContributors} reports={reports} darkMode={darkMode} />
            )}

            {activeTab === "report" && (
              <div className="max-w-2xl mx-auto space-y-6">
                <ReportForm user={currentUser} onReportCreated={handleRefresh} />

                {/* Informational Community Callout Card */}
                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-950/20 dark:to-indigo-950/5 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/40 p-5 space-y-3 shadow-sm relative overflow-hidden">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-1 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-650 dark:text-indigo-400">
                      <Info className="w-4.5 h-4.5" />
                    </div>
                    <h3 className="text-sm font-black text-indigo-900 dark:text-indigo-300 font-display uppercase tracking-wider">How verification works</h3>
                  </div>
                  <p className="text-xs text-indigo-850 dark:text-indigo-350 leading-relaxed font-semibold">
                    Any citizen signed in with a Google Account can confirm that a reported issue is genuine by clicking&nbsp;
                    <strong className="text-indigo-700 dark:text-indigo-400 font-black"> "Confirm this is real"</strong>. 
                    This transitions the hazard state from <strong className="font-bold">Reported</strong> to <strong className="font-bold">Verified</strong>, keeping local councils and technicians accountable.
                  </p>
                </div>
              </div>
            )}

            {activeTab === "map-feed" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-3">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500" />
                    <h2 className="text-base font-black text-slate-850 dark:text-slate-100 font-display uppercase tracking-wider">Community Feed</h2>
                  </div>
                  <span className="text-xs font-black text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/30 px-3 py-1 rounded-full font-mono">
                    {reports.length} report{reports.length === 1 ? "" : "s"} found
                  </span>
                </div>

                {/* Live Reports Listing feed */}
                <ReportList
                  reports={reports}
                  loading={reportsLoading}
                  currentUser={currentUser}
                  onRefresh={handleRefresh}
                  darkMode={darkMode}
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Tab Bar - Mobile: fixed at bottom */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 py-2.5 px-4 flex justify-around items-center z-50 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] transition-all duration-300">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`flex flex-col items-center justify-center space-y-1 py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === "dashboard"
              ? "text-indigo-600 dark:text-indigo-400 font-bold scale-105"
              : "text-slate-400 dark:text-slate-500"
          }`}
        >
          <BarChart3 className="w-5 h-5" />
          <span className="text-[10px]">Dashboard</span>
        </button>
        <button
          onClick={() => setActiveTab("report")}
          className={`flex flex-col items-center justify-center space-y-1 py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === "report"
              ? "text-indigo-600 dark:text-indigo-400 font-bold scale-105"
              : "text-slate-400 dark:text-slate-500"
          }`}
        >
          <PlusCircle className="w-5 h-5" />
          <span className="text-[10px]">Report</span>
        </button>
        <button
          onClick={() => setActiveTab("map-feed")}
          className={`flex flex-col items-center justify-center space-y-1 py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === "map-feed"
              ? "text-indigo-600 dark:text-indigo-400 font-bold scale-105"
              : "text-slate-400 dark:text-slate-500"
          }`}
        >
          <MapPin className="w-5 h-5" />
          <span className="text-[10px]">Map & Feed</span>
        </button>
      </div>

      {/* Footer credits */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 mt-12 text-center text-xs text-slate-400 dark:text-slate-500 font-medium">
        <p>© 2026 Community Hero Inc. Empowering civic duty through artificial intelligence.</p>
      </footer>
    </div>
  );
}
