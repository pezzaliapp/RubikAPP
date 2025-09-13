(()=>{
// Colors (standard scheme)
const STICKER = { U:0xffffff, D:0xffd000, F:0x00a74a, B:0x0053d6, L:0xff6c00, R:0xd80027 };

// Stage
const stage = document.getElementById('stage');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a3142);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(4.2, 3.8, 5.8);
camera.lookAt(0,0,0);

const renderer = new THREE.WebGLRenderer({antialias:true, alpha:false});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
renderer.setSize(stage.clientWidth, stage.clientHeight);
stage.appendChild(renderer.domElement);

// Resize
function onResize(){
  const w = stage.clientWidth, h = stage.clientHeight;
  camera.aspect = w/h; camera.updateProjectionMatrix();
  renderer.setSize(w,h);
  renderer.render(scene,camera);
}
window.addEventListener('resize', onResize, {passive:true});

// Lights
scene.add(new THREE.AmbientLight(0xffffff, .85));
const key = new THREE.DirectionalLight(0xffffff, .8); key.position.set(4,7,6); scene.add(key);

// Helpers
function nearly(a,b,eps=1e-4){ return Math.abs(a-b)<eps; }
function snap90(rad){ return Math.round(rad/(Math.PI/2))*(Math.PI/2); }

// Build cube
const cubelets=[], root=new THREE.Group(); scene.add(root);
const size=0.98, gap=0.012;
const geo = new THREE.BoxGeometry(size, size, size);

// Stickers with polygonOffset to avoid z-fighting
function makeSticker(color, axis, sign){
  const g = new THREE.PlaneGeometry(0.965,0.965);
  const m = new THREE.MeshBasicMaterial({
    color,
    side: THREE.FrontSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  });
  const s = new THREE.Mesh(g, m);
  const d = 0.515; // slightly farther from cube surface
  if(axis==='x'){ s.position.x = sign*d; s.rotation.y = -sign*Math.PI/2; }
  if(axis==='y'){ s.position.y = sign*d; s.rotation.x =  sign*Math.PI/2; }
  if(axis==='z'){ s.position.z = sign*d; if(sign<0) s.rotation.y = Math.PI; }
  return s;
}
function addCubelet(i,j,k){
  const base = new THREE.MeshStandardMaterial({color:0x20232c, metalness:0.1, roughness:0.6});
  const mesh = new THREE.Mesh(geo, [base,base,base,base,base,base].map(m=>m.clone()));
  const s = size+gap;
  mesh.position.set(i*s, j*s, k*s);
  mesh.userData.coord = new THREE.Vector3(i,j,k);
  // Stickers
  if(i=== 1) mesh.add(makeSticker(STICKER.R,'x',+1));
  if(i===-1) mesh.add(makeSticker(STICKER.L,'x',-1));
  if(j=== 1) mesh.add(makeSticker(STICKER.U,'y',+1));
  if(j===-1) mesh.add(makeSticker(STICKER.D,'y',-1));
  if(k=== 1) mesh.add(makeSticker(STICKER.F,'z',+1));
  if(k===-1) mesh.add(makeSticker(STICKER.B,'z',-1));
  root.add(mesh); cubelets.push(mesh);
}
function buildSolved(){
  while(root.children.length) root.remove(root.children[0]);
  cubelets.length=0;
  for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++) addCubelet(i,j,k);
}

// History / notation
const moveAlgEl = document.getElementById('move-alg');
const moveCountEl = document.getElementById('move-count');
let history=[], future=[], moveAlg=[], moveCount=0;

function pushHistory(){
  const s = cubelets.map(m=>({
    x:m.position.x, y:m.position.y, z:m.position.z,
    rx:m.rotation.x, ry:m.rotation.y, rz:m.rotation.z,
    cx:m.userData.coord.x, cy:m.userData.coord.y, cz:m.userData.coord.z
  }));
  history.push(s);
  if(history.length>200) history.shift();
  future.length=0;
}
function restoreState(snap){
  cubelets.forEach((m,i)=>{
    const s=snap[i];
    m.position.set(s.x,s.y,s.z);
    m.rotation.set(s.rx,s.ry,s.rz);
    m.userData.coord.set(s.cx,s.cy,s.cz);
    root.attach(m);
  });
  renderer.render(scene,camera);
}
function addMoveNotation(n){
  moveAlg.push(n); moveCount++;
  moveAlgEl.textContent = moveAlg.join(' ');
  moveCountEl.textContent = String(moveCount);
}

