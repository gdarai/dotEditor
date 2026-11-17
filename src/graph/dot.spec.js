import { describe, expect, it } from 'vitest';
import { createElement, inspectGraph, planDeletion, updateElement } from './dot.js';

describe('inspectGraph', () => {
  it('finds nested groups, explicit and implicit nodes, and edges', () => {
    const dot = 'digraph G { subgraph cluster_a { a [shape=box]; a -> b; } b -> c; }';
    const result = inspectGraph(dot);
    expect(result.directed).toBe(true);
    expect(result.groups.map((group) => group.id)).toEqual(['cluster_a']);
    expect(result.nodes.map(({ id, implicit }) => [id, !!implicit])).toEqual([
      ['a', false], ['b', true], ['c', true],
    ]);
    expect(result.edges.map(({ source, target }) => [source, target])).toEqual([['a', 'b'], ['b', 'c']]);
    expect(result.nodes[0].location.start.offset).toBe(dot.indexOf('a ['));
  });

  it('marks chained, grouped and port edges as complex', () => {
    const result = inspectGraph('graph { a -- b -- c; {a b} -- c; a:p -- b; }');
    expect(result.directed).toBe(false);
    expect(result.edges).toHaveLength(3);
    expect(result.edges.every((edge) => edge.complex)).toBe(true);
    expect(result.edges.map(({ source, target }) => [source, target])).toEqual([
      ['a', 'b'], ['', 'c'], ['a', 'b'],
    ]);
    expect(result.edges.every((edge) => edge.attributes && edge.location)).toBe(true);
  });

  it('extracts supported statement attributes while excluding ordinary subgraphs', () => {
    const dot = `digraph {
      subgraph wrapper {
        subgraph cluster_one {
          graph [label="Old", bgcolor=lightblue, custom=ignored];
          label="New";
          a [label="A", shape=box, custom=ignored];
          a -> b [color=red, arrowhead=vee, weight=2];
        }
      }
    }`;
    const { nodes, groups, edges } = inspectGraph(dot);
    expect(groups).toEqual([
      expect.objectContaining({
        id: 'cluster_one',
        attributes: { label: 'New', bgcolor: 'lightblue' },
      }),
    ]);
    expect(nodes.find((node) => node.id === 'a').attributes).toEqual({ label: 'A', shape: 'box' });
    expect(nodes.find((node) => node.id === 'b').attributes).toEqual({});
    expect(edges[0].attributes).toEqual({ color: 'red', arrowhead: 'vee' });
  });

  it('exposes supported attributes on complex edges without pretending they are editable', () => {
    const dot = 'digraph { a -> b -> c [label="chain", style=dashed, weight=10]; }';
    const edge = inspectGraph(dot).edges[0];
    expect(edge).toMatchObject({
      source: 'a', target: 'b', complex: true,
      attributes: { label: 'chain', style: 'dashed' },
    });
    expect(() => updateElement(dot, 'edge', edge.location, { label: 'changed' })).toThrow(/unsupported/);
  });
});

describe('createElement', () => {
  it('preserves original text and inserts a DOT-safe node', () => {
    const original = 'digraph G {\n  // untouched\n  a [custom=x];\n}\n';
    const updated = createElement(original, 'node', { id: 'a "quoted"', label: 'a "label"\\path', fillcolor: 'blue' });
    expect(updated).toContain('  // untouched\n  a [custom=x];\n');
    expect(updated).toContain('"a \\"quoted\\"" [label="a \\"label\\"\\\\path", fillcolor="blue"];');
    expect(inspectGraph(updated).nodes.map((node) => node.id)).toContain('a "quoted"');
  });

  it('uses the right edge operator and supports nested insertion', () => {
    const original = 'graph G {\n  subgraph cluster_a { a; }\n}';
    const group = inspectGraph(original).groups[0];
    const updated = createElement(original, 'edge', { source: 'a', target: 'b', parentLocation: group.location });
    expect(updated).toContain('"a" -- "b";');
    expect(updated.indexOf('"a" -- "b";')).toBeLessThan(updated.indexOf('\n}'));
    expect(inspectGraph(updated).edges[0].target).toBe('b');
  });

  it('creates a group with editable graph attributes', () => {
    const updated = createElement('digraph {}', 'group', { id: 'cluster_one', label: 'One', bgcolor: '#eef' });
    expect(updated).toContain('subgraph "cluster_one" { graph [label="One", bgcolor="#eef"]; }');
    expect(inspectGraph(updated).groups[0].id).toBe('cluster_one');
  });

  it('requires cluster IDs when creating groups', () => {
    expect(() => createElement('digraph {}', 'group', { id: 'ordinary' })).toThrow(/cluster_/);
  });
});

