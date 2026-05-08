import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

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
    headers: { origin: "https://app.ccalc.live" },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://app.ccalc.live");
  assert.equal(body.bucketName, "ccalc");
  assert.equal(body.publicBaseUrl, "https://images.ccalc.live");
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
  assert.equal(objects.has("my-photo.png"), true);
});

test("GET public object path streams image object", async () => {
  objects.set("folder/hero.png", createObject("folder/hero.png", "image/png", "hello"));

  const response = await dispatch("https://images.ccalc.live/folder/hero.png");

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.equal(await response.text(), "hello");
});

function dispatch(url, init = {}) {
  return worker.fetch(new Request(url, init), env);
}

function createBucket() {
  return {
    async list() {
      return { objects: Array.from(objects.values()) };
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
    async delete(key) {
      objects.delete(key);
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
