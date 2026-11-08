/* Lead.web studio preview.
   Original isometric pixel art, rasterized here. No third-party sprites.
   Phaser 3.88.2 (MIT) is loaded separately from js/vendor/phaser.min.js. */
(function () {
  "use strict";

  var WIDTH = 452;
  var HEIGHT = 308;
  var COLS = 12;
  var ROWS = 10;
  var HW = 18;
  var HH = 8;
  var OX = 208;
  var OY = 100;
  var WALL = 84;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var playing = !reduced;
  var tick = 0;
  var hover = null;
  var selected = null;
  var anchors = [];
  var screenCanvas = null;
  var screenCtx = null;
  var texture = null;
  var game = null;

  var ZONES = {
    alex: {
      c: 1.7, r: 0.15, cw: 3.8, rw: 3.55,
      eye: "Рабочее место",
      title: "Алексей",
      text: "Страница про автоматизацию: процессы, связь сайта и CRM с 1С, отчёты для руководителя.",
      href: "/leadweb/automation.html",
      link: "Открыть «Автоматизация с 1С»"
    },
    igor: {
      c: 7.05, r: 0.15, cw: 3.7, rw: 3.55,
      eye: "Рабочее место",
      title: "Игорь",
      text: "Страница про сайт на «1С-Битрикс: Управление сайтом». Это не Битрикс24.",
      href: "/leadweb/bitrix.html",
      link: "Открыть «Сайт на 1С-Битрикс»"
    },
    talk: {
      c: 3.15, r: 4.35, cw: 4.5, rw: 3.7,
      eye: "Зона общения",
      title: "Кто делает студию",
      text: "На странице «О нас» — Алексей и Игорь. Фигурки в сцене условные, это не портреты.",
      href: "/leadweb/o-nas/",
      link: "Открыть «О нас»"
    },
    portfolio: {
      c: 0.15, r: 4.15, cw: 2.15, rw: 3.15,
      eye: "Экран с работами",
      title: "Портфолио",
      text: "Кейсы и сайты, которые можно открыть и посмотреть.",
      href: "/leadweb/portfolio/",
      link: "Открыть портфолио"
    }
  };

  function showFallback(reason) {
    var el = document.getElementById("studio-fallback");
    if (!el) return;
    el.hidden = false;
    if (reason) el.textContent = reason;
    var stage = document.getElementById("studio-stage");
    if (stage) stage.dataset.ready = "fallback";
  }

  function project(c, r, z) {
    return [OX + (c - r) * HW, OY + (c + r) * HH - z];
  }

  function darken(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
    var g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
    var b = Math.max(0, Math.min(255, (n & 255) + amt));
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function fillPoly(ctx, pts, color) {
    if (!pts || pts.length < 3) return;
    var p = pts.map(function (v) { return [Math.round(v[0]), Math.round(v[1])]; });
    var minY = p[0][1], maxY = p[0][1];
    for (var i = 1; i < p.length; i++) {
      if (p[i][1] < minY) minY = p[i][1];
      if (p[i][1] > maxY) maxY = p[i][1];
    }
    if (maxY < 0 || minY >= HEIGHT) return;
    var spans = new Array(maxY - minY + 1);
    for (var s = 0; s < spans.length; s++) spans[s] = [Infinity, -Infinity];
    for (var e = 0; e < p.length; e++) {
      var a = p[e];
      var b = p[(e + 1) % p.length];
      var y0 = a[1], y1 = b[1], x0 = a[0], x1 = b[0];
      var steps = Math.abs(y1 - y0);
      if (steps === 0) {
        var idx = y0 - minY;
        if (idx >= 0 && idx < spans.length) {
          var lo = Math.min(x0, x1), hi = Math.max(x0, x1);
          if (lo < spans[idx][0]) spans[idx][0] = lo;
          if (hi > spans[idx][1]) spans[idx][1] = hi;
        }
        continue;
      }
      var dir = y1 > y0 ? 1 : -1;
      for (var t = 0; t <= steps; t++) {
        var y = y0 + dir * t;
        var x = Math.round(x0 + (x1 - x0) * (t / steps));
        var k = y - minY;
        if (k < 0 || k >= spans.length) continue;
        if (x < spans[k][0]) spans[k][0] = x;
        if (x > spans[k][1]) spans[k][1] = x;
      }
    }
    ctx.fillStyle = color;
    for (var y = minY; y <= maxY; y++) {
      var span = spans[y - minY];
      if (!span || span[0] === Infinity) continue;
      var w = span[1] - span[0] + 1;
      if (w > 0) ctx.fillRect(span[0], y, w, 1);
    }
  }

  function line(ctx, x0, y0, x1, y1, color) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    var dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    var sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    var err = dx - dy;
    ctx.fillStyle = color;
    while (true) {
      ctx.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  }

  function outline(ctx, pts, color) {
    for (var i = 0; i < pts.length; i++) {
      var a = pts[i], b = pts[(i + 1) % pts.length];
      line(ctx, a[0], a[1], b[0], b[1], color);
    }
  }

  function bounds(pts) {
    var x0 = pts[0][0], y0 = pts[0][1], x1 = x0, y1 = y0;
    for (var i = 1; i < pts.length; i++) {
      if (pts[i][0] < x0) x0 = pts[i][0];
      if (pts[i][1] < y0) y0 = pts[i][1];
      if (pts[i][0] > x1) x1 = pts[i][0];
      if (pts[i][1] > y1) y1 = pts[i][1];
    }
    return { x: Math.floor(x0), y: Math.floor(y0), w: Math.ceil(x1 - x0), h: Math.ceil(y1 - y0) };
  }

  function inside(x, y, pts) {
    var hit = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var yi = pts[i][1], yj = pts[j][1];
      var xi = pts[i][0], xj = pts[j][0];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-6) + xi)) hit = !hit;
    }
    return hit;
  }

  function shrink(pts, k) {
    var cx = 0, cy = 0;
    for (var i = 0; i < pts.length; i++) { cx += pts[i][0]; cy += pts[i][1]; }
    cx /= pts.length; cy /= pts.length;
    return pts.map(function (p) { return [cx + (p[0] - cx) * k, cy + (p[1] - cy) * k]; });
  }

  function face(c, r, cw, rw, z0, z1) {
    return {
      top: [project(c, r, z1), project(c + cw, r, z1), project(c + cw, r + rw, z1), project(c, r + rw, z1)],
      south: [project(c, r + rw, z1), project(c + cw, r + rw, z1), project(c + cw, r + rw, z0), project(c, r + rw, z0)],
      east: [project(c + cw, r, z1), project(c + cw, r + rw, z1), project(c + cw, r + rw, z0), project(c + cw, r, z0)]
    };
  }

  function prism(ctx, c, r, cw, rw, z0, z1, top, south, east) {
    var f = face(c, r, cw, rw, z0, z1);
    fillPoly(ctx, f.south, south);
    fillPoly(ctx, f.east, east);
    fillPoly(ctx, f.top, top);
    outline(ctx, f.south, darken(south, -32));
    outline(ctx, f.east, darken(east, -32));
    outline(ctx, f.top, darken(top, -36));
    line(ctx, f.top[0][0], f.top[0][1], f.top[1][0], f.top[1][1], darken(top, 28));
    line(ctx, f.top[0][0], f.top[0][1], f.top[3][0], f.top[3][1], darken(top, 16));
    return f;
  }

  function bricks(ctx, pts, a, b, mortar) {
    fillPoly(ctx, pts, a);
    var box = bounds(pts);
    for (var y = box.y; y <= box.y + box.h; y++) {
      for (var x = box.x; x <= box.x + box.w; x++) {
        if (!inside(x + 0.5, y + 0.5, pts)) continue;
        if (y % 5 === 0) {
          ctx.fillStyle = mortar;
          ctx.fillRect(x, y, 1, 1);
        } else if ((x + (Math.floor(y / 5) % 2) * 4) % 8 === 0) {
          ctx.fillStyle = (x + y) % 3 === 0 ? b : mortar;
          ctx.fillRect(x, y, 1, 1);
        } else if ((x * 3 + y * 5) % 17 === 0) {
          ctx.fillStyle = b;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    outline(ctx, pts, "#140e22");
  }

  function paintScreen(ctx, poly, kind, anim) {
    var inner = shrink(poly, 0.9);
    var bg = kind === "igor" ? "#15803d" : kind === "portfolio" ? "#5b21b6" : "#7c3aed";
    fillPoly(ctx, inner, bg);
    var box = bounds(inner);
    var shift = anim.on ? (anim.t % 6) : 1;
    for (var y = box.y; y <= box.y + box.h; y++) {
      for (var x = box.x; x <= box.x + box.w; x++) {
        if (!inside(x + 0.5, y + 0.5, inner)) continue;
        var row = y - box.y;
        var col = x - box.x;
        var color = null;
        if (kind === "portfolio") {
          var slice = Math.max(1, Math.floor((box.w + 1) / 3));
          var band = Math.min(2, Math.floor(col / slice));
          if (row > 2 && row < box.h - 1 && (col % slice) > 0 && (col % slice) < slice - 1) {
            color = ["#ddd6fe", "#fde68a", "#bbf7d0"][band];
            if ((row + shift) % 6 === 0) color = "#1e1b4b";
          }
        } else if (row >= 1 && row <= 2) {
          color = "#f8fafc";
        } else if (row > 3 && (row + shift) % 4 === 0 && col > 1 && col < box.w - 1) {
          color = kind === "igor" ? "#ecfccb" : "#fae8ff";
        } else if (row > 3 && col < 3) {
          color = "#0f172a";
        }
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }

  function circle(ctx, x, y, rad, color) {
    ctx.fillStyle = color;
    var r2 = rad * rad;
    for (var iy = -rad; iy <= rad; iy++) {
      var w = Math.floor(Math.sqrt(Math.max(0, r2 - iy * iy)));
      ctx.fillRect(Math.round(x) - w, Math.round(y) + iy, w * 2 + 1, 1);
    }
  }

  function drawFloor(ctx) {
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var rug = c >= 3 && c < 8 && r >= 4 && r < 8;
        var border = rug && (c === 3 || c === 7 || r === 4 || r === 7);
        var color;
        if (border) color = "#6d28d9";
        else if (rug) color = ((c + r) % 2 === 0) ? "#2a175c" : "#321c68";
        else {
          var plank = (r + (c % 5 === 0 ? 1 : 0)) % 2;
          color = plank ? "#e4c8a2" : "#d4b088";
          if ((c * 5 + r * 3) % 11 === 0) color = darken(color, -14);
          if (c < 1 || r < 1) color = darken(color, -18);
        }
        fillPoly(ctx, [
          project(c, r, 0), project(c + 1, r, 0), project(c + 1, r + 1, 0), project(c, r + 1, 0)
        ], color);
      }
    }
    for (var rr = 0; rr <= ROWS; rr++) {
      var a = project(0, rr, 0), b = project(COLS, rr, 0);
      line(ctx, a[0], a[1], b[0], b[1], "#8a6844");
    }
    for (var pr = 0; pr < ROWS; pr++) {
      if (pr >= 4 && pr < 8) continue;
      var off = (pr % 2) * 2;
      for (var pc = off; pc <= COLS; pc += 4) {
        var p0 = project(pc, pr, 0), p1 = project(pc, pr + 1, 0);
        line(ctx, p0[0], p0[1], p1[0], p1[1], "#9a784e");
      }
    }
    outline(ctx, [project(0, 0, 0), project(COLS, 0, 0), project(COLS, ROWS, 0), project(0, ROWS, 0)], "#5c4128");
  }

  function drawWalls(ctx, anim) {
    var left = [project(0, 0, WALL), project(0, ROWS, WALL), project(0, ROWS, 0), project(0, 0, 0)];
    var right = [project(0, 0, WALL), project(COLS, 0, WALL), project(COLS, 0, 0), project(0, 0, 0)];
    bricks(ctx, right, "#3c315f", "#4d4178", "#1a1430");
    bricks(ctx, left, "#2c2348", "#3a305c", "#120e22");
    fillPoly(ctx, [project(-0.42, 0, WALL), project(0, 0, WALL), project(0, ROWS, WALL), project(-0.42, ROWS, WALL)], "#6d5a9a");
    fillPoly(ctx, [project(0, -0.42, WALL), project(COLS, -0.42, WALL), project(COLS, 0, WALL), project(0, 0, WALL)], "#7c6aaa");
    fillPoly(ctx, [project(0, ROWS, WALL), project(-0.42, ROWS, WALL), project(-0.42, ROWS, 0), project(0, ROWS, 0)], "#241c3e");
    fillPoly(ctx, [project(COLS, 0, WALL), project(COLS, -0.42, WALL), project(COLS, -0.42, 0), project(COLS, 0, 0)], "#2e264c");
    line(ctx, project(0, 0, WALL)[0], project(0, 0, WALL)[1], project(0, ROWS, WALL)[0], project(0, ROWS, WALL)[1], "#c4b5fd");
    line(ctx, project(0, 0, WALL)[0], project(0, 0, WALL)[1], project(COLS, 0, WALL)[0], project(COLS, 0, WALL)[1], "#ddd6fe");

    poster(ctx, 0, 0.35, 1.55, 46, 68, "#140c28", function (box) {
      circle(ctx, box.x + box.w * 0.5, box.y + box.h * 0.52, 7, "#a855f7");
      circle(ctx, box.x + box.w * 0.5, box.y + box.h * 0.52, 4, "#140c28");
      circle(ctx, box.x + box.w * 0.5, box.y + box.h * 0.52, 2, "#e9d5ff");
    });
    poster(ctx, 0, 3.15, 4.35, 40, 62, "#1a1030", function (box) {
      for (var i = 0; i < 4; i++) {
        var h = 4 + ((i * 3) % 5) * 2;
        ctx.fillStyle = i % 2 ? "#22c55e" : "#a855f7";
        ctx.fillRect(box.x + 3 + i * 4, box.y + box.h - 3 - h, 3, h);
      }
    });
    drawWindow(ctx, anim);
    drawClock(ctx, anim);
  }

  function poster(ctx, c, r0, r1, z0, z1, frame, paint) {
    var outer = [project(c, r0, z1), project(c, r1, z1), project(c, r1, z0), project(c, r0, z0)];
    fillPoly(ctx, outer, frame);
    outline(ctx, outer, "#0b0616");
    var inner = shrink(outer, 0.82);
    fillPoly(ctx, inner, "#22183f");
    paint(bounds(inner), inner);
  }

  function drawWindow(ctx, anim) {
    var outer = [project(5.15, 0, 66), project(7.15, 0, 66), project(7.15, 0, 34), project(5.15, 0, 34)];
    fillPoly(ctx, outer, "#1b1430");
    var sky = shrink(outer, 0.86);
    fillPoly(ctx, sky, "#12183a");
    var box = bounds(sky);
    var moonX = box.x + 7;
    var moonY = box.y + 6 + (anim.on ? (anim.t % 10 > 6 ? 0 : 0) : 0);
    circle(ctx, moonX, moonY, 3, "#f8e7c4");
    ctx.fillStyle = "#dbe7ff";
    [[box.x + box.w - 6, box.y + 3], [box.x + 4, box.y + box.h - 8], [box.x + box.w - 10, box.y + 12]].forEach(function (s) {
      if (inside(s[0], s[1], sky)) ctx.fillRect(s[0], s[1], 1, 1);
    });
    for (var i = 0; i < 6; i++) {
      var bh = 3 + (i % 3) * 2;
      ctx.fillStyle = i % 2 ? "#4c1d95" : "#1e1b4b";
      var bx = box.x + 2 + i * 4;
      var by = box.y + box.h - bh;
      for (var yy = 0; yy < bh; yy++) {
        for (var xx = 0; xx < 3; xx++) {
          if (inside(bx + xx, by + yy, sky)) ctx.fillRect(bx + xx, by + yy, 1, 1);
        }
      }
    }
    var mid = project(6.15, 0, 50);
    line(ctx, mid[0], sky[0][1], mid[0], sky[2][1], "#c4b5fd");
    outline(ctx, sky, "#d6ccff");
  }

  function drawClock(ctx, anim) {
    var center = project(1.15, 0, 56);
    circle(ctx, center[0], center[1], 6, "#f4efe4");
    circle(ctx, center[0], center[1], 5, "#1e1b4b");
    var ang = anim.on ? (anim.t % 16) / 16 * Math.PI * 2 : -Math.PI / 2;
    for (var i = 0; i < 4; i++) {
      ctx.fillStyle = "#f8f5ff";
      ctx.fillRect(Math.round(center[0] + Math.cos(ang) * i), Math.round(center[1] + Math.sin(ang) * i * 0.6), 1, 1);
    }
    ctx.fillStyle = "#c4b5fd";
    ctx.fillRect(Math.round(center[0]), Math.round(center[1]), 1, 1);
  }

  function monitor(ctx, c, r, z, kind, anim) {
    prism(ctx, c + 0.35, r + 0.08, 0.16, 0.16, z, z + 4, "#6b6580", "#3f3a52", "#514c66");
    var f = prism(ctx, c, r, 1.15, 0.28, z + 4, z + 18, "#2a2640", "#151226", "#221c38");
    paintScreen(ctx, f.south, kind, anim);
  }

  function keyboard(ctx, c, r, z) {
    prism(ctx, c, r, 0.95, 0.32, z, z + 1.6, "#2a243c", "#1a1628", "#221c34");
    for (var i = 0; i < 4; i++) {
      var p = project(c + 0.14 + i * 0.2, r + 0.16, z + 1.8);
      ctx.fillStyle = "#6d6788";
      ctx.fillRect(Math.round(p[0]), Math.round(p[1]), 2, 1);
    }
  }

  function mug(ctx, c, r, z) {
    prism(ctx, c, r, 0.28, 0.28, z, z + 4, "#f3e6d0", "#c4a484", "#ddc2a4");
    var top = project(c + 0.14, r + 0.14, z + 4);
    ctx.fillStyle = "#6b3a22";
    ctx.fillRect(Math.round(top[0]) - 1, Math.round(top[1]), 3, 2);
  }

  function plant(ctx, c, r, anim, scale) {
    var sway = anim.on && (Math.floor(anim.t / 3) % 2) ? 1 : 0;
    prism(ctx, c, r, 0.55 * scale, 0.55 * scale, 0, 5 * scale, "#8d5a32", "#5c3a22", "#704628");
    var foot = project(c + 0.28 * scale, r + 0.28 * scale, 5 * scale);
    var x = Math.round(foot[0]) + sway;
    var y = Math.round(foot[1]);
    circle(ctx, x - 4, y - 8, 5, "#166534");
    circle(ctx, x + 4, y - 9, 4, "#16a34a");
    circle(ctx, x, y - 13, 5, "#22c55e");
    circle(ctx, x + 1, y - 7, 3, "#15803d");
    ctx.fillStyle = "#14532d";
    ctx.fillRect(x, y - 6, 1, 5);
  }

  function person(ctx, x, y, who, anim) {
    var bob = anim.on && anim.bob ? 1 : 0;
    var by = Math.round(y) - bob;
    var bx = Math.round(x);
    ctx.fillStyle = "rgba(12,8,16,.45)";
    ctx.fillRect(bx - 8, Math.round(y) - 1, 16, 3);
    var shirt = who === "alex" ? "#7c3aed" : "#f8f7ff";
    var shirtHi = who === "alex" ? "#c4b5fd" : "#ffffff";
    var pants = who === "alex" ? "#1e1638" : "#1e1b4b";
    var hair = who === "alex" ? "#1a1028" : "#f0d7a4";
    ctx.fillStyle = "#120c18";
    ctx.fillRect(bx - 7, by - 5, 5, 3);
    ctx.fillRect(bx + 2, by - 5, 5, 3);
    ctx.fillStyle = pants;
    ctx.fillRect(bx - 7, by - 14, 5, 9);
    ctx.fillRect(bx + 2, by - 14, 5, 9);
    ctx.fillStyle = shirt;
    ctx.fillRect(bx - 8, by - 27, 16, 13);
    ctx.fillStyle = shirtHi;
    ctx.fillRect(bx - 7, by - 27, 14, 2);
    ctx.fillStyle = who === "alex" ? "#4c1d95" : "#e0e7ff";
    ctx.fillRect(bx - 10, by - 25, 3, 9);
    ctx.fillRect(bx + 7, by - 25, 3, 9);
    ctx.fillStyle = "#f3c7a6";
    ctx.fillRect(bx - 5, by - 38, 10, 11);
    ctx.fillStyle = hair;
    ctx.fillRect(bx - 6, by - 42, 12, 6);
    ctx.fillRect(bx - 6, by - 38, 2, who === "alex" ? 7 : 3);
    ctx.fillRect(bx + 4, by - 38, 2, who === "alex" ? 4 : 3);
    if (who === "igor") {
      ctx.fillStyle = "#d6b48a";
      ctx.fillRect(bx - 4, by - 30, 8, 2);
    }
    if (!anim.blink) {
      ctx.fillStyle = "#140c18";
      ctx.fillRect(bx - 3, by - 34, 2, 2);
      ctx.fillRect(bx + 2, by - 34, 2, 2);
      if (who === "igor") {
        ctx.fillStyle = "#67e8f9";
        ctx.fillRect(bx - 4, by - 34, 4, 1);
        ctx.fillRect(bx + 1, by - 34, 4, 1);
      }
    } else {
      ctx.fillStyle = "#e7b89a";
      ctx.fillRect(bx - 3, by - 33, 2, 1);
      ctx.fillRect(bx + 2, by - 33, 2, 1);
    }
    anchors.push({ id: who, x: bx, y: by - 46 });
  }

  function robot(ctx, x, y, anim) {
    var bob = anim.on ? (anim.t % 4 < 2 ? 2 : 0) : 0;
    var bx = Math.round(x);
    var by = Math.round(y) - bob;
    ctx.fillStyle = "rgba(12,8,16,.4)";
    ctx.fillRect(bx - 8, Math.round(y), 16, 3);
    ctx.fillStyle = "#6d28d9";
    ctx.fillRect(bx - 6, by - 6, 5, 4);
    ctx.fillRect(bx + 1, by - 6, 5, 4);
    ctx.fillStyle = "#ddd6fe";
    ctx.fillRect(bx - 8, by - 22, 16, 16);
    ctx.fillStyle = "#1e1b4b";
    ctx.fillRect(bx - 6, by - 19, 12, 8);
    ctx.fillStyle = anim.on && anim.t % 8 > 5 ? "#f5d0fe" : "#d946ef";
    ctx.fillRect(bx - 4, by - 17, 3, 3);
    ctx.fillRect(bx + 2, by - 17, 3, 3);
    ctx.fillStyle = "#a78bfa";
    ctx.fillRect(bx - 1, by - 28, 2, 6);
    ctx.fillStyle = "#f0abfc";
    ctx.fillRect(bx - 3, by - 31, 6, 4);
    ctx.fillStyle = "#4c1d95";
    ctx.fillRect(bx - 11, by - 16, 3, 8);
    ctx.fillRect(bx + 8, by - 16, 3, 8);
    anchors.push({ id: "robot", x: bx, y: by - 36 });
  }

  function drawScene(ctx, anim) {
    anchors = [];
    ctx.fillStyle = "#100a22";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    drawWalls(ctx, anim);
    drawFloor(ctx);

    var items = [];
    function add(depth, fn) { items.push({ depth: depth, fn: fn }); }
    function mid(c, r, cw, rw) { return c + cw / 2 + r + rw / 2; }

    add(mid(0.2, 0.85, 0.85, 2.3), function () {
      prism(ctx, 0.2, 0.85, 0.85, 2.3, 0, 28, "#4c3d78", "#2a2048", "#3a2d60");
      var colors = ["#a855f7", "#22c55e", "#e7c99a", "#6366f1", "#f472b6", "#f8fafc", "#7c3aed", "#0ea5e9"];
      var heights = [12, 16, 11, 15, 13, 10, 14, 12];
      for (var b = 0; b < 8; b++) {
        var bh = heights[b];
        prism(ctx, 0.32, 0.98 + b * 0.26, 0.5, 0.22, 28, 28 + bh, darken(colors[b], 20), colors[b], darken(colors[b], -15));
      }
    });

    add(mid(0.25, 4.35, 0.7, 2.5), function () {
      prism(ctx, 0.25, 4.35, 0.9, 2.5, 0, 12, "#5b4b86", "#2e254c", "#3d3264");
      var f = prism(ctx, 0.42, 4.5, 0.42, 2.2, 12, 32, "#221c38", "#100c1e", "#1a1430");
      paintScreen(ctx, f.east, "portfolio", anim);
      prism(ctx, 1.05, 6.5, 0.45, 0.45, 0, 8, "#d7b48a", "#8d6240", "#b48355");
    });

    add(mid(0.4, 7.7, 0.2, 0.2), function () { plant(ctx, 0.35, 7.55, anim, 1.15); });

    add(mid(1.7, 0.2, 3.5, 1.45), function () {
      prism(ctx, 1.7, 0.2, 3.5, 1.45, 0, 14, "#e6c79a", "#a36d3e", "#c99558");
      monitor(ctx, 1.9, 0.32, 14, "alex", anim);
      keyboard(ctx, 3.15, 0.85, 14);
      mug(ctx, 4.55, 0.4, 14);
      var note = project(4.7, 1.15, 15);
      ctx.fillStyle = "#fde68a";
      ctx.fillRect(Math.round(note[0]), Math.round(note[1]), 5, 4);
    });
    add(mid(2.55, 1.75, 1.15, 1.05), function () {
      prism(ctx, 2.7, 2.15, 0.18, 0.18, 0, 7, "#4c1d95", "#3b0764", "#5b21b6");
      prism(ctx, 3.55, 2.15, 0.18, 0.18, 0, 7, "#4c1d95", "#3b0764", "#5b21b6");
      prism(ctx, 2.55, 1.75, 1.15, 1.05, 7, 11, "#3b0764", "#2e1064", "#4c1d95");
      prism(ctx, 2.55, 1.75, 1.15, 0.22, 11, 18, "#2e1064", "#3b0764", "#4c1d95");
    });

    add(mid(7.15, 0.2, 3.4, 1.45), function () {
      prism(ctx, 7.15, 0.2, 3.4, 1.45, 0, 14, "#efd0a6", "#a36d3e", "#d0a066");
      monitor(ctx, 8.55, 0.32, 14, "igor", anim);
      keyboard(ctx, 7.4, 0.85, 14);
      mug(ctx, 7.35, 0.38, 14);
    });
    add(mid(8.15, 1.75, 1.15, 1.05), function () {
      prism(ctx, 8.3, 2.15, 0.18, 0.18, 0, 7, "#334155", "#1e293b", "#475569");
      prism(ctx, 9.15, 2.15, 0.18, 0.18, 0, 7, "#334155", "#1e293b", "#475569");
      prism(ctx, 8.15, 1.75, 1.15, 1.05, 7, 11, "#334155", "#1e293b", "#475569");
      prism(ctx, 8.15, 1.75, 1.15, 0.22, 11, 18, "#334155", "#1e293b", "#475569");
    });

    add(mid(10.55, 0.35, 1.2, 1.15), function () {
      prism(ctx, 10.55, 0.35, 1.2, 1.15, 0, 16, "#4c1d95", "#3b0764", "#5b21b6");
      prism(ctx, 10.7, 0.5, 0.85, 0.7, 16, 24, "#1e1b4b", "#312e81", "#3730a3");
      var cup = project(11.05, 1.15, 17);
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(Math.round(cup[0]), Math.round(cup[1]), 3, 3);
      var steamX = Math.round(cup[0]) + 1;
      var steamY = Math.round(cup[1]) - 2;
      var rise = anim.on ? anim.t % 7 : 2;
      ctx.fillStyle = "rgba(255,255,255,.85)";
      ctx.fillRect(steamX, steamY - rise, 1, 1);
      ctx.fillRect(steamX + 2, steamY - ((rise + 3) % 7), 1, 1);
      ctx.fillStyle = "rgba(226,232,240,.7)";
      ctx.fillRect(steamX + 1, steamY - ((rise + 5) % 7), 1, 1);
    });

    add(mid(3.5, 4.55, 2.3, 1.7), function () {
      prism(ctx, 3.7, 5.55, 0.16, 0.16, 0, 8, "#a36d3e", "#6b4423", "#8d5a32");
      prism(ctx, 5.45, 5.55, 0.16, 0.16, 0, 8, "#a36d3e", "#6b4423", "#8d5a32");
      prism(ctx, 3.7, 4.7, 0.16, 0.16, 0, 8, "#a36d3e", "#6b4423", "#8d5a32");
      prism(ctx, 5.45, 4.7, 0.16, 0.16, 0, 8, "#a36d3e", "#6b4423", "#8d5a32");
      prism(ctx, 3.5, 4.55, 2.3, 1.7, 8, 12, "#e7c49a", "#a36d3e", "#c99558");
      mug(ctx, 3.85, 4.85, 12);
      mug(ctx, 5.15, 5.15, 12);
      prism(ctx, 4.45, 5.55, 0.55, 0.4, 12, 14, "#6d28d9", "#4c1d95", "#7c3aed");
    });

    add(mid(3.35, 6.45, 3.6, 1.45), function () {
      prism(ctx, 3.35, 6.45, 3.6, 1.45, 0, 10, "#8b5cf6", "#4c1d95", "#6d28d9");
      prism(ctx, 3.35, 6.45, 3.6, 0.32, 10, 24, "#ddd6fe", "#6d28d9", "#a78bfa");
      prism(ctx, 3.35, 6.45, 0.42, 1.45, 10, 18, "#c4b5fd", "#5b21b6", "#8b5cf6");
      prism(ctx, 6.53, 6.45, 0.42, 1.45, 10, 18, "#c4b5fd", "#5b21b6", "#8b5cf6");
      prism(ctx, 4.15, 6.9, 0.9, 0.75, 10, 14, "#f8fafc", "#c4b5fd", "#ede9fe");
      prism(ctx, 5.35, 6.95, 0.9, 0.7, 10, 14, "#22c55e", "#166534", "#4ade80");
    });

    add(mid(7.55, 6.7, 1.3, 1.05), function () { plant(ctx, 7.55, 6.85, anim, 1); });
    add(mid(9.35, 6.15, 0.2, 0.2), function () {
      var foot = project(9.45, 6.35, 0);
      robot(ctx, foot[0], foot[1], anim);
    });

    add(mid(3.7, 3.2, 0.2, 0.2), function () {
      var foot = project(3.7, 3.25, 0);
      person(ctx, foot[0], foot[1], "alex", anim);
    });
    add(mid(8.85, 3.2, 0.2, 0.2), function () {
      var foot = project(8.85, 3.25, 0);
      person(ctx, foot[0], foot[1], "igor", anim);
    });

    items.sort(function (a, b) { return a.depth - b.depth; });
    for (var n = 0; n < items.length; n++) items[n].fn();

    var hot = hover || selected;
    if (hot && ZONES[hot]) {
      var z = ZONES[hot];
      var poly = [project(z.c, z.r, 2), project(z.c + z.cw, z.r, 2), project(z.c + z.cw, z.r + z.rw, 2), project(z.c, z.r + z.rw, 2)];
      outline(ctx, poly, "#f5f3ff");
      var inner = shrink(poly, 0.96);
      outline(ctx, inner, "#c4b5fd");
    }
  }

  function animState() {
    var on = playing && !reducedQueryOff();
    return {
      on: on,
      t: on ? tick : 0,
      bob: on && (Math.floor(tick / 4) % 2 === 1),
      blink: on && (tick % 24) > 21
    };
  }

  function reducedQueryOff() {
    return reduced && !playing;
  }

  function paint() {
    if (!screenCtx) return;
    drawScene(screenCtx, animState());
    if (texture && texture.source && texture.source[0] && texture.source[0].update) texture.source[0].update();
    placeLabels();
  }

  function placeLabels() {
    if (!game || !game.canvas) return;
    var canvas = game.canvas;
    var wrap = document.querySelector(".stage-wrap");
    if (!wrap) return;
    var cr = canvas.getBoundingClientRect();
    var wr = wrap.getBoundingClientRect();
    anchors.forEach(function (a) {
      var el = document.getElementById("label-" + a.id);
      if (!el) return;
      el.style.left = (cr.left - wr.left) + (a.x / WIDTH) * cr.width + "px";
      el.style.top = (cr.top - wr.top) + (a.y / HEIGHT) * cr.height + "px";
    });
  }

  function hitTest(x, y) {
    var order = ["talk", "portfolio", "igor", "alex"];
    var found = null;
    var best = -1;
    order.forEach(function (id) {
      var z = ZONES[id];
      var poly = [project(z.c, z.r, 2), project(z.c + z.cw, z.r, 2), project(z.c + z.cw, z.r + z.rw, 2), project(z.c, z.r + z.rw, 2)];
      var depth = z.c + z.r + z.cw + z.rw;
      if (inside(x, y, poly) && depth >= best) {
        best = depth;
        found = id;
      }
    });
    return found;
  }

  function showTip(id) {
    var zone = ZONES[id];
    var eye = document.getElementById("tip-eye");
    var title = document.getElementById("tip-title");
    var text = document.getElementById("tip-text");
    var link = document.getElementById("tip-link");
    if (!zone || !eye || !title || !text || !link) return;
    eye.textContent = zone.eye;
    title.textContent = zone.title;
    text.textContent = zone.text;
    link.href = zone.href;
    link.textContent = zone.link;
    link.hidden = false;
    document.querySelectorAll("[data-zone]").forEach(function (el) {
      if (el.getAttribute("data-zone") === id) el.setAttribute("aria-current", "true");
      else el.removeAttribute("aria-current");
    });
  }

  function selectZone(id, repaintNow) {
    if (!ZONES[id]) return;
    selected = id;
    hover = id;
    showTip(id);
    if (repaintNow) paint();
  }

  function boot() {
    if (!window.Phaser) {
      showFallback("Сцена не загрузилась. Разделы ниже всё равно открываются.");
      return;
    }
    screenCanvas = document.createElement("canvas");
    screenCanvas.width = WIDTH;
    screenCanvas.height = HEIGHT;
    screenCtx = screenCanvas.getContext("2d", { alpha: false });
    screenCtx.imageSmoothingEnabled = false;
    paint();

    var params = new URLSearchParams(location.search);
    var forced = params.get("renderer");
    var probe = document.createElement("canvas");
    var gl = null;
    try { gl = probe.getContext("webgl") || probe.getContext("experimental-webgl"); } catch (err) { gl = null; }
    var type = Phaser.AUTO;
    if (forced === "canvas" || !gl) type = Phaser.CANVAS;
    else if (forced === "webgl") type = Phaser.WEBGL;

    try {
      game = new Phaser.Game({
        type: type,
        parent: "studio-stage",
        width: WIDTH,
        height: HEIGHT,
        backgroundColor: "#100a22",
        pixelArt: true,
        roundPixels: true,
        banner: false,
        audio: { noAudio: true, disableWebAudio: true },
        disableContextMenu: true,
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        scene: {
          create: function () {
            texture = this.textures.addCanvas("room", screenCanvas);
            this.add.image(0, 0, "room").setOrigin(0, 0);
            paint();
            var self = this;
            this.input.on("pointermove", function (p) {
              var id = hitTest(p.worldX, p.worldY);
              if (game && game.canvas) game.canvas.style.cursor = id ? "pointer" : "default";
              if (id !== hover) {
                hover = id || selected;
                if (id) showTip(id);
                paint();
              }
            });
            this.input.on("pointerdown", function (p) {
              var id = hitTest(p.worldX, p.worldY);
              if (id) selectZone(id, true);
            });
            var stage = document.getElementById("studio-stage");
            if (stage) {
              stage.dataset.ready = "1";
              stage.dataset.renderer = this.game.renderer.type === Phaser.WEBGL ? "webgl" : "canvas";
            }
            if (game.canvas) game.canvas.tabIndex = -1;
            window.addEventListener("resize", placeLabels);
          },
          update: function () {
            if (!(playing && !reducedQueryOff())) return;
            tick += 1;
            if (tick % 8 === 0) paint();
          }
        }
      });
    } catch (err) {
      showFallback("Сцена не включилась. Разделы ниже всё равно открываются.");
    }
  }

  function bindUi() {
    document.querySelectorAll("[data-zone]").forEach(function (el) {
      var id = el.getAttribute("data-zone");
      el.addEventListener("mouseenter", function () { selectZone(id, true); });
      el.addEventListener("focus", function () { selectZone(id, true); });
    });
    var pause = document.getElementById("pause");
    var note = document.getElementById("motion-note");
    function syncPause() {
      if (!pause) return;
      var moving = playing && !reducedQueryOff();
      pause.setAttribute("aria-pressed", moving ? "false" : "true");
      pause.textContent = moving ? "Пауза" : "Дальше";
      document.documentElement.dataset.motion = moving ? "on" : "off";
      if (note) {
        note.textContent = reduced && !playing
          ? "В системе включено уменьшение движения, сцена стоит. Кнопка запускает короткие движения."
          : (moving ? "Короткие движения на местах: моргание, пар, экран." : "Движение на паузе. Нажимать зоны можно.");
      }
    }
    if (pause) {
      pause.addEventListener("click", function () {
        playing = !playing;
        if (playing && reduced) reduced = false;
        syncPause();
        paint();
      });
    }
    syncPause();
    var stage = document.getElementById("studio-stage");
    if (stage) stage.dataset.motion = document.documentElement.dataset.motion || "";
  }

  document.addEventListener("DOMContentLoaded", function () {
    bindUi();
    boot();
    setTimeout(function () {
      var stage = document.getElementById("studio-stage");
      if (!stage || !stage.dataset.ready) showFallback("Сцена не включилась. Разделы ниже всё равно открываются.");
    }, 2500);
  });

  window.LeadStudio = {
    select: function (id) { selectZone(id, true); },
    centers: function () {
      return Object.keys(ZONES).map(function (id) {
        var z = ZONES[id];
        var p = project(z.c + z.cw / 2, z.r + z.rw / 2, 2);
        return { id: id, x: p[0], y: p[1] };
      });
    }
  };
})();
