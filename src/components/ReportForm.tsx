import React, { useState, useEffect, useRef } from "react";
import { User } from "firebase/auth";
import { collection, addDoc, serverTimestamp, doc, setDoc, increment } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { ReportCategory, ReportSeverity, LocationData } from "../types";
import { Camera, MapPin, Sparkles, RefreshCw, AlertTriangle, Check, Loader2, Video } from "lucide-react";

interface ReportFormProps {
  user: User | null;
  onReportCreated: () => void;
}

export default function ReportForm({ user, onReportCreated }: ReportFormProps) {
  const [photo, setPhoto] = useState<string>("");
  const [category, setCategory] = useState<ReportCategory>("other");
  const [severity, setSeverity] = useState<ReportSeverity>("medium");
  const [description, setDescription] = useState<string>("");
  const [location, setLocation] = useState<LocationData | null>(null);
  const [isManualLocation, setIsManualLocation] = useState<boolean>(false);
  const [manualAddress, setManualAddress] = useState<string>("");
  const [locationError, setLocationError] = useState<string>("");
  
  // Statuses
  const [detectingLocation, setDetectingLocation] = useState<boolean>(false);
  const [analyzingPhoto, setAnalyzingPhoto] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [videoUploading, setVideoUploading] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Auto-detect location when the user mounts the component or starts to report
  useEffect(() => {
    let permissionStatus: PermissionStatus | null = null;

    const handlePermissionChange = () => {
      if (permissionStatus) {
        console.log("Permission state changed:", permissionStatus.state);
        if (permissionStatus.state === "granted") {
          setLocationError("");
          setIsManualLocation(false);
          captureLocation();
        } else if (permissionStatus.state === "denied") {
          setLocationError("Failed to capture location automatically. Switched to manual entry mode.");
          setIsManualLocation(true);
        }
      }
    };

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((status) => {
          permissionStatus = status;
          status.addEventListener("change", handlePermissionChange);
          
          if (status.state === "granted") {
            setLocationError("");
            setIsManualLocation(false);
            captureLocation();
          } else if (status.state === "prompt") {
            setLocationError("");
            captureLocation();
          } else {
            setIsManualLocation(true);
            setLocationError("Failed to capture location automatically. Switched to manual entry mode.");
            setLocation({
              latitude: 37.7749,
              longitude: -122.4194,
              address: "Default San Francisco (Location Permission Denied)",
            });
          }
        })
        .catch((err) => {
          console.warn("Permissions query failed, triggering captureLocation directly:", err);
          captureLocation();
        });
    } else {
      captureLocation();
    }

    return () => {
      if (permissionStatus) {
        permissionStatus.removeEventListener("change", handlePermissionChange);
      }
    };
  }, []);

  const captureLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser. Please enter your location manually below.");
      setIsManualLocation(true);
      return;
    }

    setDetectingLocation(true);
    setLocationError("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          // Attempt reverse geocoding via OpenStreetMap Nominatim
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
            {
              headers: {
                "Accept-Language": "en",
              },
            }
          );
          if (response.ok) {
            const data = await response.json();
            const address = data.display_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
            setLocation({ latitude, longitude, address });
          } else {
            setLocation({
              latitude,
              longitude,
              address: `Coordinates: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
            });
          }
        } catch (err) {
          console.error("Reverse geocoding failed, falling back to coordinates:", err);
          setLocation({
            latitude,
            longitude,
            address: `Coordinates: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
          });
        } finally {
          setDetectingLocation(false);
          setLocationError("");
          setIsManualLocation(false);
        }
      },
      (error) => {
        console.warn("Geolocation capture handled gracefully via fallback:", error);
        setDetectingLocation(false);

        if (navigator.permissions && navigator.permissions.query) {
          navigator.permissions
            .query({ name: "geolocation" as PermissionName })
            .then((status) => {
              if (status.state === "denied") {
                setLocationError("Failed to capture location automatically. Switched to manual entry mode.");
                setIsManualLocation(true);
              } else if (status.state === "prompt") {
                console.log("Geolocation failed but permission is still 'prompt'. No error shown.");
              }
            })
            .catch(() => {
              setLocationError("Failed to capture location automatically. Switched to manual entry mode.");
              setIsManualLocation(true);
            });
        } else {
          if (error.code === error.PERMISSION_DENIED) {
            setLocationError("Failed to capture location automatically. Switched to manual entry mode.");
            setIsManualLocation(true);
          }
        }

        // Set fallback default location
        setLocation({
          latitude: 37.7749,
          longitude: -122.4194,
          address: "Default San Francisco (Location Permission Denied)",
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Compress image on the client-side to ensure small Firestore payload (<100KB)
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 600;
          const MAX_HEIGHT = 600;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
            resolve(dataUrl);
          } else {
            resolve(event.target?.result as string);
          }
        };
        img.onerror = () => reject(new Error("Failed to load image structure."));
        img.src = event.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Failed to read file."));
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg("");
    setSuccessMsg("");

    if (!file.type.startsWith("image/")) {
      setErrorMsg("Please upload an image file (PNG, JPG).");
      setPhoto("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setAnalyzingPhoto(true);

    try {
      // Compress image to Base64
      const mediaBase64 = await compressImage(file);
      setPhoto(mediaBase64);

      // 2. Call server-side Gemini API endpoint
      const response = await fetch("/api/analyze-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageBase64: mediaBase64,
          mimeType: file.type,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || "Gemini analysis failed");
      }

      const analysis = await response.json();
      console.log("Gemini Tagging Result:", analysis);

      // 3. Fill form with Gemini response values
      if (analysis.category) setCategory(analysis.category);
      if (analysis.severity) setSeverity(analysis.severity);
      if (analysis.description) setDescription(analysis.description);
      
      if (analysis.isFallback) {
        setErrorMsg("Gemini AI is currently offline or busy. We loaded your photo; please fill in the details manually.");
      } else {
        setSuccessMsg("AI scanned photo and filled the details successfully!");
      }
    } catch (err: any) {
      console.error("Error analyzing photo:", err);
      setErrorMsg(`Photo scanning failed: ${err.message}. You can still fill in the details manually!`);
    } finally {
      setAnalyzingPhoto(false);
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg("");
    setSuccessMsg("");

    if (!file.type.startsWith("video/")) {
      setErrorMsg("Please upload a valid video file.");
      setVideoUrl("");
      if (videoInputRef.current) {
        videoInputRef.current.value = "";
      }
      return;
    }

    setVideoUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", "nvumovvs");

      const response = await fetch("https://api.cloudinary.com/v1_1/db2wzni89/video/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload video to Cloudinary");
      }

      const data = await response.json();
      if (data.secure_url) {
        setVideoUrl(data.secure_url);
        setSuccessMsg("Video uploaded successfully!");
      } else {
        throw new Error("Response did not contain secure_url");
      }
    } catch (err: any) {
      console.error("Video upload error:", err);
      setErrorMsg(`Video upload failed: ${err.message}`);
      if (videoInputRef.current) {
        videoInputRef.current.value = "";
      }
    } finally {
      setVideoUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setErrorMsg("You must be logged in to report an issue.");
      return;
    }
    if (!photo) {
      setErrorMsg("Please upload a photo of the problem.");
      return;
    }

    const finalLocation = isManualLocation
      ? {
          latitude: location?.latitude || 37.7749,
          longitude: location?.longitude || -122.4194,
          address: manualAddress.trim(),
        }
      : location;

    if (isManualLocation && !manualAddress.trim()) {
      setErrorMsg("Please enter a manual address.");
      return;
    }

    if (!finalLocation) {
      setErrorMsg("Please wait, capturing your location details...");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      await addDoc(collection(db, "reports"), {
        photo,
        category,
        severity,
        description,
        status: "Reported",
        location: finalLocation,
        reportedBy: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || "Citizen Hero",
          photoURL: user.photoURL,
        },
        createdAt: serverTimestamp(),
        confirmedBy: [],
        videoUrl: videoUrl || "",
      });

      // Award +10 points to the user for reporting
      try {
        const userRef = doc(db, "users", user.uid);
        await setDoc(userRef, {
          uid: user.uid,
          displayName: user.displayName || "Citizen Hero",
          photoURL: user.photoURL || null,
          email: user.email || null,
          points: increment(10),
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (userErr) {
        console.error("Error updating reporter points:", userErr);
      }

      setPhoto("");
      setVideoUrl("");
      setDescription("");
      setCategory("other");
      setSeverity("medium");
      setManualAddress("");
      setIsManualLocation(false);
      setLocationError("");
      setSuccessMsg("Issue reported successfully! Community Hero team is notified.");
      onReportCreated();
    } catch (err: any) {
      console.error("Firestore submit error:", err);
      setErrorMsg(`Failed to submit report: ${err.message}`);
      handleFirestoreError(err, OperationType.CREATE, "reports");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div id="report-form-container" className="bg-gradient-to-b from-soft-bg to-slate-50/40 dark:from-slate-800 dark:to-slate-850/40 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-md p-6 relative overflow-hidden transition-all duration-300">
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 dark:bg-indigo-500/2 rounded-full blur-2xl pointer-events-none" />
      <div className="flex items-center space-x-3 mb-5 border-b border-slate-100 dark:border-slate-700/60 pb-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/15">
          <Camera className="w-5 h-5 stroke-[2.2]" />
        </div>
        <div>
          <h2 className="text-base font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight font-display">Report a Local Problem</h2>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-semibold uppercase tracking-wider">Submissions verify automatically with community consensus</p>
        </div>
      </div>

      {!user ? (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 dark:from-amber-950/20 dark:to-transparent rounded-2xl p-6 text-center border border-amber-200/50 dark:border-amber-900/30 shadow-xs">
          <AlertTriangle className="w-9 h-9 text-amber-500 mx-auto mb-2.5 animate-bounce" />
          <h3 className="text-sm font-black text-amber-900 dark:text-amber-400 font-display uppercase tracking-wider">Authentication Required</h3>
          <p className="text-xs text-amber-700 dark:text-amber-500 mt-1.5 leading-relaxed font-medium max-w-xs mx-auto">
            Please sign in with Google at the top of the page to submit a new infrastructure report.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Photo Uploader */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 font-display">
              Snap or Upload Photo/Video
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center relative min-h-48 overflow-hidden group shadow-inner ${
                photo
                  ? "border-emerald-300 dark:border-emerald-800 bg-emerald-50/20 dark:bg-emerald-950/10"
                  : "border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 bg-slate-50/40 dark:bg-slate-900/40 hover:bg-indigo-50/10 dark:hover:bg-indigo-950/10"
              }`}
            >
              {photo ? (
                <div className="w-full h-full absolute inset-0">
                  <img
                    src={photo}
                    alt="Infrastructure Problem"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-slate-950/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <span className="text-white text-xs font-bold bg-slate-900/90 px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-md border border-slate-700/50">
                      <Camera className="w-4 h-4 text-amber-400" /> Replace Photo
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5 group-hover:scale-105 transition-transform duration-300">
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center mx-auto text-slate-400 group-hover:text-indigo-500 transition-colors">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Snap or Upload Photo</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-semibold uppercase tracking-wider">Accepts PNG, JPG, JPEG</p>
                  </div>
                </div>
              )}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handlePhotoUpload}
                accept="image/*"
                className="hidden"
              />
            </div>
          </div>

          {/* Video Uploader */}
          <div className="space-y-1.5 animate-fadeIn">
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5 font-display">
              Add a video (optional)
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-100/50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 transition-colors duration-200">
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                disabled={videoUploading}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm cursor-pointer transition-all active:scale-95 duration-150 flex items-center gap-2 shrink-0 ${
                  videoUploading
                    ? "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700"
                }`}
              >
                {videoUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                ) : (
                  <Video className="w-4 h-4 text-indigo-500" />
                )}
                {videoUrl ? "Change Video" : "Choose Video File"}
              </button>
              <input
                type="file"
                ref={videoInputRef}
                onChange={handleVideoUpload}
                accept="video/*"
                className="hidden"
              />
              <div className="flex-1 min-w-0 text-center sm:text-left">
                {videoUploading && (
                  <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 animate-pulse flex items-center justify-center sm:justify-start gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading video...
                  </span>
                )}
                {!videoUploading && videoUrl && (
                  <div className="text-xs text-slate-700 dark:text-slate-300 font-semibold truncate flex items-center justify-center sm:justify-start gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <span>Video uploaded:</span>
                    <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline truncate">
                      {videoUrl}
                    </a>
                  </div>
                )}
                {!videoUploading && !videoUrl && (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">
                    Accepts MP4, WEBM, MOV, etc. (Max 100MB)
                  </p>
                )}
              </div>
              {videoUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setVideoUrl("");
                    if (videoInputRef.current) videoInputRef.current.value = "";
                  }}
                  className="px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 border border-rose-100 dark:border-rose-900/30 rounded-lg cursor-pointer transition-all duration-150 active:scale-95"
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          {/* Gemini AI Status and Help widget */}
          {analyzingPhoto ? (
            <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-950 text-white p-4 rounded-2xl shadow-md border border-indigo-500/20 animate-pulse">
              <div className="flex items-center space-x-2 mb-1.5">
                <Sparkles className="w-4.5 h-4.5 text-amber-400 animate-spin-slow" />
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 font-display">Gemini AI Smart Scanning</span>
              </div>
              <p className="text-xs text-indigo-200 font-semibold leading-relaxed">
                Gemini is categorizing, assigning severity, and writing description draft from your image...
              </p>
            </div>
          ) : !photo ? (
            <div className="bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 text-white p-4 rounded-2xl shadow-md border border-indigo-800/30">
              <div className="flex items-center space-x-2.5 mb-1.5">
                <div className="p-1 bg-indigo-500/25 rounded-lg border border-indigo-400/20">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300 font-display">Gemini AI Smart Entry</span>
              </div>
              <p className="text-xs text-indigo-200 leading-relaxed font-semibold">
                Awaiting image upload. Once loaded, Gemini will fill severity, category, and description automatically.
              </p>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-emerald-900 to-teal-950 text-white p-3 rounded-2xl shadow-sm border border-emerald-800/40 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 bg-emerald-600 rounded-lg shadow-inner">
                  <Check className="w-4 h-4 text-white stroke-[2.5]" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300 font-display">Gemini Assisted Entry Live</span>
              </div>
              <span className="text-[10px] font-black bg-emerald-800 text-emerald-100 px-2.5 py-0.5 rounded-lg border border-emerald-600/30">Auto filled</span>
            </div>
          )}

          {/* Location status panel */}
          <div className="space-y-3">
            <div className="bg-slate-100/50 dark:bg-slate-900/40 rounded-2xl p-3.5 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between group hover:border-slate-300 dark:hover:border-slate-600 transition-colors duration-200">
              <div className="flex items-center space-x-3 min-w-0">
                <div className={`p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/50 shrink-0 ${detectingLocation ? "text-amber-500 animate-bounce" : "text-indigo-500"}`}>
                  <MapPin className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 leading-none">Your Location</p>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate mt-1.5">
                    {detectingLocation ? "Detecting your location..." : isManualLocation ? "Entering address manually" : (location ? location.address : "Location offline")}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-1.5 shrink-0">
                {!isManualLocation && (
                  <button
                    type="button"
                    onClick={captureLocation}
                    disabled={detectingLocation}
                    className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all cursor-pointer shrink-0 active:scale-90 duration-150"
                    title="Recapture Location"
                  >
                    <RefreshCw className={`w-4 h-4 ${detectingLocation ? "animate-spin" : ""}`} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsManualLocation(!isManualLocation);
                    if (!isManualLocation && location && !manualAddress) {
                      setManualAddress(location.address.startsWith("Coordinates:") || location.address.includes("Permission Denied") ? "" : location.address);
                    }
                  }}
                  className="px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 border border-indigo-100 dark:border-indigo-900/30 rounded-lg cursor-pointer transition-all duration-150 active:scale-95"
                >
                  {isManualLocation ? "Use Auto GPS" : "Enter Address Manually"}
                </button>
              </div>
            </div>

            {/* Geolocation failure error message (Shown only if actual geolocation capture fails/denied) */}
            {locationError && (
              <div className="bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 text-xs rounded-xl p-3 border border-rose-150/80 dark:border-rose-900/30 font-semibold animate-fadeIn flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{locationError}</span>
              </div>
            )}

            {/* Manual Address Input */}
            {isManualLocation && (
              <div className="animate-fadeIn space-y-1.5">
                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5 font-display">
                  Manually Type Address or Location Description
                </label>
                <input
                  type="text"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  placeholder="e.g. Corner of 5th Ave & Pine St, or 123 Main Street"
                  required={isManualLocation}
                  className="w-full bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-750 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all shadow-xs"
                />
              </div>
            )}
          </div>

          {/* Category selection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 font-display">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ReportCategory)}
                className="w-full bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-750 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all cursor-pointer"
              >
                <option value="pothole">Pothole</option>
                <option value="broken streetlight">Broken Streetlight</option>
                <option value="water leak">Water Leak</option>
                <option value="garbage issue">Garbage Issue</option>
                <option value="other">Other / General</option>
              </select>
            </div>

            {/* Severity selection */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 font-display">
                Hazard Severity
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as ReportSeverity)}
                className="w-full bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-750 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all cursor-pointer"
              >
                <option value="low">Low (Minor nuisance)</option>
                <option value="medium">Medium (Potential risk)</option>
                <option value="high">High (Immediate danger)</option>
              </select>
            </div>
          </div>

          {/* Description text area */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 font-display">
              Brief Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide a clear explanation of what needs fixing..."
              rows={3}
              required
              className="w-full bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-750 rounded-2xl px-4 py-3 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all resize-none shadow-xs"
            />
          </div>

          {/* Error and Success notifications */}
          {errorMsg && (
            <div className="bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 text-xs rounded-xl p-3 border border-rose-150 dark:border-rose-900/30 font-semibold">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-xs rounded-xl p-3 border border-emerald-150 dark:border-emerald-900/30 font-semibold flex items-center gap-1.5">
              <Check className="w-4 h-4 stroke-[2.5]" /> {successMsg}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={submitting || analyzingPhoto || !photo || videoUploading}
            className={`w-full py-3 rounded-xl text-slate-950 font-black text-sm transition-all flex items-center justify-center space-x-2 shadow-md cursor-pointer active:scale-95 hover:scale-[1.01] duration-200 ${
              submitting || analyzingPhoto || !photo || videoUploading
                ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 border border-transparent cursor-not-allowed shadow-none"
                : "bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 shadow-orange-500/10 hover:shadow-orange-500/20"
            }`}
          >
            {submitting ? (
              <div className="flex items-center space-x-2 justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                <span>Submitting report...</span>
              </div>
            ) : (
              <span>File Infrastructure Report</span>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
