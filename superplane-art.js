/*!
 * SuperplaneArt — generative arrow engine for superplane.com
 * Usage:
 *   <script src="https://cdn.jsdelivr.net/gh/metabrand-agency/superplane@main/superplane-art.js"></script>
 *   <div id="sp-field" style="width:100%;height:520px;"></div>
 *   <script>SuperplaneArt.mount('#sp-field', {mode:'field', panel:false});</script>
 *
 * Requires three.js r128 loaded first:
 *   <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
 *
 * mount(target, options):
 *   target  - CSS selector string or a DOM element
 *   options.mode            'field' | 'school' | 'growth'   (default 'field')
 *   options.panel           show the utility control panel  (default false)
 *   options.allowModeSwitch show FIELD/SCHOOL/GROWTH tabs, only used if panel:true (default true)
 *   options.height          CSS height if the container has none set, e.g. '520px' (default '100%')
 *   options.overrides       {field:{...}, school:{...}, growth:{...}, global:{...}} param overrides
 * Returns {destroy(){...}} handle.
 */
(function(global){
"use strict";

/* ======================================================================
   SHARED CONSTANTS
====================================================================== */
var COLOR_BASE   = 0xe7e5df;
var COLOR_ACCENT = 0xff5a1f;
var COLOR_BG     = 0x0b0b0c;
var MAX_INSTANCES = 1300;
var FONT_STACK = "'IBM Plex Mono','SFMono-Regular','Cascadia Code',Menlo,Consolas,monospace";

var MODES = {
  field: {
    label: 'FIELD PARAMS',
    params: [
      {key:'count',     label:'PARTICLES',     min:50,  max:800, step:10,  def:300},
      {key:'poles',     label:'POLE COUNT',    min:1,   max:4,   step:1,   def:2},
      {key:'strength',  label:'POLE STRENGTH', min:0.2, max:3,   step:0.05,def:1},
      {key:'speed',     label:'FLOW SPEED',    min:0.1, max:3,   step:0.05,def:1},
      {key:'cursorPull',label:'CURSOR PULL',   min:0,   max:3,   step:0.05,def:1.2}
    ]
  },
  school: {
    label: 'SCHOOL PARAMS',
    params: [
      {key:'count',      label:'AGENTS',      min:20, max:220, step:5,   def:110},
      {key:'cohesion',   label:'COHESION',    min:0,  max:2,   step:0.02,def:0.6},
      {key:'separation', label:'SEPARATION',  min:0,  max:2,   step:0.02,def:0.9},
      {key:'alignment',  label:'ALIGNMENT',   min:0,  max:2,   step:0.02,def:0.8},
      {key:'cursorPull', label:'CURSOR PULL', min:0,  max:3,   step:0.05,def:1.0},
      {key:'speed',      label:'SWIM SPEED',  min:0.1,max:3,   step:0.05,def:1.2}
    ]
  },
  growth: {
    label: 'GROWTH PARAMS',
    params: [
      {key:'maxSegments', label:'MAX SEGMENTS', min:100,max:1200,step:20, def:500},
      {key:'maxDepth',    label:'MAX DEPTH',    min:3,  max:12,  step:1,  def:7},
      {key:'branchAngle', label:'BRANCH ANGLE', min:5,  max:60,  step:1,  def:28},
      {key:'variance',    label:'VARIANCE',     min:0,  max:1,   step:0.02,def:0.4},
      {key:'spawnChance', label:'SPAWN CHANCE', min:0,  max:1,   step:0.02,def:0.65},
      {key:'growSpeed',   label:'GROW SPEED',   min:0.2,max:4,   step:0.05,def:1.4},
      {key:'cursorPull',  label:'CURSOR BIAS',  min:0,  max:2,   step:0.05,def:0.8}
    ]
  }
};
var GLOBAL_PARAMS = [
  {key:'arrowScale',   label:'ARROW SCALE',   min:0.3,max:2.5,step:0.05,def:1.0},
  {key:'accentRadius', label:'ACCENT RADIUS', min:0,  max:8,  step:0.1, def:3.0}
];

/* ---------------- shared arrow geometry (safe to reuse across instances) ----------------
   Built lazily by ensureSharedResources() the first time mount() actually runs, so this
   file never throws or no-ops just because three.js has not executed yet at parse time
   (script load order can vary by host page). */
var SW = 0.09, HW = 0.22;
var OUTLINE = null;
var sharedArrowGeo = null, sharedBaseMat = null, sharedAccentMat = null, sharedPoleGeo = null, sharedPoleMat = null;

function buildArrowGeometry(){
  var tris = [[0,1,2],[0,2,3],[0,3,4],[0,4,5],[0,5,6]];
  var positions = [];
  tris.forEach(function(t){
    t.forEach(function(i){
      var p = OUTLINE[i];
      positions.push(p.x, p.y, p.z);
    });
  });
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

function ensureSharedResources(){
  if(sharedArrowGeo) return; // already built
  OUTLINE = [
    new THREE.Vector3(-0.5,  SW, 0),
    new THREE.Vector3( 0.05, SW, 0),
    new THREE.Vector3( 0.05, HW, 0),
    new THREE.Vector3( 0.5,  0,  0),
    new THREE.Vector3( 0.05,-HW, 0),
    new THREE.Vector3( 0.05,-SW, 0),
    new THREE.Vector3(-0.5, -SW, 0)
  ];
  sharedArrowGeo = buildArrowGeometry();
  sharedBaseMat = new THREE.MeshBasicMaterial({color:COLOR_BASE, side:THREE.DoubleSide});
  sharedAccentMat = new THREE.MeshBasicMaterial({color:COLOR_ACCENT, side:THREE.DoubleSide});
  sharedPoleGeo = new THREE.RingGeometry(0.04,0.06,16);
  sharedPoleMat = new THREE.MeshBasicMaterial({color:0x5c5c58, side:THREE.DoubleSide});
}

/* ---------------- shared slider row builder ---------------- */
function makeRow(param, getVal, setVal, onChange){
  var row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:9px;font-family:'+FONT_STACK+';font-size:11px;';
  var val = document.createElement('span');
  val.style.cssText = 'width:38px;flex:0 0 38px;text-align:left;font-variant-numeric:tabular-nums;color:#141414;';
  var input = document.createElement('input');
  input.type='range'; input.min=param.min; input.max=param.max; input.step=param.step; input.value=getVal();
  input.style.cssText = '-webkit-appearance:none;appearance:none;flex:1 1 auto;height:14px;border:1px solid #1c1c1c;background:#cfcfcb;cursor:pointer;';
  var label = document.createElement('span');
  label.style.cssText = 'flex:0 0 auto;white-space:nowrap;letter-spacing:0.3px;color:#3a3a38;';
  label.textContent = param.label;

  function refresh(){
    var v = parseFloat(input.value);
    var isInt = Math.abs(param.step - Math.round(param.step)) < 1e-9 && param.step >= 1;
    val.textContent = isInt ? String(Math.round(v)) : v.toFixed(2);
    var pct = (v-param.min)/(param.max-param.min)*100;
    input.style.background = 'linear-gradient(to right, #141414 0%, #141414 '+pct+'%, #cfcfcb '+pct+'%, #cfcfcb 100%)';
  }
  input.addEventListener('input', function(){
    setVal(parseFloat(input.value));
    refresh();
    if(onChange) onChange();
  });
  refresh();
  row.appendChild(val); row.appendChild(input); row.appendChild(label);
  return row;
}

function injectSliderThumbCSS(){
  if(document.getElementById('sp-art-thumb-css')) return;
  var style = document.createElement('style');
  style.id = 'sp-art-thumb-css';
  style.textContent =
    '.sp-art-root input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:2px;height:14px;background:transparent;border:none;}'+
    '.sp-art-root input[type=range]::-moz-range-thumb{width:2px;height:14px;background:transparent;border:none;}'+
    '.sp-art-root input[type=range]::-moz-range-track{height:14px;background:transparent;}';
  document.head.appendChild(style);
}

/* ======================================================================
   MOUNT
====================================================================== */
function mount(target, options){
  options = options || {};
  var container = (typeof target === 'string') ? document.querySelector(target) : target;
  if(!container){ console.error('SuperplaneArt: target not found:', target); return null; }

  if(typeof THREE === 'undefined'){
    // three.js has not executed yet (script load order can vary by host page) — retry briefly
    // instead of failing silently, so a temporary race never leaves a blank container.
    var attempts = 0;
    var waitId = setInterval(function(){
      attempts++;
      if(typeof THREE !== 'undefined'){
        clearInterval(waitId);
        mount(target, options);
      } else if(attempts > 50){ // ~5s
        clearInterval(waitId);
        console.error('SuperplaneArt: three.js did not load within 5s.');
        container.innerHTML = '<div style="padding:16px;font-family:monospace;font-size:12px;color:#a33;">SuperplaneArt: three.js failed to load.</div>';
      }
    }, 100);
    return null;
  }
  ensureSharedResources();

  injectSliderThumbCSS();
  container.classList.add('sp-art-root');
  container.innerHTML = '';
  if(!container.style.height) container.style.height = options.height || '100%';
  if(!container.style.width) container.style.width = '100%';
  container.style.position = container.style.position || 'relative';
  container.style.overflow = 'hidden';

  var showPanel = !!options.panel;
  var allowModeSwitch = options.allowModeSwitch !== false;

  var cfg = {global:{}, field:{}, school:{}, growth:{}};
  GLOBAL_PARAMS.forEach(function(p){ cfg.global[p.key] = p.def; });
  Object.keys(MODES).forEach(function(m){
    MODES[m].params.forEach(function(p){ cfg[m][p.key] = p.def; });
  });
  if(options.overrides){
    Object.keys(options.overrides).forEach(function(section){
      if(cfg[section]) Object.assign(cfg[section], options.overrides[section]);
    });
  }

  var state = { mode: options.mode || 'field', autoRotate: false };

  /* ---------------- DOM ---------------- */
  var root = document.createElement('div');
  root.style.cssText = 'display:flex;width:100%;height:100%;background:#0b0b0c;font-family:'+FONT_STACK+';font-size:11px;color:#141414;-webkit-font-smoothing:none;';
  container.appendChild(root);

  var panelEl = null, modeParamsEl = null, modeSectionLabel = null, readoutEl = null, tabsEls = {};
  if(showPanel){
    panelEl = document.createElement('div');
    panelEl.style.cssText = 'width:280px;min-width:280px;height:100%;overflow-y:auto;background:#ececea;border-right:1px solid #1c1c1c;padding:14px;box-sizing:border-box;';
    root.appendChild(panelEl);

    if(allowModeSwitch){
      var tabsRow = document.createElement('div');
      tabsRow.style.cssText = 'display:flex;border:1px solid #1c1c1c;margin-bottom:14px;';
      ['field','school','growth'].forEach(function(m, i){
        var t = document.createElement('div');
        t.textContent = m.toUpperCase();
        t.style.cssText = 'flex:1;text-align:center;padding:7px 0;cursor:pointer;user-select:none;'+
          (i<2?'border-right:1px solid #1c1c1c;':'')+'background:'+(m===state.mode?'#141414':'#ececea')+';color:'+(m===state.mode?'#ececea':'#141414')+';';
        t.addEventListener('click', function(){
          state.mode = m;
          Object.keys(tabsEls).forEach(function(k){
            tabsEls[k].style.background = (k===m)?'#141414':'#ececea';
            tabsEls[k].style.color = (k===m)?'#ececea':'#141414';
          });
          rebuildModeParams();
          resetSimForMode();
        });
        tabsEls[m] = t;
        tabsRow.appendChild(t);
      });
      panelEl.appendChild(tabsRow);
    }

    var globalLabel = document.createElement('div');
    globalLabel.textContent = 'GLOBAL';
    globalLabel.style.cssText = 'font-weight:700;letter-spacing:0.5px;margin-bottom:8px;';
    panelEl.appendChild(globalLabel);
    var globalParamsEl = document.createElement('div');
    panelEl.appendChild(globalParamsEl);
    GLOBAL_PARAMS.forEach(function(p){
      globalParamsEl.appendChild(makeRow(p, function(){return cfg.global[p.key];}, function(v){cfg.global[p.key]=v;}));
    });

    var btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px;margin:8px 0 14px;';
    var btnRotate = document.createElement('button');
    btnRotate.textContent = 'AUTO ROTATE';
    var btnReset = document.createElement('button');
    btnReset.textContent = 'RESET';
    [btnRotate, btnReset].forEach(function(b){
      b.style.cssText = 'flex:1;padding:8px 4px;border:1px solid #1c1c1c;background:#ececea;color:#141414;font-family:inherit;font-size:10px;letter-spacing:0.4px;cursor:pointer;';
    });
    btnRotate.addEventListener('click', function(){
      state.autoRotate = !state.autoRotate;
      btnRotate.style.background = state.autoRotate ? '#ff5a1f' : '#ececea';
      btnRotate.style.borderColor = state.autoRotate ? '#ff5a1f' : '#1c1c1c';
    });
    btnReset.addEventListener('click', function(){
      resetSimForMode();
      orbit.radius = 8; orbit.theta = 0.6; orbit.phi = 1.2;
    });
    btnRow.appendChild(btnRotate); btnRow.appendChild(btnReset);
    panelEl.appendChild(btnRow);

    var divider1 = document.createElement('div');
    divider1.style.cssText = 'border-top:1px solid #1c1c1c;margin:14px 0;';
    panelEl.appendChild(divider1);

    modeSectionLabel = document.createElement('div');
    modeSectionLabel.style.cssText = 'font-weight:700;letter-spacing:0.5px;margin-bottom:8px;';
    panelEl.appendChild(modeSectionLabel);
    modeParamsEl = document.createElement('div');
    panelEl.appendChild(modeParamsEl);

    var divider2 = document.createElement('div');
    divider2.style.cssText = 'border-top:1px solid #1c1c1c;margin:14px 0;';
    panelEl.appendChild(divider2);

    var exportLabel = document.createElement('div');
    exportLabel.textContent = 'EXPORT';
    exportLabel.style.cssText = 'font-weight:700;letter-spacing:0.5px;margin-bottom:8px;';
    panelEl.appendChild(exportLabel);
    var exportRow = document.createElement('div');
    exportRow.style.cssText = 'display:flex;gap:8px;margin-bottom:14px;';
    var btnPng = document.createElement('button');
    btnPng.textContent = 'EXPORT PNG';
    var btnSvg = document.createElement('button');
    btnSvg.textContent = 'EXPORT SVG';
    [btnPng, btnSvg].forEach(function(b){
      b.style.cssText = 'flex:1;padding:8px 4px;border:1px solid #1c1c1c;background:#ececea;color:#141414;font-family:inherit;font-size:10px;letter-spacing:0.4px;cursor:pointer;';
    });
    exportRow.appendChild(btnPng); exportRow.appendChild(btnSvg);
    panelEl.appendChild(exportRow);

    readoutEl = document.createElement('div');
    readoutEl.style.cssText = 'margin-top:4px;line-height:1.6;color:#3a3a38;';
    panelEl.appendChild(readoutEl);
  }

  var canvasWrap = document.createElement('div');
  canvasWrap.style.cssText = 'flex:1 1 auto;position:relative;background:#0b0b0c;min-width:0;height:100%;';
  root.appendChild(canvasWrap);
  var canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%;';
  canvasWrap.appendChild(canvas);

  /* ======================================================================
     THREE SETUP (scoped to this instance)
  ====================================================================== */
  var renderer = new THREE.WebGLRenderer({canvas:canvas, antialias:true});
  renderer.setPixelRatio(Math.min(global.devicePixelRatio||1, 2));
  renderer.setClearColor(COLOR_BG, 1);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  var orbit = {radius:8, theta:0.6, phi:1.2};
  function applyOrbit(){
    camera.position.x = orbit.radius * Math.sin(orbit.phi) * Math.sin(orbit.theta);
    camera.position.y = orbit.radius * Math.cos(orbit.phi);
    camera.position.z = orbit.radius * Math.sin(orbit.phi) * Math.cos(orbit.theta);
    camera.lookAt(0,0,0);
  }
  applyOrbit();

  function resize(){
    var w = canvasWrap.clientWidth, h = canvasWrap.clientHeight;
    if(w<2||h<2) return;
    renderer.setSize(w,h,false);
    camera.aspect = w/h;
    camera.updateProjectionMatrix();
  }
  var resizeObs = new (global.ResizeObserver || function(){ this.observe=function(){}; this.disconnect=function(){}; })(resize);
  resizeObs.observe(container);
  resize();

  var baseMesh = new THREE.InstancedMesh(sharedArrowGeo, sharedBaseMat, MAX_INSTANCES);
  var accentMesh = new THREE.InstancedMesh(sharedArrowGeo, sharedAccentMat, MAX_INSTANCES);
  baseMesh.count = 0; accentMesh.count = 0;
  scene.add(baseMesh, accentMesh);

  var poleGroup = new THREE.Group();
  scene.add(poleGroup);

  /* ---------------- interaction ---------------- */
  var raycaster = new THREE.Raycaster();
  var groundPlane = new THREE.Plane(new THREE.Vector3(0,0,1), 0);
  var interactionPoint = new THREE.Vector3();
  var interactionActive = false;
  var mouseNDC = new THREE.Vector2();
  var isDragging=false, dragMoved=false, lastX=0, lastY=0;

  function updatePointerNDC(e){
    var rect = canvas.getBoundingClientRect();
    mouseNDC.x = ((e.clientX-rect.left)/rect.width)*2-1;
    mouseNDC.y = -((e.clientY-rect.top)/rect.height)*2+1;
  }
  canvas.addEventListener('pointerdown', function(e){
    isDragging=true; dragMoved=false; lastX=e.clientX; lastY=e.clientY;
    try{ canvas.setPointerCapture(e.pointerId); }catch(err){}
  });
  canvas.addEventListener('pointermove', function(e){
    updatePointerNDC(e);
    interactionActive = true;
    raycaster.setFromCamera(mouseNDC, camera);
    raycaster.ray.intersectPlane(groundPlane, interactionPoint);
    if(isDragging){
      var dx = e.clientX-lastX, dy = e.clientY-lastY;
      if(Math.abs(dx)+Math.abs(dy) > 3) dragMoved = true;
      if(dragMoved){
        orbit.theta -= dx*0.006;
        orbit.phi = Math.min(2.7, Math.max(0.35, orbit.phi - dy*0.006));
      }
      lastX=e.clientX; lastY=e.clientY;
    }
  });
  canvas.addEventListener('pointerup', function(e){
    if(!dragMoved && state.mode==='growth'){
      updatePointerNDC(e);
      raycaster.setFromCamera(mouseNDC, camera);
      var hit = new THREE.Vector3();
      raycaster.ray.intersectPlane(groundPlane, hit);
      resetGrowth(hit);
    }
    isDragging=false; dragMoved=false;
  });
  canvas.addEventListener('pointerleave', function(){ interactionActive=false; });
  canvas.addEventListener('wheel', function(e){
    e.preventDefault();
    orbit.radius = Math.min(20, Math.max(3, orbit.radius*(1+e.deltaY*0.001)));
  }, {passive:false});

  /* ---------------- FIELD MODE ---------------- */
  var fieldParticles = [], poles = [];
  function computePoles(){
    var n = cfg.field.poles;
    poles = []; poleGroup.clear();
    for(var i=0;i<n;i++){
      var a = (i/n)*Math.PI*2;
      var p = new THREE.Vector3(Math.cos(a)*2.2, Math.sin(a)*2.2*0.6, Math.sin(a*2)*1.0);
      poles.push(p);
      var m = new THREE.Mesh(sharedPoleGeo, sharedPoleMat);
      m.position.copy(p);
      poleGroup.add(m);
    }
  }
  function initField(){
    computePoles();
    var n = cfg.field.count;
    fieldParticles = [];
    for(var i=0;i<n;i++){
      var pole = poles[Math.floor(Math.random()*poles.length)] || new THREE.Vector3();
      var ang = Math.random()*Math.PI*2;
      var r = 0.6 + Math.random()*3.2;
      fieldParticles.push({
        pos: new THREE.Vector3(pole.x+Math.cos(ang)*r, pole.y+Math.sin(ang)*r, (Math.random()-0.5)*1.5),
        vel: new THREE.Vector3(),
        seed: Math.random()*1000
      });
    }
  }
  var tmpRel=new THREE.Vector3(), tmpTan=new THREE.Vector3(), tmpFieldV=new THREE.Vector3();
  function fieldVectorAt(pos){
    tmpFieldV.set(0,0,0);
    for(var i=0;i<poles.length;i++){
      tmpRel.subVectors(pos, poles[i]);
      var d2 = Math.max(tmpRel.lengthSq(), 0.05);
      tmpTan.set(-tmpRel.y, tmpRel.x, 0);
      if(tmpTan.lengthSq()>1e-8) tmpTan.normalize();
      tmpTan.multiplyScalar(cfg.field.strength*3.0/Math.sqrt(d2));
      tmpFieldV.add(tmpTan);
    }
    if(interactionActive && cfg.field.cursorPull>0){
      tmpRel.subVectors(pos, interactionPoint);
      var d2c = Math.max(tmpRel.lengthSq(), 0.05);
      tmpTan.set(-tmpRel.y, tmpRel.x, 0);
      if(tmpTan.lengthSq()>1e-8) tmpTan.normalize();
      tmpTan.multiplyScalar(cfg.field.cursorPull*3.0/Math.sqrt(d2c));
      tmpFieldV.add(tmpTan);
    }
    return tmpFieldV;
  }
  function updateField(dt, time){
    for(var i=0;i<fieldParticles.length;i++){
      var pt = fieldParticles[i];
      var f = fieldVectorAt(pt.pos);
      pt.vel.lerp(f, 0.15);
      pt.pos.addScaledVector(pt.vel, dt*cfg.field.speed);
      pt.pos.z += Math.sin(time*0.5+pt.seed)*0.01;
    }
  }

  /* ---------------- SCHOOL MODE ---------------- */
  var agents = [];
  function initSchool(){
    var n = cfg.school.count;
    agents = [];
    for(var i=0;i<n;i++){
      agents.push({
        pos: new THREE.Vector3((Math.random()-0.5)*4,(Math.random()-0.5)*4,(Math.random()-0.5)*2),
        vel: new THREE.Vector3((Math.random()-0.5),(Math.random()-0.5),(Math.random()-0.5)*0.3)
      });
    }
  }
  var NEIGHBOR_R=1.6, SEP_R=0.55;
  function updateSchool(dt){
    var n = agents.length, c = cfg.school;
    for(var i=0;i<n;i++){
      var a = agents[i];
      var coh=new THREE.Vector3(), ali=new THREE.Vector3(), sep=new THREE.Vector3();
      var count=0;
      for(var j=0;j<n;j++){
        if(i===j) continue;
        var b = agents[j];
        var d2 = a.pos.distanceToSquared(b.pos);
        if(d2 < NEIGHBOR_R*NEIGHBOR_R){
          coh.add(b.pos); ali.add(b.vel); count++;
          if(d2 < SEP_R*SEP_R && d2>1e-6){
            var away = new THREE.Vector3().subVectors(a.pos,b.pos).multiplyScalar(1/d2);
            sep.add(away);
          }
        }
      }
      var force = new THREE.Vector3();
      if(count>0){
        coh.divideScalar(count).sub(a.pos).multiplyScalar(c.cohesion);
        ali.divideScalar(count).sub(a.vel).multiplyScalar(c.alignment);
        force.add(coh).add(ali);
      }
      force.add(sep.multiplyScalar(c.separation));
      force.addScaledVector(a.pos, -0.02);
      if(interactionActive && c.cursorPull>0){
        var toC = new THREE.Vector3().subVectors(interactionPoint, a.pos).multiplyScalar(c.cursorPull*0.4);
        force.add(toC);
      }
      a.vel.addScaledVector(force, dt);
      var maxSpeed = 2.2;
      if(a.vel.length()>maxSpeed) a.vel.setLength(maxSpeed);
      a.pos.addScaledVector(a.vel, dt*c.speed);
    }
  }

  /* ---------------- GROWTH MODE ---------------- */
  var segments=[], activeTwigs=[], growthAccum=0, resetPending=false, resetTimer=0;
  var lastSeed = new THREE.Vector3(0,-2.6,0);
  var AXIS_POOL=[];
  (function(){ for(var i=0;i<24;i++) AXIS_POOL.push(new THREE.Vector3(Math.random()-0.5,Math.random()-0.5,Math.random()-0.5).normalize()); })();

  function resetGrowth(seedPos){
    if(seedPos) lastSeed.copy(seedPos);
    segments = [];
    activeTwigs = [{pos:lastSeed.clone(), dir:new THREE.Vector3(0,1,0), len:0.9, depth:0}];
    resetPending=false; resetTimer=0; growthAccum=0;
  }
  function growthStep(){
    var c = cfg.growth;
    var newTwigs = [];
    for(var t=0;t<activeTwigs.length;t++){
      var twig = activeTwigs[t];
      var dir = twig.dir.clone();
      if(interactionActive && c.cursorPull>0){
        var toC = new THREE.Vector3().subVectors(interactionPoint, twig.pos);
        if(toC.lengthSq()>1e-6) toC.normalize();
        dir.lerp(toC, Math.min(0.9,0.15*c.cursorPull)).normalize();
      }
      dir.x += (Math.random()-0.5)*c.variance*0.6;
      dir.y += (Math.random()-0.5)*c.variance*0.6;
      dir.z += (Math.random()-0.5)*c.variance*0.3;
      if(dir.lengthSq()<1e-8) dir.set(0,1,0);
      dir.normalize();
      var len = twig.len;
      var newPos = twig.pos.clone().addScaledVector(dir, len);
      segments.push({pos:twig.pos.clone(), dir:dir.clone(), len:len});
      var nd = twig.depth+1;
      if(nd < c.maxDepth && segments.length < c.maxSegments){
        if(Math.random() < c.spawnChance){
          for(var b=0;b<2;b++){
            var bdir = dir.clone();
            var ang = (c.branchAngle*Math.PI/180) * (b===0?1:-1);
            var axis = AXIS_POOL[Math.floor(Math.random()*AXIS_POOL.length)];
            bdir.applyAxisAngle(axis, ang);
            newTwigs.push({pos:newPos.clone(), dir:bdir.normalize(), len:len*0.78, depth:nd});
          }
        } else {
          newTwigs.push({pos:newPos.clone(), dir:dir, len:len*0.85, depth:nd});
        }
      }
    }
    activeTwigs = newTwigs;
    if(activeTwigs.length===0 || segments.length>=c.maxSegments){
      resetPending=true; resetTimer=1.0;
    }
  }
  function updateGrowth(dt){
    if(resetPending){
      resetTimer -= dt;
      if(resetTimer<=0) resetGrowth();
      return;
    }
    growthAccum += dt;
    var interval = 0.5/Math.max(0.05,cfg.growth.growSpeed);
    var guard=0;
    while(growthAccum > interval && guard < 20){
      growthAccum -= interval;
      growthStep();
      guard++;
      if(resetPending) break;
    }
  }
  resetGrowth();

  /* ---------------- compose instances ---------------- */
  var X_AXIS=new THREE.Vector3(1,0,0), tmpQuat=new THREE.Quaternion(), tmpScale=new THREE.Vector3(), tmpMat=new THREE.Matrix4();
  var frameArrows = [];
  function assignInstances(list, getPDL){
    frameArrows.length = 0;
    var bi=0, ai=0;
    var accentR2 = cfg.global.accentRadius*cfg.global.accentRadius;
    for(var i=0;i<list.length;i++){
      var pdl = getPDL(list[i]);
      if(!pdl) continue;
      var pos=pdl.pos, dir=pdl.dir, len=pdl.len*cfg.global.arrowScale;
      if(dir.lengthSq()<1e-8) dir = X_AXIS;
      var isAccent = interactionActive && pos.distanceToSquared(interactionPoint) < accentR2;
      tmpQuat.setFromUnitVectors(X_AXIS, dir);
      tmpScale.set(len, cfg.global.arrowScale, cfg.global.arrowScale);
      tmpMat.compose(pos, tmpQuat, tmpScale);
      if(isAccent){ if(ai<MAX_INSTANCES){ accentMesh.setMatrixAt(ai++, tmpMat); } }
      else { if(bi<MAX_INSTANCES){ baseMesh.setMatrixAt(bi++, tmpMat); } }
      if(frameArrows.length < MAX_INSTANCES*2) frameArrows.push({pos:pos.clone(), dir:dir.clone(), len:len, accent:isAccent});
    }
    baseMesh.count = bi; accentMesh.count = ai;
    baseMesh.instanceMatrix.needsUpdate = true;
    accentMesh.instanceMatrix.needsUpdate = true;
  }
  var FIELD_LEN=0.4, SCHOOL_LEN=0.34;
  function composeForMode(){
    if(state.mode==='field'){
      poleGroup.visible = true;
      assignInstances(fieldParticles, function(p){
        var d = p.vel.lengthSq()>1e-6 ? p.vel.clone().normalize() : X_AXIS;
        return {pos:p.pos, dir:d, len:FIELD_LEN};
      });
    } else if(state.mode==='school'){
      poleGroup.visible = false;
      assignInstances(agents, function(a){
        var d = a.vel.lengthSq()>1e-6 ? a.vel.clone().normalize() : X_AXIS;
        return {pos:a.pos, dir:d, len:SCHOOL_LEN};
      });
    } else if(state.mode==='growth'){
      poleGroup.visible = false;
      assignInstances(segments, function(s){
        var center = s.pos.clone().addScaledVector(s.dir, s.len*0.5);
        return {pos:center, dir:s.dir, len:s.len};
      });
    }
  }
  function resetSimForMode(){
    if(state.mode==='field') initField();
    else if(state.mode==='school') initSchool();
    else if(state.mode==='growth') resetGrowth();
  }
  initField(); initSchool();

  /* ---------------- panel: mode params rebuild (needs functions above defined first) ---------------- */
  function rebuildModeParams(){
    if(!showPanel) return;
    modeParamsEl.innerHTML = '';
    modeSectionLabel.textContent = MODES[state.mode].label;
    MODES[state.mode].params.forEach(function(p){
      modeParamsEl.appendChild(makeRow(p,
        function(){ return cfg[state.mode][p.key]; },
        function(v){ cfg[state.mode][p.key] = v; },
        function(){
          if(state.mode==='field' && (p.key==='count'||p.key==='poles')) initField();
          if(state.mode==='school' && p.key==='count') initSchool();
        }
      ));
    });
  }
  if(showPanel) rebuildModeParams();

  /* ---------------- export ---------------- */
  function downloadBlob(content, mime, filename){
    var blob = (content instanceof Blob) ? content : new Blob([content], {type:mime});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 2000);
  }
  if(showPanel){
    btnPng.addEventListener('click', function(){
      renderer.render(scene, camera);
      canvas.toBlob(function(blob){ downloadBlob(blob, 'image/png', 'superplane-'+state.mode+'.png'); }, 'image/png');
    });
    btnSvg.addEventListener('click', function(){
      var w = renderer.domElement.width, h = renderer.domElement.height;
      var baseParts=[], accentParts=[];
      for(var i=0;i<frameArrows.length;i++){
        var a = frameArrows[i];
        tmpQuat.setFromUnitVectors(X_AXIS, a.dir);
        tmpScale.set(a.len, cfg.global.arrowScale, cfg.global.arrowScale);
        tmpMat.compose(a.pos, tmpQuat, tmpScale);
        var pts=[];
        for(var k=0;k<OUTLINE.length;k++){
          var wp = OUTLINE[k].clone().applyMatrix4(tmpMat);
          var proj = wp.clone().project(camera);
          var x=(proj.x*0.5+0.5)*w, y=(1-(proj.y*0.5+0.5))*h;
          pts.push(x.toFixed(1)+','+y.toFixed(1));
        }
        var poly = '<polygon points="'+pts.join(' ')+'"/>';
        if(a.accent) accentParts.push(poly); else baseParts.push(poly);
      }
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'">'+
        '<rect width="100%" height="100%" fill="#0b0b0c"/>'+
        '<g fill="#e7e5df">'+baseParts.join('')+'</g>'+
        '<g fill="#ff5a1f">'+accentParts.join('')+'</g>'+
        '</svg>';
      downloadBlob(svg, 'image/svg+xml', 'superplane-'+state.mode+'.svg');
    });
  }

  /* ---------------- main loop ---------------- */
  var clock = new THREE.Clock();
  var elapsed = 0;
  var rafId = null;
  var destroyed = false;

  function animate(){
    if(destroyed) return;
    rafId = requestAnimationFrame(animate);
    var dt = Math.min(0.05, clock.getDelta());
    elapsed += dt;

    if(state.mode==='field') updateField(dt, elapsed);
    else if(state.mode==='school') updateSchool(dt);
    else if(state.mode==='growth') updateGrowth(dt);

    composeForMode();

    if(state.autoRotate) orbit.theta += dt*0.15;
    applyOrbit();

    renderer.render(scene, camera);

    if(showPanel && readoutEl){
      var activeCount = state.mode==='field' ? fieldParticles.length :
                         state.mode==='school' ? agents.length : segments.length;
      readoutEl.innerHTML = 'MODE &nbsp;: <b>'+state.mode.toUpperCase()+'</b><br>ARROWS: <b>'+activeCount+'</b><br>TIME &nbsp;: <b>'+elapsed.toFixed(1)+'s</b>';
    }
  }
  animate();

  return {
    destroy: function(){
      destroyed = true;
      if(rafId) cancelAnimationFrame(rafId);
      resizeObs.disconnect();
      renderer.dispose();
      container.innerHTML = '';
    }
  };
}

global.SuperplaneArt = { mount: mount, MODES: MODES };

})(window);
