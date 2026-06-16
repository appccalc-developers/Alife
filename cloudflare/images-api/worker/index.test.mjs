import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";

import worker from "./index.js";

let objects;
let env;

beforeEach(() => {
  objects = new Map();
  env = {
    R2_BUCKET_NAME: "ccalc",
    R2_PUBLIC_BASE_URL: "https://images.ccalc.live",
    BUCKET_LIST_LIMIT: "500",
    HELP_BUCKET_OBJECT_KEY: "images.ccalc.live/openapi.yaml",
    IMAGE_BUCKET: createBucket(),
    HELP_BUCKET: createBucket(),
  };
});

test("GET /api/config returns runtime config with CORS", async () => {
  const response = await dispatch("https://images.ccalc.live/api/config", {
    headers: { origin: "https://ccalc.live" },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://ccalc.live");
  assert.equal(body.bucketName, "ccalc");
  assert.equal(body.publicBaseUrl, "https://images.ccalc.live");
});

test("GET /api/images/config is the canonical config path with CORS", async () => {
  const response = await dispatch("https://images.ccalc.live/api/images/config", {
    headers: { origin: "https://ccalc.live" },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://ccalc.live");
  assert.equal(body.bucketName, "ccalc");
});

test("GET /api/images lists only image objects", async () => {
  objects.set("hero.png", createObject("hero.png", "image/png"));
  objects.set("notes.txt", createObject("notes.txt", "text/plain"));

  const response = await dispatch("https://images.ccalc.live/api/images");
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(
    body.images.map((image) => image.key),
    ["hero.png"],
  );
  assert.equal(body.images[0].url, "https://images.ccalc.live/hero.png");
  assert.ok(Array.isArray(body.folders), "response should include folders array");
});

test("GET /api/images/list returns root folder with images and subfolders", async () => {
  objects.set("hero.png", createObject("hero.png", "image/png"));
  objects.set("cats/tabby.jpg", createObject("cats/tabby.jpg", "image/jpeg"));
  objects.set("cats/siamese.jpg", createObject("cats/siamese.jpg", "image/jpeg"));

  const response = await dispatch("https://images.ccalc.live/api/images/list");
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.path, "/");
  assert.deepEqual(
    body.images.map((i) => i.key),
    ["hero.png"],
  );
  assert.deepEqual(body.folders.map((f) => f.path), ["cats/"]);
  assert.equal(body.folders[0].name, "cats");
  assert.equal(body.folders[0].type, "folder");
});

test("GET /api/images/list/{path} lists subfolder contents", async () => {
  objects.set("cats/tabby.jpg", createObject("cats/tabby.jpg", "image/jpeg"));
  objects.set("cats/siamese.jpg", createObject("cats/siamese.jpg", "image/jpeg"));
  objects.set("cats/kittens/fluffy.png", createObject("cats/kittens/fluffy.png", "image/png"));

  const response = await dispatch("https://images.ccalc.live/api/images/list/cats");
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.path, "cats");
  assert.equal(body.images.length, 2);
  assert.deepEqual(body.folders.map((f) => f.path), ["cats/kittens/"]);
  assert.equal(body.images[0].type, "image");
  assert.ok(body.images[0].url.startsWith("https://images.ccalc.live/cats/"));
});

test("POST /api/images stores multipart image upload", async () => {
  const data = new FormData();
  data.set("file", new File(["image"], "my photo.png", { type: "image/png" }));

  const response = await dispatch("https://images.ccalc.live/api/images", {
    method: "POST",
    body: data,
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.image.key, "my-photo.png");
  assert.equal(body.image.folder, "/");
  assert.equal(objects.has("my-photo.png"), true);
});

test("POST /api/images/{path} uploads image into a subfolder", async () => {
  const data = new FormData();
  data.set("file", new File(["image"], "tabby.jpg", { type: "image/jpeg" }));

  const response = await dispatch("https://images.ccalc.live/api/images/cats", {
    method: "POST",
    body: data,
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.image.key, "cats/tabby.jpg");
  assert.equal(body.image.name, "tabby.jpg");
  assert.equal(body.image.folder, "cats");
  assert.equal(objects.has("cats/tabby.jpg"), true);
});

test("GET /api/images/{path} streams image by key path", async () => {
  objects.set("cats/tabby.jpg", createObject("cats/tabby.jpg", "image/jpeg", "imgdata"));

  const response = await dispatch("https://images.ccalc.live/api/images/cats/tabby.jpg");

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/jpeg");
  assert.equal(await response.text(), "imgdata");
});

test("GET /api/images/{path} returns 404 for missing key", async () => {
  const response = await dispatch("https://images.ccalc.live/api/images/missing.png");

  assert.equal(response.status, 404);
});

test("DELETE /api/images/{path} deletes a single image", async () => {
  objects.set("cats/tabby.jpg", createObject("cats/tabby.jpg", "image/jpeg"));
  objects.set("cats/siamese.jpg", createObject("cats/siamese.jpg", "image/jpeg"));

  const response = await dispatch("https://images.ccalc.live/api/images/cats/tabby.jpg", {
    method: "DELETE",
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.deleted, "cats/tabby.jpg");
  assert.equal(body.type, "image");
  assert.equal(objects.has("cats/tabby.jpg"), false);
  assert.equal(objects.has("cats/siamese.jpg"), true);
});

test("DELETE /api/images/{path} deletes an entire folder and its contents", async () => {
  objects.set("cats/tabby.jpg", createObject("cats/tabby.jpg", "image/jpeg"));
  objects.set("cats/kittens/fluffy.png", createObject("cats/kittens/fluffy.png", "image/png"));
  objects.set("dogs/rex.jpg", createObject("dogs/rex.jpg", "image/jpeg"));

  const response = await dispatch("https://images.ccalc.live/api/images/cats", {
    method: "DELETE",
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.deleted, "cats");
  assert.equal(body.type, "folder");
  assert.equal(body.count, 2);
  assert.equal(objects.has("cats/tabby.jpg"), false);
  assert.equal(objects.has("cats/kittens/fluffy.png"), false);
  assert.equal(objects.has("dogs/rex.jpg"), true);
});

test("DELETE /api/images/{path} returns 404 for non-existent path", async () => {
  const response = await dispatch("https://images.ccalc.live/api/images/missing.png", {
    method: "DELETE",
  });
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.ok(body.error);
});

test("GET public object path streams image object", async () => {
  objects.set("folder/hero.png", createObject("folder/hero.png", "image/png", "hello"));

  const response = await dispatch("https://images.ccalc.live/folder/hero.png", {
    headers: { origin: "https://ccalc.live" },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://ccalc.live");
  assert.equal(response.headers.get("vary"), "origin");
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.equal(await response.text(), "hello");
});

test("OPTIONS public object path returns CORS preflight headers", async () => {
  const response = await dispatch("https://images.ccalc.live/folder/hero.png", {
    method: "OPTIONS",
    headers: {
      origin: "https://ccalc.live",
      "access-control-request-method": "GET",
    },
  });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://ccalc.live");
  assert.match(response.headers.get("access-control-allow-methods") ?? "", /\bGET\b/);
});

function dispatch(url, init = {}) {
  return worker.fetch(new Request(url, init), env);
}

function createBucket() {
  return {
    async list({ prefix = "", delimiter, limit = 1000 } = {}) {
      const all = Array.from(objects.values()).filter((obj) => obj.key.startsWith(prefix));

      if (!delimiter) {
        return { objects: all.slice(0, limit), truncated: false };
      }

      // Delimiter listing: separate direct-child objects from sub-prefix groups
      const directObjects = [];
      const prefixSet = new Set();
      for (const obj of all) {
        const rest = obj.key.slice(prefix.length);
        const delimIdx = rest.indexOf(delimiter);
        if (delimIdx === -1) {
          directObjects.push(obj);
        } else {
          prefixSet.add(prefix + rest.slice(0, delimIdx + 1));
        }
      }

      return {
        objects: directObjects.slice(0, limit),
        delimitedPrefixes: Array.from(prefixSet),
        truncated: false,
      };
    },
    async put(key, body, options = {}) {
      const value = body instanceof ReadableStream ? await new Response(body).text() : String(body);
      objects.set(key, createObject(key, options.httpMetadata?.contentType, value));
    },
    async head(key) {
      return objects.get(key) ?? null;
    },
    async get(key) {
      return objects.get(key) ?? null;
    },
    async delete(keyOrKeys) {
      if (Array.isArray(keyOrKeys)) {
        for (const key of keyOrKeys) objects.delete(key);
      } else {
        objects.delete(keyOrKeys);
      }
    },
  };
}

function createObject(key, contentType = "application/octet-stream", body = "") {
  return {
    key,
    size: body.length,
    uploaded: "2026-05-07T00:00:00.000Z",
    httpEtag: `"${key}"`,
    httpMetadata: { contentType },
    body,
    writeHttpMetadata(headers) {
      headers.set("content-type", contentType);
    },
  };
}
