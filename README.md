# Zentelle - Educational Dashboard

This project was built with React, TypeScript, and Vite.

## How to Run Locally

Since this is a modern web application, you cannot simply open the `index.html` file in your browser. You need to run a local development server.

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)

### Steps

1. **Extract the ZIP file** to a folder on your computer.
2. **Open a Terminal** (or Command Prompt) in that folder.
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Start the development server**:
   ```bash
   npm run dev
   ```
   *Note: If you have another project running on port 3000, you can run this on a different port:*
   ```bash
   PORT=3001 npm run dev
   ```
   *(On Windows: `set PORT=3001 && npm run dev`)*
5. **Open the app**:
   The terminal will show a URL (usually `http://localhost:3000`). Copy and paste that into your browser.

## Building for Production

If you want to create a version of the app that can be hosted on a website:

1. Run the build command:
   ```bash
   npm run build
   ```
2. The production-ready files will be in the `dist` folder.
3. You must serve the `dist` folder using a web server (e.g., `npx serve dist`).

## Google OAuth Configuration

This app uses Google OAuth for Drive integration. If you are running locally:

1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Select your project and go to **APIs & Services > Credentials**.
3.  Under **OAuth 2.0 Client IDs**, edit your client ID.
4.  Add your local URL to **Authorized redirect URIs**:
    -   `http://localhost:3000/auth/google/callback`
    -   (If using a different port, e.g., `http://localhost:3001/auth/google/callback`)
5.  Ensure your `.env` file (create one based on `.env.example`) has the correct `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

## Firebase Setup

This app uses Firebase for authentication and data storage. If you are running this locally for the first time:
- Ensure your `firebase-applet-config.json` contains valid credentials.
- If you see permission errors, you may need to deploy the `firestore.rules` to your Firebase project.
