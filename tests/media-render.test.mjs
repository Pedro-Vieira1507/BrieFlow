import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  decodeTaskHandle,
  encodeTaskHandle,
  findGeminiMediaOutput,
  normalizeGeminiAudio,
} from "../supabase/functions/media-render/media.ts";

test("media task handles preserve provider routing and legacy Runway tasks", () => {
  assert.deepEqual(
    decodeTaskHandle(encodeTaskHandle({ provider: "gemini", id: "v1_123" })),
    {
      provider: "gemini",
      id: "v1_123",
    },
  );
  assert.deepEqual(decodeTaskHandle("legacy-task-id"), {
    provider: "runway",
    id: "legacy-task-id",
  });
  assert.equal(decodeTaskHandle("unknown:task"), null);
});

test("Gemini REST media is extracted from convenience fields or steps", () => {
  assert.deepEqual(
    findGeminiMediaOutput(
      {
        output_audio: { type: "audio", data: "AQI=", mime_type: "audio/mpeg" },
      },
      "audio",
    ),
    { type: "audio", data: "AQI=", mime_type: "audio/mpeg" },
  );
  assert.deepEqual(
    findGeminiMediaOutput(
      {
        steps: [
          { type: "user_input", content: [{ type: "text" }] },
          {
            type: "model_output",
            content: [
              {
                type: "video",
                uri: "https://generativelanguage.googleapis.com/v1beta/files/1:download",
                mime_type: "video/mp4",
              },
            ],
          },
        ],
      },
      "video",
    ),
    {
      type: "video",
      uri: "https://generativelanguage.googleapis.com/v1beta/files/1:download",
      mime_type: "video/mp4",
    },
  );
});

test("Gemini raw PCM output is wrapped as a browser-playable WAV", () => {
  const normalized = normalizeGeminiAudio({
    type: "audio",
    data: Buffer.from([0, 1, 2, 3]).toString("base64"),
    mime_type: "audio/L16;codec=pcm;rate=24000",
  });
  assert.equal(normalized.mimeType, "audio/wav");
  assert.equal(
    Buffer.from(normalized.bytes.subarray(0, 4)).toString("ascii"),
    "RIFF",
  );
  assert.equal(
    Buffer.from(normalized.bytes.subarray(8, 12)).toString("ascii"),
    "WAVE",
  );
  assert.equal(normalized.bytes.byteLength, 48);
});

test("media rendering selects Gemini output models first and keeps server-side fallback", async () => {
  const [edge, client, envExample, config] = await Promise.all([
    readFile(
      new URL("../supabase/functions/media-render/index.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../src/lib/mediaRender.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/.env.example", import.meta.url), "utf8"),
    readFile(new URL("../supabase/config.toml", import.meta.url), "utf8"),
  ]);

  assert.match(edge, /"gemini-omni-1\.1-flash"/);
  assert.match(edge, /"gemini-3\.1-flash-tts-preview"/);
  assert.match(edge, /provider: "gemini"[\s\S]*provider: "runway"/);
  assert.match(edge, /created\.interaction[\s\S]*persistGeminiOutput/);
  assert.match(edge, /fetchPublicResource\(referenceImageUrl/);
  assert.match(edge, /hostname !== "generativelanguage\.googleapis\.com"/);
  assert.match(client, /status\.provider \?\? started\.provider \?\? "runway"/);
  assert.match(client, /started\.status === "ready" && started\.url/);
  assert.doesNotMatch(client, /GEMINI_API_KEY|RUNWAYML_API_SECRET/);
  assert.match(envExample, /GEMINI_VIDEO_MODEL=gemini-omni-1\.1-flash/);
  assert.match(
    envExample,
    /GEMINI_PODCAST_MODEL=gemini-3\.1-flash-tts-preview/,
  );
  assert.match(config, /\[functions\.media-render\][\s\S]*verify_jwt = true/);
});

test("generated media storage accepts browser-playable audio and video", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/20260914120252_enable_generated_media_storage.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(migration, /file_size_limit = 50000000/);
  assert.match(migration, /'audio\/wav'/);
  assert.match(migration, /'audio\/mpeg'/);
  assert.match(migration, /'video\/mp4'/);
});
