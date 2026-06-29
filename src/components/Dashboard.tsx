import React, { useState, useEffect, useMemo } from "react";
import { DashboardStats, Contributor, Report, ReportCategory } from "../types";
import { Info, Trophy, BarChart3, Sparkles, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface DashboardProps {
  stats: DashboardStats;
  topContributors?: Contributor[];
  reports?: Report[];
  darkMode?: boolean;
}

const categoryDisplayNames: Record<string, string> = {
  pothole: "Pothole",
  "broken streetlight": "Streetlight",
  "water leak": "Water Leak",
  "garbage issue": "Garbage",
  other: "Other",
};

const categoryColors: Record<string, string> = {
  pothole: "#6366f1", // Indigo
  "broken streetlight": "#eab308", // Yellow
  "water leak": "#0ea5e9", // Sky Blue
  "garbage issue": "#f43f5e", // Rose
  other: "#64748b", // Slate
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-800 text-white px-3 py-2 rounded-lg shadow-md text-xs">
        <p className="font-bold">{payload[0].payload.displayName}</p>
        <p className="text-slate-400 mt-0.5">
          Reports: <span className="text-blue-400 font-mono font-bold">{payload[0].value}</span>
        </p>
      </div>
    );
  }
  return null;
};

export default function Dashboard({ stats, topContributors = [], reports = [], darkMode = false }: DashboardProps) {
  const [insight, setInsight] = useState<string>("");
  const [insightLoading, setInsightLoading] = useState<boolean>(false);

  // Memoized dependencies of reports list to prevent redundant fetches on unrelated renders
  const reportsDependency = useMemo(() => {
    return JSON.stringify(reports.map(r => ({ id: r.id, status: r.status, category: r.category })));
  }, [reports]);

  useEffect(() => {
    if (!reports || reports.length === 0) {
      setInsight("No reports submitted yet. Help your neighborhood by submitting the first community report!");
      return;
    }

    let isMounted = true;
    const fetchInsight = async () => {
      try {
        setInsightLoading(true);
        const res = await fetch("/api/generate-insight", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ reports })
        });
        const data = await res.json();
        if (isMounted && data.insight) {
          setInsight(data.insight);
        }
      } catch (err) {
        console.error("Failed to fetch community insight:", err);
      } finally {
        if (isMounted) {
          setInsightLoading(false);
        }
      }
    };

    fetchInsight();

    return () => {
      isMounted = false;
    };
  }, [reportsDependency]);

  // Aggregate report count per category
  const categories: ReportCategory[] = ["pothole", "broken streetlight", "water leak", "garbage issue", "other"];
  const chartData = categories.map((cat) => ({
    category: cat,
    displayName: categoryDisplayNames[cat] || cat,
    count: reports.filter((r) => r.category === cat).length,
  }));

  return (
    <div id="dashboard-section" className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
      {/* Left Column: Stats Cards & Category breakdown chart */}
      <div className="lg:col-span-8 xl:col-span-9 space-y-6">
        
        {/* Stats Grid Container */}
        <div id="stats-grid-container" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Overview stats info */}
          <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white rounded-2xl p-5 flex flex-col justify-between shadow-md border border-indigo-800/40 relative overflow-hidden group hover:shadow-indigo-950/20 hover:-translate-y-1 transition-all duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-xl group-hover:bg-amber-500/15 transition-all duration-300" />
            <div>
              <span className="text-[10px] text-amber-400 font-bold uppercase tracking-widest font-display">Active Hub</span>
              <h2 className="text-lg font-extrabold mt-0.5 text-slate-100 leading-tight font-display">Infrastructure</h2>
            </div>
            <p className="text-xs text-slate-300 mt-4 flex items-start gap-1.5 leading-relaxed font-semibold">
              <Info className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              Keep local streets clean and functional.
            </p>
          </div>

          {/* Reported Count */}
          <div id="stat-reported" className="bg-soft-bg dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700/60 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex items-center justify-between group cursor-pointer">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider font-display">Reported</p>
              <p className="text-3xl sm:text-4xl font-black font-display text-slate-900 dark:text-white leading-none group-hover:scale-105 transition-transform duration-300 origin-left">{stats.reported}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-450 mt-1 font-semibold">Needs verification</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/40 p-3 rounded-2xl flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-900/30 group-hover:rotate-6 transition-transform duration-300">
              <div className="w-3.5 h-3.5 bg-blue-500 rounded-full animate-pulse" />
            </div>
          </div>

          {/* Verified Count */}
          <div id="stat-verified" className="bg-soft-bg dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700/60 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex items-center justify-between group cursor-pointer">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider font-display">Verified</p>
              <p className="text-3xl sm:text-4xl font-black font-display text-slate-900 dark:text-white leading-none group-hover:scale-105 transition-transform duration-300 origin-left">{stats.verified}</p>
              <p className="text-[10px] text-orange-600 dark:text-orange-400 mt-1 font-extrabold tracking-wide">Confirmed</p>
            </div>
            <div className="bg-orange-50 dark:bg-orange-950/40 p-3 rounded-2xl flex items-center justify-center shrink-0 border border-orange-100 dark:border-orange-900/30 group-hover:rotate-6 transition-transform duration-300">
              <div className="w-3.5 h-3.5 bg-orange-500 rounded-full animate-pulse" />
            </div>
          </div>

          {/* Fixed Count */}
          <div id="stat-fixed" className="bg-soft-bg dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700/60 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex items-center justify-between group cursor-pointer">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider font-display">Fixed</p>
              <p className="text-3xl sm:text-4xl font-black font-display text-slate-900 dark:text-white leading-none group-hover:scale-105 transition-transform duration-300 origin-left">{stats.fixed}</p>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-extrabold tracking-wide">Resolved</p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-2xl flex items-center justify-center shrink-0 border border-emerald-100 dark:border-emerald-900/30 group-hover:rotate-6 transition-transform duration-300">
              <div className="w-3.5 h-3.5 bg-emerald-500 rounded-full" />
            </div>
          </div>
        </div>

        {/* Community Insight Card */}
        <div id="community-insight-card" className="bg-gradient-to-br from-indigo-50/70 via-blue-50/50 to-indigo-50/30 dark:from-indigo-950/20 dark:via-blue-950/15 dark:to-indigo-950/5 border border-indigo-100/80 dark:border-indigo-900/40 rounded-2xl p-5 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-br from-amber-400/5 to-orange-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-start space-x-4">
            <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 text-white p-3 rounded-xl shrink-0 shadow-md shadow-indigo-600/10 group-hover:scale-105 duration-200 transition-transform">
              <Sparkles className="w-4 h-4 text-amber-300" />
            </div>
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-bold text-indigo-800 dark:text-indigo-400 uppercase tracking-wider font-display">Community AI Insight</h4>
                {insightLoading && <Loader2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 animate-spin" />}
              </div>
              {insightLoading && !insight ? (
                <p className="text-xs text-indigo-700/70 dark:text-indigo-400 italic animate-pulse">Analyzing community hazard patterns with Gemini...</p>
              ) : (
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
                  {insight}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Category Breakdown Bar Chart */}
        <div id="category-chart-card" className="bg-soft-bg dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/60 p-5 shadow-sm hover:shadow-md transition-shadow duration-300">
          <div className="flex items-center space-x-2 border-b border-slate-100 dark:border-slate-700/60 pb-3.5 mb-4">
            <BarChart3 className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-xs font-black text-slate-850 dark:text-slate-100 uppercase tracking-wider font-display">Reports by Category</h3>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? "#334155" : "#f1f5f9"} />
                <XAxis
                  dataKey="displayName"
                  tick={{ fill: darkMode ? '#94a3b8' : '#64748b', fontSize: 10, fontWeight: 700 }}
                  axisLine={{ stroke: darkMode ? '#334155' : '#e2e8f0' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: darkMode ? '#94a3b8' : '#64748b', fontSize: 10, fontWeight: 700 }}
                  axisLine={{ stroke: darkMode ? '#334155' : '#e2e8f0' }}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: darkMode ? '#1e293b' : '#f8fafc' }} />
                <Bar dataKey="count" radius={[5, 5, 0, 0]} barSize={28}>
                  {chartData.map((entry, index) => {
                    const color = categoryColors[entry.category] || "#64748b";
                    return <Cell key={`cell-${index}`} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Leaderboard Section (Right) */}
      <div id="leaderboard-container" className="lg:col-span-4 xl:col-span-3 bg-soft-bg dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/60 p-5 shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col justify-between">
        <div>
          <div className="flex items-center space-x-2 border-b border-slate-100 dark:border-slate-700/60 pb-3 mb-4">
            <Trophy className="w-4.5 h-4.5 text-amber-500" />
            <h3 className="text-xs font-black text-slate-850 dark:text-slate-100 uppercase tracking-wider font-display">Top Contributors</h3>
          </div>

          <div className="space-y-3">
            {topContributors.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold italic">No active contributors yet</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Be the first by reporting an issue!</p>
              </div>
            ) : (
              topContributors.map((contributor, index) => {
                return (
                  <div
                    key={contributor.uid}
                    className="flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900/40 p-1.5 rounded-xl transition-all duration-200 hover:-translate-y-0.5"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      {/* Rank Indicator */}
                      <span className="w-5 text-center text-xs font-black text-slate-400">
                        {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}`}
                      </span>

                      {/* Avatar */}
                      {contributor.photoURL ? (
                        <img
                          src={contributor.photoURL}
                          alt={contributor.displayName}
                          className="w-7.5 h-7.5 rounded-full border border-slate-200 dark:border-slate-700 shrink-0 shadow-xs"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-7.5 h-7.5 rounded-full bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs font-bold shrink-0">
                          {contributor.displayName.charAt(0).toUpperCase()}
                        </div>
                      )}

                      {/* Display name */}
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate leading-tight font-display">
                          {contributor.displayName}
                        </p>
                        <p className="text-[9px] text-indigo-500 dark:text-indigo-400 font-extrabold uppercase tracking-wide leading-none mt-0.5">
                          Citizen Hero
                        </p>
                      </div>
                    </div>

                    {/* Points total */}
                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/30 px-2 py-0.5 rounded-lg font-mono">
                        {contributor.points} pts
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="border-t border-slate-100 dark:border-slate-700/60 pt-3.5 mt-4 flex justify-between text-[9px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">
          <span>Report (+10 pts)</span>
          <span>Verify (+5 pts)</span>
        </div>
      </div>
    </div>
  );
}
