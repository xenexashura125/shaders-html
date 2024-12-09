import {Scene, PerspectiveCamera, Color, Object3D, PlaneGeometry, BufferGeometry, BufferAttribute, Vector2, Vector3, MathUtils} from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {SimplexNoise} from "three/addons/math/SimplexNoise.js";
console.clear();

let noise = new SimplexNoise();

class WireRenderer {
    constructor(cnv){
        this.domElement = cnv;
        this.context = cnv.getContext("2d");
        this.clearColor = "black";
        this.halfSize = new Vector3();
        this.context.lineCap = "round";
    }
    setBackgroundGradient(colorStops){
        this.clearColor = this.context.createLinearGradient(0, 0, 0, this.domElement.height);
        colorStops.forEach(cs => {
            this.clearColor.addColorStop(cs.offset, cs.color);
        })
    }
    setSize(width, height){
        this.domElement.width = width;
        this.domElement.height = height;
        this.halfSize.set(width * 0.5, height * 0.5);
    }
    render(scene, camera){
        scene.updateMatrixWorld();
        camera.updateMatrixWorld();
        
        let ctx = this.context;
        ctx.lineCap = "round";
        ctx.fillStyle = this.clearColor;
        ctx.fillRect(0, 0, this.domElement.width, this.domElement.height);
        
        scene.traverse( object => {
        if (object.isLines){
            let g = object.geometry;
            let m = object.material;
            let index = g.index;
            ctx.lineWidth = m.lineWidth;
            ctx.strokeStyle = m.color;
            ctx.beginPath();
            for(let i = 0; i < index.count * 0.5; i++){
                object.linePoints.forEach((lp, idx) => {
                    lp.fromBufferAttribute(g.attributes.position, index.getX(i * 2 + idx));
                    object.localToWorld(lp);
                    lp.project(camera);
                    lp.y *= -1; 
                    lp.multiply(this.halfSize).add(this.halfSize);
                })
                ctx.moveTo(object.linePoints[0].x, object.linePoints[0].y);
                ctx.lineTo(object.linePoints[1].x, object.linePoints[1].y);
            }
            ctx.stroke();
        }
        })
        
    }
}

class Lines extends Object3D{
    constructor(geometry, material){
        super();
        this.geometry = geometry;
        this.material = material;
        this.isLines = true;
        this.linePoints = [new Vector3(), new Vector3()];
    }
}  

let scene = new Scene();
let camera = new PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 0.25, 10.25);
let renderer = new WireRenderer(cnv);
renderer.setSize(innerWidth, innerHeight);
let backGrd = [{offset: 0, color: "#f48"}, {offset: 0.5, color: "#f48"}, {offset: 1, color: "maroon"}];
renderer.setBackgroundGradient(backGrd);
window.addEventListener("resize", event => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    renderer.setBackgroundGradient(backGrd);
})

let controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enabled = false;

let g = new PlaneGeometry(20, 22, 15, 11).translate(0, 1, 0).rotateX(-Math.PI * 0.5);
ToQuads(g);

let pos = g.attributes.position;
let isMoving = [];
for(let i = 0; i < pos.count; i++){
    let z = pos.getZ(i);
    let moving = 1;
    if(z > 9 || z < -10){
        moving = 0;
    }
    if (z < -10){
        z -= 2 * Math.sign(z);
    }
    isMoving.push(moving);
    pos.setZ(i, z);
}
g.setAttribute("isMoving", new BufferAttribute(new Float32Array(isMoving), 1));
g.setAttribute("posInit", g.attributes.position.clone());
let posInit = g.attributes.posInit;
let moves = g.attributes.isMoving;
let uvs = g.attributes.uv;
let uv = new Vector2();
let speed = 1;
function waveGridByTime(time){
    for(let i = 0; i < g.attributes.position.count; i++){
            uv.fromBufferAttribute(uvs, i);
            let maxHeight = 4;
            let valley = MathUtils.smoothstep(Math.abs(uv.x - 0.5), 0.05, 0.25) * maxHeight;
            
            let currZ = posInit.getZ(i);
            let currX = posInit.getX(i);
            let currScale = 1 / 10 * 2;
        if(moves.getX(i) == 0) {
            let n1 = Math.floor((time * speed / 2)) * 2;
            let nz1 = noise.noise(currX * currScale, (currZ - n1) * currScale) * 0.5 + 0.5;
            let n2 = (Math.floor((time * speed / 2)) + 1) * 2;
            let nz2 = noise.noise(currX * currScale, (currZ - n2) * currScale) * 0.5 + 0.5;
            let noize = (nz2 - nz1) * (((time * speed) % 2) / 2) + nz1; 
            pos.setY(i, noize * valley);
        } else {
            let zGap = (time * speed) % 2;
            let noize = noise.noise(currX * currScale, (currZ - Math.floor((time * speed / 2)) * 2) * currScale) * 0.5 + 0.5;
            pos.setY(i, noize * valley);
            pos.setZ(i, currZ + zGap);
        }
    }
}
let m = {
  lineWidth: 4,
  color: "aquamarine",
}
let grid = new Lines(g, m);

