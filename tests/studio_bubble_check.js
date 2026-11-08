#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const src = fs.readFileSync(path.join(__dirname, "..", "js", "studio-live.js"), "utf8");

function load() {
  const sandbox = {
    console,
    Math,
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

function project(c, r) {
  return [208 + (c - r) * 18, 100 + (c + r) * 8];
}

function nameBox(id, c, r, sit, scale) {
  const foot = project(c, r);
  const anchorY = foot[1] - (id === "cat" ? 24 : sit ? 40 : 46);
  const base = { alex: 34, igor: 28, client: 32, cat: 22 };
  const w = base[id] * scale;
  const h = 11 * scale;
  return { id, x: foot[0] - w / 2, y: anchorY - h, w, h };
}

function overlapArea(a, b) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (w <= 0 || h <= 0) return 0;
  return w * h;
}

function clearance(a, b) {
  const dx = Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w));
  const dy = Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h));
  if (dx >= -0.01 && dy >= -0.01) return Infinity;
  if (dx >= -0.01) return dx;
  if (dy >= -0.01) return dy;
  return Math.max(dx, dy);
}

const BOUNDS = { x: 4, y: 4, w: 444, h: 300 };
let failed = 0;
function check(name, ok, detail) {
  if (!ok) {
    failed += 1;
    console.log("FAIL", name, detail || "");
  } else {
    console.log("ok", name, detail || "");
  }
}

const api = load();
const phrases = {
  igorDesk: { who: "igor", w: 108, h: 18 },
  talk: { who: "alex", w: 108, h: 30 },
  client: { who: "client", w: 80, h: 18 },
  taken: { who: "igor", w: 100, h: 18 },
  code: { who: "alex", w: 78, h: 18 },
  meow: { who: "cat", w: 40, h: 18 },
  long: { who: "alex", w: 108, h: 66 }
};

const desks = {
  alex: [3.35, 3.2],
  igor: [8.75, 3.2],
  meetA: [4.15, 3.95],
  meetI: [6.35, 3.95],
  client: [5.2, 3.95],
  door: [10.4, 8.7]
};
const cats = [
  [2.05, 8.55],
  [8.55, 8.55],
  [6.35, 5.55],
  [4.45, 3.35],
  [9.7, 3.55],
  [2.15, 5.1],
  [10.2, 8.55]
];

function boxesFor(scale, pose) {
  const sit = true;
  const alexAt = desks.alex;
  const igorAt = desks.igor;
  const list = [
    nameBox("alex", alexAt[0], alexAt[1], sit, scale),
    nameBox("igor", igorAt[0], igorAt[1], sit, scale),
    nameBox("cat", pose.cat[0], pose.cat[1], false, scale)
  ];
  if (pose.client) list.push(nameBox("client", pose.client[0], pose.client[1], false, scale));
  return list;
}

function speakerOf(box) {
  return { x: box.x + box.w / 2, top: box.y, half: box.w / 2 };
}

function assertClear(label, bubble, obstacles) {
  const inside = bubble.x >= BOUNDS.x - 0.01 && bubble.y >= BOUNDS.y - 0.01 &&
    bubble.x + bubble.w <= BOUNDS.x + BOUNDS.w + 0.01 &&
    bubble.y + bubble.h <= BOUNDS.y + BOUNDS.h + 0.01;
  let worst = Infinity;
  let hit = "";
  obstacles.forEach((name) => {
    const gap = clearance(bubble, name);
    const area = overlapArea(bubble, name);
    if (area > 0.5 || gap < 2) {
      if (gap < worst) {
        worst = gap;
        hit = name.id + " gap " + gap.toFixed(2) + " area " + area.toFixed(1);
      }
    }
  });
  check(label, inside && worst === Infinity, inside ? hit : "outside " + JSON.stringify(bubble));
}

