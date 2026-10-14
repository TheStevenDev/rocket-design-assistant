import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { tr } from '../core/i18n';
import type { ComponentRole, MassComponent, RocketGeometry } from '../core/types';

/** Same hues as the role legend in the UI. */
export const ROLE_COLORS: Record<ComponentRole, number> = {
  gps: 0x8b5cf6, sensor: 0x06b6d4, computer: 0x22c55e, camera: 0xf43f5e,
  battery: 0xf59e0b, recovery: 0xeab308, other: 0x94a3b8,
};
import { sampleNoseProfile } from '../geometry/noseProfile';
import type { DerivedGeometry } from '../geometry/rocketGeometry';

export interface ViewerData {
  geometry: RocketGeometry;
  derived: DerivedGeometry;
  components: MassComponent[];
  cgX: number;
  cpX: number;
  toggles: {
    nose: boolean; body: boolean; fins: boolean; components: boolean;
    cg: boolean; cp: boolean; dimensions: boolean; axes: boolean; transparent: boolean;
  };
  /** Formats an SI length for the dimension labels. */
  formatLength: (v: number) => string;
  dark: boolean;
}

/**
 * Three.js scene for the parametric rocket. Independent of React and of the
 * application state: it only receives geometry and markers through setData().
 * The rocket axis is the scene X axis, nose tip at x = 0, tail towards +X.
 */
export class RocketViewer {
  private renderer: THREE.WebGLRenderer;
  private labels: CSS2DRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private model = new THREE.Group();
  private frame = 0;
  private resize: ResizeObserver;
  private framedLength = 0;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.labels = new CSS2DRenderer();
    this.labels.domElement.className = 'viewer-labels';
    container.appendChild(this.labels.domElement);

    this.camera = new THREE.PerspectiveCamera(35, 1, 0.001, 100);
    this.controls = new OrbitControls(this.camera, this.labels.domElement);
    this.controls.enableDamping = true;

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(1, 2, 3);
    this.scene.add(sun);
    this.scene.add(this.model);

