/* sr-sonar.js — 4D tesseract sonar over the Sydney stress field.
   Pitch Black Industries / Shadow.Black appendix VII. No dependencies.
   Renders a rotating 4D hypercube (stereographic projection), eight precinct
   beacons and a sonar heat field in one WebGL canvas. Falls back to a CSS
   sonar if WebGL is unavailable. */
(function () {
  "use strict";

  var box = document.getElementById("sr-sonar-box");
  var stage = document.getElementById("sr-stage");
  var canvas = document.getElementById("sr-canvas");
  if (!box || !stage || !canvas) return;

  var reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  /* ---------- data: eight precincts, same order as the board ---------- */
  var NODES = [
    { short: "SYD CBD",   x: 2.30, z: -0.51, heat: 0.94,
      title: "Sydney CBD core — premium / A-grade",
      inst: "Net yield ~6.13% vs 5.43% 10Y ACGB (+70bp). Senior debt near 6.65% means negative leverage; a −20% to −24% write-down restores a 200bp premium.",
      fast: "Safe bonds pay 5.4%, towers pay 6.1%. Nobody takes tower risk for 0.7%. Prices must fall 20%+ before the maths works." },
    { short: "ROCKDALE",  x: 1.39, z: 1.40, heat: 0.88,
      title: "Rockdale TOD — T4 Illawarra spine",
      inst: "Measured −8.9% cumulative (−17.4% annualised). TOD SEPP uplift (FSR 3:1+) meets 15–18% private-credit facilities and zero presale velocity.",
      fast: "Upzoned station blocks, held by builders who cannot refinance shadow loans. Hunt 65–70c forced sales." },
    { short: "KOGARAH",   x: 1.14, z: 1.81, heat: 0.80,
      title: "Kogarah — health & rail hub",
      inst: "Measured −8.2% cumulative. St George Hospital and the T4 anchor 5.0%+ gross yields while boutique syndicates face Q4 redemption gates.",
      fast: "Hospital and rail keep the rent flowing while busted builders sell sites cheap." },
    { short: "MARRICKVILLE", x: 0.99, z: 0.51, heat: 0.76,
      title: "Marrickville Metro — inner west",
      inst: "Measured −7.4% cumulative. Southwest Metro upzoning against Q4 mezzanine refinancing walls in mixed-use amalgamations.",
      fast: "Metro makes the land gold in ten years. Small syndicates are forced sellers today." },
    { short: "MASCOT / GSQ", x: 2.00, z: 0.62, heat: 0.96,
      title: "Mascot / Green Square — high density",
      inst: "Measured −11.2% cumulative (−22.5% annualised). Unit oversupply plus investor offloading ahead of the 1 July 2027 tax changes (200–270bp equivalent).",
      fast: "Cookie-cutter towers and an exit race before the tax rules change. Stay clear." },
    { short: "PARRAMATTA", x: -2.30, z: -0.56, heat: 0.95,
      title: "Parramatta CBD — western core",
      inst: "A-grade near 7.15% cap with 21.4% vacancy; epicentre of the August 2026 $3.4bn developer collapse.",
      fast: "Half-empty offices and busted sites. The play is distressed senior debt at a deep discount — or nothing." },
    { short: "CHATSWOOD", x: 1.74, z: -1.81, heat: 0.68,
      title: "Chatswood / Macquarie — north shore spine",
      inst: "Measured −7.8% cumulative. $22,000+/sqm break-evens freeze new starts despite strong downsizer equity.",
      fast: "Blue-chip location, insane construction costs. Wait for another 8–10% off the land." },
    { short: "BANKSTOWN", x: -1.10, z: 0.81, heat: 0.91,
      title: "Bankstown — Metro terminal TOD",
      inst: "Measured −9.6% cumulative (−19.1% annualised). Mortgage-belt sensitivity at 4.60% cash; non-bank arrears climbing into Metro-terminal upzoning.",
      fast: "2026's rate hikes bite hardest here. Watch for mortgagee sales on the corner blocks." }
  ];

  var REGIMES = [
    "Q1 2026 — PEAK PRICING, PRE-HIKE",
    "MAY 2026 — BUDGET TAX SHOCK",
    "AUG 2026 — $3.4BN COLLAPSE",
    "Q4 2026 — CREDIT FREEZE",
    "2027 — DISTRESSED CLEARING"
  ];

  /* ---------- readout wiring (works even without WebGL) ---------- */
  var elPills = document.getElementById("sr-pills");
  var elInstCode = document.getElementById("sr-inst-code");
  var elInstTitle = document.getElementById("sr-inst-title");
  var elInstTxt = document.getElementById("sr-inst-txt");
  var elFastTitle = document.getElementById("sr-fast-title");
  var elFastTxt = document.getElementById("sr-fast-txt");
  var elPhase = document.getElementById("sr-phase");
  var elRegime = document.getElementById("sr-regime");
  var elW = document.getElementById("sr-w");
  var boardRows = Array.prototype.slice.call(document.querySelectorAll("#sr-board .sr-prow"));
  var selected = 1;
  var wPhase = 3.0;

  var pills = [];
  NODES.forEach(function (n, i) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "sr-pill" + (i === selected ? " active" : "");
    b.textContent = ("0" + (i + 1)).slice(-2) + " · " + n.short;
    b.addEventListener("click", function () { select(i, true); });
    if (elPills) elPills.appendChild(b);
    pills.push(b);
  });

  function select(i, fromUI) {
    selected = i;
    var n = NODES[i];
    if (elInstCode) elInstCode.textContent = "NODE " + ("0" + (i + 1)).slice(-2) + " — " + n.short;
    if (elInstTitle) elInstTitle.textContent = n.title;
    if (elInstTxt) elInstTxt.textContent = n.inst;
    if (elFastTitle) elFastTitle.textContent = n.title;
    if (elFastTxt) elFastTxt.textContent = n.fast;
    pills.forEach(function (p, j) { p.classList.toggle("active", j === i); });
    boardRows.forEach(function (r) {
      r.classList.toggle("active", parseInt(r.getAttribute("data-i"), 10) === i);
    });
    if (reduced) renderOnce();
  }

  boardRows.forEach(function (r) {
    var i = parseInt(r.getAttribute("data-i"), 10);
    r.addEventListener("click", function () { select(i, true); });
    r.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(i, true); }
    });
  });

  function regimeLabel() {
    var v = parseFloat(elW && elW.value || "300");
    var idx = Math.min(REGIMES.length - 1, Math.floor((v / 628) * REGIMES.length));
    return { idx: idx, label: REGIMES[idx] };
  }

  function syncScrub() {
    wPhase = parseFloat(elW && elW.value || "300") / 100;
    var r = regimeLabel();
    if (elRegime) elRegime.textContent = r.label;
    if (elPhase) elPhase.innerHTML = "W-PHASE <b>" + wPhase.toFixed(2) + "</b> RAD · <b>" + r.label + "</b>";
  }
  if (elW) {
    elW.addEventListener("input", function () { syncScrub(); if (reduced) renderOnce(); });
  }

  select(selected, false);
  syncScrub();

  /* ---------- WebGL ---------- */
  var gl = null;
  var dbgPdb = /[?&]pdb/.test(location.search);
  try {
    gl = canvas.getContext("webgl", { antialias: true, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: dbgPdb })
      || canvas.getContext("experimental-webgl", { antialias: true, alpha: false });
  } catch (e) { gl = null; }
  if (!gl) { (window.__srLog = window.__srLog || []).push("no webgl context"); box.classList.add("sr-nogl"); return; }

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      var _msg = "shader " + (type === gl.VERTEX_SHADER ? "VS" : "FS") + ": " + gl.getShaderInfoLog(s);
      (window.__srLog = window.__srLog || []).push(_msg);
      if (window.console && console.warn) console.warn("sr-sonar", _msg);
      return null;
    }
    return s;
  }
  function program(vsSrc, fsSrc) {
    var vs = compile(gl.VERTEX_SHADER, vsSrc);
    var fs = compile(gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) return null;
    var p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      var _lmsg = "link: " + gl.getProgramInfoLog(p);
      (window.__srLog = window.__srLog || []).push(_lmsg);
      if (window.console && console.warn) console.warn("sr-sonar", _lmsg);
      return null;
    }
    return p;
  }

  /* --- field program: fullscreen triangle + heat field --- */
  var fieldProgram = program(
    "attribute vec2 aPos; varying vec2 vUv;" +
    "void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.0,1.0); }",
    "precision mediump float;" +
    "varying vec2 vUv; uniform vec2 uRes; uniform float uTime; uniform float uW; uniform float uSel;" +
    "uniform vec3 uNodes[8];" +
    "void main(){" +
    "  vec2 p = vUv; vec2 d = (p - 0.5) * vec2(uRes.x/uRes.y, 1.0);" +
    "  float dist0 = length(d);" +
    "  float mask = smoothstep(1.2, 0.3, length((p - 0.5) * 1.9));" +
    "  float heat = 0.0; float heatSel = 0.0;" +
    "  for (int i = 0; i < 8; i++){" +
    "    vec2 n = (uNodes[i].xy - 0.5) * vec2(uRes.x/uRes.y, 1.0);" +
    "    float dd = length(d - n);" +
    "    heat += uNodes[i].z * exp(-dd*dd*7.0);" +
    "    if (abs(float(i) - uSel) < 0.5) { heatSel = exp(-dd*dd*9.0) * (0.75 + 0.25*sin(uTime*4.0)); }" +
    "  }" +
    "  float stress = 0.8 + 0.45*uW;" +
    "  heat *= stress;" +
    "  float rings = sin(dist0*34.0 - uTime*2.1);" +
    "  rings = smoothstep(0.62, 1.0, rings) * smoothstep(1.05, 0.08, dist0);" +
    "  float ang = atan(d.y, d.x);" +
    "  float sweep = fract(ang/6.2831853 - uTime*0.055);" +
    "  sweep = smoothstep(0.955, 1.0, sweep) * smoothstep(1.1, 0.1, dist0);" +
    "  vec2 g = abs(fract(p*vec2(44.0,25.0)) - 0.5);" +
    "  float grid = 1.0 - smoothstep(0.0, 0.045, min(g.x, g.y));" +
    "  vec3 col = mix(vec3(0.016), vec3(0.043), mask);" +
    "  vec3 gold = vec3(0.784, 0.643, 0.298);" +
    "  vec3 bone = vec3(0.984, 0.976, 0.945);" +
    "  col += gold * (0.45 * smoothstep(0.25, 1.5, heat));" +
    "  col += bone * (0.24 * smoothstep(0.75, 2.2, heat));" +
    "  col += bone * rings * 0.13;" +
    "  col += gold * sweep * 0.16;" +
    "  col += bone * grid * 0.04 * (0.35 + 0.65*mask);" +
    "  col += gold * heatSel * 0.50;" +
    "  float vig = smoothstep(1.35, 0.25, length(d));" +
    "  col *= 0.60 + 0.40*vig;" +
    "  col += vec3(0.5,0.9,0.86) * 0.0;" +
    "  gl_FragColor = vec4(col, 1.0);" +
    "}"
  );

  /* --- geometry program: lines and glow points --- */
  var geomProgram = program(
    "attribute vec3 aPos; attribute vec4 aCol; attribute float aSize;" +
    "uniform mat4 uVP; uniform float uPointScale; uniform mediump float uIsPoint;" +
    "varying vec4 vCol;" +
    "void main(){ vCol = aCol; gl_Position = uVP * vec4(aPos,1.0);" +
    " if (uIsPoint > 0.5) { gl_PointSize = max(1.0, aSize * uPointScale / max(0.05, gl_Position.w)); } else { gl_PointSize = 1.0; } }",
    "precision mediump float;" +
    "varying vec4 vCol; uniform float uIsPoint;" +
    "void main(){ float a = vCol.a;" +
    " if (uIsPoint > 0.5) { float d = length(gl_PointCoord - vec2(0.5)); a *= smoothstep(0.5, 0.12, d); }" +
    " gl_FragColor = vec4(vCol.rgb, a); }"
  );
  if (!fieldProgram || !geomProgram) {
    (window.__srLog = window.__srLog || []).push("program link failure");
    box.classList.add("sr-nogl");
    return;
  }

  var fieldLoc = {
    aPos: gl.getAttribLocation(fieldProgram, "aPos"),
    uRes: gl.getUniformLocation(fieldProgram, "uRes"),
    uTime: gl.getUniformLocation(fieldProgram, "uTime"),
    uW: gl.getUniformLocation(fieldProgram, "uW"),
    uSel: gl.getUniformLocation(fieldProgram, "uSel"),
    uNodes: gl.getUniformLocation(fieldProgram, "uNodes")
  };
  var geomLoc = {
    aPos: gl.getAttribLocation(geomProgram, "aPos"),
    aCol: gl.getAttribLocation(geomProgram, "aCol"),
    aSize: gl.getAttribLocation(geomProgram, "aSize"),
    uVP: gl.getUniformLocation(geomProgram, "uVP"),
    uPointScale: gl.getUniformLocation(geomProgram, "uPointScale"),
    uIsPoint: gl.getUniformLocation(geomProgram, "uIsPoint")
  };

  var quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  var lineBuf = gl.createBuffer();
  var pointBuf = gl.createBuffer();

  var nodeUV = new Float32Array(24);
  for (var ni = 0; ni < 8; ni++) {
    nodeUV[ni * 3] = 0.5 + NODES[ni].x / 6.4;
    nodeUV[ni * 3 + 1] = 0.5 - NODES[ni].z / 5.0;
    nodeUV[ni * 3 + 2] = NODES[ni].heat;
  }

  /* ---------- matrix math ---------- */
  function perspective(fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) / (near - far), -1,
      0, 0, 2 * far * near / (near - far), 0
    ]);
  }
  function normalize(v) {
    var l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  }
  function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function lookAt(eye, center, up) {
    var z = normalize([eye[0] - center[0], eye[1] - center[1], eye[2] - center[2]]);
    var x = normalize(cross(up, z));
    var y = cross(z, x);
    return new Float32Array([
      x[0], y[0], z[0], 0,
      x[1], y[1], z[1], 0,
      x[2], y[2], z[2], 0,
      -dot(x, eye), -dot(y, eye), -dot(z, eye), 1
    ]);
  }
  function mul(a, b) {
    var o = new Float32Array(16);
    for (var i = 0; i < 4; i++) {
      for (var j = 0; j < 4; j++) {
        o[j * 4 + i] = a[0 * 4 + i] * b[j * 4 + 0] + a[1 * 4 + i] * b[j * 4 + 1] + a[2 * 4 + i] * b[j * 4 + 2] + a[3 * 4 + i] * b[j * 4 + 3];
      }
    }
    return o;
  }
  function project(vp, p, W, H) {
    var x = vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12];
    var y = vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13];
    var w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
    if (w <= 0.001) return null;
    return [(x / w * 0.5 + 0.5) * W, (1 - (y / w * 0.5 + 0.5)) * H];
  }

  /* ---------- scene state ---------- */
  var W = 0, H = 0, dpr = 1;
  var yaw = 0.24, pitch = 0.35, radius = 4.25;
  var dragging = false, moved = false, lastX = 0, lastY = 0;
  var vp = null, eye = [0, 0, 5], target = [0, 0.30, 0];
  var t0 = performance.now();
  var running = true;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = stage.clientWidth || 640;
    H = stage.clientHeight || 360;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    if (reduced) renderOnce();
  }

  /* ---------- 4D tesseract ---------- */
  var V4 = [];
  for (var i = 0; i < 16; i++) V4.push([(i & 1) ? 1 : -1, (i & 2) ? 1 : -1, (i & 4) ? 1 : -1, (i & 8) ? 1 : -1]);
  var EDGES = [];
  for (var a = 0; a < 16; a++) {
    for (var b = a + 1; b < 16; b++) {
      var d = a ^ b;
      if ((d & (d - 1)) === 0) EDGES.push([a, b]);
    }
  }

  function rot4(v, xw, yw, zw) {
    var x = v[0], y = v[1], z = v[2], w = v[3], n;
    n = x * Math.cos(xw) - w * Math.sin(xw); w = x * Math.sin(xw) + w * Math.cos(xw); x = n;
    n = y * Math.cos(yw) - w * Math.sin(yw); w = y * Math.sin(yw) + w * Math.cos(yw); y = n;
    n = z * Math.cos(zw) - w * Math.sin(zw); w = z * Math.sin(zw) + w * Math.cos(zw); z = n;
    var s = 1.75 / (2.75 - w);
    var scale = 0.92;
    return [x * s * scale, y * s * scale + 1.06, z * s * scale];
  }

  function buildScene(tSec) {
    var linePos = [], lineCol = [], lineSize = [];
    var ptPos = [], ptCol = [], ptSize = [];
    var gold = [0.784, 0.643, 0.298];
    var bone = [0.984, 0.976, 0.945];

    /* tesseract edges */
    var xw = tSec * 0.32 + wPhase;
    var yw = tSec * 0.24 + wPhase * 0.6;
    var zw = tSec * 0.17 + wPhase * 0.35;
    var proj = [];
    for (var i = 0; i < 16; i++) proj.push(rot4(V4[i], xw, yw, zw));
    for (var e = 0; e < EDGES.length; e++) {
      var A = proj[EDGES[e][0]], B = proj[EDGES[e][1]];
      var al = 0.50 + 0.30 * (0.5 + 0.5 * Math.sin(tSec * 1.7 + e * 0.4));
      linePos.push(A[0], A[1], A[2], B[0], B[1], B[2]);
      lineCol.push(bone[0], bone[1], bone[2], al, bone[0], bone[1], bone[2], al);
      lineSize.push(1, 1);
    }

    /* spires + beacons */
    var floorY = 0.0;
    for (var n = 0; n < 8; n++) {
      var nd = NODES[n];
      var h = 0.55 + nd.heat * 1.05;
      var isSel = (n === selected);
      var c = isSel ? gold : bone;
      var alpha = isSel ? 0.98 : (0.30 + nd.heat * 0.38);
      linePos.push(nd.x, floorY, nd.z, nd.x, floorY + h, nd.z);
      lineCol.push(c[0], c[1], c[2], alpha, c[0], c[1], c[2], alpha);
      lineSize.push(1, 1);
      ptPos.push(nd.x, floorY + h, nd.z);
      ptCol.push(c[0], c[1], c[2], isSel ? 1.0 : 0.85);
      ptSize.push(isSel ? (14 + 2.8 * Math.sin(tSec * 4)) : 7.2);
    }

    /* selected base ring */
    var sel = NODES[selected];
    var ringR = 0.17 + 0.05 * Math.sin(tSec * 3.6);
    for (var s = 0; s < 48; s++) {
      var a1 = (s / 48) * Math.PI * 2, a2 = ((s + 1) / 48) * Math.PI * 2;
      linePos.push(
        sel.x + Math.cos(a1) * ringR, 0.02, sel.z + Math.sin(a1) * ringR,
        sel.x + Math.cos(a2) * ringR, 0.02, sel.z + Math.sin(a2) * ringR
      );
      lineCol.push(gold[0], gold[1], gold[2], 0.55, gold[0], gold[1], gold[2], 0.55);
      lineSize.push(1, 1);
    }

    /* floor frame */
    var fx = 2.9, fz = 2.35;
    var corners = [[-fx, -fz], [fx, -fz], [fx, fz], [-fx, fz]];
    for (var q = 0; q < 4; q++) {
      var p1 = corners[q], p2 = corners[(q + 1) % 4];
      linePos.push(p1[0], floorY, p1[1], p2[0], floorY, p2[1]);
      lineCol.push(bone[0], bone[1], bone[2], 0.16, bone[0], bone[1], bone[2], 0.16);
      lineSize.push(1, 1);
    }

    return { linePos: linePos, lineCol: lineCol, ptPos: ptPos, ptCol: ptCol, ptSize: ptSize };
  }

  function uploadBuffer(buf, arr, stride) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.DYNAMIC_DRAW);
  }

  var lineCount = 0, pointCount = 0;
  var lineData = null, pointData = null;

  function setAttribs(loc) {
    var stride = 8 * 4;
    gl.enableVertexAttribArray(loc.aPos);
    gl.vertexAttribPointer(loc.aPos, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(loc.aCol);
    gl.vertexAttribPointer(loc.aCol, 4, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(loc.aSize);
    gl.vertexAttribPointer(loc.aSize, 1, gl.FLOAT, false, stride, 28);
  }

  function frame(tSec) {
    /* camera */
    eye = [
      target[0] + radius * Math.sin(yaw) * Math.cos(pitch),
      target[1] + radius * Math.sin(pitch),
      target[2] + radius * Math.cos(yaw) * Math.cos(pitch)
    ];
    vp = mul(perspective(38 * Math.PI / 180, W / Math.max(1, H), 0.1, 60), lookAt(eye, target, [0, 1, 0]));

    var s = buildScene(tSec);

    /* field */
    gl.useProgram(fieldProgram);
    gl.disable(gl.BLEND);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(fieldLoc.aPos);
    gl.vertexAttribPointer(fieldLoc.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(fieldLoc.uRes, canvas.width, canvas.height);
    gl.uniform1f(fieldLoc.uTime, tSec);
    gl.uniform1f(fieldLoc.uW, wPhase / 6.28);
    gl.uniform1f(fieldLoc.uSel, selected);
    gl.uniform3fv(fieldLoc.uNodes, nodeUV);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    /* geometry: build interleaved arrays */
    var ln = s.linePos.length / 3;
    var interleaved = new Float32Array(ln * 8);
    for (var i = 0; i < ln; i++) {
      interleaved[i * 8] = s.linePos[i * 3];
      interleaved[i * 8 + 1] = s.linePos[i * 3 + 1];
      interleaved[i * 8 + 2] = s.linePos[i * 3 + 2];
      interleaved[i * 8 + 3] = s.lineCol[i * 4];
      interleaved[i * 8 + 4] = s.lineCol[i * 4 + 1];
      interleaved[i * 8 + 5] = s.lineCol[i * 4 + 2];
      interleaved[i * 8 + 6] = s.lineCol[i * 4 + 3];
      interleaved[i * 8 + 7] = 1;
    }
    uploadBuffer(lineBuf, interleaved, 8);
    lineCount = ln;

    var pn = s.ptPos.length / 3;
    var pinter = new Float32Array(pn * 8);
    for (var j = 0; j < pn; j++) {
      pinter[j * 8] = s.ptPos[j * 3];
      pinter[j * 8 + 1] = s.ptPos[j * 3 + 1];
      pinter[j * 8 + 2] = s.ptPos[j * 3 + 2];
      pinter[j * 8 + 3] = s.ptCol[j * 4];
      pinter[j * 8 + 4] = s.ptCol[j * 4 + 1];
      pinter[j * 8 + 5] = s.ptCol[j * 4 + 2];
      pinter[j * 8 + 6] = s.ptCol[j * 4 + 3];
      pinter[j * 8 + 7] = s.ptSize[j];
    }
    uploadBuffer(pointBuf, pinter, 8);
    pointCount = pn;

    gl.useProgram(geomProgram);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.uniformMatrix4fv(geomLoc.uVP, false, vp);
    gl.uniform1f(geomLoc.uPointScale, canvas.height / 700);

    /* lines */
    gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf);
    setAttribs(geomLoc);
    gl.uniform1f(geomLoc.uIsPoint, 0);
    gl.drawArrays(gl.LINES, 0, lineCount);

    /* points */
    gl.bindBuffer(gl.ARRAY_BUFFER, pointBuf);
    setAttribs(geomLoc);
    gl.uniform1f(geomLoc.uIsPoint, 1);
    gl.drawArrays(gl.POINTS, 0, pointCount);

    lineData = s;
  }

  /* ---------- interaction ---------- */
  function hitTest(cx, cy) {
    if (!vp) return -1;
    var best = -1, bestD = 58 * 58;
    for (var n = 0; n < 8; n++) {
      var nd = NODES[n];
      var h = 0.55 + nd.heat * 1.05;
      var sp = project(vp, [nd.x, h, nd.z], W, H);
      if (!sp) continue;
      var dx = sp[0] - cx, dy = sp[1] - cy;
      var d2 = dx * dx + dy * dy;
      if (d2 < bestD) { bestD = d2; best = n; }
    }
    return best;
  }

  canvas.addEventListener("pointerdown", function (e) {
    dragging = true; moved = false;
    lastX = e.clientX; lastY = e.clientY;
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    var dx = e.clientX - lastX, dy = e.clientY - lastY;
    if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
    yaw -= dx * 0.006;
    pitch = Math.max(0.08, Math.min(1.2, pitch + dy * 0.004));
    lastX = e.clientX; lastY = e.clientY;
    if (reduced) renderOnce();
  });
  canvas.addEventListener("pointerup", function (e) {
    dragging = false;
    if (!moved) {
      var rect = canvas.getBoundingClientRect();
      var hit = hitTest(e.clientX - rect.left, e.clientY - rect.top);
      if (hit >= 0) select(hit, true);
    }
  });
  window.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      var r = canvas.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) {
        e.preventDefault();
        select((selected + (e.key === "ArrowRight" ? 1 : 7)) % 8, true);
      }
    }
  });

  /* ---------- run loop ---------- */
  var needsFrame = true;
  function renderOnce() { needsFrame = true; if (reduced) drawOnce(); }

  function drawOnce() {
    if (!vp || !W || !H) { resize(); }
    var tSec = reduced ? 0.6 : (performance.now() - t0) / 1000;
    frame(tSec);
  }

  function loop() {
    if (running) {
      var tSec = (performance.now() - t0) / 1000;
      frame(tSec);
    }
    requestAnimationFrame(loop);
  }

  var io = null;
  if ("IntersectionObserver" in window) {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { running = en.isIntersecting && !document.hidden; });
    }, { threshold: 0.02 });
    io.observe(stage);
  }
  document.addEventListener("visibilitychange", function () {
    running = !document.hidden;
  });
  window.addEventListener("resize", resize);

  resize();
  drawOnce();
  window.__srSonarOk = true;
  if (!reduced) {
    requestAnimationFrame(loop);
  } else {
    /* one clean static frame */
    frame(0.6);
  }
})();
