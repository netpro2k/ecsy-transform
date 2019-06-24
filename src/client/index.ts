import { World, System } from "ecsy";
import * as THREE from "three";
import { Matrix4 } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

import * as TransformSystems from "./transform-system";
import { Rotation, LocalToWorld, Parent, Translation, Scale, LocalToParent } from "./transform-system";

class Rotating {
  public rotatingSpeed: number;

  constructor() {
    this.rotatingSpeed = 0.1;
  }
}

export class Object3DComponent {
  public object: THREE.Object3D;
  constructor(o: THREE.Object3D) {
    this.object = o;
  }
}

const yAxis = new THREE.Vector3(0, 1, 0);
const tempQ = new THREE.Quaternion();
class RotatingSystem extends System {
  public init() {
    return {
      queries: {
        entities: { components: [Rotating, Rotation] }
      }
    };
  }

  public execute(dt: number) {
    const entities = this.queries.entities;
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];

      const rotation = entity.getMutableComponent(Rotation);
      const rotating = entity.getComponent(Rotating);

      tempQ.setFromAxisAngle(yAxis, rotating.rotatingSpeed * THREE.Math.DEG2RAD * (dt / 100));
      rotation.rotation.multiply(tempQ);
    }
  }
}

class Object3DMatrixSystem extends System {
  public init() {
    return {
      queries: {
        entities: { components: [Object3DComponent, LocalToWorld] }
      }
    };
  }

  public execute(_delta: number) {
    const entities = this.queries.entities;
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      const o = entity.getMutableComponent(Object3DComponent);
      const t = entity.getComponent(LocalToWorld);

      o.object.matrixWorld.copy(t.matrix);
    }
  }
}

const world = new World();

world.registerComponent(Rotating);
world.registerComponent(Object3DComponent);
TransformSystems.registerComponents(world);

// App systems
world.registerSystem(RotatingSystem);

// Transform systems
TransformSystems.registerSystems(world);

// ThreeJS Systems
world.registerSystem(Object3DMatrixSystem);

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const context = canvas.getContext("webgl2", { antialias: true }) as WebGLRenderingContext;

const renderer = new THREE.WebGLRenderer({ canvas, context });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const scene = new THREE.Scene();
window.s = scene;
scene.matrixAutoUpdate = false;

scene.add(new THREE.AmbientLight(0xcccccc));

const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
directionalLight.position.set(1, 1, 0.5).normalize();
scene.add(directionalLight);

function createCube(color = 0xffffff) {
  const mat = new THREE.MeshStandardMaterial();
  mat.color.setHex(color);
  const m = new THREE.Mesh(new THREE.BoxBufferGeometry(), mat);
  m.matrixAutoUpdate = false;
  scene.add(m);
  return m;
}

const e1 = world
  .createEntity()
  .addComponent(LocalToWorld)
  .addComponent(Rotation)
  .addComponent(Rotating, { rotatingSpeed: 3 })
  .addComponent(Object3DComponent, { object: createCube(0xff0000) });

const e2 = world
  .createEntity()
  .addComponent(LocalToWorld)
  .addComponent(Translation, { position: new THREE.Vector3(1, 0, 0) })
  .addComponent(Rotation)
  .addComponent(Scale, { scale: 0.5 })
  .addComponent(LocalToParent)
  .addComponent(Parent, { entity: e1 })
  .addComponent(Rotating, { rotatingSpeed: -5 })
  .addComponent(Object3DComponent, { object: createCube(0x00ff00) });

const e3 = world
  .createEntity()
  .addComponent(LocalToWorld)
  // .addComponent(Translation, { position: new THREE.Vector3(1, 0, 0) })
  // .addComponent(Rotation)
  // .addComponent(Scale, { scale: 0.5 })
  .addComponent(LocalToParent, {
    matrix: new Matrix4().makeTranslation(0, 1, 0).multiply(new Matrix4().makeScale(0.5, 0.5, 0.5))
  })
  .addComponent(Parent, { entity: e2 })
  // .addComponent(Rotating, { rotatingSpeed: 5 })
  .addComponent(Object3DComponent, { object: createCube(0x0000ff) });

setTimeout(function() {
  e2.removeComponent(Parent);
}, 5000);

const camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.005, 1000);
camera.position.z = 2;
scene.add(camera);

new OrbitControls(camera, renderer.domElement);

let prevTime = performance.now();
function update(time: number) {
  const dt = time - prevTime;
  prevTime = time;

  world.execute(dt, time);

  renderer.render(scene, camera);

  requestAnimationFrame(update);
}

requestAnimationFrame(update);
