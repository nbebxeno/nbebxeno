import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { canonicalIdentity, identitiesMatch, metadataIsAdmin, PermanentGms } from "../src/access.ts";

test("admin checks match phone/LID metadata, device IDs, boolean flags, and group owners", () => {
  const metadata = { owner: "800@lid", ownerPn: "15550000001@s.whatsapp.net", participants: [
    { id: "900@lid", phoneNumber: "15550000002@s.whatsapp.net", admin: "admin" },
    { id: "901@lid", phoneNumber: "15550000003@s.whatsapp.net", isAdmin: true },
    { id: "902@lid", phoneNumber: "15550000004@s.whatsapp.net", isSuperAdmin: true },
    { id: "903@lid", phoneNumber: "15550000005@s.whatsapp.net", admin: null }
  ] };
  assert.equal(metadataIsAdmin(metadata, ["15550000002:4@s.whatsapp.net"]), true);
  assert.equal(metadataIsAdmin(metadata, ["900@lid"]), true);
  assert.equal(metadataIsAdmin(metadata, ["15550000003@s.whatsapp.net"]), true);
  assert.equal(metadataIsAdmin(metadata, ["902@lid"]), true);
  assert.equal(metadataIsAdmin(metadata, ["15550000001@s.whatsapp.net"]), true);
  assert.equal(metadataIsAdmin(metadata, ["15550000005@s.whatsapp.net"]), false);
  assert.equal(metadataIsAdmin(metadata, ["unknown@lid"]), false);
});

test("LID digits cannot impersonate a phone number and malformed domains do not match", () => {
  assert.equal(identitiesMatch(["15550000001@lid"], ["15550000001@s.whatsapp.net"]), false);
  assert.equal(canonicalIdentity("15550000001@s.whatsapp.net.evil"), undefined);
  assert.equal(canonicalIdentity("15550000001@s.whatsapp.net@evil"), undefined);
  assert.equal(canonicalIdentity("+1 (555) 000-0001"), "15550000001@s.whatsapp.net");
  assert.equal(identitiesMatch(["15550000001:7@s.whatsapp.net"], ["15550000001@c.us"]), true);
});

test("permanent GM access persists locally, reloads without restart, and is removable", () => {
  const dir = mkdtempSync(join(tmpdir(), "lordxeno-access-"));
  try {
    const file = join(dir, "access.json");
    const store = new PermanentGms(file);
    assert.equal(store.has(["15550000001@s.whatsapp.net"]), false);
    store.add("+1 (555) 000-0001");
    store.add("15550000001");
    assert.equal(new PermanentGms(file).list().length, 1);
    assert.equal(store.has(["15550000001:3@s.whatsapp.net"]), true);
    assert.equal(store.has(["15550000001@lid"]), false);
    assert.throws(() => store.add("not a phone"), /international/);
    new PermanentGms(file).remove("+15550000001");
    assert.equal(store.has(["15550000001@s.whatsapp.net"]), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("GM setup CLI writes to the current installation's ignored data folder", () => {
  const dir = mkdtempSync(join(tmpdir(), "lordxeno-gm-cli-"));
  try {
    const cli = fileURLToPath(new URL("../src/gm-cli.ts", import.meta.url));
    const result = spawnSync(process.execPath, [cli, "add", "15550000001"], { cwd: dir, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(new PermanentGms(join(dir, ".data/lordxeno-access.json")).has(["15550000001@s.whatsapp.net"]), true);
    const invalid = spawnSync(process.execPath, [cli, "add", "invalid"], { cwd: dir, encoding: "utf8" });
    assert.notEqual(invalid.status, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
