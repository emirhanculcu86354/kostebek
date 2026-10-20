/** 2D (XZ-plane) collision: static AABBs, circle resolution, ray casts and a grid pathfinder. */

export interface AABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Low furniture blocks movement but not sight or bullets. */
  blocksSight: boolean;
  enabled: boolean;
  id?: string;
}

export interface RayHit {
  dist: number;
  box: AABB | null;
}

export class CollisionWorld {
  readonly boxes: AABB[] = [];

  addBox(cx: number, cz: number, w: number, d: number, blocksSight = true, id?: string): AABB {
    const b: AABB = { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, blocksSight, enabled: true, id };
    this.boxes.push(b);
    return b;
  }

  removeBox(b: AABB): void {
    const i = this.boxes.indexOf(b);
    if (i >= 0) this.boxes.splice(i, 1);
  }

  /** Push a circle out of all boxes. Mutates pos. Returns true if any collision happened. */
  resolveCircle(pos: { x: number; z: number }, r: number): boolean {
    let hit = false;
    for (let pass = 0; pass < 2; pass++) {
      for (const b of this.boxes) {
        if (!b.enabled) continue;
        const cx = pos.x < b.minX ? b.minX : pos.x > b.maxX ? b.maxX : pos.x;
        const cz = pos.z < b.minZ ? b.minZ : pos.z > b.maxZ ? b.maxZ : pos.z;
        const dx = pos.x - cx;
        const dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        hit = true;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          pos.x = cx + (dx / d) * r;
          pos.z = cz + (dz / d) * r;
        } else {
          // Centre inside the box: push out along the shallowest axis.
          const left = pos.x - b.minX;
          const right = b.maxX - pos.x;
          const top = pos.z - b.minZ;
          const bottom = b.maxZ - pos.z;
          const m = Math.min(left, right, top, bottom);
          if (m === left) pos.x = b.minX - r;
          else if (m === right) pos.x = b.maxX + r;
          else if (m === top) pos.z = b.minZ - r;
          else pos.z = b.maxZ + r;
        }
      }
    }
    return hit;
  }

  overlapsCircle(x: number, z: number, r: number): boolean {
    for (const b of this.boxes) {
      if (!b.enabled) continue;
      const cx = x < b.minX ? b.minX : x > b.maxX ? b.maxX : x;
      const cz = z < b.minZ ? b.minZ : z > b.maxZ ? b.maxZ : z;
      const dx = x - cx;
      const dz = z - cz;
      if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
  }

  /** Ray vs boxes (slab method). dir must be normalised. sightOnly ignores low furniture. */
  raycast(ox: number, oz: number, dx: number, dz: number, maxDist: number, sightOnly = true): RayHit {
    let best = maxDist;
    let bestBox: AABB | null = null;
    const invX = dx !== 0 ? 1 / dx : Infinity;
    const invZ = dz !== 0 ? 1 / dz : Infinity;
    for (const b of this.boxes) {
      if (!b.enabled || (sightOnly && !b.blocksSight)) continue;
      let tmin: number;
      let tmax: number;
      if (dx !== 0) {
        const t1 = (b.minX - ox) * invX;
        const t2 = (b.maxX - ox) * invX;
        tmin = Math.min(t1, t2);
        tmax = Math.max(t1, t2);
      } else {
        if (ox < b.minX || ox > b.maxX) continue;
        tmin = -Infinity;
        tmax = Infinity;
      }
      if (dz !== 0) {
        const t1 = (b.minZ - oz) * invZ;
        const t2 = (b.maxZ - oz) * invZ;
        tmin = Math.max(tmin, Math.min(t1, t2));
        tmax = Math.min(tmax, Math.max(t1, t2));
      } else if (oz < b.minZ || oz > b.maxZ) continue;
      if (tmax < 0 || tmin > tmax) continue;
      const t = tmin < 0 ? 0 : tmin;
      if (t < best) {
        best = t;
        bestBox = b;
      }
    }
    return { dist: best, box: bestBox };
  }

  lineOfSight(ax: number, az: number, bx: number, bz: number): boolean {
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    if (len < 1e-4) return true;
    return this.raycast(ax, az, dx / len, dz / len, len, true).dist >= len - 1e-3;
  }
}