// Orbit vs rotate
let isOrbit=false,lastX=0,lastY=0, rotating=false;
function orbitStart(x,y){ isOrbit=true; lastX=x; lastY=y; }
function orbitMove(x,y){ if(!isOrbit||rotating) return; const dx=(x-lastX)/120, dy=(y-lastY)/120; root.rotation.y+=dx; root.rotation.x+=dy; lastX=x; lastY=y; }
function orbitEnd(){ isOrbit=false; }

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let press=null;
function hitsAt(cx,cy){
  const r=renderer.domElement.getBoundingClientRect();
  ndc.x=((cx-r.left)/r.width)*2-1; ndc.y= -((cy-r.top)/r.height)*2+1;
  ray.setFromCamera(ndc, camera);
  const inters = ray.intersectObjects(root.children, true);
  if(!inters.length) return [];
  const norm = inters.map(h=>{
    let obj=h.object;
    while(obj && obj.parent && obj.parent!==root){ obj = obj.parent; }
    return {...h, object: obj};
  });
  return norm;
}
function onDown(e){ const t=e.touches?e.touches[0]:e; const h=hitsAt(t.clientX,t.clientY);
  if(h.length){ press={hit:h[0],x:t.clientX,y:t.clientY}; } else { orbitStart(t.clientX,t.clientY); } }
function onMove(e){ const t=e.touches?e.touches[0]:e;
  if(isOrbit&&!rotating){ orbitMove(t.clientX,t.clientY); return; }
  if(!press||rotating) return;
  const dx=t.clientX-press.x, dy=t.clientY-press.y;
  if(Math.hypot(dx,dy)>18){ rotateFromGesture(press.hit,dx,dy); press=null; } }
function onUp(){ orbitEnd(); press=null; }

renderer.domElement.addEventListener('mousedown', onDown);
window.addEventListener('mousemove', onMove);
window.addEventListener('mouseup', onUp);
renderer.domElement.addEventListener('touchstart', onDown, {passive:true});
window.addEventListener('touchmove', onMove, {passive:true});
window.addEventListener('touchend', onUp);

// Core layer rotation primitive (used by gestures & keyboard)
async function rotateLayer(axisChar, layerCoord, sign, record=true){
  if(rotating) return;
  rotating=true;
  if(record) pushHistory();

  const axis = axisChar==='X' ? new THREE.Vector3(1,0,0)
            : axisChar==='Y' ? new THREE.Vector3(0,1,0)
            : new THREE.Vector3(0,0,1);
  const picker = axisChar==='X' ? (m)=> nearly(m.userData.coord.x, layerCoord)
               : axisChar==='Y' ? (m)=> nearly(m.userData.coord.y, layerCoord)
               :                   (m)=> nearly(m.userData.coord.z, layerCoord);
  const group = new THREE.Group(), layer=[];
  cubelets.forEach(m=>{ if(picker(m)){ layer.push(m); group.attach(m); } });
  scene.add(group);

  const target=(Math.PI/2)*sign, dur=200, t0=performance.now();
  await new Promise(res=>{
    function anim(now){
      const t=Math.min(1,(now-t0)/dur);
      group.rotation.x = axis.x*target*t;
      group.rotation.y = axis.y*target*t;
      group.rotation.z = axis.z*target*t;
      renderer.render(scene,camera);
      if(t<1) requestAnimationFrame(anim); else res();
    }
    requestAnimationFrame(anim);
  });

  const s=size+gap;
  layer.forEach(m=>{
    m.applyMatrix4(group.matrix);
    m.position.set(Math.round(m.position.x/s)*s, Math.round(m.position.y/s)*s, Math.round(m.position.z/s)*s);
    m.userData.coord.set(Math.round(m.position.x/s), Math.round(m.position.y/s), Math.round(m.position.z/s));
    m.rotation.x = snap90(m.rotation.x);
    m.rotation.y = snap90(m.rotation.y);
    m.rotation.z = snap90(m.rotation.z);
  });
  layer.forEach(m=>root.attach(m)); scene.remove(group);
  rotating=false; renderer.render(scene,camera);
}

