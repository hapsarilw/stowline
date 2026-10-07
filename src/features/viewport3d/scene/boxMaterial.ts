import {
  BoxGeometry,
  BufferAttribute,
  Color,
  MeshBasicMaterial,
  SRGBColorSpace,
  Vector3,
} from 'three';

// The design shades the three visible faces of a box with fixed factors: top 1.0, side 0.8,
// end 0.62, and draws a dark edge around each face. Here the factors are vertex colors of a
// unit box (multiplied by the instance color), and the edges come from a few shader lines, so
// thousands of boxes stay one draw call per size and need no lights.

const FACE = { top: 1, side: 0.8, end: 0.62, bottom: 0.5 } as const;

/** A 1 x 1 x 1 box with the face shading in its vertex colors. */
export function shadedBoxGeometry(): BoxGeometry {
  const g = new BoxGeometry(1, 1, 1);
  const normal = g.getAttribute('normal');
  const colors = new Float32Array(normal.count * 3);
  const c = new Color();
  for (let i = 0; i < normal.count; i++) {
    const ny = normal.getY(i);
    const k =
      ny > 0.5
        ? FACE.top
        : ny < -0.5
          ? FACE.bottom
          : Math.abs(normal.getX(i)) > 0.5
            ? FACE.end
            : FACE.side;
    // The design multiplies sRGB values, so convert the factor as an sRGB value.
    c.setRGB(k, k, k, SRGBColorSpace);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new BufferAttribute(colors, 3));
  return g;
}

export interface BoxMaterial extends MeshBasicMaterial {
  /** Edge color in sRGB, 0 to 1 per channel, and its opacity. */
  setEdge(rgb: [number, number, number], alpha: number): void;
}

/** Unlit material for shaded boxes with dark edges. Works for instanced and plain meshes. */
export function createBoxMaterial(color = '#ffffff'): BoxMaterial {
  const edge = { uEdgeColor: { value: new Vector3(0.03, 0.05, 0.09) }, uEdgeAlpha: { value: 0.6 } };
  const m = new MeshBasicMaterial({ color, vertexColors: true }) as BoxMaterial;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, edge);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLocal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vLocal;\nuniform vec3 uEdgeColor;\nuniform float uEdgeAlpha;',
      )
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        // Distance in pixels to the box boundary along each local axis. On a face one axis is at
        // the boundary already; the middle distance is the distance to the nearest edge. The
        // edge is a little under a pixel wide and smoothed, mixed after the sRGB conversion as
        // the design strokes its boxes.
        vec3 a = abs(vLocal) * 2.0;
        vec3 d = (1.0 - a) / max(fwidth(vLocal) * 2.0, vec3(1e-6));
        float mid = d.x + d.y + d.z - min(d.x, min(d.y, d.z)) - max(d.x, max(d.y, d.z));
        float edge = clamp(1.1 - mid, 0.0, 1.0);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uEdgeColor, uEdgeAlpha * edge);`,
      );
  };
  m.setEdge = (rgb, alpha) => {
    edge.uEdgeColor.value.set(rgb[0], rgb[1], rgb[2]);
    edge.uEdgeAlpha.value = alpha;
  };
  return m;
}

/** Parses '#rrggbb' or 'rgba(r, g, b, a)' into sRGB channels from 0 to 1 and an alpha. */
export function parseCssColor(css: string): { rgb: [number, number, number]; alpha: number } {
  const s = css.trim();
  if (s.startsWith('#')) {
    const h = s.slice(1);
    const v = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [
      number,
      number,
      number,
    ];
    return { rgb: v, alpha: 1 };
  }
  const m = /rgba?\(([^)]+)\)/.exec(s);
  if (!m) return { rgb: [0, 0, 0], alpha: 1 };
  const parts = m[1]!.split(',').map((x) => parseFloat(x));
  return {
    rgb: [(parts[0] ?? 0) / 255, (parts[1] ?? 0) / 255, (parts[2] ?? 0) / 255],
    alpha: parts[3] ?? 1,
  };
}
