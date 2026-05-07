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
  version: 1.0.0
servers:
  - url: https://images.ccalc.live
paths:
  /api/config:
    get:
      summary: Get API runtime config
      responses:
        '200':
          description: OK
  /api/images:
    get:
      summary: List images
      responses:
        '200':
          description: OK
    post:
      summary: Upload image
      requestBody:
        required: true
      responses:
        '201':
          description: Created
  /api/images/{key}:
    delete:
      summary: Delete image by key
      parameters:
        - in: path
          name: key
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Deleted
  /api/images/object/{key}:
    get:
      summary: Stream image object
      parameters:
        - in: path
          name: key
          required: true
          schema:
            type: string
      responses:
        '200':
          description: OK
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
    "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
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
  const apiObjectUrl = `${origin}/api/images/object/${encodeURIComponent(key)}`;
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

async function listImages(request, env) {
  const configuredLimit = Number.parseInt(env.BUCKET_LIST_LIMIT ?? "500", 10);
  const limit = Number.isFinite(configuredLimit) && configuredLimit > 0 ? configuredLimit : 500;
  const listing = await env.IMAGE_BUCKET.list({ delimiter: "/", limit });
  const images = listing.objects
    .filter((object) => isImageObject(object.key, object.httpMetadata?.contentType))
    .map((object) => ({
      key: object.key,
      size: object.size,
      uploaded: object.uploaded,
      etag: object.httpEtag,
      contentType: object.httpMetadata?.contentType || TYPE_BY_EXTENSION[getKeyExtension(object.key)] || EMPTY,
      url: toImageUrl(request, env, object.key),
    }))
    .sort((left, right) => String(right.uploaded).localeCompare(String(left.uploaded)));

  return json({ images });
}

async function uploadImage(request, env) {
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

  const key = sanitizeFileName(file.name);
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
        size: uploadedObject?.size ?? file.size,
        uploaded: uploadedObject?.uploaded ?? new Date().toISOString(),
        contentType: uploadedObject?.httpMetadata?.contentType || candidateType || EMPTY,
        url: toImageUrl(request, env, key),
      },
    },
    201,
  );
}

async function deleteImage(_request, env, pathname) {
  const encodedKey = pathname.slice("/api/images/".length);
  const key = decodeURIComponent(encodedKey);
  if (!key) {
    return json({ error: "Image key is required." }, 400);
  }

  await env.IMAGE_BUCKET.delete(key);
  return json({ deleted: key });
}

async function fetchObject(_request, env, pathname) {
  const encodedKey = pathname.slice("/api/images/object/".length);
  const key = decodeURIComponent(encodedKey);
  if (!key) {
    return json({ error: "Image key is required." }, 400);
  }

  return fetchBucketObject(env, key);
}

async function fetchObjectByPublicPath(env, pathname) {
  const key = pathname
    .replace(/^\/+/, "")
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment))
    .join("/");
  if (!key) {
    return json({ error: "Image key is required." }, 400);
  }

  return fetchBucketObject(env, key);
}

async function fetchBucketObject(env, key) {
  const object = await env.IMAGE_BUCKET.get(key);
  if (!object) {
    return json({ error: "Image not found." }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=300");

  return new Response(object.body, {
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
    try {
      if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
        return handleOptions(request);
      }
      if (url.pathname === "/api/config" && request.method === "GET") {
        return withCors(configResponse(env), request);
      }
      if (url.pathname === "/api/images" && request.method === "GET") {
        return withCors(await listImages(request, env), request);
      }
      if (url.pathname === "/api/images" && request.method === "POST") {
        return withCors(await uploadImage(request, env), request);
      }
      if (url.pathname.startsWith("/api/images/object/") && request.method === "GET") {
        return withCors(await fetchObject(request, env, url.pathname), request);
      }
      if (url.pathname.startsWith("/api/images/") && request.method === "DELETE") {
        return withCors(await deleteImage(request, env, url.pathname), request);
      }
      if (url.pathname === "/help" && request.method === "GET") {
        return helpHtml();
      }
      if (url.pathname === "/help/raw" && request.method === "GET") {
        return helpRaw(env);
      }
      if (request.method === "GET" && url.pathname !== "/" && !url.pathname.startsWith("/help")) {
        return fetchObjectByPublicPath(env, url.pathname);
      }
      if (url.pathname.startsWith("/api/")) {
        return withCors(json({ error: "Not found." }, 404), request);
      }

      return json({ error: "Not found." }, 404);
    } catch (error) {
      const response = json({ error: error instanceof Error ? error.message : "Unexpected error." }, 500);
      return url.pathname.startsWith("/api/") ? withCors(response, request) : response;
    }
  },
};
