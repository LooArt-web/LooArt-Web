import { test } from "node:test";
import assert from "node:assert/strict";
import { detectarImagen } from "../../src/dominio/archivos.js";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const WEBP = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from([1, 0, 0, 0]),
  Buffer.from("WEBPVP8 ")
]);

test("detectarImagen reconoce JPG, PNG y WebP por sus bytes, no por la extensión", () => {
  assert.equal(detectarImagen(PNG), "image/png");
  assert.equal(detectarImagen(JPG), "image/jpeg");
  assert.equal(detectarImagen(WEBP), "image/webp");
});

test("detectarImagen rechaza otros formatos aunque se llamen .png (RN-026)", () => {
  const exe = Buffer.from("MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00", "latin1");
  const gif = Buffer.from("GIF89a\x01\x00\x01\x00\x00\x00", "latin1");
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  const riffAvi = Buffer.concat([
    Buffer.from("RIFF"),
    Buffer.from([1, 0, 0, 0]),
    Buffer.from("AVI LIST")
  ]);
  for (const b of [exe, gif, svg, riffAvi, Buffer.alloc(0), Buffer.from([0x89, 0x50])]) {
    assert.equal(detectarImagen(b), null);
  }
});