describe('updateElement', () => {
  it('changes only specified node values and preserves unknown attributes and comments', () => {
    const dot = 'digraph { // hi\n  a [custom=unchanged, label="old", color=red]; // node\n  b;\n}';
    const node = inspectGraph(dot).nodes[0];
    const updated = updateElement(dot, 'node', node.location, { id: 'new id', label: 'new', color: '', shape: 'box' });
    expect(updated).toContain('// hi');
    expect(updated).toContain('// node');
    expect(updated).toContain('"new id" [custom=unchanged, label="new", shape="box"]');
    expect(updated).toContain('  b;');
  });

});

describe('planDeletion', () => {
    it('removes all declarations of a selected node ID and its connected arrows, including complex arrows', () => {
      const dot = 'digraph { a [label="A"]; a; b; a -> b; a:p -> c; b -> {a d}; b -> d; }';
      const node = inspectGraph(dot).nodes.find((item) => item.id === 'a');
      const { counts, deleted } = planDeletion(dot, 'node', node.location);
      expect(counts).toEqual({ nodes: 2, arrows: 3, groups: 0 });
      expect(deleted).toContain('b;');
      expect(deleted).toContain('b -> d;');
      expect(deleted).not.toMatch(/\ba(?:\s*(?:;|\[|->)|:)/);
      expect(inspectGraph(deleted).nodes.map((item) => item.id)).toEqual(['b', 'd']);
    });

    it('deletes an implicit node by removing all its referencing arrows', () => {
      const dot = 'digraph { a -> b; c -> b; c -> d; }';
      const node = inspectGraph(dot).nodes.find((item) => item.id === 'b');
      const { counts, deleted } = planDeletion(dot, 'node', node.location);
      expect(counts).toEqual({ nodes: 2, arrows: 2, groups: 0 });
      expect(deleted).toContain('c -> d;');
      expect(inspectGraph(deleted).nodes.map((item) => item.id)).toEqual(['c', 'd']);
    });

    it('removes a node ID across groups while retaining unrelated group contents', () => {
      const dot = 'digraph { subgraph cluster_a { a; a -> b; } subgraph cluster_b { a; c; c -> a; } }';
      const node = inspectGraph(dot).nodes.find((item) => item.id === 'a');
      const { counts, deleted } = planDeletion(dot, 'node', node.location);
      expect(counts).toEqual({ nodes: 2, arrows: 2, groups: 0 });
      expect(inspectGraph(deleted).nodes.map((item) => item.id)).toEqual(['c']);
      expect(inspectGraph(deleted).groups.map((item) => item.id)).toEqual(['cluster_a', 'cluster_b']);
      expect(deleted).toContain('c;');
    });

    it('deletes only the selected arrow among duplicates, including complex arrows', () => {
      const dot = 'graph { a -- b -- c; a -- b -- c; b -- c; }';
      const edge = inspectGraph(dot).edges[1];
      const { counts, deleted } = planDeletion(dot, 'edge', edge.location);
      expect(counts).toEqual({ nodes: 0, arrows: 1, groups: 0 });
      expect(inspectGraph(deleted).edges).toHaveLength(2);
      expect(deleted.match(/a -- b -- c;/g)).toHaveLength(1);
      expect(deleted).toContain('b -- c;');
    });

    it('removes a nested group and its descendants without touching neighboring statements', () => {
      const dot = 'digraph { outside; subgraph cluster_a { a; subgraph cluster_b { b; } a -> b; } outside -> x; }';
      const group = inspectGraph(dot).groups[0];
      const { counts, deleted } = planDeletion(dot, 'group', group.location);
      expect(counts).toEqual({ nodes: 2, arrows: 1, groups: 2 });
      expect(deleted).toContain('outside;');
      expect(deleted).toContain('outside -> x;');
      expect(inspectGraph(deleted).groups).toHaveLength(0);
    });

    it('keeps children of a group but drops group-scoped attributes', () => {
      const dot = 'digraph { subgraph cluster_a { graph [label="Only group"]; color=red; a [label="A"]; subgraph cluster_b { b; } a -> b; } x; }';
      const group = inspectGraph(dot).groups[0];
      const { kept, deleted } = planDeletion(dot, 'group', group.location);
      expect(kept).not.toContain('cluster_a');
      expect(kept).not.toContain('Only group');
      expect(kept).not.toContain('color=red');
      expect(kept).toContain('a [label="A"]; subgraph cluster_b { b; } a -> b;');
      expect(kept).toContain('x;');
      expect(inspectGraph(kept).groups.map((item) => item.id)).toEqual(['cluster_b']);
      expect(deleted).not.toContain('cluster_b');
    });

    it('keeps child statements in the parent group when deleting a nested wrapper', () => {
      const dot = 'digraph { subgraph cluster_parent { subgraph cluster_child { a; a -> b; } c; } }';
      const child = inspectGraph(dot).groups.find((item) => item.id === 'cluster_child');
      const { kept } = planDeletion(dot, 'group', child.location);
      expect(inspectGraph(kept).groups.map((item) => item.id)).toEqual(['cluster_parent']);
      expect(inspectGraph(kept).edges).toHaveLength(1);
      expect(kept).toContain('a; a -> b;');
      expect(kept).toContain('c;');
    });

    it('rejects stale locations and unsupported types without changing the source', () => {
      const dot = 'digraph { a; }';
      const location = { start: { offset: 100 }, end: { offset: 101 } };
      expect(() => planDeletion(dot, 'node', location)).toThrow(/location/);
      expect(() => planDeletion(dot, 'group', location)).toThrow(/location/);
      expect(() => planDeletion(dot, 'vertex', location)).toThrow(/Unsupported/);
      expect(dot).toBe('digraph { a; }');
    });
});

describe('updateElement', () => {
  it('updates only endpoints and selected edge attributes', () => {
    const dot = 'graph { a -- b [weight=5, label="old"]; }';
    const edge = inspectGraph(dot).edges[0];
    const updated = updateElement(dot, 'edge', edge.location, { source: 'x', target: 'y', label: 'next', color: 'red' });
    expect(updated).toContain('"x" -- "y" [weight=5, label="next", color="red"]');
  });

  it('materializes implicit nodes without altering edges', () => {
    const dot = 'digraph { a -> b; }';
    const implicit = inspectGraph(dot).nodes.find((node) => node.id === 'a');
    const updated = updateElement(dot, 'node', implicit.location, { label: 'A' });
    expect(updated).toContain('a -> b;');
    expect(updated).toContain('"a" [label="A"];');
    expect(inspectGraph(updated).nodes.find((node) => node.id === 'a').implicit).toBeUndefined();
  });

  it('materializes an implicit node beside its first edge inside a nested subgraph', () => {
    const dot = 'digraph {\n  subgraph wrapper {\n    subgraph cluster_one {\n      a -> b;\n    }\n  }\n  b -> c;\n}';
    const implicit = inspectGraph(dot).nodes.find((node) => node.id === 'b');
    const updated = updateElement(dot, 'node', implicit.location, { label: 'B' });
    expect(updated).toContain('a -> b;\n      "b" [label="B"];\n    }\n  }\n  b -> c;');
    expect(updated.match(/"b" \[label=/g)).toHaveLength(1);
  });

  it('updates a group ID without touching its content', () => {
    const dot = 'digraph { subgraph cluster_a { // preserved\n a; } }';
    const group = inspectGraph(dot).groups[0];
    const updated = updateElement(dot, 'group', group.location, { id: 'cluster_b', label: 'B' });
    expect(updated).toContain('subgraph "cluster_b" { graph [label="B"]; // preserved\n a; }');
  });

  it('updates group attribute lists while preserving unknown keys', () => {
    const dot = 'digraph { subgraph cluster_a { graph [custom=keep, label="Old", bgcolor=blue]; a; } }';
    const group = inspectGraph(dot).groups[0];
    const updated = updateElement(dot, 'group', group.location, { label: 'New', bgcolor: '', color: 'red' });
    expect(updated).toContain('graph [custom=keep, label="New", color="red"]');
    expect(updated).toContain('a;');
  });

  it('prevents renaming a cluster to an ordinary subgraph', () => {
    const dot = 'digraph { subgraph cluster_one { a; } }';
    const group = inspectGraph(dot).groups[0];
    expect(() => updateElement(dot, 'group', group.location, { id: 'ordinary' })).toThrow(/cluster_/);
    expect(dot).toContain('cluster_one');
  });

  it('edits only the selected duplicate edge and effective duplicate attribute', () => {
    const dot = 'digraph { a -> b [label="old", label="active", weight=1]; /* keep */ a -> b [label="other"]; }';
    const edges = inspectGraph(dot).edges;
    const updated = updateElement(dot, 'edge', edges[0].location, { target: 'c', label: 'new' });
    expect(updated).toContain('a -> "c" [label="old", label="new", weight=1]');
    expect(updated).toContain('/* keep */ a -> b [label="other"]');
    expect(inspectGraph(updated).edges[0].attributes.label).toBe('new');
    expect(inspectGraph(updated).edges[1].attributes.label).toBe('other');
  });

  it('updates only the effective duplicate group attribute', () => {
    const dot = 'digraph { subgraph cluster_one { graph [label="first", label="last", custom=keep]; } }';
    const group = inspectGraph(dot).groups[0];
    const updated = updateElement(dot, 'group', group.location, { label: 'new' });
    expect(updated).toContain('graph [label="first", label="new", custom=keep]');
    expect(inspectGraph(updated).groups[0].attributes.label).toBe('new');
  });

  it('removes optional attributes without changing unrelated values', () => {
    const dot = 'digraph { a [shape=box, color=red, custom=keep]; }';
    const node = inspectGraph(dot).nodes[0];
    const updated = updateElement(dot, 'node', node.location, { shape: '', color: '' });
    expect(updated).toMatch(/a \[\s*custom=keep\]/);
  });

  it('refuses unsupported and stale edits', () => {
    const dot = 'digraph { a -> b -> c; }';
    const edge = inspectGraph(dot).edges[0];
    expect(() => updateElement(dot, 'edge', edge.location, { target: 'x' })).toThrow(/unsupported/);
    expect(() => updateElement(dot, 'node', { start: { offset: 100 }, end: { offset: 101 } }, { label: 'X' })).toThrow(/location/);
    expect(() => updateElement(dot, 'node', inspectGraph(dot).nodes[0].location, { id: 'x' })).toThrow(/implicit/);
  });

  it('rejects invalid DOT, IDs and unsupported fields', () => {
    expect(() => inspectGraph('digraph { a -> }')).toThrow(/Invalid DOT/);
    expect(() => createElement('graph {}', 'node', { id: '' })).toThrow(/empty/);
    expect(() => createElement('graph {}', 'edge', { source: 'a', target: 'b', unsupported: 1 })).toThrow(/Unsupported/);
    expect(() => updateElement('graph {}', 'group', { start: {}, end: {} }, {})).toThrow(/location/);
  });
});
