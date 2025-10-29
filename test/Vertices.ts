import { describe, it, expect } from "vitest";

import Vertex from "@/Vertex";
import VertexError from "@/VertexError";

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

describe("Vertex can add children", () => {
  it("Should return the children when added", () => {
    const a = new Vertex(async () => {});
    const b = new Vertex(async () => {});

    a.addChild(b);
    const children = a.getChildren();
    const retrievedChild = children.values().next().value;

    expect(children.has(b)).toBeTruthy();
    expect(retrievedChild).toEqual(b);
  });

  it("Should throw an error when trying to add itself", () => {
    const vertex = new Vertex(async () => {});
    expect(() => vertex.addChild(vertex)).toThrowError(VertexError);
    expect(() => vertex.addChild(vertex)).toThrow("Cannot add self as a child.");
  });

  it("Should throw an error when trying to add duplicate child", () => {
    const a = new Vertex(async () => {});
    const b = new Vertex(async () => {});
    a.addChild(b);

    expect(() => a.addChild(b)).toThrowError(VertexError);
    expect(() => a.addChild(b)).toThrow("Vertex is already a child.");
  });

  it("Should assign the correct depths to children", () => {
    const root = new Vertex(async () => {});
    const a = new Vertex(async () => {});
    const b = new Vertex(async () => {});
    const c = new Vertex(async () => {});

    root.addChild(a);
    a.addChild(b);
    b.addChild(c);

    expect(root.depth).toEqual(1);
    expect(a.depth).toEqual(2);
    expect(b.depth).toEqual(3);
    expect(c.depth).toEqual(4);
  });
});