[1, 2.6].forEach((scale) => {
  cats.forEach((cat, index) => {
    const desk = boxesFor(scale, { cat, client: null });
    assertClear(
      "scale " + scale + " work igor cat" + index,
      api.placeBubble(phrases.igorDesk.w, phrases.igorDesk.h, speakerOf(desk.find((b) => b.id === "igor")), desk),
      desk
    );
    assertClear(
      "scale " + scale + " code alex cat" + index,
      api.placeBubble(phrases.code.w, phrases.code.h, speakerOf(desk.find((b) => b.id === "alex")), desk),
      desk
    );
    assertClear(
      "scale " + scale + " meow cat" + index,
      api.placeBubble(phrases.meow.w, phrases.meow.h, speakerOf(desk.find((b) => b.id === "cat")), desk),
      desk
    );

    const talk = boxesFor(scale, { cat, client: null });
    const talkNames = [
      nameBox("alex", desks.meetA[0], desks.meetA[1], false, scale),
      nameBox("igor", desks.meetI[0], desks.meetI[1], false, scale),
      talk.find((b) => b.id === "cat")
    ];
    assertClear(
      "scale " + scale + " talk cat" + index,
      api.placeBubble(phrases.talk.w, phrases.talk.h, speakerOf(talkNames.find((b) => b.id === "alex")), talkNames),
      talkNames
    );
    assertClear(
      "scale " + scale + " long talk cat" + index,
      api.placeBubble(phrases.long.w, phrases.long.h, speakerOf(talkNames.find((b) => b.id === "alex")), talkNames),
      talkNames
    );

    const meeting = [
      nameBox("alex", desks.meetA[0], desks.meetA[1], false, scale),
      nameBox("igor", desks.meetI[0], desks.meetI[1], false, scale),
      nameBox("client", desks.client[0], desks.client[1], false, scale),
      nameBox("cat", cat[0], cat[1], false, scale)
    ];
    assertClear(
      "scale " + scale + " client cat" + index,
      api.placeBubble(phrases.client.w, phrases.client.h, speakerOf(meeting.find((b) => b.id === "client")), meeting),
      meeting
    );

    const door = [
      nameBox("alex", desks.alex[0], desks.alex[1], true, scale),
      nameBox("igor", desks.igor[0], desks.igor[1], true, scale),
      nameBox("client", desks.door[0], desks.door[1], false, scale),
      nameBox("cat", cat[0], cat[1], false, scale)
    ];
    assertClear(
      "scale " + scale + " door cat" + index,
      api.placeBubble(phrases.client.w, phrases.client.h, speakerOf(door.find((b) => b.id === "client")), door),
      door
    );
    assertClear(
      "scale " + scale + " taken cat" + index,
      api.placeBubble(phrases.taken.w, phrases.taken.h, speakerOf(door.find((b) => b.id === "igor")), door),
      door
    );
  });
});

const topNames = [
  { id: "alex", x: 136, y: 4, w: 90, h: 24 },
  { id: "igor", x: 230, y: 6, w: 84, h: 24 }
];
assertClear(
  "names at the top edge",
  api.placeBubble(108, 30, speakerOf(topNames[0]), topNames),
  topNames
);

const fullTop = [{ id: "alex", x: 4, y: 4, w: 440, h: 36 }];
assertClear(
  "name across the top",
  api.placeBubble(108, 42, speakerOf(fullTop[0]), fullTop),
  fullTop
);

const low = [{ id: "cat", x: 300, y: 250, w: 80, h: 28 }, { id: "igor", x: 300, y: 210, w: 70, h: 24 }];
assertClear(
  "cat near the bottom",
  api.placeBubble(108, 54, speakerOf(low[0]), low),
  low
);

const side = [{ id: "client", x: 4, y: 80, w: 70, h: 30 }];
assertClear(
  "client on the left edge",
  api.placeBubble(108, 30, speakerOf(side[0]), side),
  side
);

if (failed) {
  console.log(failed + " failed");
  process.exit(1);
}
console.log("ok: bubbles stay inside the scene and clear of names");
