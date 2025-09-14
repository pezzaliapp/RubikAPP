(()=>{
'use strict';

// ---- colori (per-face materials)
const COLORS = { U:0xffffff, D:0xffd000, F:0x00a74a, B:0x2f6ee6, L:0xff6c00, R:0xd80027 };

// utils
const nearly=(a,b,eps=1e-4)=>Math.abs(a-b)<eps;
const snap90=r=>Math.round(r/(Math.PI/2))*(Math.PI/2);
function rotateCoord(v,axis,sign){
  const x=v.x,y=v.y,z=v.z;
  if(axis==='X') return new THREE.Vector3(x,  sign>0? z:-z, sign>0?-y:y);
  if(axis==='Y') return new THREE.Vector3(sign>0?-z:z, y,  sign>0? x:-x);
  return               new THREE.Vector3(sign>0? y:-y, sign>0?-x:x, z);
}

const stage=document.getElementById('stage');
const scene=new THREE.Scene(); scene.background=new THREE.Color(0x2a3142);
const camera=new THREE.PerspectiveCamera(45, 1, 0.1, 100); camera.position.set(4.2,3.8,5.8); camera.lookAt(0,0,0);
const renderer=new THREE.WebGLRenderer({antialias:true, alpha:false, logarithmicDepthBuffer:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.setSize(stage.clientWidth, stage.clientHeight);
stage.appendChild(renderer.domElement);

// luci sobrie
scene.add(new THREE.AmbientLight(0xffffff, .9));
const key=new THREE.DirectionalLight(0xffffff,.8); key.position.set(4,7,6); scene.add(key);

// resize
function onResize(){ const w=stage.clientWidth,h=stage.clientHeight; camera.aspect=w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h); }
window.addEventListener('resize', onResize, {passive:true}); new ResizeObserver(onResize).observe(stage);

// build cube con 6 materiali per faccia
const size=0.98, gap=0.012;
const geo=new THREE.BoxGeometry(size,size,size); // order: +x,-x,+y,-y,+z,-z
const root=new THREE.Group(); scene.add(root); const cubelets=[];

function matsFor(i,j,k){
  // base plastica
  const plast = ()=> new THREE.MeshLambertMaterial({color:0x20232c});
  const m=[plast(),plast(),plast(),plast(),plast(),plast()];
  if(i=== 1) m[0]=new THREE.MeshBasicMaterial({color:COLORS.R});
  if(i===-1) m[1]=new THREE.MeshBasicMaterial({color:COLORS.L});
  if(j=== 1) m[2]=new THREE.MeshBasicMaterial({color:COLORS.U});
  if(j===-1) m[3]=new THREE.MeshBasicMaterial({color:COLORS.D});
  if(k=== 1) m[4]=new THREE.MeshBasicMaterial({color:COLORS.F});
  if(k===-1) m[5]=new THREE.MeshBasicMaterial({color:COLORS.B});
  return m;
}

function addCubelet(i,j,k){
  const mesh=new THREE.Mesh(geo, matsFor(i,j,k));
  mesh.frustumCulled=false;
  const s=size+gap;
  mesh.position.set(i*s,j*s,k*s);
  mesh.userData.coord=new THREE.Vector3(i,j,k);
  root.add(mesh); cubelets.push(mesh);
}

function buildSolved(){
  while(root.children.length) root.remove(root.children[0]);
  cubelets.length=0;
  for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++) addCubelet(i,j,k);
}
buildSolved(); onResize();

// aggiorna i colori delle 6 facce in base alla coord (quale lato è esterno)
function repaintFaces(){
  for(const m of cubelets){
    const c=m.userData.coord;
    const mats=m.material;
    // +x,-x,+y,-y,+z,-z
    mats[0].color.setHex(c.x=== 1?COLORS.R:0x20232c);
    mats[1].color.setHex(c.x===-1?COLORS.L:0x20232c);
    mats[2].color.setHex(c.y=== 1?COLORS.U:0x20232c);
    mats[3].color.setHex(c.y===-1?COLORS.D:0x20232c);
    mats[4].color.setHex(c.z=== 1?COLORS.F:0x20232c);
    mats[5].color.setHex(c.z===-1?COLORS.B:0x20232c);
  }
}

// interazione: orbita o rotazione layer da gesto
let isOrbit=false,lastX=0,lastY=0, rotating=false, press=null;
function orbitStart(x,y){ isOrbit=true; lastX=x; lastY=y; }
function orbitMove(x,y){ if(!isOrbit||rotating) return; const dx=(x-lastX)/120,dy=(y-lastY)/120; root.rotation.y+=dx; root.rotation.x+=dy; lastX=x; lastY=y; }
function orbitEnd(){ isOrbit=false; }

const ray=new THREE.Raycaster(), ndc=new THREE.Vector2();
function hitsAt(cx,cy){
  const r=renderer.domElement.getBoundingClientRect();
  ndc.x=((cx-r.left)/r.width)*2-1; ndc.y= -((cy-r.top)/r.height)*2+1;
  ray.setFromCamera(ndc,camera);
  return ray.intersectObjects(root.children, true);
}

function onDown(e){ const t=e.touches?e.touches[0]:e; const hs=hitsAt(t.clientX,t.clientY); if(hs.length){ press={hit:hs[0],x:t.clientX,y:t.clientY}; } else { orbitStart(t.clientX,t.clientY); } }
function onMove(e){ const t=e.touches?e.touches[0]:e; if(isOrbit&&!rotating){ orbitMove(t.clientX,t.clientY); return; } if(!press||rotating) return; const dx=t.clientX-press.x, dy=t.clientY-press.y; if(Math.hypot(dx,dy)>18){ rotateFromGesture(press.hit,dx,dy); press=null; } }
function onUp(){ orbitEnd(); press=null; }

renderer.domElement.addEventListener('mousedown', onDown);
window.addEventListener('mousemove', onMove);
window.addEventListener('mouseup', onUp);
renderer.domElement.addEventListener('touchstart', onDown, {passive:true});
window.addEventListener('touchmove', onMove, {passive:true});
window.addEventListener('touchend', onUp);

// rotazione layer
function rotateLayer(axisChar, layerCoord, sign){
  if(rotating) return;
  rotating=true;
  const axis = axisChar==='X'? new THREE.Vector3(1,0,0) : axisChar==='Y'? new THREE.Vector3(0,1,0) : new THREE.Vector3(0,0,1);
  const pick = axisChar==='X'? m=>nearly(m.userData.coord.x,layerCoord) : axisChar==='Y'? m=>nearly(m.userData.coord.y,layerCoord) : m=>nearly(m.userData.coord.z,layerCoord);

  const group=new THREE.Group(), layer=[];
  cubelets.forEach(m=>{ if(pick(m)){ layer.push(m); group.attach(m);} });
  scene.add(group);

  const target=(Math.PI/2)*sign, dur=180, t0=performance.now();
  function anim(now){
    const t=Math.min(1,(now-t0)/dur);
    group.rotation.x=axis.x*target*t; group.rotation.y=axis.y*target*t; group.rotation.z=axis.z*target*t;
    renderer.render(scene,camera);
    if(t<1) requestAnimationFrame(anim); else bake();
  }
  requestAnimationFrame(anim);

  function bake(){
    // aggiorna coord logiche
    layer.forEach(m=>{ m.userData.coord.copy( rotateCoord(m.userData.coord, axisChar, sign) ); });
    // riattacca al root e snap
    const s=size+gap;
    layer.forEach(m=>root.attach(m)); scene.remove(group);
    layer.forEach(m=>{
      const c=m.userData.coord; m.position.set(c.x*s,c.y*s,c.z*s);
      if(axisChar==='X') m.rotation.x=snap90(m.rotation.x + sign*Math.PI/2);
      if(axisChar==='Y') m.rotation.y=snap90(m.rotation.y + sign*Math.PI/2);
      if(axisChar==='Z') m.rotation.z=snap90(m.rotation.z + sign*Math.PI/2);
      if(m.geometry.computeVertexNormals) m.geometry.computeVertexNormals();
      m.updateMatrixWorld(true);
    });
    repaintFaces();
    rotating=false; renderer.render(scene,camera);
  }
}

function rotateFromGesture(hit, dx, dy){
  if(rotating) return;
  // normal della faccia colpita in world space
  const n = hit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();
  const dom = Math.abs(dx)>Math.abs(dy)?'x':'y';
  let axisChar;
  if(Math.abs(n.z)>0.9){ axisChar = (dom==='x')?'Y':'X'; }    // fronte/retro
  else if(Math.abs(n.x)>0.9){ axisChar = (dom==='x')?'Y':'Z'; } // destra/sinistra
  else { axisChar = (dom==='x')?'Z':'X'; }                     // alto/basso
  const sign = (dom==='x') ? (dx>0?1:-1) : (dy<0?1:-1);
  // il layer è determinato dalla coord del cubetto cliccato
  const c = hit.object.userData.coord;
  const layerCoord = axisChar==='X'? c.x : axisChar==='Y'? c.y : c.z;
  rotateLayer(axisChar, layerCoord, sign);
}

// UI
document.getElementById('btn-reset').addEventListener('click', ()=>{
  root.rotation.set(0,0,0); buildSolved(); repaintFaces(); renderer.render(scene,camera);
});
document.getElementById('btn-scramble').addEventListener('click', async ()=>{
  if(rotating) return;
  const axes=['X','Y','Z'], layers=[-1,0,1], signs=[-1,1];
  for(let i=0;i<20;i++){
    const A=axes[(Math.random()*3)|0], L=layers[(Math.random()*3)|0], S=signs[(Math.random()*2)|0];
    await new Promise(res=>{ const iv=setInterval(()=>{ if(!rotating){ clearInterval(iv); res(); } }, 14); rotateLayer(A,L,S); });
  }
});

// loop
(function loop(){ renderer.render(scene,camera); requestAnimationFrame(loop); })();
})();