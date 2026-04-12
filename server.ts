import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());
  app.use(cookieParser(process.env.SESSION_SECRET || "zentelle-secret"));

  const appUrl = (process.env.APP_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${appUrl}/auth/google/callback`;

  console.log("OAuth Redirect URI configured as:", redirectUri);

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );

  const SCOPES = [
    "https://www.googleapis.com/auth/drive",
  ];

  // OAuth Routes
  app.get("/api/auth/google/url", (req, res) => {
    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      prompt: "consent",
      include_granted_scopes: true,
    });
    res.json({ url });
  });

  app.get("/auth/google/callback", async (req, res) => {
    const { code } = req.query;
    try {
      const { tokens } = await oauth2Client.getToken(code as string);
      
      // Store tokens in a secure cookie
      res.cookie("google_tokens", JSON.stringify(tokens), {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Error exchanging code for tokens:", error);
      res.status(500).send("Authentication failed");
    }
  });

  app.get("/api/auth/google/status", (req, res) => {
    const tokens = req.cookies.google_tokens;
    res.json({ isAuthenticated: !!tokens });
  });

  app.post("/api/auth/google/logout", (req, res) => {
    res.clearCookie("google_tokens");
    res.json({ success: true });
  });

  // Google Drive API Proxy Routes
  app.post("/api/drive/copy", async (req, res) => {
    const tokens = req.cookies.google_tokens;
    if (!tokens) return res.status(401).json({ error: "Not authenticated with Google" });

    const { fileId, name } = req.body;
    console.log(`Attempting to copy file: ${fileId} with name: ${name}`);
    try {
      const auth = new google.auth.OAuth2();
      auth.setCredentials(JSON.parse(tokens));
      const drive = google.drive({ version: "v3", auth });

      const response = await drive.files.copy({
        fileId,
        requestBody: { name },
      });

      res.json(response.data);
    } catch (error: any) {
      console.error("Error copying file:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/drive/permissions", async (req, res) => {
    const tokens = req.cookies.google_tokens;
    if (!tokens) return res.status(401).json({ error: "Not authenticated with Google" });

    const { fileId, role, type, emailAddress } = req.body;
    try {
      const auth = new google.auth.OAuth2();
      auth.setCredentials(JSON.parse(tokens));
      const drive = google.drive({ version: "v3", auth });

      const response = await drive.permissions.create({
        fileId,
        requestBody: { role, type, emailAddress },
      });

      res.json(response.data);
    } catch (error: any) {
      console.error("Error updating permissions:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
