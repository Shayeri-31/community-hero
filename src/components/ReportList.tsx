import React, { useState } from "react";
import { User } from "firebase/auth";
import { Report, ReportCategory, ReportSeverity } from "../types";
import ReportCard from "./ReportCard";
import IssuesMap from "./IssuesMap";
import { Search, SlidersHorizontal, AlertCircle } from "lucide-react";

interface ReportListProps {
  reports: Report[];
  loading: boolean;
  currentUser: User | null;
  onRefresh: () => void;
  darkMode?: boolean;
}

export default function ReportList({ reports, loading, currentUser, onRefresh, darkMode = false }: ReportListProps) {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const [showFilters, setShowFilters] = useState<boolean>(false);

  // Filter reports
  const filteredReports = reports.filter((report) => {
    const matchesSearch =
      report.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.location.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.category.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || report.status === statusFilter;
    const matchesCategory = categoryFilter === "all" || report.category === categoryFilter;
    const matchesSeverity = severityFilter === "all" || report.severity === severityFilter;

    return matchesSearch && matchesStatus && matchesCategory && matchesSeverity;
  });

  return (
    <div id="report-list-section" className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="bg-gradient-to-b from-soft-bg to-slate-50/40 dark:from-slate-800 dark:to-slate-850/40 rounded-2xl border border-slate-200 dark:border-slate-700/60 p-4.5 shadow-md">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Search reports by description or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-100/50 dark:bg-slate-900 border border-slate-200 dark:border-slate-750 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:focus:border-indigo-400 focus:bg-white dark:focus:bg-slate-850 transition-all"
            />
          </div>

          {/* Filter toggle button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center space-x-1.5 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer active:scale-95 duration-150 ${
              showFilters
                ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-850 text-indigo-700 dark:text-indigo-400"
                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 hover:border-slate-300 dark:hover:border-slate-600"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Filters</span>
          </button>
        </div>

        {/* Expandable Filters Section */}
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 animate-fadeIn">
            {/* Status Filter */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5 font-display">
                Filter Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 rounded-xl p-2.5 text-xs text-slate-700 dark:text-slate-200 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:focus:border-indigo-400 cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="Reported">Reported</option>
                <option value="Verified">Verified</option>
                <option value="Fixed">Fixed</option>
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5 font-display">
                Filter Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 rounded-xl p-2.5 text-xs text-slate-700 dark:text-slate-200 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:focus:border-indigo-400 cursor-pointer"
              >
                <option value="all">All Categories</option>
                <option value="pothole">Pothole</option>
                <option value="broken streetlight">Broken Streetlight</option>
                <option value="water leak">Water Leak</option>
                <option value="garbage issue">Garbage Issue</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Severity Filter */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5 font-display">
                Filter Severity
              </label>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 rounded-xl p-2.5 text-xs text-slate-700 dark:text-slate-200 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:focus:border-indigo-400 cursor-pointer"
              >
                <option value="all">All Severities</option>
                <option value="low">Low Severity</option>
                <option value="medium">Medium Severity</option>
                <option value="high">High Severity</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Map View */}
      <IssuesMap reports={filteredReports} darkMode={darkMode} />

      {/* Reports Listing content */}
      {loading ? (
        <div className="bg-gradient-to-b from-soft-bg to-slate-50/40 dark:from-slate-800 dark:to-slate-850/40 rounded-2xl border border-slate-200 dark:border-slate-700/60 p-12 text-center shadow-md">
          <div className="w-8 h-8 rounded-full border-2 border-slate-200 dark:border-slate-700 border-t-indigo-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-600 dark:text-slate-350">Syncing with Community Database...</p>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="bg-gradient-to-b from-soft-bg to-slate-50/40 dark:from-slate-800 dark:to-slate-850/40 rounded-2xl border border-slate-200 dark:border-slate-700/60 p-12 text-center shadow-md space-y-2">
          <AlertCircle className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto" />
          <h3 className="text-sm font-black text-slate-700 dark:text-slate-250 font-display uppercase tracking-wider">No Reports Found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed font-semibold">
            {searchTerm || statusFilter !== "all" || categoryFilter !== "all" || severityFilter !== "all"
              ? "No reports match your selected search query or active filter settings. Try modifying your criteria."
              : "No infrastructure problems have been logged yet! Be the first to report an issue in your local community."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              currentUser={currentUser}
              onUpdate={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}
