const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "avif",
  "bmp",
  "svg",
  "tif",
  "tiff",
  "ico",
]);

const TYPE_BY_EXTENSION = {
  avif: "image/avif",
  bmp: "image/bmp",
  gif: "image/gif",
  ico: "image/x-icon",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  tif: "image/tiff",
  tiff: "image/tiff",
  webp: "image/webp",
};

const EMPTY = "";

const OPENAPI_FALLBACK_YAML = `openapi: 3.1.0
info:
  title: CCalc Image API
  version: 2.0.0
servers:
  - url: https://images.ccalc.live
paths:
  /api/images/config:
    get:
      summary: Get API runtime config
      responses:
        '200':
          description: OK
  /api/images/list/{path}:
    get:
      summary: List images and subfolders at path
      parameters:
        - in: path
          name: path
          required: false
          schema:
            type: string
      responses:
        '200':
          description: OK
  /api/images/{path}:
    get:
      summary: Stream image object by path
      parameters:
        - in: path
          name: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: OK
    post:
      summary: Upload image into folder at path
      parameters:
        - in: path
          name: path
          required: false
          schema:
            type: string
      requestBody:
        required: true
      responses:
        '201':
          description: Created
    delete:
      summary: Delete image or folder (and all contents) at path
      parameters:
        - in: path
          name: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Deleted
`;

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function corsHeaders(request) {
  const origin = request.headers.get("origin") || "*";
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET,POST,DELETE,OPTIONS,HEAD",
    "access-control-allow-headers": "content-type,authorization",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}

function withCors(response, request) {
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders(request)).forEach(([key, value]) => {
    headers.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function handleOptions(request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request),
  });
}

function isPublicObjectPath(pathname) {
  return pathname !== "/" && !pathname.startsWith("/help") && !pathname.startsWith("/api/");
}

function getKeyExtension(key) {
  const tokens = key.toLowerCase().split(".");
  return tokens.length > 1 ? tokens.at(-1) : "";
}

function isImageObject(objectKey, contentType) {
  if (typeof contentType === "string" && contentType.startsWith("image/")) {
    return true;
  }

  return IMAGE_EXTENSIONS.has(getKeyExtension(objectKey));
}

function keyToUrlPath(key) {
  return key.split("/").map((segment) => encodeURIComponent(segment)).join("/");
}

function toImageUrl(request, env, key) {
  const base = typeof env.R2_PUBLIC_BASE_URL === "string" ? env.R2_PUBLIC_BASE_URL.trim() : "";
  const origin = new URL(request.url).origin;
  const apiObjectUrl = `${origin}/api/images/${keyToUrlPath(key)}`;
  if (!base) {
    return apiObjectUrl;
  }

  let baseUrl;
  try {
    baseUrl = new URL(base);
  } catch {
    return apiObjectUrl;
  }

  if (baseUrl.origin !== origin) {
    return apiObjectUrl;
  }

  return `${base.replace(/\/$/, "")}/${keyToUrlPath(key)}`;
}

function sanitizeFileName(name) {
  const trimmed = name.trim();
  if (!trimmed) {
    return `upload-${Date.now()}`;
  }

  return trimmed.replace(/\\/g, "/").split("/").at(-1).replace(/\s+/g, "-");
}

/**
 * List images and subfolders at a given folder path.
 * Uses R2 delimiter listing to return virtual folders (delimitedPrefixes)
 * and image objects at this level.
 */
async function listFolder(request, env, folderPath) {
  const configuredLimit = Number.parseInt(env.BUCKET_LIST_LIMIT ?? "500", 10);
  const limit = Number.isFinite(configuredLimit) && configuredLimit > 0 ? configuredLimit : 500;

  // Normalize: non-root folders must end with '/'
  const prefix = folderPath ? folderPath.replace(/\/$/, "") + "/" : "";

  const listing = await env.IMAGE_BUCKET.list({ prefix, delimiter: "/", limit });

  const folders = (listing.delimitedPrefixes || []).map((p) => {
    const name = p.replace(/\/$/, "").split("/").pop();
    return { type: "folder", path: p, name };
  });

  const images = listing.objects
    .filter((obj) => isImageObject(obj.key, obj.httpMetadata?.contentType))
    .map((obj) => ({
      type: "image",
      key: obj.key,
      name: obj.key.split("/").pop(),
      size: obj.size,
      uploaded: obj.uploaded,
      etag: obj.httpEtag,
      contentType: obj.httpMetadata?.contentType || TYPE_BY_EXTENSION[getKeyExtension(obj.key)] || EMPTY,
      url: toImageUrl(request, env, obj.key),
    }))
    .sort((a, b) => String(b.uploaded).localeCompare(String(a.uploaded)));

  return json({ path: folderPath || "/", folders, images });
}

