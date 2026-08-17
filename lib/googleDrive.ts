import { google } from "googleapis";
import { Readable } from "stream";

let driveClient: ReturnType<typeof google.drive> | null = null;

function getDriveClient() {
  if (driveClient) return driveClient;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Missing Google Drive credentials: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN are required"
    );
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });

  driveClient = google.drive({ version: "v3", auth });
  return driveClient;
}

export async function downloadResumeFromDrive(fileId: string): Promise<{ buffer: Buffer; filename: string }> {
  const drive = getDriveClient();

  const meta = await drive.files.get({ fileId, fields: "name" });
  const filename = meta.data.name ?? "resume.docx";

  const response = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" }
  );

  return { buffer: Buffer.from(response.data as ArrayBuffer), filename };
}

export async function deleteFileFromDrive(fileId: string): Promise<void> {
  const drive = getDriveClient();
  await drive.files.delete({ fileId });
}

export async function uploadResumeToDrive(
  buffer: Buffer,
  filename: string
): Promise<{ fileId: string; driveLink: string }> {
  const drive = getDriveClient();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  const { data } = await drive.files.create({
    requestBody: {
      name: filename,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ...(folderId ? { parents: [folderId] } : {}),
    },
    media: {
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      body: Readable.from(buffer),
    },
    fields: "id, webViewLink",
  });

  if (!data.id) throw new Error("Google Drive upload returned no file ID");

  await drive.permissions.create({
    fileId: data.id,
    requestBody: { role: "reader", type: "anyone" },
  });

  return {
    fileId: data.id,
    driveLink: data.webViewLink ?? `https://drive.google.com/file/d/${data.id}/view`,
  };
}