    this.resize = new ResizeObserver(() => this.onResize());
    this.resize.observe(container);
    this.onResize();
    const loop = () => {
      this.frame = requestAnimationFrame(loop);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      this.labels.render(this.scene, this.camera);
    };
    loop();
  }

  private onResize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h);
    this.labels.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Frames the whole rocket from a three-quarter view. */
  frameModel(length: number) {
    const L = Math.max(length, 0.05);
    // Fit ~1.5 L horizontally (rocket plus labels) for the current aspect ratio.
    const halfFov = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const dist = Math.max(L * 0.9, (0.62 * L) /(Math.tan(halfFov) * Math.max(this.camera.aspect, 0.5)));
    this.camera.position.set(dist * 0.1, dist * 0.25, dist);
    this.controls.target.set(0, 0, 0);
    this.camera.near = L / 500;
    this.camera.far = dist * 20;
    this.camera.updateProjectionMatrix();
    this.framedLength = L;
  }

  setData(d: ViewerData) {
    this.clearModel();
    const { geometry: g, derived: dg, toggles: t } = d;
    const R = dg.bodyRadius;
    const L = dg.totalLength;
    if (!(R > 0) || !(L > 0)) return;
    if (this.framedLength === 0) this.frameModel(L);

    // Centre the model on the origin so orbiting feels natural.
    this.model.position.set(-L / 2, 0, 0);

    const opacity = t.transparent ? 0.35 : 1;
    const mat = (color: number) => new THREE.MeshStandardMaterial({
      color, roughness: 0.55, metalness: 0.05, transparent: t.transparent, opacity,
      side: THREE.DoubleSide, depthWrite: !t.transparent,
    });

    if (t.nose && g.nose.length > 0) {
      const pts = sampleNoseProfile(g.nose.shape, g.nose.length, R, g.nose.shapeParameter, 64)
        .map((p) => new THREE.Vector2(Math.max(p.r, 1e-6), p.x));
      const geo = new THREE.LatheGeometry(pts, 64);
      geo.rotateZ(-Math.PI / 2);
      this.model.add(new THREE.Mesh(geo, mat(0xf1f5f9)));
    }

    if (t.body && g.body.length > 0) {
      const geo = new THREE.CylinderGeometry(R, R, g.body.length, 64, 1, false);
      geo.rotateZ(-Math.PI / 2);
      const mesh = new THREE.Mesh(geo, mat(0x6366f1));
      mesh.position.x = dg.bodyStartX + g.body.length / 2;
      this.model.add(mesh);
    }

    if (t.fins && g.fins.count > 0 && g.fins.span > 0 && g.fins.rootChord > 0) {
      const f = g.fins;
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(f.rootChord, 0);
      shape.lineTo(f.sweepLength + f.tipChord, f.span);
      shape.lineTo(f.sweepLength, f.span);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: Math.max(f.thickness, 1e-4), bevelEnabled: false });
      geo.translate(dg.fins.rootLeadingEdgeX, R * 0.98, -f.thickness / 2);
      for (let i = 0; i < f.count; i++) {
        const mesh = new THREE.Mesh(geo, mat(0xf97316));
        mesh.rotation.x = (i * 2 * Math.PI) / f.count;
        this.model.add(mesh);
      }
    }

    if (t.components) {
      for (const c of d.components) {
        const len = c.length > 0 ? c.length : R;
        const rad = c.diameter > 0 ? c.diameter / 2 : R * (c.role && c.role !== 'recovery' ? 0.4 : 0.6);
        const geo = new THREE.CylinderGeometry(rad, rad, len, 32);
        geo.rotateZ(-Math.PI / 2);
        const color = c.kind === 'motor' ? 0x6b7280 : ROLE_COLORS[c.role ?? 'other'];
        const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
          color, transparent: true, opacity: 0.85, depthTest: false,
        }));
        mesh.renderOrder = 5;
        mesh.position.x = c.cgX;
        this.model.add(mesh);
      }
    }

    const markerR = Math.max(R * 0.28, L * 0.006);
    if (t.cg && Number.isFinite(d.cgX)) this.addMarker(d.cgX, 0x3b82f6, 'CG', markerR, R, true);
    if (t.cp && Number.isFinite(d.cpX)) this.addMarker(d.cpX, 0xef4444, 'CP', markerR, R, false);

    if (t.axes) {
      const axes = new THREE.AxesHelper(L * 0.15);
      this.model.add(axes);
      this.addLabel(tr('origine (punta)', 'origin (tip)'), new THREE.Vector3(0, -R * 1.6, 0), 'label-muted');
    }

    if (t.dimensions) {
      const dimColor = d.dark ? 0xc3c2b7 : 0x52514e;
      const y = dg.fins.tipRadius + R * 0.8;
      this.addDimension(new THREE.Vector3(0, y, 0), new THREE.Vector3(L, y, 0), `L = ${d.formatLength(L)}`, dimColor);
      const xd = dg.bodyEndX + R * 0.6;
      this.addDimension(new THREE.Vector3(xd, -R, 0), new THREE.Vector3(xd, R, 0), `Ø ${d.formatLength(2 * R)}`, dimColor);
      if (t.fins && g.fins.span > 0) {
        const xs = dg.fins.rootLeadingEdgeX + g.fins.sweepLength + g.fins.tipChord / 2;
        this.addDimension(new THREE.Vector3(xs, -R, 0), new THREE.Vector3(xs, -dg.fins.tipRadius, 0), `s = ${d.formatLength(g.fins.span)}`, dimColor);
      }
      this.addDimension(new THREE.Vector3(0, -dg.fins.tipRadius - R * 0.8, 0), new THREE.Vector3(g.nose.length, -dg.fins.tipRadius - R * 0.8, 0),
        `${tr('ogiva', 'nose')} ${d.formatLength(g.nose.length)}`, dimColor);
    }
  }

  private addMarker(x: number, color: number, text: string, r: number, bodyR: number, checkered: boolean) {
    const group = new THREE.Group();
    const m = (c: number) => new THREE.MeshBasicMaterial({ color: c, depthTest: false, transparent: true });
    if (checkered) {
      // Classic CG symbol: alternating quadrants.
      for (let i = 0; i < 4; i++) {
        const geo = new THREE.SphereGeometry(r, 16, 12, (i * Math.PI) / 2, Math.PI / 2);
        group.add(new THREE.Mesh(geo, m(i % 2 ? 0xffffff : color)));
      }
    } else {
      group.add(new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m(color)));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.5, r * 0.25, 8, 32), m(color));
      ring.rotation.y = Math.PI / 2;
      group.add(ring);
    }
    group.children.forEach((c) => (c.renderOrder = 10));
    group.position.x = x;
    this.model.add(group);
    // Vertical leader line and label above the body.
    const top = bodyR * (checkered ? 2.6 : 3.4);
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 0, 0), new THREE.Vector3(x, top, 0)]),
      new THREE.LineBasicMaterial({ color, depthTest: false }),
    );
    line.renderOrder = 10;
    this.model.add(line);
    this.addLabel(text, new THREE.Vector3(x, top, 0), checkered ? 'label-cg' : 'label-cp');
  }

  private addDimension(a: THREE.Vector3, b: THREE.Vector3, text: string, color: number) {
    const material = new THREE.LineBasicMaterial({ color });
    const dir = b.clone().sub(a).normalize();
    const n = new THREE.Vector3(-dir.y, dir.x, 0).multiplyScalar(a.distanceTo(b) * 0.04 + 0.002);
    const pts = [a, b, a.clone().add(n), a.clone().sub(n), b.clone().add(n), b.clone().sub(n)];
    const geo = new THREE.BufferGeometry().setFromPoints([pts[0], pts[1], pts[2], pts[3], pts[4], pts[5]]);
    this.model.add(new THREE.LineSegments(geo, material));
    this.addLabel(text, a.clone().add(b).multiplyScalar(0.5), 'label-dim');
  }

  private addLabel(text: string, pos: THREE.Vector3, cls: string) {
    const el = document.createElement('div');
    el.className = `viewer-label ${cls}`;
    el.textContent = text;
    const obj = new CSS2DObject(el);
    obj.position.copy(pos);
    this.model.add(obj);
  }

  private clearModel() {
    this.model.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
        o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => m.dispose());
      }
      if (o instanceof CSS2DObject) o.element.remove();
    });
    this.model.clear();
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    this.resize.disconnect();
    this.clearModel();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labels.domElement.remove();
  }
}
