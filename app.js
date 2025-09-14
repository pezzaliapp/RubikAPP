(()=>{
const COLORS = { U:0xffffff, D:0xffd000, F:0x00a74a, B:0x2f6ee6, L:0xff6c00, R:0xd80027 };
const stage = document.getElementById('stage');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a3142);

// camera + renderer
const camera = new THREE.PerspectiveCamera(45, stage.clientWidth/stage.clientHeight, 0.1, 100);
camera.position.set(4.5,4.5,6);
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(stage.clientWidth, stage.clientHeight);
stage.appendChild(renderer.domElement);

// luci
scene.add(new THREE.AmbientLight(0xffffff,0.8));
const dir = new THREE.DirectionalLight(0xffffff,0.6); dir.position.set(5,10,7); scene.add(dir);

const root = new THREE.Group(); scene.add(root);
const cubelets=[];
const size=0.98,gap=0.04;

// costruzione cubo: per-face materials
function buildSolved(){
  while(root.children.length) root.remove(root.children[0]);
  cubelets.length=0;
  for(let i=-1;i<=1;i++){
    for(let j=-1;j<=1;j++){
      for(let k=-1;k<=1;k++){
        const mats=[];
        for(let f=0; f<6; f++) mats.push(new THREE.MeshLambertMaterial({color:0x20232c}));
        if(i===1) mats[0]=new THREE.MeshBasicMaterial({color:COLORS.R});
        if(i===-1) mats[1]=new THREE.MeshBasicMaterial({color:COLORS.L});
        if(j===1) mats[2]=new THREE.MeshBasicMaterial({color:COLORS.U});
        if(j===-1) mats[3]=new THREE.MeshBasicMaterial({color:COLORS.D});
        if(k===1) mats[4]=new THREE.MeshBasicMaterial({color:COLORS.F});
        if(k===-1) mats[5]=new THREE.MeshBasicMaterial({color:COLORS.B});
        const geo=new THREE.BoxGeometry(size,size,size);
        const mesh=new THREE.Mesh(geo,mats);
        mesh.position.set(i*(size+gap),j*(size+gap),k*(size+gap));
        mesh.userData.coord={x:i,y:j,z:k};
        root.add(mesh); cubelets.push(mesh);
      }
    }
  }
}
buildSolved();

// resize
window.addEventListener('resize',()=>{
  camera.aspect=stage.clientWidth/stage.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(stage.clientWidth, stage.clientHeight);
});

// interazione orbit semplice
let isDragging=false,lastX=0,lastY=0;
stage.addEventListener('mousedown',e=>{isDragging=true;lastX=e.clientX;lastY=e.clientY;});
window.addEventListener('mouseup',()=>isDragging=false);
window.addEventListener('mousemove',e=>{
  if(isDragging){
    const dx=(e.clientX-lastX)/100,dy=(e.clientY-lastY)/100;
    root.rotation.y+=dx; root.rotation.x+=dy;
    lastX=e.clientX; lastY=e.clientY;
  }
});

// scramble & reset
document.getElementById('btn-reset').onclick=()=>{buildSolved();};
document.getElementById('btn-scramble').onclick=()=>{
  root.rotation.x=Math.random()*Math.PI*2;
  root.rotation.y=Math.random()*Math.PI*2;
};

// loop
(function loop(){renderer.render(scene,camera);requestAnimationFrame(loop);})();
})();