/** Uniform grid A* for small maps. Cells are blocked when an agent of `agentR` would overlap a box. */
export class NavGrid {
  readonly cols: number;
  readonly rows: number;
  private blocked: Uint8Array;
  private dynamic = new Map<string, number[]>();

  constructor(
    private world: CollisionWorld,
    readonly minX: number,
    readonly minZ: number,
    maxX: number,
    maxZ: number,
    readonly cell = 0.5,
    private agentR = 0.42,
  ) {
    this.cols = Math.ceil((maxX - minX) / cell);
    this.rows = Math.ceil((maxZ - minZ) / cell);
    this.blocked = new Uint8Array(this.cols * this.rows);
    this.rebuild();
  }

  rebuild(): void {
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) {
        const x = this.minX + (c + 0.5) * this.cell;
        const z = this.minZ + (r + 0.5) * this.cell;
        this.blocked[r * this.cols + c] = this.world.overlapsCircle(x, z, this.agentR) ? 1 : 0;
      }
  }

  /** Marks a rectangle (e.g. a locked door) as blocked (2) or restores its static state. */
  setDynamic(id: string, minX: number, minZ: number, maxX: number, maxZ: number, blocked: boolean): void {
    const prev = this.dynamic.get(id);
    if (prev) for (const i of prev) if (this.blocked[i] === 2) this.blocked[i] = 0;
    this.dynamic.delete(id);
    if (!blocked) return;
    const cells: number[] = [];
    const c0 = Math.max(0, Math.floor((minX - this.agentR - this.minX) / this.cell));
    const c1 = Math.min(this.cols - 1, Math.floor((maxX + this.agentR - this.minX) / this.cell));
    const r0 = Math.max(0, Math.floor((minZ - this.agentR - this.minZ) / this.cell));
    const r1 = Math.min(this.rows - 1, Math.floor((maxZ + this.agentR - this.minZ) / this.cell));
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) {
        const i = r * this.cols + c;
        if (this.blocked[i] === 0) {
          this.blocked[i] = 2;
          cells.push(i);
        }
      }
    this.dynamic.set(id, cells);
  }

  private toCell(x: number, z: number): [number, number] {
    return [
      Math.min(this.cols - 1, Math.max(0, Math.floor((x - this.minX) / this.cell))),
      Math.min(this.rows - 1, Math.max(0, Math.floor((z - this.minZ) / this.cell))),
    ];
  }

  isFree(c: number, r: number): boolean {
    return c >= 0 && r >= 0 && c < this.cols && r < this.rows && this.blocked[r * this.cols + c] === 0;
  }

  walkable(x: number, z: number): boolean {
    const [c, r] = this.toCell(x, z);
    return this.isFree(c, r);
  }

  private nearestFree(c: number, r: number): [number, number] | null {
    if (this.isFree(c, r)) return [c, r];
    for (let rad = 1; rad < 8; rad++)
      for (let dr = -rad; dr <= rad; dr++)
        for (let dc = -rad; dc <= rad; dc++) {
          if (Math.abs(dr) !== rad && Math.abs(dc) !== rad) continue;
          if (this.isFree(c + dc, r + dr)) return [c + dc, r + dr];
        }
    return null;
  }

  /** Grid line walk: true if every cell between the points is free. */
  private clearLine(c0: number, r0: number, c1: number, r1: number): boolean {
    const dc = Math.abs(c1 - c0);
    const dr = Math.abs(r1 - r0);
    const sc = c0 < c1 ? 1 : -1;
    const sr = r0 < r1 ? 1 : -1;
    let err = dc - dr;
    let c = c0;
    let r = r0;
    for (;;) {
      if (!this.isFree(c, r)) return false;
      if (c === c1 && r === r1) return true;
      const e2 = 2 * err;
      if (e2 > -dr) {
        err -= dr;
        c += sc;
      }
      if (e2 < dc) {
        err += dc;
        r += sr;
      }
    }
  }

  private gScore = new Float32Array(0);
  private came = new Int32Array(0);
  private closed = new Uint8Array(0);

  /** A* with 8-way movement, no corner cutting, then string-pulled. Returns world waypoints or null. */
  findPath(sx: number, sz: number, tx: number, tz: number, maxNodes = 6000): { x: number; z: number }[] | null {
    const n = this.cols * this.rows;
    if (this.gScore.length !== n) {
      this.gScore = new Float32Array(n);
      this.came = new Int32Array(n);
      this.closed = new Uint8Array(n);
    }
    const s0 = this.toCell(sx, sz);
    const t0 = this.toCell(tx, tz);
    const s = this.nearestFree(s0[0], s0[1]);
    const t = this.nearestFree(t0[0], t0[1]);
    if (!s || !t) return null;
    const start = s[1] * this.cols + s[0];
    const goal = t[1] * this.cols + t[0];
    if (start === goal) return [{ x: tx, z: tz }];

    this.gScore.fill(Infinity);
    this.closed.fill(0);
    this.came.fill(-1);
    const heap = new MinHeap();
    const h = (i: number) => {
      const dc = Math.abs((i % this.cols) - t[0]);
      const dr = Math.abs(Math.floor(i / this.cols) - t[1]);
      return Math.max(dc, dr) + 0.4142 * Math.min(dc, dr);
    };
    this.gScore[start] = 0;
    heap.push(start, h(start));
    let expanded = 0;
    let found = false;
    while (heap.size > 0) {
      const cur = heap.pop();
      if (cur === goal) {
        found = true;
        break;
      }
      if (this.closed[cur]) continue;
      this.closed[cur] = 1;
      if (++expanded > maxNodes) break;
      const cc = cur % this.cols;
      const cr = Math.floor(cur / this.cols);
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nc = cc + dc;
          const nr = cr + dr;
          if (!this.isFree(nc, nr)) continue;
          if (dc && dr && (!this.isFree(cc + dc, cr) || !this.isFree(cc, cr + dr))) continue;
          const ni = nr * this.cols + nc;
          if (this.closed[ni]) continue;
          const g = this.gScore[cur] + (dc && dr ? 1.4142 : 1);
          if (g < this.gScore[ni]) {
            this.gScore[ni] = g;
            this.came[ni] = cur;
            heap.push(ni, g + h(ni));
          }
        }
    }
    if (!found) return null;

    const cells: number[] = [];
    for (let i = goal; i !== -1; i = this.came[i]) cells.push(i);
    cells.reverse();
    // String pulling.
    const out: { x: number; z: number }[] = [];
    let anchor = 0;
    for (let i = 2; i <= cells.length; i++) {
      const a = cells[anchor];
      const b = cells[Math.min(i, cells.length - 1)];
      if (i === cells.length || !this.clearLine(a % this.cols, Math.floor(a / this.cols), b % this.cols, Math.floor(b / this.cols))) {
        const p = cells[i - 1];
        out.push({ x: this.minX + ((p % this.cols) + 0.5) * this.cell, z: this.minZ + (Math.floor(p / this.cols) + 0.5) * this.cell });
        anchor = i - 1;
      }
    }
    if (out.length) out[out.length - 1] = this.walkable(tx, tz) ? { x: tx, z: tz } : out[out.length - 1];
    return out;
  }
}

class MinHeap {
  private items: number[] = [];
  private prio: number[] = [];
  get size(): number {
    return this.items.length;
  }
  push(item: number, p: number): void {
    const a = this.items;
    const pr = this.prio;
    a.push(item);
    pr.push(p);
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (pr[parent] <= pr[i]) break;
      [a[i], a[parent]] = [a[parent], a[i]];
      [pr[i], pr[parent]] = [pr[parent], pr[i]];
      i = parent;
    }
  }
  pop(): number {
    const a = this.items;
    const pr = this.prio;
    const top = a[0];
    const lastI = a.pop()!;
    const lastP = pr.pop()!;
    if (a.length > 0) {
      a[0] = lastI;
      pr[0] = lastP;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && pr[l] < pr[m]) m = l;
        if (r < a.length && pr[r] < pr[m]) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        [pr[i], pr[m]] = [pr[m], pr[i]];
        i = m;
      }
    }
    return top;
  }
}