// Gesture → deduce axis/layer/sign and also notation
function rotateFromGesture(hit, dx, dy){
  if(rotating) return;
  const faceN = hit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();
  const dom = Math.abs(dx)>Math.abs(dy)?'x':'y';
  let axisChar, layerCoord, sign;
  if(Math.abs(faceN.z)>0.9){ axisChar = (dom==='x')?'Y':'X'; }
  else if(Math.abs(faceN.x)>0.9){ axisChar = (dom==='x')?'Y':'Z'; }
  else { axisChar = (dom==='x')?'Z':'X'; }
  sign = (dom==='x')? (dx>0?1:-1) : (dy<0?1:-1);
  const c = hit.object.userData.coord;
  layerCoord = axisChar==='X'? c.x : axisChar==='Y'? c.y : c.z;

  let notation = '?';
  if(axisChar==='Y' && nearly(layerCoord, +1)) notation = (sign===-1)?'U':\"U'\";
  else if(axisChar==='Y' && nearly(layerCoord, -1)) notation = (sign===+1)?'D':\"D'\";
  else if(axisChar==='X' && nearly(layerCoord, +1)) notation = (sign===+1)?'R':\"R'\";
  else if(axisChar==='X' && nearly(layerCoord, -1)) notation = (sign===-1)?'L':\"L'\";
  else if(axisChar==='Z' && nearly(layerCoord, +1)) notation = (sign===+1)?'F':\"F'\";
  else if(axisChar==='Z' && nearly(layerCoord, -1)) notation = (sign===-1)?'B':\"B'\";
  else notation = `${axisChar}${layerCoord>0?'+':'-'}${sign>0?'+':'-'}`;

  addMoveNotation(notation);
  rotateLayer(axisChar, layerCoord, sign, /*record*/true);
}

// Keyboard / algorithm playback
function parseAlg(alg){
  return alg.trim().split(/\s+/).filter(Boolean).map(tok=>tok.toUpperCase());
}
async function playAlg(alg){
  const tokens = parseAlg(alg);
  for(const t of tokens){
    let base=t[0], mod=t.slice(1);
    const dbl = mod.includes('2');
    const prime = mod.includes(\"'\") || mod.includes('’');
    const reps = dbl?2:1;
    for(let r=0;r<reps;r++){
      if(base==='U') await rotateLayer('Y', +1, prime?-1:+1, true);
      else if(base==='D') await rotateLayer('Y', -1, prime?+1:-1, true);
      else if(base==='R') await rotateLayer('X', +1, prime?+1:-1, true);
      else if(base==='L') await rotateLayer('X', -1, prime?-1:+1, true);
      else if(base==='F') await rotateLayer('Z', +1, prime?+1:-1, true);
      else if(base==='B') await rotateLayer('Z', -1, prime?-1:+1, true);
      addMoveNotation(base + (dbl? '2': (prime?\"'\":'')));
    }
  }
}

// Buttons
document.getElementById('btn-reset').addEventListener('click', ()=>{
  buildSolved(); root.rotation.set(0,0,0);
  history=[]; future=[]; moveAlg=[]; moveCount=0;
  moveAlgEl.textContent=''; moveCountEl.textContent='0';
  renderer.render(scene,camera);
});
document.getElementById('btn-scramble').addEventListener('click', async ()=>{
  if(rotating) return;
  const faces = ['U','D','L','R','F','B'];
  let last=null, seq=[];
  for(let i=0;i<20;i++){
    let f; do{ f = faces[(Math.random()*6)|0]; } while(f===last);
    last=f;
    const mod = Math.random()<0.33 ? \"'\" : (Math.random()<0.5 ? '2' : '');
    seq.push(f+mod);
  }
  await playAlg(seq.join(' '));
});
document.getElementById('btn-undo').addEventListener('click', ()=>{
  if(!history.length) return;
  const snap = history.pop();
  const curr = cubelets.map(m=>({
    x:m.position.x, y:m.position.y, z:m.position.z,
    rx:m.rotation.x, ry:m.rotation.y, rz:m.rotation.z,
    cx:m.userData.coord.x, cy:m.userData.coord.y, cz:m.userData.coord.z
  }));
  future.push(curr);
  restoreState(snap);
  if(moveAlg.length){ moveAlg.pop(); moveCount=Math.max(0,moveCount-1); }
  moveAlgEl.textContent = moveAlg.join(' ');
  moveCountEl.textContent = String(moveCount);
});
document.getElementById('btn-redo').addEventListener('click', ()=>{
  if(!future.length) return;
  const snap = future.pop();
  history.push(cubelets.map(m=>({
    x:m.position.x, y:m.position.y, z:m.position.z,
    rx:m.rotation.x, ry:m.rotation.y, rz:m.rotation.z,
    cx:m.userData.coord.x, cy:m.userData.coord.y, cz:m.userData.coord.z
  })));
  restoreState(snap);
});
document.getElementById('btn-copy').addEventListener('click', ()=>{
  const s = moveAlg.join(' ');
  navigator.clipboard?.writeText(s);
});

// Keyboard
window.addEventListener('keydown', async (e)=>{
  const k = e.key.toUpperCase();
  if('UDLRFB'.includes(k)){
    const prime = e.shiftKey;
    const dbl = e.altKey || e.ctrlKey || e.metaKey;
    let tok = k + (prime?\"'\":'') + (dbl?'2':'');
    await playAlg(tok);
  }
});

// Init
buildSolved();
onResize();
(function loop(){ renderer.render(scene,camera); requestAnimationFrame(loop); })();
})();