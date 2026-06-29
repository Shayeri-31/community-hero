import express from "express";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

// Set body limit high enough for base64 image uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Lazy initializer for Gemini API client with required User-Agent headers
let aiInstance: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!aiInstance) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required but missing. Please configure it in your secrets.");
    }
    aiInstance = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

/**
 * Robust wrapper around generateContent that automatically falls back to secondary models
 * if the primary model is rate limited, overloaded (e.g., 503 Service Unavailable), or otherwise fails.
 */
async function generateContentWithFallback(
  contents: any,
  config?: any,
  primaryModel: string = "gemini-3.5-flash",
  fallbackModels: string[] = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-3.1-flash-lite"]
) {
  const modelsToTry = [primaryModel, ...fallbackModels];
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    let retries = 3;
    let delay = 600; // start with 600ms delay

    while (retries > 0) {
      try {
        console.log(`Attempting content generation with model: ${modelName} (Attempts remaining: ${retries})...`);
        const ai = getGenAI();
        const response = await ai.models.generateContent({
          model: modelName,
          contents,
          config,
        });
        if (response && response.text) {
          console.log(`Successfully generated content using model: ${modelName}`);
          return response;
        }
        throw new Error(`Model ${modelName} returned an empty response.`);
      } catch (err: any) {
        console.log(`[Gemini Fallback] Model ${modelName} returned status ${err.status || "N/A"}. Continuing fallback checks.`);
        lastError = err;

        // Check if error is non-retriable (like 401 Unauthorized, 403 Forbidden, 400 Bad Request, invalid API keys)
        const isNonRetriable = 
          err.status === 401 || 
          err.status === 403 || 
          err.status === 400 ||
          (err.message && (
            err.message.includes("API key") || 
            err.message.includes("API_KEY") ||
            err.message.includes("INVALID_ARGUMENT") ||
            err.message.includes("not found")
          ));

        // If we hit quota limits / 429 / Resource Exhausted, we should fall back to the next model immediately
        const shouldFallbackImmediately =
          err.status === 429 ||
          (err.message && (
            err.message.includes("quota") ||
            err.message.includes("Quota") ||
            err.message.includes("RESOURCE_EXHAUSTED") ||
            err.message.includes("exceeded")
          ));

        if (isNonRetriable || shouldFallbackImmediately) {
          retries = 0; // stop retrying this model
          break; // break the retry loop to immediately fail or try next model
        }

        retries--;
        if (retries > 0) {
          console.log(`Model ${modelName} hit a transient error or busy state. Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2; // exponential backoff
        }
      }
    }
  }

  throw lastError || new Error("All attempt models failed to generate content.");
}

// API endpoint to analyze infrastructure photo
app.post("/api/analyze-image", async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "Missing imageBase64 in request body" });
    }

    // Clean base64 string if it contains prefix (e.g., data:image/jpeg;base64,)
    let cleanBase64 = imageBase64;
    let detectedMimeType = mimeType || "image/jpeg";

    if (imageBase64.includes(";base64,")) {
      const parts = imageBase64.split(";base64,");
      cleanBase64 = parts[1];
      detectedMimeType = parts[0].replace("data:", "");
    }

    console.log("Calling Gemini API with base64 photo analysis (utilizing fallback chain)...");
    
    const contents = [
      "Analyze this local infrastructure problem photo (like a pothole, broken streetlight, water leak, garbage issue, or other). Determine the category (must be exactly: pothole, broken streetlight, water leak, garbage issue, or other), determine the severity based on public hazard level (must be exactly: low, medium, or high), and write a clear, concise short description (1-2 sentences) summarizing what is visible.",
      {
        inlineData: {
          data: cleanBase64,
          mimeType: detectedMimeType,
        },
      },
    ];

    const config = {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          category: { 
            type: "STRING", 
            enum: ["pothole", "broken streetlight", "water leak", "garbage issue", "other"] 
          },
          severity: { 
            type: "STRING", 
            enum: ["low", "medium", "high"] 
          },
          description: { 
            type: "STRING" 
          },
        },
        required: ["category", "severity", "description"],
      },
    };

    const response = await generateContentWithFallback(
      contents,
      config,
      "gemini-2.5-flash", // primary model for image analysis
      ["gemini-3.5-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"] // fallback models
    );

    const resultText = response.text;
    console.log("Gemini API raw response text:", resultText);

    if (!resultText) {
      throw new Error("Gemini returned an empty response.");
    }

    const resultJson = JSON.parse(resultText);
    return res.json({ ...resultJson, isFallback: false });

  } catch (error: any) {
    console.log("[Gemini Fallback] Image analysis completed using manual entry fallback route.");
    // Graceful fallback when Gemini is busy or rate limited (e.g., 503)
    return res.json({
      category: "other",
      severity: "medium",
      description: "",
      isFallback: true,
      fallbackReason: error.message || "Model is currently busy"
    });
  }
});

// Simple in-memory cache for generated community insights to prevent Gemini quota exhaustion
let cachedInsight: string = "";
let cachedInsightTime: number = 0;
let cachedReportsHash: string = "";

// API endpoint to generate community insights using Gemini API
app.post("/api/generate-insight", async (req, res) => {
  const { reports } = req.body;

  if (!reports || !Array.isArray(reports) || reports.length === 0) {
    return res.json({
      insight: "No reports submitted yet. Help your neighborhood by submitting the first community report!"
    });
  }

  // Create a hash representing the current reports list configuration
  const reportsHash = reports
    .map((r: any) => `${r.id}-${r.status || ""}-${r.category || ""}`)
    .sort()
    .join("|");
  const now = Date.now();
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL

  // If reports haven't changed, or cache is still fresh, return the cached version
  if (cachedInsight && (now - cachedInsightTime < CACHE_TTL || reportsHash === cachedReportsHash)) {
    console.log("Returning cached community insight (cache hit)");
    return res.json({ insight: cachedInsight });
  }

  // Simplify reports to keep prompt clean and minimize token usage
  const simplifiedReports = reports.map((r: any) => ({
    category: r.category || "unknown",
    severity: r.severity || "unknown",
    status: r.status || "unknown",
    address: r.location?.address || "unknown",
    description: r.description || ""
  }));

  try {
    console.log(`Generating community insight from ${simplifiedReports.length} reports (utilizing fallback chain)...`);

    const contents = [
      `Analyze the following list of active infrastructure hazard reports in our community. Write exactly one short, clean, actionable, and positive sentence (maximum 20 words) summarizing the main pattern, trend, or category with the highest activity (e.g., streetlights, potholes, or specific locations) to inform citizens. Avoid greetings, Markdown formatting, bolding, italics, or introductory prefixes (like "Here is a summary:"). Just return the single sentence.\n\nReports:\n${JSON.stringify(simplifiedReports, null, 2)}`
    ];

    const response = await generateContentWithFallback(
      contents,
      undefined,
      "gemini-3.5-flash", // primary model for basic text analysis
      ["gemini-flash-latest", "gemini-2.5-flash", "gemini-3.1-flash-lite"] // fallback models
    );

    const resultText = response.text?.trim() || "Stay alert and support community improvement efforts!";
    
    // Save to cache
    cachedInsight = resultText;
    cachedInsightTime = Date.now();
    cachedReportsHash = reportsHash;

    return res.json({ insight: resultText });

  } catch (error: any) {
    console.log("[Gemini Fallback] Community insight generated via smart local fallback.");
    
    // Construct a highly descriptive dynamic local fallback based on actual data
    let fallbackInsight = "Our community is actively working on infrastructure repairs. Submit a report or verify existing ones to help!";
    
    try {
      const counts: Record<string, number> = {};
      let highSeverityCount = 0;
      let resolvedCount = 0;
      
      simplifiedReports.forEach((r: any) => {
        counts[r.category] = (counts[r.category] || 0) + 1;
        if (r.severity === "high") highSeverityCount++;
        if (r.status === "Fixed") resolvedCount++;
      });

      // Find top category
      let topCategory = "other";
      let maxCount = 0;
      for (const [cat, count] of Object.entries(counts)) {
        if (count > maxCount) {
          maxCount = count;
          topCategory = cat;
        }
      }

      const categoryNames: Record<string, string> = {
        pothole: "potholes",
        "broken streetlight": "broken streetlights",
        "water leak": "water leaks",
        "garbage issue": "garbage issues",
        other: "miscellaneous hazards"
      };

      const topCatName = categoryNames[topCategory] || "hazards";

      if (resolvedCount > 0 && resolvedCount === simplifiedReports.length) {
        fallbackInsight = `Outstanding community effort! All ${resolvedCount} reported hazards have been successfully resolved.`;
      } else if (highSeverityCount > 0) {
        fallbackInsight = `Active response needed: ${highSeverityCount} high-severity issue${highSeverityCount > 1 ? "s are" : " is"} currently flagged, with ${topCatName} being highly reported.`;
      } else if (maxCount > 0) {
        fallbackInsight = `Community update: ${topCatName.charAt(0).toUpperCase() + topCatName.slice(1)} are currently the most active category with ${maxCount} report${maxCount > 1 ? "s" : ""} logged.`;
      }
    } catch (fallbackErr) {
      // Ignore and use default fallbackInsight
    }

    return res.json({
      insight: fallbackInsight
    });
  }
});

// Serve health status
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Community Hero Backend is online" });
});

async function startServer() {
  // Vite dev server middleware integration for dynamic asset recompilation
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development server middleware mounted.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // Support SPA router fallback on production build
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving static production assets from:", distPath);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT} in ${process.env.NODE_ENV || "development"} mode`);
  });
}

startServer().catch((err) => {
  console.error("Critical failure during server startup:", err);
});