/**
 * Upload an image into a folder path. The form field "file" provides the image.
 * The resulting key is: <folderPath>/<sanitized-filename>
 * (or just <sanitized-filename> for the root).
 */
async function uploadToPath(request, env, folderPath) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return json({ error: 'Use multipart/form-data with field name "file".' }, 400);
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return json({ error: "Missing file field." }, 400);
  }

  const extension = getKeyExtension(file.name);
  const candidateType = file.type || TYPE_BY_EXTENSION[extension] || "";
  if (!isImageObject(file.name, candidateType)) {
    return json({ error: "Only image files can be uploaded." }, 400);
  }

  const fileName = sanitizeFileName(file.name);
  const folder = folderPath ? folderPath.replace(/\/$/, "") + "/" : "";
  const key = folder + fileName;

  await env.IMAGE_BUCKET.put(key, file.stream(), {
    httpMetadata: {
      contentType: candidateType || "application/octet-stream",
    },
  });

  const uploadedObject = await env.IMAGE_BUCKET.head(key);
  return json(
    {
      image: {
        key,
        name: fileName,
        folder: folderPath || "/",
        size: uploadedObject?.size ?? file.size,
        uploaded: uploadedObject?.uploaded ?? new Date().toISOString(),
        contentType: uploadedObject?.httpMetadata?.contentType || candidateType || EMPTY,
        url: toImageUrl(request, env, key),
      },
    },
    201,
  );
}

/**
 * Delete an image file or an entire folder (and all its contents).
 * - If targetPath matches an existing object key → delete that image.
 * - If targetPath is a folder prefix with objects → delete all recursively.
 * After deletion, empty parent folder markers are cleaned up.
 */
async function deletePath(_request, env, targetPath) {
  if (!targetPath) {
    return json({ error: "Path is required." }, 400);
  }

  // Check if it is an existing object (image file)
  const head = await env.IMAGE_BUCKET.head(targetPath);
  if (head) {
    await env.IMAGE_BUCKET.delete(targetPath);
    await cleanupEmptyParentFolders(env, targetPath);
    return json({ deleted: targetPath, type: "image" });
  }

  // Check if it is a folder (objects exist under this prefix)
  const folderPrefix = targetPath.replace(/\/$/, "") + "/";
  const count = await deleteAllWithPrefix(env, folderPrefix);
  if (count > 0) {
    await cleanupEmptyParentFolders(env, folderPrefix);
    return json({ deleted: targetPath, type: "folder", count });
  }

  return json({ error: "Not found." }, 404);
}

/**
 * Recursively delete all R2 objects whose keys begin with the given prefix.
 * Returns the total count of deleted objects.
 */
async function deleteAllWithPrefix(env, prefix) {
  let cursor;
  let count = 0;
  do {
    const options = { prefix, limit: 1000 };
    if (cursor) {
      options.cursor = cursor;
    }
    const listing = await env.IMAGE_BUCKET.list(options);
    const keys = listing.objects.map((obj) => obj.key);
    if (keys.length > 0) {
      await env.IMAGE_BUCKET.delete(keys);
      count += keys.length;
    }
    cursor = listing.truncated ? listing.cursor : null;
  } while (cursor);
  return count;
}

/**
 * After deleting an object, walk up the folder hierarchy and remove any explicit
 * folder marker objects (keys ending in '/') that are now empty.
 */
async function cleanupEmptyParentFolders(env, key) {
  const parts = key.split("/").filter(Boolean);
  for (let i = parts.length - 1; i > 0; i--) {
    const folderPrefix = parts.slice(0, i).join("/") + "/";
    const listing = await env.IMAGE_BUCKET.list({ prefix: folderPrefix, limit: 1 });
    const isEmpty =
      listing.objects.length === 0 && (!listing.delimitedPrefixes || listing.delimitedPrefixes.length === 0);
    if (isEmpty) {
      // Remove explicit folder marker if present (key == folderPrefix)
      await env.IMAGE_BUCKET.delete(folderPrefix);
    } else {
      // Parent folder still has content; stop climbing
      break;
    }
  }
}

async function fetchObjectByKey(_request, env, encodedKey) {
  const key = decodeURIComponent(encodedKey);
  if (!key) {
    return json({ error: "Image key is required." }, 400);
  }

  return fetchBucketObject(env, key, _request.method === "HEAD");
}

async function fetchObjectByPublicPath(request, env, pathname) {
  const key = pathname
    .replace(/^\/+/, "")
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment))
    .join("/");
  if (!key) {
    return json({ error: "Image key is required." }, 400);
  }

  return fetchBucketObject(env, key, request.method === "HEAD");
}

