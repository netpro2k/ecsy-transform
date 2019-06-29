import { World, System, Entity, Not } from "ecsy";
import { vec3, mat4, quat, glMatrix } from "gl-matrix";

glMatrix.setMatrixArrayType(Array);

export class LocalToWorld {
  public matrix: mat4;
  constructor() {
    this.matrix = mat4.create();
  }

  public __init() {
    this.matrix = mat4.create();
  }
}

export class LocalToParent {
  public matrix: mat4;
  constructor() {
    this.matrix = mat4.create();
  }

  public __init() {
    this.matrix = mat4.create();
  }
}

export class Parent {
  public entity: Entity;
  constructor(e: Entity) {
    this.entity = e;
  }
}

class PreviousParent {
  public entity: Entity;
  constructor(e: Entity) {
    this.entity = e;
  }
}

class Child {
  public children: Entity[];
  constructor() {
    this.children = [];
  }

  public __init() {
    this.children = [];
  }
}

export class Rotation {
  public rotation: quat;
  constructor() {
    this.rotation = quat.create();
  }

  public __init() {
    this.rotation = quat.create();
  }
}

export class Translation {
  public position: vec3;
  constructor() {
    this.position = vec3.create();
  }
  public __init() {
    this.position = vec3.create();
  }
}

export class Scale {
  public scale: number;
  constructor() {
    this.scale = 1;
  }
}

export class HierarchySystem extends System {
  public init() {
    return {
      queries: {
        newlyParented: { components: [Parent, Not(PreviousParent)] },
        newlyUnparented: { components: [Not(Parent), PreviousParent] },
        parented: { components: [Parent, PreviousParent] }
      }
    };
  }

  public execute(_delta: number) {
    const newlyUnparented = this.queries.newlyUnparented;
    for (let i = newlyUnparented.length - 1; i >= 0; i--) {
      const entity = newlyUnparented[i];
      console.log("Newly unparented", entity);
      const c = entity.getComponent(PreviousParent).entity.getMutableComponent(Child);
      c.children.splice(c.children.indexOf(entity), 1);
      entity.removeComponent(PreviousParent);
    }

    const newlyParented = this.queries.newlyParented;
    for (let i = newlyParented.length - 1; i >= 0; i--) {
      const entity = newlyParented[i];
      entity.addComponent(PreviousParent);
      console.log("Newly parented", entity);
    }

    const parented = this.queries.parented;
    for (let i = 0; i < parented.length; i++) {
      const entity = parented[i];
      const parent = entity.getComponent(Parent);
      const prevParent = entity.getComponent(PreviousParent);
      if (parent.entity !== prevParent.entity) {
        console.log("parent changed", entity, prevParent, parent);
        if (prevParent.entity) {
          const c = prevParent.entity.getMutableComponent(Child);
          c.children.splice(c.children.indexOf(entity), 1);
        }

        if (!parent.entity.hasComponent(Child)) {
          parent.entity.addComponent(Child);
        }
        parent.entity.getMutableComponent(Child).children.push(entity);

        entity.getMutableComponent(PreviousParent).entity = parent.entity;
      }
    }
  }
}

const VEC3_ZERO = vec3.fromValues(0, 0, 0);
const VEC3_ONE = vec3.fromValues(1, 1, 1);
const QUAT_IDENTITY = quat.create();
const tempScale = vec3.create();

export class LocalToParentSystem extends System {
  public init() {
    return {
      queries: {
        entities: { components: [LocalToParent] } // Any([Translation, Rotation, Scale])
      }
    };
  }

  public execute(_delta: number) {
    const entities = this.queries.entities;
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      const m = entity.getMutableComponent(LocalToParent);

      const r = entity.getComponent(Rotation);
      const t = entity.getComponent(Translation);
      const s = entity.getComponent(Scale);

      if (!(r || t || s)) continue;

      mat4.fromRotationTranslationScale(
        m.matrix,
        r ? r.rotation : QUAT_IDENTITY,
        t ? t.position : VEC3_ZERO,
        s ? vec3.set(tempScale, s.scale, s.scale, s.scale) : VEC3_ONE
      );
    }
  }
}

export class LocalToWorldSystem extends System {
  public init() {
    return {
      queries: {
        roots: { components: [LocalToWorld, Not(Parent)] }, // Any([Translation, Rotation, Scale])
        rootsWithChildren: { components: [LocalToWorld, Child, Not(Parent)] }
      }
    };
  }

  private updateChildrenLocalToWorld(entity: Entity, parentLocalToWorld: LocalToWorld) {
    const c = entity.getComponent(Child);
    if (!c) return;

    for (let i = 0; i < c.children.length; i++) {
      const child = c.children[i];
      const localToWorld = child.getMutableComponent(LocalToWorld);
      const localToParent = child.getComponent(LocalToParent);
      mat4.multiply(localToWorld.matrix, parentLocalToWorld.matrix, localToParent.matrix);
      this.updateChildrenLocalToWorld(child, localToWorld);
    }
  }

  public execute(_delta: number) {
    const roots = this.queries.roots;
    for (let i = 0; i < roots.length; i++) {
      const entity = roots[i];
      const m = entity.getMutableComponent(LocalToWorld);

      const r = entity.getComponent(Rotation);
      const t = entity.getComponent(Translation);
      const s = entity.getComponent(Scale);
      if (!(r || t || s)) continue;

      mat4.fromRotationTranslationScale(
        m.matrix,
        r ? r.rotation : QUAT_IDENTITY,
        t ? t.position : VEC3_ZERO,
        s ? vec3.set(tempScale, s.scale, s.scale, s.scale) : VEC3_ONE
      );
    }

    const rootsWithChildren = this.queries.rootsWithChildren;
    for (let i = 0; i < rootsWithChildren.length; i++) {
      const entity = rootsWithChildren[i];
      this.updateChildrenLocalToWorld(entity, entity.getComponent(LocalToWorld));
    }
  }
}

export function registerPrivateComponents(world: World) {
  world.registerComponent(PreviousParent);
  world.registerComponent(Child);
}

export function registerComponents(world: World) {
  world.registerComponent(LocalToWorld);
  world.registerComponent(LocalToParent);
  world.registerComponent(Parent);
  world.registerComponent(Rotation);
  world.registerComponent(Translation);
  world.registerComponent(Scale);
  registerPrivateComponents(world);
}

export function registerSystems(world: World) {
  world.registerSystem(HierarchySystem);
  world.registerSystem(LocalToParentSystem);
  world.registerSystem(LocalToWorldSystem);
}
