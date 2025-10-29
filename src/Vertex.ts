import VertexError from "./VertexError";

type Execute<T, R> = (input: T) => Promise<R>;

/**
 * TODOs:
 * [ ] coalescing of types for 'execute'
 * We need to use Event emitter
 */

const VertexKey = Symbol('vertex');

export default class Vertex<T, R> {
  key = VertexKey;
  execute: Execute<T, R>;

  private _depth: number = 1;
  private children: Set<Vertex<unknown, unknown>> = new Set();

  constructor(execute: Execute<T, R>) {
    this.execute = execute;
  }

  get depth(): number {
    return this._depth;
  }

  set depth(d: number) {
    this._depth = d;
    // Update the children's depth
    this.children.forEach(child => child.depth = d + 1);
  }

  addChild(vertex: Vertex<any, any>) {
    if (this.children.has(vertex)) {
      throw new VertexError("Vertex is already a child.");
    }

    if (this === vertex) {
      throw new VertexError("Cannot add self as a child.");
    }

    this.children.add(vertex);
    vertex.depth = this.depth + 1;
  }

  getChildren() {
    return this.children;
  }
}

const a = new Vertex(async () => {});
const b = new Vertex(async () => {});

const executors: Record<symbol, any> = {};

executors[a.key] = "";
