const fs = require("fs/promises");
const { createClient } = require("@supabase/supabase-js");

const getSupabaseClient = () => {
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error("Supabase URL or secret key is missing from backend/.env");
  }

  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

const getBucket = () => process.env.SUPABASE_BUCKET || "video-assets";

// Upload a local file to the private bucket.
const uploadLocalFile = async (localPath, objectPath, contentType) => {
  const supabase = getSupabaseClient();
  const fileBuffer = await fs.readFile(localPath);

  const { data, error } = await supabase.storage
    .from(getBucket())
    .upload(objectPath, fileBuffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  return data.path;
};

// Download a stored object to a local file.
// FFmpeg and the AI model can then process it locally.
const downloadToFile = async (objectPath, destinationPath) => {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.storage
    .from(getBucket())
    .download(objectPath);

  if (error) {
    throw new Error(`Supabase download failed: ${error.message}`);
  }

  await fs.writeFile(destinationPath, Buffer.from(await data.arrayBuffer()));

  return destinationPath;
};

// Generate temporary access to a private file.
const createSignedUrl = async (objectPath, expiresIn = 3600) => {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.storage
    .from(getBucket())
    .createSignedUrl(objectPath, expiresIn);

  if (error) {
    throw new Error(`Supabase signed URL failed: ${error.message}`);
  }

  return data.signedUrl;
};

// Delete stored objects from the bucket.
const removeFiles = async (objectPaths) => {
  if (!objectPaths || objectPaths.length === 0) {
    return;
  }

  const supabase = getSupabaseClient();

  const { error } = await supabase.storage
    .from(getBucket())
    .remove(objectPaths);

  if (error) {
    throw new Error(`Supabase deletion failed: ${error.message}`);
  }
};

module.exports = {
  uploadLocalFile,
  downloadToFile,
  createSignedUrl,
  removeFiles,
};
