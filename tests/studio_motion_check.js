#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const src = fs.readFileSync(path.join(__dirname, "..", "js", "studio-live.js"), "utf8");
let seed = 1;
function rng() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}

function load() {
  seed = 1;
  const sandbox = {
    console,
    Math: Object.assign(Object.create(Math), { random: rng }),
    window: {},
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    setTimeout: () => 0,
    matchMedia: () => ({ matches: false }),
    document: {
      readyState: "complete",
      documentElement: { dataset: {} },
      getElementById: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {}
    }
  };
  sandbox.window = sandbox;
  sandbox.global = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: "studio-live.js" });
  return sandbox.LeadStudio;
}

function dist(a, b) {
  return Math.hypot(a.c - b.c, a.r - b.r);
}

function run(dt, seconds) {
  const api = load();
  api.reset();
  const marks = [];
  let t = 0;
  let prevNote = "";
  let maxStep = 0;
  let maxSit = 0;
  let prev = null;
  const samples = [];
  while (t < seconds) {
    const step = Math.min(dt, seconds - t);
    const snap = api.advance(step);
    t += step;
    const moved = prev ? Math.max(dist(prev.alex, snap.alex), dist(prev.igor, snap.igor), dist(prev.client, snap.client), dist(prev.cat, snap.cat)) : 0;
    if (moved > maxStep) maxStep = moved;
    const sitJ = prev ? Math.max(Math.abs(prev.alex.sit - snap.alex.sit), Math.abs(prev.igor.sit - snap.igor.sit)) : 0;
    if (sitJ > maxSit) maxSit = sitJ;
    if (snap.note !== prevNote) {
      marks.push({ t: Math.round(t * 1000) / 1000, note: snap.note, act: snap.act });
      prevNote = snap.note;
    }
    if (Math.abs(t - Math.round(t)) < dt * 0.51) samples.push(snap);
    prev = snap;
    if (marks.filter((m) => m.act === 0).length >= 3 && t > 5) break;
  }
  return { marks, maxStep, maxSit, samples, t };
}

function samePeople(a, b) {
  return Math.max(dist(a.alex, b.alex), dist(a.igor, b.igor), dist(a.client, b.client));
}

let failed = 0;
function check(name, ok, detail) {
  if (!ok) {
    failed += 1;
    console.log("FAIL", name, detail || "");
  } else {
    console.log("ok", name, detail || "");
  }
}

const rates = [1 / 30, 1 / 60, 1 / 120, 1 / 144];
const runs = rates.map((dt) => run(dt, 140));
const base = runs[1];
check("cycle repeats", base.marks.filter((m) => m.act === 0).length >= 2, "acts " + base.marks.map((m) => m.act + "@" + m.t).join(" "));
const cycleMarks = base.marks.filter((m) => m.act === 0);
const cycle = cycleMarks.length >= 2 ? cycleMarks[1].t - cycleMarks[0].t : 0;
check("cycle about 70-160s", cycle > 70 && cycle < 160, cycle + "s");

runs.forEach((item, i) => {
  const hz = Math.round(1 / rates[i]);
  const n = Math.min(item.marks.length, base.marks.length);
  let worst = 0;
  for (let k = 0; k < n; k++) worst = Math.max(worst, Math.abs(item.marks[k].t - base.marks[k].t));
  check(hz + "Hz scene times", worst < 0.2, "max delta " + worst.toFixed(3) + "s");
  const samples = Math.min(item.samples.length, base.samples.length, 40);
  let pos = 0;
  for (let k = 0; k < samples; k++) pos = Math.max(pos, samePeople(item.samples[k], base.samples[k]));
  check(hz + "Hz positions", pos < 0.04, "max people delta " + pos.toFixed(4) + " tiles");
  const limit = 0.3 * rates[i] + 0.004;
  check(hz + "Hz no jump", item.maxStep <= limit, "max step " + item.maxStep.toFixed(4) + " limit " + limit.toFixed(4));
  check(hz + "Hz sit blend", item.maxSit <= rates[i] / 0.35 + 0.002, "max sit " + item.maxSit.toFixed(4));
});

const uneven = [];
let left = 90;
const pattern = [0.05, 0.01, 0.017, 0.004, 0.033, 0.008];
let p = 0;
while (left > 0) {
  const piece = Math.min(pattern[p % pattern.length], left);
  uneven.push(piece);
  left -= piece;
  p += 1;
}
const api = load();
api.reset();
let jumped = false;
let prev = api.advance(0.0001);
for (const dt of uneven) {
  const snap = api.advance(dt);
  if (Math.max(dist(prev.alex, snap.alex), dist(prev.cat, snap.cat)) > 0.3 * 0.05 + 0.004) jumped = true;
  prev = snap;
}
check("uneven dt no teleport", !jumped);

const huge = load();
huge.reset();
for (let t = 0; t < 9; t += 0.05) huge.advance(0.05);
const before = huge.advance(0.016);
const after = huge.advance(5);
check("hidden-tab dt is clamped", dist(before.alex, after.alex) > 0 && dist(before.alex, after.alex) <= 0.3 * 0.05 + 0.004, "moved " + dist(before.alex, after.alex).toFixed(4));

if (failed) {
  console.log(failed + " failed");
  process.exit(1);
}
console.log("ok: motion is time-based and continuous");
