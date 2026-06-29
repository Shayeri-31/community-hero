# 🛠️ Community Hero

**Report, Verify, Fix — Together.**

Community Hero is an AI-powered civic infrastructure reporting web app that lets any citizen report a local hazard — potholes, broken streetlights, water leaks, garbage, and more — in under a minute. Just snap a photo (and optionally a short video), and Google's Gemini AI automatically categorizes the issue, assesses its severity, and writes a clear description for you.

Each report is pinned to the reporter's location and shows up on a live community feed and interactive hazard map, where anyone can track its status as it moves from **Reported → Verified → Fixed**.

🔗 **Live App:** https://community-hero-384112070820.us-west1.run.app

---

## ✨ Features

- 📸 **AI-Powered Reporting** — Upload a photo, and Gemini automatically fills in category, severity, and description
- 🎥 **Optional Video Evidence** — Attach a short video alongside the photo for extra context, powered by Cloudinary
- 📍 **Automatic Geolocation** — Detects the reporter's location automatically, with manual address entry as a fallback
- 🗺️ **Interactive Hazard Map** — See all reported issues plotted live on a map
- 📰 **Community Feed** — Browse, search, and filter reports by category or location
- ✅ **Status Workflow** — Reports move through Reported → Verified → Fixed, with community members able to confirm issues
- 🏆 **Gamification** — Earn points for reporting and verifying issues, with a leaderboard for top contributors
- 📱 **Tabbed Navigation** — Clean Dashboard / Report / Map & Feed pages, optimized for both desktop and mobile
- 🔐 **Secure Sign-In** — Google Authentication via Firebase

---

## 🧰 Tech Stack

| Technology | Purpose |
|---|---|
| **Google AI Studio (Build Mode)** | Prompt-driven environment used to build the entire app |
| **Gemini API** | AI image analysis — categorization, severity scoring, description generation |
| **Firebase Firestore** | NoSQL database storing reports, users, and points |
| **Firebase Authentication** | Secure Google Sign-In |
| **Cloudinary** | Free-tier video storage, via direct unsigned browser uploads |
| **Google Cloud Run** | Hosting and deployment |

---

## 🚀 About This Project

Built solo in one week for the **Vibe2Ship Hackathon**, with the goal of learning Google AI Studio, Firebase, and AI-assisted development from scratch — and shipping something genuinely functional, not just a demo.

A key technical pivot: the original plan was a Flutter app, but the hackathon's submission requirement (deployed link must come from AI Studio's Build Mode) meant switching to a prompt-driven web app instead — a great lesson in adapting scope under real constraints.
