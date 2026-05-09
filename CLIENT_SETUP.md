# Client Setup & Collaboration Guide

Welcome to the CardSnap AI project. This guide will help you configure the project environment, obtain necessary API credentials, and run the application locally.

## 1. Cloning the Repository

```bash
git clone <repository_url>
cd cardsnap
```

## 2. Environment Configuration

The application requires various API keys to function safely. **Never commit `.env` files to source control.**

1.  Navigate to the `backend/` directory.
2.  Copy `.env.example` to `.env`:
    ```bash
    cp .env.example .env
    ```
3.  Navigate to the `frontend/` directory.
4.  Copy `.env.example` to `.env.local`:
    ```bash
    cp .env.example .env.local
    ```

## 3. Required API Setup

### Firebase Setup
1. Create a project in the [Firebase Console](https://console.firebase.google.com/).
2. Enable Firestore, Firebase Auth (Google Provider), and Firebase Storage.
3. Generate a new private key from **Project Settings > Service Accounts** and save the JSON contents. Map the values into `backend/.env` (`FIREBASE_PRIVATE_KEY`, etc.).
4. Obtain your web app configuration from **Project Settings > General** and add the keys to `frontend/.env.local`.

### Google OAuth & Vision API Setup
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Enable the **Cloud Vision API** and **Gmail API**.
3. Create OAuth 2.0 Client IDs under **Credentials**. Set authorized JavaScript origins to `http://localhost:5173` (or your frontend URL) and authorized redirect URIs appropriately.
4. Add the `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to your `.env` files.

### Gemini Setup
1. Visit [Google AI Studio](https://aistudio.google.com/).
2. Generate an API Key.
3. Add it as `GEMINI_API_KEY` in `backend/.env`.

## 4. Running the Application

### Backend
1. Open a terminal and navigate to the `backend/` folder.
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   venv\Scripts\activate  # Windows
   ```
3. Install dependencies: `pip install -r requirements.txt`
4. Run the server: `uvicorn main:app --reload` (or `python main.py` depending on setup)

### Frontend
1. Open a terminal and navigate to the `frontend/` folder.
2. Install dependencies: `npm install`
3. Start the dev server: `npm run dev`
