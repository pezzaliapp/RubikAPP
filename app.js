(()=>{
// Colors
const STICKER = { U:0xffffff, D:0xffd000, F:0x00a74a, B:0x2f6ee6, L:0xff6c00, R:0xd80027 };

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

// "Sticker planes" = colori indipendenti dalla luce
function makeSticker(color, axis, sign){
  const g = new THREE.PlaneGeometry(0.96,0.96);
  const m = new THREE.MeshBasicMaterial({color});
  const s = new THREE.Mesh(g, m);
  const d = 0.505;
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
for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++) addCubelet(i,j,k);

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
  return ray.intersectObjects(cubelets);
}
function onDown(e){ const t=e.touches?e.touches[0]:e; const h=hitsAt(t.clientX,t.clientY);
  if(h.length){ press={hit:h[0],x:t.clientX,y:t.clientY}; } else { orbitStart(t.clientX,t.clientY); } }
function onMove(e){ const t=e.touches?e.touches[0]:e;
  if(isOrbit&&!rotating){ orbitMove(t.clientX,t.clientY); return; }
  if(!press||rotating) return;
  const dx=t.clientX-press.x, dy=t.clientY-press.y;
  if(Math.hypot(dx,dy)>18){ rotateLayer(press.hit,dx,dy); press=null; } }
function onUp(){ orbitEnd(); press=null; }

renderer.domElement.addEventListener('mousedown', onDown);
window.addEventListener('mousemove', onMove);
window.addEventListener('mouseup', onUp);
renderer.domElement.addEventListener('touchstart', onDown, {passive:true});
window.addEventListener('touchmove', onMove, {passive:true});
window.addEventListener('touchend', onUp);

function rotateLayer(hit, dx, dy){
  if(rotating) return; rotating=true;
  const faceN = hit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();
  const dom = Math.abs(dx)>Math.abs(dy)?'x':'y';
  let axis = new THREE.Vector3();
  if(Math.abs(faceN.z)>0.9){ axis = (dom==='x')? new THREE.Vector3(0,1,0) : new THREE.Vector3(1,0,0); }
  else if(Math.abs(faceN.x)>0.9){ axis = (dom==='x')? new THREE.Vector3(0,1,0) : new THREE.Vector3(0,0,1); }
  else { axis = (dom==='x')? new THREE.Vector3(0,0,1) : new THREE.Vector3(1,0,0); }
  const sign = (dom==='x')? (dx>0?1:-1) : (dy<0?1:-1);
  const coord = hit.object.userData.coord.clone();
  let pick;
  if(Math.abs(axis.x)>0.9) pick = m=> nearly(m.userData.coord.x, coord.x);
  else if(Math.abs(axis.y)>0.9) pick = m=> nearly(m.userData.coord.y, coord.y);
  else pick = m=> nearly(m.userData.coord.z, coord.z);

  const group = new THREE.Group(), layer=[];
  cubelets.forEach(m=>{ if(pick(m)){ layer.push(m); group.attach(m); } });
  scene.add(group);

  const target=(Math.PI/2)*sign, dur=220, t0=performance.now();
  function anim(now){
    const t=Math.min(1,(now-t0)/dur);
    group.rotation.x = axis.x*target*t;
    group.rotation.y = axis.y*target*t;
    group.rotation.z = axis.z*target*t;
    renderer.render(scene,camera);
    if(t<1) requestAnimationFrame(anim); else bake();
  }
  requestAnimationFrame(anim);

  function bake(){
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
}

// Buttons
document.getElementById('btn-reset').addEventListener('click', ()=>{
  while(root.children.length) root.remove(root.children[0]); cubelets.length=0;
  for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++) addCubelet(i,j,k);
  root.rotation.set(0,0,0); renderer.render(scene,camera);
});
document.getElementById('btn-scramble').addEventListener('click', async ()=>{
  if(rotating) return;
  for(let i=0;i<20;i++){
    const rand = cubelets[(Math.random()*cubelets.length)|0];
    const fake = {object:rand, face:{normal:new THREE.Vector3(0,0,1)}};
    const dx=(Math.random()>.5?1:-1)*30, dy=(Math.random()>.5?1:-1)*30;
    await new Promise(res=>{ const iv=setInterval(()=>{ if(!rotating){ clearInterval(iv); res(); }}, 18); rotateLayer(fake,dx,dy); });
  }
});

onResize();
(function loop(){ renderer.render(scene,camera); requestAnimationFrame(loop); })();
})();