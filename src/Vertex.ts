// Vertex.ts
import z from "zod/v4";
import VertexError from "./VertexError";

/**
 * Execute function shapes (unchanged).
 */
export type Execute<Input, Output> =
  | ((input: Input) => Promise<Output>)
  | ((input: Input) => Output);

export type ExecuteWithoutInput<Output> =
  | (() => Promise<Output>)
  | (() => Output);

/**
 * AnyVertex alias (unchanged).
 */
export type AnyVertex = Vertex<any, any, any>;

/**
 * Original constructor shape:
 * - Schema drives Input via default generic parameter (Input = z.infer<Schema>)
 * - Conditional execute type: if Schema is 'unknown' sentinel, then no-arg execute
 */
export interface VertexConstructor<
  Schema extends z.ZodType<Input>,
  Output,
  Input = z.infer<Schema>
> {
  input?: Schema;
  execute: z.ZodType<unknown> extends Schema
    ? ExecuteWithoutInput<Output>
    : Execute<Input, Output>;
}

/**
 * Pretty compile-time error if parent's Output isn't assignable to child's input value type.
 * Purely type-level; zero runtime impact.
 */
type _EnforceAssignable<From, To> =
  [From] extends [To]
    ? unknown
    : ["OutputNotAssignableToChildInput", { Output: From }, { NeededInput: To }];

/**
 * Main Vertex class.
 * Runtime behaviour preserved:
 *  - execute is assigned via the original wrapper that awaits result and notifies children
 *  - getChildren() returns a Set
 *  - addChild prevents self and duplicate keys, records parents, and checks for cycles
 *  - updateParentStatus notifies readiness and triggers execute when all parents have resolved
 */
export default class Vertex<
  Schema extends z.ZodType<Input>,
  Output,
  Input = z.infer<Schema>
> {
  /**
   * Conditional execute type remains exactly as in your original.
   */
  public readonly execute: z.ZodType<unknown> extends Schema
    ? ExecuteWithoutInput<Output>
    : Execute<Input, Output>;

  /**
   * Optional schema retained as-is.
   */
  public readonly input?: Schema;

  /**
   * Unique identity symbol, used by duplicate/self/cycle protections and tests.
   */
  public readonly key = Symbol("vertex");

  /**
   * Track parent vertex keys; tests assert on this.
   */
  public readonly parents: Set<symbol> = new Set();

  /**
   * Internal child storage keyed by child.key to prevent duplicates.
   * NOTE: name preserved ($children) to match original behaviour.
   */
  private readonly $children: Map<symbol, AnyVertex> = new Map();

  /**
   * Track statuses from parents (used by updateParentStatus to know readiness).
   * Insertion order reflects arrival order of parent results.
   */
  private readonly $parentStatuses: Map<symbol, unknown> = new Map();

  constructor(builder: VertexConstructor<Schema, Output, Input>) {
    this.input = builder.input;

    // IMPORTANT: preserve original behaviour — create a wrapper that:
    //  1) awaits builder.execute(input)
    //  2) notifies children via child.updateParentStatus(this.key, result)
    //  3) returns the result
    const impl = builder.execute as any;
    const wrapper = async (input?: any) => {
      const result = await impl(input);

      this.$children.forEach((child) => {
        (child as any).updateParentStatus(this.key, result);
      });

      return result;
    };

    // Keep the public type of execute intact; runtime is the wrapper above.
    this.execute = (wrapper as unknown) as z.ZodType<unknown> extends Schema
      ? ExecuteWithoutInput<Output>
      : Execute<Input, Output>;
  }

  /**
   * Adds a child vertex to run after this one.
   *
   * ***Only type-level strengthening on the parameter:***
   *   Output (this vertex's output) must be assignable to z.input<ChildSchema> (child's input value type).
   *
   * Runtime behaviour (self/duplicate/cycle/parents) is unchanged.
   */
  public addChild<
    ChildSchema extends z.ZodType<ChildInput>,
    ChildOutput,
    ChildInput
  >(
    vertex: Vertex<ChildSchema, ChildOutput, ChildInput> &
      _EnforceAssignable<Output, z.input<ChildSchema>>
  ) {
    // Prevent adding self
    if (vertex === (this as unknown as AnyVertex)) {
      throw new VertexError("Cannot add self as a child.");
    }

    // Prevent duplicates by vertex key
    if (this.$children.has(vertex.key)) {
      throw new VertexError("Duplicate vertex key added.");
    }

    // Prevent cycles: if there's a path from the prospective child back to this,
    // adding (this -> child) would create a cycle.
    if (this._hasPath(vertex as unknown as AnyVertex, this as unknown as AnyVertex)) {
      throw new VertexError("Adding this edge would create a cycle.");
    }

    // Establish edge
    this.$children.set(vertex.key, vertex as unknown as AnyVertex);
    (vertex as unknown as AnyVertex).parents.add(this.key);
  }

  /**
   * Return a Set view of children — matches tests that do Set + iterator usage.
   */
  public getChildren(): Set<AnyVertex> {
    return new Set(this.$children.values());
  }

  /**
   * Called by a parent when it resolves; records the parent's result and,
   * if all parents are ready, triggers this vertex's execution with the appropriate input.
   *
   * Single-parent: pass that parent's result directly.
   * Multi-parent:
   *   - If all results are plain objects, shallow-merge them and pass the merged object.
   *   - Otherwise, pass an array of results in arrival order (conservative fallback).
   *
   * This matches the test expecting a flat object like: { test2: 'bar ', test3: 'baz' }.
   */
  public async updateParentStatus(parentKey: symbol, value: unknown): Promise<void> {
    this.$parentStatuses.set(parentKey, value);

    // Only run when all registered parents have produced a status.
    if (this.parents.size === 0 || this.$parentStatuses.size < this.parents.size) {
      return;
    }

    // Single-parent case: pass-through
    if (this.parents.size === 1) {
      await (this.execute as any)(value);
      return;
    }

    // Multi-parent case
    const values = Array.from(this.$parentStatuses.values());

    const allPlainObjects = values.every(
      (v) => v !== null && typeof v === "object" && !Array.isArray(v)
    );

    if (allPlainObjects) {
      // Shallow-merge in arrival order (Map preserves insertion order)
      const merged = Object.assign({}, ...values as Record<string, unknown>[]);
      await (this.execute as any)(merged);
    } else {
      // Fallback: pass an array if we can't safely merge
      await (this.execute as any)(values);
    }
  }

  /**
   * Depth-first reachability to detect cycles.
   * Unchanged logic; used by addChild before linking.
   */
  private _hasPath(
    from: AnyVertex,
    to: AnyVertex,
    seen: Set<symbol> = new Set()
  ): boolean {
    if (from.key === to.key) return true;
    if (seen.has(from.key)) return false;
    seen.add(from.key);

    for (const child of (from as any).$children.values() as Iterable<AnyVertex>) {
      if (this._hasPath(child as AnyVertex, to, seen)) return true;
    }
    return false;
  }
}