async function fetchBucketObject(env, key, headOnly = false) {
  const object = headOnly ? await env.IMAGE_BUCKET.head(key) : await env.IMAGE_BUCKET.get(key);
  if (!object) {
    return json({ error: "Image not found." }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=86400, immutable");
  if (Number.isFinite(object.size)) {
    headers.set("content-length", String(object.size));
  }

  return new Response(headOnly ? null : object.body, {
    status: 200,
    headers,
  });
}

function configResponse(env) {
  return json({
    bucketBinding: "IMAGE_BUCKET",
    bucketName: env.R2_BUCKET_NAME ?? EMPTY,
    publicBaseUrl: env.R2_PUBLIC_BASE_URL ?? EMPTY,
    listLimit: env.BUCKET_LIST_LIMIT ?? "500",
    helpBucketObjectKey: env.HELP_BUCKET_OBJECT_KEY ?? "openapi.yaml",
  });
}

async function helpRaw(env) {
  const helpBucket = env.HELP_BUCKET;
  const objectKey =
    typeof env.HELP_BUCKET_OBJECT_KEY === "string" && env.HELP_BUCKET_OBJECT_KEY.trim()
      ? env.HELP_BUCKET_OBJECT_KEY.trim()
      : "openapi.yaml";

  if (helpBucket) {
    const object = await helpBucket.get(objectKey);
    if (object) {
      return new Response(object.body, {
        headers: {
          "content-type": "text/yaml; charset=utf-8",
          "access-control-allow-origin": "*",
        },
      });
    }
  }

  return new Response(OPENAPI_FALLBACK_YAML, {
    headers: {
      "content-type": "text/yaml; charset=utf-8",
      "access-control-allow-origin": "*",
    },
  });
}

function helpHtml() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>CCalc Image API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"><\/script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: 'https://images.ccalc.live/help/raw',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis],
      });
    };
  <\/script>
</body>
</html>`;

  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;

    try {
      // CORS preflight
      if (method === "OPTIONS" && (pathname.startsWith("/api/") || isPublicObjectPath(pathname))) {
        return handleOptions(request);
      }

      // ── Config ──────────────────────────────────────────────────────────
      // New canonical path: GET /api/images/config
      // Legacy path kept for backwards compatibility: GET /api/config
      if (method === "GET" && (pathname === "/api/images/config" || pathname === "/api/config")) {
        return withCors(configResponse(env), request);
      }

      // ── List folder: GET /api/images/list[/{path}] ─────────────────────
      if (method === "GET" && pathname.startsWith("/api/images/list")) {
        const raw = pathname.slice("/api/images/list".length).replace(/^\//, "");
        const folderPath = raw ? decodeURIComponent(raw) : "";
        return withCors(await listFolder(request, env, folderPath), request);
      }

      // ── Legacy flat list: GET /api/images ─────────────────────────────
      if (method === "GET" && pathname === "/api/images") {
        return withCors(await listFolder(request, env, ""), request);
      }

      // ── Upload: POST /api/images[/{path}] ──────────────────────────────
      if (method === "POST" && (pathname === "/api/images" || pathname.startsWith("/api/images/"))) {
        const raw = pathname === "/api/images" ? "" : pathname.slice("/api/images/".length);
        const folderPath = raw ? decodeURIComponent(raw) : "";
        return withCors(await uploadToPath(request, env, folderPath), request);
      }

      // ── Delete image or folder: DELETE /api/images/{path} ──────────────
      if (method === "DELETE" && pathname.startsWith("/api/images/")) {
        const encodedPath = pathname.slice("/api/images/".length);
        const targetPath = decodeURIComponent(encodedPath);
        return withCors(await deletePath(request, env, targetPath), request);
      }

      // ── Stream image: GET /api/images/{path} ───────────────────────────
      // Must come after /api/images/list and /api/images/config checks above.
      if ((method === "GET" || method === "HEAD") && pathname.startsWith("/api/images/")) {
        const encodedKey = pathname.slice("/api/images/".length);
        return withCors(await fetchObjectByKey(request, env, encodedKey), request);
      }

      // ── Documentation ──────────────────────────────────────────────────
      if (pathname === "/help" && method === "GET") {
        return helpHtml();
      }
      if (pathname === "/help/raw" && method === "GET") {
        return helpRaw(env);
      }

      // ── Public path fallback (serve image by public URL path) ──────────
      if ((method === "GET" || method === "HEAD") && isPublicObjectPath(pathname)) {
        return withCors(await fetchObjectByPublicPath(request, env, pathname), request);
      }

      if (pathname.startsWith("/api/")) {
        return withCors(json({ error: "Not found." }, 404), request);
      }

      return json({ error: "Not found." }, 404);
    } catch (error) {
      const response = json({ error: error instanceof Error ? error.message : "Unexpected error." }, 500);
      return pathname.startsWith("/api/") ? withCors(response, request) : response;
    }
  },
};
