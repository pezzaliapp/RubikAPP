(()=>{
// === Palette ===
const COLORS = { U:0xffffff, D:0xffd000, F:0x00a74a, B:0x2f6ee6, L:0xff6c00, R:0xd80027 };

const stage = document.getElementById('stage');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a3142);

// Camera & Renderer
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(5,4.5,6);
camera.lookAt(0,0,0);

const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
stage.appendChild(renderer.domElement);

// Resize
function onResize(){
  const w = stage.clientWidth, h = stage.clientHeight;
  camera.aspect = w/h; camera.updateProjectionMatrix();
  renderer.setSize(w,h);
  renderer.render(scene,camera);
}
window.addEventListener('resize', onResize);
onResize();

// Lights
scene.add(new THREE.AmbientLight(0xffffff,0.9));

// Utils
const nearly=(a,b,eps=1e-4)=>Math.abs(a-b)<eps;
const snap90=r=>Math.round(r/(Math.PI/2))*(Math.PI/2);
function rotateCoord(v,axis,sign){
  const x=v.x,y=v.y,z=v.z;
  if(axis==='X') return new THREE.Vector3(x, sign>0?z:-z, sign>0?-y:y);
  if(axis==='Y') return new THREE.Vector3(sign>0?-z:z, y, sign>0?x:-x);
  return new THREE.Vector3(sign>0?y:-y, sign>0?-x:x, z);
}

// Root + cubelets
const root=new THREE.Group(); scene.add(root);
const cubelets=[];
const SIZE=0.98, GAP=0.012;
const GEO=new THREE.BoxGeometry(SIZE,SIZE,SIZE);

function materialsFor(i,j,k){
  const plastic=()=>new THREE.MeshLambertMaterial({color:0x20232c});
  const m=[plastic(),plastic(),plastic(),plastic(),plastic(),plastic()];
  if(i===1) m[0]=new THREE.MeshBasicMaterial({color:COLORS.R});
  if(i===-1) m[1]=new THREE.MeshBasicMaterial({color:COLORS.L});
  if(j===1) m[2]=new THREE.MeshBasicMaterial({color:COLORS.U});
  if(j===-1) m[3]=new THREE.MeshBasicMaterial({color:COLORS.D});
  if(k===1) m[4]=new THREE.MeshBasicMaterial({color:COLORS.F});
  if(k===-1) m[5]=new THREE.MeshBasicMaterial({color:COLORS.B});
  return m;
}

function addCubelet(i,j,k){
  const mesh=new THREE.Mesh(GEO,materialsFor(i,j,k));
  const s=SIZE+GAP;
  mesh.position.set(i*s,j*s,k*s);
  mesh.userData.coord=new THREE.Vector3(i,j,k);
  mesh.frustumCulled=false;
  root.add(mesh); cubelets.push(mesh);
}

function buildSolved(){
  while(root.children.length) root.remove(root.children[0]);
  cubelets.length=0;
  for(let i=-1;i<=1;i++) for(let j=-1;j<=1;j++) for(let k=-1;k<=1;k++) addCubelet(i,j,k);
}
function repaintFaces(){
  for(const m of cubelets){
    const c=m.userData.coord, mats=m.material;
    mats[0].color.setHex(c.x===1?COLORS.R:0x20232c);
    mats[1].color.setHex(c.x===-1?COLORS.L:0x20232c);
    mats[2].color.setHex(c.y===1?COLORS.U:0x20232c);
    mats[3].color.setHex(c.y===-1?COLORS.D:0x20232c);
    mats[4].color.setHex(c.z===1?COLORS.F:0x20232c);
    mats[5].color.setHex(c.z===-1?COLORS.B:0x20232c);
  }
  renderer.render(scene,camera);
}
buildSolved();
repaintFaces();

// Orbit control semplice
let isOrbit=false,lastX=0,lastY=0;
stage.addEventListener('mousedown',e=>{isOrbit=true;lastX=e.clientX;lastY=e.clientY;});
window.addEventListener('mouseup',()=>{isOrbit=false;});
window.addEventListener('mousemove',e=>{
  if(!isOrbit)return;
  const dx=(e.clientX-lastX)/120, dy=(e.clientY-lastY)/120;
  root.rotation.y+=dx; root.rotation.x+=dy;
  lastX=e.clientX; lastY=e.clientY;
});

// Rotate layer
let rotating=false;
async function rotateLayer(axisChar,layerCoord,sign){
  if(rotating)return; rotating=true;
  const axis=axisChar==='X'?new THREE.Vector3(1,0,0):axisChar==='Y'?new THREE.Vector3(0,1,0):new THREE.Vector3(0,0,1);
  const pick=axisChar==='X'?m=>nearly(m.userData.coord.x,layerCoord):axisChar==='Y'?m=>nearly(m.userData.coord.y,layerCoord):m=>nearly(m.userData.coord.z,layerCoord);
  const group=new THREE.Group(), layer=[];
  cubelets.forEach(m=>{if(pick(m)){layer.push(m);group.attach(m);}});
  scene.add(group);
  const target=(Math.PI/2)*sign,dur=200,t0=performance.now();
  await new Promise(res=>{
    function anim(now){const t=Math.min(1,(now-t0)/dur);
      group.rotation.set(axis.x*target*t,axis.y*target*t,axis.z*target*t);
      renderer.render(scene,camera);
      if(t<1)requestAnimationFrame(anim);else res();
    }requestAnimationFrame(anim);
  });
  const s=SIZE+GAP;
  layer.forEach(m=>{
    m.userData.coord.copy(rotateCoord(m.userData.coord,axisChar,sign));
    m.position.set(m.userData.coord.x*s,m.userData.coord.y*s,m.userData.coord.z*s);
    if(axisChar==='X') m.rotation.x=snap90(m.rotation.x+sign*Math.PI/2);
    if(axisChar==='Y') m.rotation.y=snap90(m.rotation.y+sign*Math.PI/2);
    if(axisChar==='Z') m.rotation.z=snap90(m.rotation.z+sign*Math.PI/2);
  });
  layer.forEach(m=>root.attach(m)); scene.remove(group);
  repaintFaces(); rotating=false;
}

// Pulsanti
document.getElementById('btn-reset').addEventListener('click',()=>{root.rotation.set(0,0,0);buildSolved();repaintFaces();});
document.getElementById('btn-scramble').addEventListener('click',async()=>{
  for(let i=0;i<20;i++){
    const rand=cubelets[(Math.random()*cubelets.length)|0];
    await new Promise(res=>{const iv=setInterval(()=>{if(!rotating){clearInterval(iv);res();}},18);rotateLayer('X',rand.userData.coord.x,Math.random()>.5?1:-1);});
  }
});

// Loop
(function loop(){renderer.render(scene,camera);requestAnimationFrame(loop);})();
})();