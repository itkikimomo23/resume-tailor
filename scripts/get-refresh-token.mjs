/**
 * Run once to get a new Google OAuth refresh token:
 *   node scripts/get-refresh-token.mjs
 */

import { createServer } from "http";
import { google } from "googleapis";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = "http://localhost:3333/callback";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your env first.");
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",           // forces Google to return a new refresh_token
  scope: ["https://www.googleapis.com/auth/drive"],
});

console.log("\nOpen this URL in your browser:\n");
console.log(authUrl);
console.log("\nWaiting for callback on http://localhost:3333 ...\n");

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost:3333");
  if (url.pathname !== "/callback") return;

  const code = url.searchParams.get("code");
  if (!code) {
    res.end("No code found.");
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    res.end("Done! Check your terminal for the refresh token.");

    console.log("\n✓ New refresh token:");
    console.log(tokens.refresh_token);
    console.log("\nUpdate your GOOGLE_REFRESH_TOKEN env variable with this value.\n");
  } catch (err) {
    res.end("Error: " + err.message);
    console.error(err);
  } finally {
    server.close();
  }
});

server.listen(3333);
