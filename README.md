# CardSnap AI

**AI-powered business networking assistant**

CardSnap AI is a cutting-edge business networking application designed to streamline professional contact management. It intelligently extracts contact information from business cards using computer vision and AI, enriching your professional network seamlessly.

## Architecture

*   **Frontend**: React / Vite
*   **Backend**: Python / FastAPI
*   **Database**: Firebase Firestore
*   **AI Engine**: Google Gemini Pro / Google Vision API
*   **Authentication**: Firebase Auth / Google OAuth
*   **Email Integration**: Gmail API

## Features

*   📷 **Smart Card Scanning**: Extract data instantly from business cards.
*   🧠 **AI Intelligence**: Contextual enrichment of contact data.
*   🔒 **Secure Authentication**: Enterprise-grade security with Firebase.
*   ✉️ **Email Automation**: Draft and send contextual follow-ups.

## Screenshots

*(Add screenshots here)*
* [Dashboard Placeholder]
* [Scanning Flow Placeholder]

## Local Setup

### Prerequisites
* Python 3.10+
* Node.js 18+
* Firebase Account
* Google Cloud Console Account

### Environment Setup

1.  Copy `.env.example` templates to create local environment variables:
    *   `backend/.env.example` -> `backend/.env`
    *   `frontend/.env.example` -> `frontend/.env.local`
2.  Follow the [Client Setup Guide](CLIENT_SETUP.md) for detailed configuration of Firebase and Google APIs.

### Running Locally

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## Deployment Guide

*   **Frontend Deployment**: Deployable to Vercel, Netlify, or Firebase Hosting.
*   **Backend Deployment**: Ready for Google Cloud Run, Render, or AWS Elastic Beanstalk.