let sun = new Object3D();
let r = 10;
let sunLines = 24;
let sunLineHeightRatio = 0.5;
let c1 = new Color(0xff4488), c2 = new Color(0xffff00), c = new Color();
let gSun= new PlaneGeometry().translate(0, 0.5, 0).setIndex([0, 1, 1, 3, 3, 2, 2, 0]);
for(let i = 0; i < sunLines; i++){
    let hStep = i * (r / sunLines);
    let w = Math.sqrt(r * r - hStep * hStep);
    let sunPart = new Lines(
        gSun,
        {
            lineWidth: 6,
            color: "#" + c.lerpColors(c1, c2, i / (sunLines - 1)).getHexString()
        }
    )
    sunPart.scale.set(w * 2, r / sunLines * sunLineHeightRatio, 1);
    sunPart.position.set(0, hStep, 0);
    sunPart.userData.scale = sunPart.scale.clone();
    sun.add(sunPart);
}
sun.position.set(0, 0, -10);
function waveSunByTime(time){
    sun.children.forEach(strip => {
        let t = time;
        let yRatio = strip.position.y / r ;
        let yNoise = noise.noise(yRatio * 4 - t, 1) * (yRatio * yRatio);
        let xNoiseScale = noise.noise(yRatio * 4 - t, 2) * (yRatio * yRatio);
        strip.scale.x = strip.userData.scale.x + xNoiseScale;
        strip.position.x = yNoise * 0.5;
    })
}

let gPalm = new BufferGeometry().setFromPoints([
    [-0.25, 0],
    [-0.12, 10],
    [0.12, 10],
    [0.25, 0],
    [-0.25, 11],
    [0.25, 11],
    [1, 11],
    [3, 9],
    [1, 10.25],
    [-2, 11],
    [-3, 10],
    [-2, 10.25],
    [-2, 8],
    [-1.5, 9.5]
].map(p => {return new Vector2(p[0], p[1])}))
    .setIndex([0, 1, 1, 2, 2, 3, 1, 4, 4, 5, 5, 2, 2, 6, 6, 7, 7, 8, 8, 2, 1, 9, 9, 10, 10, 11, 11, 1, 1, 12, 12, 13, 13, 1])

let mPalm = {lineWidth: 5, color: "white"};
let palms = new Object3D();
for(let i = 0; i < 6; i++){
    let palm = new Lines(gPalm, mPalm);
    let evenOdd = i % 2 == 0;
    palm.position.x = (20 / 15) * 0.5 * (evenOdd ? -1 : 1);
    palm.position.z = -10 + (20 / 6) * i;
    palm.userData.initPos = palm.position.clone();
    palm.scale.setScalar(0.2);
    palm.rotation.y = Math.PI * (evenOdd ? 1 : 0);
    palms.add(palm);
}
function movePalmsByTime(time){
    let t = time;
    palms.children.forEach(palm => {
        palm.position.z = -10 + ((palm.userData.initPos.z + 10 + t * speed) % 20);
        palm.scale.setScalar(MathUtils.smoothstep(palm.position.z, -10, -8) * 0.2);
    })
}

scene.add(sun, grid, palms);


let timeStart = performance.now();

draw();
function draw(){
    let t = (performance.now() - timeStart) * 0.001;
    
    controls.update();
    
    waveSunByTime(t * 0.5);
    waveGridByTime(t * 2);
    movePalmsByTime(t * 2);
        
    renderer.render(scene, camera);
    requestAnimationFrame(draw);
}

function ToQuads(g) {
    let p = g.parameters;
    let segmentsX = (g.type == "TorusGeometry" ? p.tubularSegments : p.radialSegments) || p.widthSegments || p.thetaSegments || (p.points.length - 1) || 1;
    let segmentsY = (g.type == "TorusGeometry" ? p.radialSegments : p.tubularSegments) || p.heightSegments || p.phiSegments || p.segments || 1;
    let indices = [];
    for (let i = 0; i < segmentsY + 1; i++) {
        let index11 = 0;
        let index12 = 0;
        for (let j = 0; j < segmentsX; j++) {
            index11 = (segmentsX + 1) * i + j;
            index12 = index11 + 1;
            let index21 = index11;
            let index22 = index11 + (segmentsX + 1);
            indices.push(index11, index12);
            if (index22 < ((segmentsX + 1) * (segmentsY + 1) - 1)) {
                indices.push(index21, index22);
            }
        }
        if ((index12 + segmentsX + 1) <= ((segmentsX + 1) * (segmentsY + 1) - 1)) {
            indices.push(index12, index12 + segmentsX + 1);
        }
    }
    g.setIndex(indices);
}