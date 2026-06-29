import React, { useState } from "react";
import { User } from "firebase/auth";
import { doc, updateDoc, arrayUnion, setDoc, increment, serverTimestamp } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { Report } from "../types";
import { MapPin, ThumbsUp, CheckCircle, Clock, ShieldAlert, AlertTriangle, ExternalLink } from "lucide-react";

interface ReportCardProps {
  key?: string;
  report: Report;
  currentUser: User | null;
  onUpdate: () => void;
}

export default function ReportCard({ report, currentUser, onUpdate }: ReportCardProps) {
  const [updating, setUpdating] = useState<boolean>(false);

  const { id, photo, category, severity, description, status, location, reportedBy, createdAt, confirmedBy = [], videoUrl } = report;

  // Format date
  const formatDate = (timestamp: any) => {
    if (!timestamp) return "Just now";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Severity color maps
  const severityStyles = {
    high: {
      bg: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-100 dark:border-rose-900/40",
      dot: "bg-rose-500",
      label: "High Severity",
    },
    medium: {
      bg: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/40",
      dot: "bg-amber-500",
      label: "Medium Severity",
    },
    low: {
      bg: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/40",
      dot: "bg-emerald-500",
      label: "Low Severity",
    },
  };

  // Status badge style maps
  const statusStyles = {
    Reported: "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-900/40",
    Verified: "bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-400 border-blue-200 dark:border-blue-900/40",
    Fixed: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40",
  };

  const currentSeverityStyle = severityStyles[severity] || severityStyles.low;

  // Check if current user has already confirmed this report
  const hasConfirmed = currentUser ? confirmedBy.includes(currentUser.uid) : false;

  // Confirm report is real
  const handleConfirmReal = async () => {
    if (!currentUser) return;
    setUpdating(true);
    try {
      const reportRef = doc(db, "reports", id);
      const updatedConfirmedBy = [...confirmedBy, currentUser.uid];
      
      // Update status to Verified if it was "Reported"
      const newStatus = status === "Reported" ? "Verified" : status;

      await updateDoc(reportRef, {
        confirmedBy: arrayUnion(currentUser.uid),
        status: newStatus,
      });

      // Award +5 points to the verifying user if they verified someone else's report
      if (reportedBy.uid !== currentUser.uid) {
        try {
          const userRef = doc(db, "users", currentUser.uid);
          await setDoc(userRef, {
            uid: currentUser.uid,
            displayName: currentUser.displayName || "Citizen Hero",
            photoURL: currentUser.photoURL || null,
            email: currentUser.email || null,
            points: increment(5),
            updatedAt: serverTimestamp()
          }, { merge: true });
        } catch (userErr) {
          console.error("Error updating verifier points:", userErr);
        }
      }

      onUpdate();
    } catch (err) {
      console.error("Error confirming report:", err);
      alert("Failed to confirm report. Please try again.");
      handleFirestoreError(err, OperationType.UPDATE, `reports/${id}`);
    } finally {
      setUpdating(false);
    }
  };

  // Mark verified report as fixed
  const handleMarkAsFixed = async () => {
    if (!currentUser) return;
    setUpdating(true);
    try {
      const reportRef = doc(db, "reports", id);
      await updateDoc(reportRef, {
        status: "Fixed",
      });
      onUpdate();
    } catch (err) {
      console.error("Error marking report as fixed:", err);
      alert("Failed to mark as fixed. Please try again.");
      handleFirestoreError(err, OperationType.UPDATE, `reports/${id}`);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div id={`report-card-${id}`} className="bg-gradient-to-br from-soft-bg to-slate-50/40 dark:from-slate-800 dark:to-slate-850/40 rounded-2xl border border-slate-200 dark:border-slate-700/60 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col md:flex-row relative group">
      {/* Photo section */}
      <div className={`w-full md:w-64 shrink-0 bg-slate-50 dark:bg-slate-900 overflow-hidden flex flex-col ${videoUrl ? "h-auto" : "h-48 md:h-auto"}`}>
        <div className={`relative w-full ${videoUrl ? "h-40 shrink-0" : "h-full"}`}>
          {photo && photo.startsWith("data:video/") ? (
            <video
              src={photo}
              controls
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <img
              src={photo}
              alt={category}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          )}
          {/* Severity Dot Badge */}
          <span className={`absolute top-3 left-3 border px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 backdrop-blur-md shadow-sm ${currentSeverityStyle.bg}`}>
            <span className={`w-2 h-2 rounded-full animate-pulse ${currentSeverityStyle.dot}`} />
            {currentSeverityStyle.label}
          </span>
        </div>
        {videoUrl && (
          <div className="w-full h-40 bg-black border-t border-slate-200 dark:border-slate-700/60 relative shrink-0">
            <video
              src={videoUrl}
              controls
              preload="metadata"
              className="w-full h-full object-contain"
            />
          </div>
        )}
      </div>

      {/* Content section */}
      <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between">
        <div className="space-y-3.5">
          {/* Top category & Status line */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-black uppercase tracking-widest text-indigo-500 dark:text-indigo-400 font-display">
              {category.replace("_", " ")}
            </span>
            <span className={`text-[10px] uppercase font-black tracking-wider px-2.5 py-1 rounded-lg border ${statusStyles[status]}`}>
              {status}
            </span>
          </div>

          {/* Description */}
          <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-semibold">{description}</p>

          {/* Location info */}
          <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-700/60">
            <div className="flex items-start space-x-2 text-xs text-slate-500 dark:text-slate-400">
              <div className="p-1 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-700/50 text-indigo-500 shrink-0">
                <MapPin className="w-3.5 h-3.5" />
              </div>
              <span className="font-bold text-slate-600 dark:text-slate-300 line-clamp-2 mt-0.5">{location.address}</span>
            </div>
            {/* Coordinates Link */}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline pl-7.5"
            >
              <span>View GPS Coordinates</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Footer meta & actions */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Reporter avatar info */}
          <div className="flex items-center space-x-2.5">
            {reportedBy.photoURL ? (
              <img
                src={reportedBy.photoURL}
                alt={reportedBy.displayName || "Reporter"}
                className="w-7.5 h-7.5 rounded-full border border-slate-200 dark:border-slate-700 shadow-xs"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-7.5 h-7.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-[10px] font-black text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30">
                U
              </div>
            )}
            <div className="text-[10px] text-slate-400 dark:text-slate-500">
              <p className="font-bold text-slate-700 dark:text-slate-350 leading-tight">
                By {reportedBy.displayName || "Citizen"}
              </p>
              <p className="flex items-center gap-1 mt-0.5 font-semibold">
                <Clock className="w-3 h-3 text-slate-400" />
                {formatDate(createdAt)}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-2 self-end sm:self-center">
            {currentUser && status === "Reported" && (
              <button
                id={`confirm-btn-${id}`}
                onClick={handleConfirmReal}
                disabled={updating || hasConfirmed}
                className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all shadow-xs active:scale-95 duration-150 ${
                  hasConfirmed
                    ? "bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-600 border border-transparent cursor-not-allowed"
                    : "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-150/40 dark:border-indigo-900/35 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:border-indigo-200 cursor-pointer"
                }`}
              >
                <ThumbsUp className="w-3.5 h-3.5" />
                <span>{hasConfirmed ? "Confirmed" : "Confirm this is real"}</span>
                {confirmedBy.length > 0 && (
                  <span className="ml-1 bg-indigo-200 dark:bg-indigo-900 text-indigo-850 dark:text-indigo-100 text-[10px] px-2 py-0.5 rounded-full font-black font-mono">
                    {confirmedBy.length}
                  </span>
                )}
              </button>
            )}

            {currentUser && status === "Verified" && (
              <button
                id={`fix-btn-${id}`}
                onClick={handleMarkAsFixed}
                disabled={updating}
                className="flex items-center space-x-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 dark:text-white px-3.5 py-2 rounded-xl text-xs font-black transition-all shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20 cursor-pointer active:scale-95 duration-150"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Mark as Fixed</span>
              </button>
            )}

            {!currentUser && (status === "Reported" || status === "Verified") && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500 italic font-semibold uppercase tracking-wider">
                Sign in to verify/fix
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
