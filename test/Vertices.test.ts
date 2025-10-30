import { describe, it, expect, vi } from "vitest";

import Vertex from "@/Vertex";
import VertexError from "@/VertexError";
import z from "zod/v4";

/**
 * class for dag
 * [ ] nodes and edges...
 * new Node() -> node.addChildNode()
 *
 * what separates a dag not being cyclic, otherwise it
 * should be similar to a tree
 *
 * vertices and edges
 *
 * should be able to
 * - add vertices
 * - define how the vertices connect to each other (as edges?)
 * - each vertices should define the function it should run
 *      - typed input
 *      - typed output
 *      - async/non-async
 *
 * - if a child vertices doesn't have its inputs adequately fulfilled...
 *      - should be an error
 *
 * - inputs should be propagated down by parent vertices
 *      - except for the first vertices which the input should be available to
 *        all child vertices?
 * - use 'Reachability' relation to determine which vertices can be ran asynchronously
 *      - transitive reduction
 *
 * e.g. wikipedia example:
 *  - b and c can be ran asynchronously to each other
 *  - d would be dependent on all parent vertices to complete first
 *  - all nodes at the same depth in the transitive reduction can be ran asynchronous
 *    to each other
 *  - all parent -> child node relations will need to be synchronously executed
 *
 *  - cases for topologically ordered vertices
 *      - how do we calculate the right depth?
 *      - we'd probably use the largest depth value
 *          - e.g. the vertices reports both depths of 4 and 2, 4 would be the actual
 *          - in cases where there're multiple reported depths, we know there's
 *            a topological ordering situation
 *          - [ ] do we need to await in any special way here? don't think so...
 *
 * may need to track depth?
 *
 * start at top-most (called root) vertices
 *  - setDepth(1)
 *  - add to execution array
 *      - [root, <children to come>]
 * vertex.getChildren()
 *  - for each child:
 *      - check if depth is set
 *          - if it is, remove it from that depth
 *      - setDepth(1+n)
 *      - add to execution array:
 *          - [root, [<children: depth 1], ...[children: depth n]]
 *
 * for each vertex in the execution array
 *  - await execution
 *  - coalesce outputs and pass result to all children
 *
 */
// helper: a controllable promise
function deferred<T = void>() {
  let resolve!: (v: T | PromiseLike<T>) => void;
  let reject!: (e?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("Vertex can add children", () => {
  it("Should return the children when added", () => {
    const a = new Vertex({ input: z.any(), execute: vi.fn() });
    const b = new Vertex({ input: z.any(), execute: vi.fn() });

    a.addChild(b);
    const children = a.getChildren();
    const retrievedChild = children.values().next().value;

    expect(children.has(b)).toBeTruthy();
    expect(retrievedChild).toEqual(b);
  });

  it("Should throw an error when trying to add itself", () => {
    const vertex = new Vertex({ input: z.any(), execute: vi.fn() });
    expect(() => vertex.addChild(vertex)).toThrowError(VertexError);
    expect(() => vertex.addChild(vertex)).toThrow(
      "Cannot add self as a child."
    );
  });

  it("Should throw an error when trying to add duplicate child", () => {
    const a = new Vertex({ input: z.any(), execute: vi.fn() });
    const b = new Vertex({ input: z.any(), execute: vi.fn() });
    a.addChild(b);

    expect(() => a.addChild(b)).toThrowError(VertexError);
    expect(() => a.addChild(b)).toThrow("Duplicate vertex key added.");
  });

  it("Should contain parent symbols", () => {
    const a = new Vertex({ input: z.any(), execute: vi.fn() });
    const b = new Vertex({ input: z.any(), execute: vi.fn() });

    a.addChild(b);
    const bKeys = new Set(b.parents);

    expect(bKeys.has(a.key)).toBeTruthy();
    expect(bKeys.size).toBe(1);
  });

  it("Should run the execute function when called", async () => {
    const execute = vi.fn();
    const constructor = { input: z.any(), execute };
    const input = { test: "foo" };

    const a = new Vertex(constructor);
    await a.execute(input);

    expect(execute).toHaveBeenCalledExactlyOnceWith(input);
  });

  it("runs children only after parent resolves (no timeouts)", async () => {
    const aStarted = deferred<void>();
    const bStarted = deferred<void>();
    const cStarted = deferred<void>();

    const aGate = deferred<void>();
    const bGate = deferred<void>();
    const cGate = deferred<void>();

    const aInput = { test1: "foo" };
    const aOutput = { test2: "bar " };
    const bOutput = { test3: "baz" };
    const cInput = { ...aOutput, ...bOutput };

    const calls: string[] = [];

    const aFunc = vi.fn(async () => {
      calls.push("a:start");
      aStarted.resolve(); // signal that A has begun
      await aGate.promise; // pause until the test lets A finish
      calls.push("a:end");
      return aOutput;
    });

    const bFunc = vi.fn(async () => {
      calls.push("b:start");
      bStarted.resolve();
      await bGate.promise;
      calls.push("b:end");
      return bOutput;
    });

    const cFunc = vi.fn(async () => {
      calls.push("c:start");
      cStarted.resolve();
      await cGate.promise;
      calls.push("c:end");
    });

    const a = new Vertex({ input: z.any(), execute: aFunc });
    const b = new Vertex({ input: z.any(), execute: bFunc });
    const c = new Vertex({ input: z.any(), execute: cFunc });

    a.addChild(b);
    b.addChild(c);
    a.addChild(c); // transitive

    // kick it off but don't await yet; we'll step it
    const exec = a.execute(aInput);

    // A has started, but hasn't finished -> B must NOT have started yet
    await aStarted.promise;
    expect(bFunc).not.toHaveBeenCalled();

    // Let A finish, then B may start
    aGate.resolve();
    await bStarted.promise;
    expect(cFunc).not.toHaveBeenCalled();

    // Let B finish, then C may start
    bGate.resolve();
    await cStarted.promise;

    // Let C finish and await the whole execution
    cGate.resolve();
    await exec;

    // Now assert order and args
    expect(aFunc).toHaveBeenCalledBefore(bFunc);
    expect(bFunc).toHaveBeenCalledBefore(cFunc);

    expect(aFunc).toHaveBeenCalledOnce();
    expect(bFunc).toHaveBeenCalledOnce();
    expect(cFunc).toHaveBeenCalledOnce();

    expect(aFunc).toHaveBeenCalledWith(aInput);
    expect(bFunc).toHaveBeenCalledWith(aOutput);
    expect(cFunc).toHaveBeenCalledWith(cInput);

    // Finer-grained start/end proof
    expect(calls).toEqual([
      "a:start",
      "a:end",
      "b:start",
      "b:end",
      "c:start",
      "c:end",
    ]);
  });

  it("Should have no cyclic dependencies", () => {
    const a = new Vertex({ input: z.any(), execute: vi.fn() });
    const b = new Vertex({ input: z.any(), execute: vi.fn() });
    const c = new Vertex({ input: z.any(), execute: vi.fn() });

    a.addChild(b);
    b.addChild(c);
    expect(() => c.addChild(a)).toThrowError(VertexError);
    expect(() => c.addChild(a)).toThrow(
      "Adding this edge would create a cycle."
    );
  });
});
