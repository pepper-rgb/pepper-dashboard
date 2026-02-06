# Pepper Dashboard 🧠⚡

A premium personal assistant dashboard built with Next.js 14, designed for Pepper Stark (Chief of Staff to Fitz Light at FlightSuite).

**Live Demo:** https://pepper-dashboard-omega.vercel.app

## Features

### Design (Iteration 1)
- 🎨 Dark theme with purple accent and gradient backgrounds
- ✨ Glass morphism cards with backdrop blur
- 🌟 Ambient lighting effects with radial gradients
- 🎭 Smooth animations (fade-in, slide-up, hover effects)
- 📱 Fully responsive mobile-first design
- 🎯 Custom styled scrollbars and checkboxes

### Interactivity (Iteration 2)
- ✅ Working task checkboxes with state management
- 📋 Expandable task details (click to expand)
- 🔀 Drag-to-reorder tasks
- 🏷️ Filter tabs (All, Active, Completed, High Priority)
- 📊 Live progress indicators in stats
- 📱 Mobile section tabs for easy navigation

### Chat & Integration (Iteration 3)
- 💬 Slide-in chat panel to message Pepper
- 🤖 API route stub for OpenClaw integration
- 📨 Real-time message display with timestamps
- ⏳ Loading animations while waiting for response
- 🔔 Floating action button with notification badge
- ⌨️ Enter key to send, focus management

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS
- **State:** React useReducer
- **Deployment:** Vercel

## Getting Started

```bash
npm install
npm run dev
```

## Future Ideas

1. **Real OpenClaw Integration**
   - Connect to OpenClaw gateway for actual AI responses
   - Fetch live data from memory files

2. **Data Persistence**
   - Connect to Supabase for task storage
   - Sync across devices

3. **Notifications**
   - Push notifications for new messages
   - Desktop notifications for urgent tasks

4. **Calendar Integration**
   - Google Calendar sync
   - Show events in real-time

5. **Voice Interface**
   - Speech-to-text for chat
   - Voice commands

6. **Widgets**
   - Weather widget
   - Quick email preview
   - Spotify now playing

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── chat/
│   │       └── route.ts    # Chat API stub
│   ├── globals.css         # Tailwind + custom styles
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Main dashboard
└── components/
    └── ChatPanel.tsx       # Chat interface
```

---

Built with 💜 by Pepper
