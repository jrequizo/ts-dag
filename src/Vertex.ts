import z from "zod/v4";
import VertexError from "./VertexError";

/**
 *
 */
type Execute<Input, Output> =
  | ((input: Input) => Promise<Output>)
  | ((input: Input) => Output);

type ExecuteWithoutInput<Output> = (() => Promise<Output>) | (() => Output);

/**
 * TODOs:
 * [ ] coalescing of types for 'execute'
 * [ ] coalesce result set
 * [ ]
 * [ ] Use Event emitter
 */

type AnyVertex = Vertex<any, any, any>;

interface VertexConstructor<Input, Output, Schema extends z.ZodSchema<Input>> {
  input?: Schema;
  execute: z.ZodType<unknown> extends Schema
    ? ExecuteWithoutInput<Output>
    : Execute<z.infer<Schema>, Output>;
}

/**
 *
 */
export default class Vertex<Input, Output, Schema extends z.ZodSchema<Input>> {
  execute: z.ZodType<unknown> extends Schema
    ? ExecuteWithoutInput<Output>
    : Execute<z.infer<Schema>, Output>;
  /**
   * @internal
   */
  key = Symbol("vertex");

  private $resultSet: any = {};

  /**
   * @internal
   */
  private $parentExecutionStatus: Record<symbol, boolean> = {};

  /**
   * @internal
   */
  private $children: Set<AnyVertex> = new Set();

  constructor(builder: VertexConstructor<Input, Output, Schema>) {
    // Modify execute to check and propagate execution
    if (builder.input) {
      this.execute = (async (input: z.infer<Schema>): Promise<Output> => {
        // console.log(`Executing... ${JSON.stringify(input)}`);
        const result = await builder.execute(input);
        // console.log(`Result: ${JSON.stringify(result)}`);

        // console.log("Updating children");
        this.$children.forEach((child) => {
          child.updateParentStatus(this.key, result);
        });

        // We would end up running all the child elements first...
        // this.propagateCompletion(this.key, result);
        return result;
      }) as any;
    } else {
      this.execute = (async (): Promise<Output> => {
        // console.log(`Executing... ${JSON.stringify(input)}`);
        // Funky as!
        const result = await builder.execute(undefined as any);
        // console.log(`Result: ${JSON.stringify(result)}`);

        // console.log("Updating children");
        this.$children.forEach((child) => {
          child.updateParentStatus(this.key, result);
        });

        // We would end up running all the child elements first...
        // this.propagateCompletion(this.key, result);
        return result;
      }) as ExecuteWithoutInput<Output>;
    }
  }

  /**
   * Adds a {@link Vertex} as a child of this for execution after this vertex.
   * @param vertex
   */
  addChild<ChildOutput, ChildSchema extends z.ZodSchema<z.infer<Output>>>(
    vertex: Vertex<z.infer<Output>, ChildOutput, ChildSchema>
  ) {
    // @ts-expect-error
    if (this === vertex) {
      throw new VertexError("Cannot add self as a child.");
    }

    // If `vertex` can already reach `this`, then adding `this -> vertex` creates a cycle.
    if (vertex.hasPathTo(this)) {
      throw new VertexError("Adding this edge would create a cycle.");
    }

    this.$children.add(vertex);
    vertex.addParent(this.key);
    // console.log("Adding child vertex", vertex);
  }

  /**
   * @internal
   */
  getChildren() {
    return this.$children;
  }

  /**
   * @internal
   */
  private addParent(parentKey: symbol) {
    if (parentKey.description !== "vertex") {
      throw new VertexError("Symbol is not 'vertex'.");
    }

    if (this.$parentExecutionStatus[parentKey] !== undefined) {
      throw new VertexError(`Duplicate vertex key added.`);
    }

    this.$parentExecutionStatus[parentKey] = false;
  }

  get parents() {
    return Object.getOwnPropertySymbols(this.$parentExecutionStatus);
  }

  /** DFS: is there a path from `this` to `target`? */
  private hasPathTo(
    target: AnyVertex,
    visited = new Set<AnyVertex>()
  ): boolean {
    if (this === target) return true;
    if (visited.has(this)) return false;
    visited.add(this);

    for (const child of this.$children) {
      if (child.hasPathTo(target, visited)) return true;
    }
    return false;
  }

  /**
   * TODO: [ ] typing for 'result' input
   * @param parent
   * @param result
   * @internal
   */
  private updateParentStatus(parent: symbol, result: any) {
    // console.log(this);
    this.$parentExecutionStatus[parent] = true;
    // console.log(this.$parentExecutionStatus);

    this.$resultSet = {
      ...this.$resultSet,
      ...result,
    };

    // Check if all '$parentExecutionStatus' has completed.
    const keys = Object.getOwnPropertySymbols(this.$parentExecutionStatus);
    const hasExecuted = keys.every(
      (key) => this.$parentExecutionStatus[key] === true
    );
    // console.log(keys);
    // console.log(hasExecuted)
    if (hasExecuted) {
      this.execute(this.$resultSet);
    }
  }
}
