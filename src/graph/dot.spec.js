import { describe, expect, it } from 'vitest';
import { createElement, inspectGraph, planDeletion, readGraphOptions, rearrangeGroup, updateElement, updateGraphOptions } from './dot.js';

describe('graph options', () => {
  it('reads and edits root and nested cluster options without touching unrelated settings', () => {
    const dot = `digraph G {
      // preserve
      rankdir=TB;
      graph [fontname=Arial, splines=ortho, custom=keep];
      subgraph cluster_x { rank=same; graph [fontcolor=red, bgcolor=yellow]; a; }
    }`;
    const group = inspectGraph(dot).groups[0];
    expect(readGraphOptions(dot)).toEqual({ rankdir: 'TB', fontname: 'Arial', splines: 'ortho' });
    expect(readGraphOptions(dot, group.location)).toEqual({ rank: 'same', fontcolor: 'red' });
    const changed = updateGraphOptions(dot, group.location, { rank: 'max', fontcolor: '#123456', fontname: 'DejaVu Sans' });
    expect(changed).toContain('// preserve');
    expect(changed).toContain('custom=keep');
    expect(changed).toContain('bgcolor=yellow');
    expect(readGraphOptions(changed).rankdir).toBe('TB');
    expect(readGraphOptions(changed, inspectGraph(changed).groups[0].location)).toEqual({
      rank: 'max', fontcolor: '#123456', fontname: 'DejaVu Sans',
    });
  });

  it('creates a root graph list and targets duplicate cluster IDs by location', () => {
    const dot = 'digraph { subgraph cluster_x { a; } subgraph cluster_x { b; } }';
    const second = inspectGraph(dot).groups[1];
    const changed = updateGraphOptions(dot, second.location, { rank: 'same' });
    expect(changed).toContain('subgraph cluster_x { a; }');
    expect(readGraphOptions(changed, inspectGraph(changed).groups[0].location)).toEqual({});
    expect(readGraphOptions(changed, inspectGraph(changed).groups[1].location)).toEqual({ rank: 'same' });
    const root = updateGraphOptions(changed, null, { compound: 'true', splines: 'polyline' });
    expect(readGraphOptions(root)).toEqual({ compound: 'true', splines: 'polyline' });
  });

  it('clears only selected options from standalone attributes and graph lists, including duplicates', () => {
    const dot = 'digraph { rankdir=LR; graph [rankdir=TB, fontname=Arial, splines=ortho]; compound=true; }';
    const changed = updateGraphOptions(dot, null, { rankdir: '', splines: '', compound: '' });
    expect(readGraphOptions(changed)).toEqual({ fontname: 'Arial' });
    expect(changed).toContain('fontname=Arial');
    expect(changed).not.toContain('rankdir');
    expect(changed).not.toContain('splines');
    expect(changed).not.toContain('compound');
    expect(readGraphOptions(updateGraphOptions('digraph { graph [fontname=Arial, rank=same]; }', null, { rank: '' }))).toEqual({ fontname: 'Arial' });
  });

  it('rejects invalid targets and unsupported options without rewriting DOT', () => {
    const dot = 'digraph { subgraph cluster_x {} }';
    const location = inspectGraph(dot).groups[0].location;
    expect(() => updateGraphOptions(dot, location, { compound: 'true' })).toThrow(/Unsupported graph option/);
    expect(() => updateGraphOptions(dot, location, { rank: 1 })).toThrow(/must be a string/);
    expect(() => readGraphOptions('digraph {}', location)).toThrow(/location/);
    expect(() => updateGraphOptions(dot, { start: { offset: 1 }, end: { offset: 3 } }, { rank: 'same' })).toThrow(/location/);
  });
});

describe('rearrangeGroup', () => {
  it('moves multiple declarations and a complex arrow in one valid update', () => {
    const dot = 'digraph {\n  // keep\n  a [custom=x]; a; a -> b -> c;\n  subgraph cluster_team { d; }\n  subgraph cluster_other { e; }\n}';
    const before = inspectGraph(dot);
    const selected = before.groups[0];
    const updated = rearrangeGroup(dot, selected.location, [
      { type: 'node', location: before.nodes.find((node) => node.id === 'a').location, inGroup: true },
      { type: 'edge', location: before.edges[0].location, inGroup: true },
      { type: 'node', location: before.nodes.find((node) => node.id === 'd').location, inGroup: false },
      { type: 'group', location: before.groups[1].location, inGroup: true },
    ]);
    const after = inspectGraph(updated);
    expect(updated).toContain('// keep');
    expect(updated).toContain('a [custom=x];');
    expect(after.nodes.filter((node) => node.id === 'a').map((node) => node.parentId)).toContain('cluster_team');
    expect(after.nodes.find((node) => node.id === 'd').parentId).toBeUndefined();
    expect(after.edges[0].parentId).toBe('cluster_team');
    expect(after.edges[0].complex).toBe(true);
    expect(after.groups.find((group) => group.id === 'cluster_other').parentId).toBe('cluster_team');
  });

  it('handles nested group moves and materializes implicit nodes without moving their arrows', () => {
    const dot = 'digraph { subgraph cluster_team { subgraph cluster_child { a -> b; } } c -> d; }';
    const before = inspectGraph(dot);
    const updated = rearrangeGroup(dot, before.groups[0].location, [
      { type: 'group', location: before.groups[1].location, inGroup: false },
      { type: 'node', location: before.nodes.find((node) => node.id === 'b').location, inGroup: true },
    ]);
    const after = inspectGraph(updated);
    expect(after.groups.find((group) => group.id === 'cluster_child').parentId).toBeUndefined();
    expect(after.nodes.find((node) => node.id === 'b').parentId).toBe('cluster_team');
    expect(after.nodes.find((node) => node.id === 'b').implicit).toBeUndefined();
    expect(after.edges.find((edge) => edge.source === 'a').parentId).toBe('cluster_child');
  });

  it('rejects duplicate group IDs and attempts to move the selected group', () => {
    const dot = 'digraph { subgraph cluster_x {} subgraph cluster_x {} }';
    expect(() => rearrangeGroup(dot, inspectGraph(dot).groups[0].location, [])).toThrow(/unique/);
    const simple = 'digraph { subgraph cluster_x {} }';
    const group = inspectGraph(simple).groups[0];
    expect(() => rearrangeGroup(simple, group.location, [{ type: 'group', location: group.location, inGroup: false }])).toThrow(/selected group/);
  });

  it('moves a group and its child independently without duplicating either statement', () => {
    const dot = 'digraph { subgraph cluster_team {} subgraph cluster_other { subgraph cluster_child { a; } } }';
    const before = inspectGraph(dot);
    const updated = rearrangeGroup(dot, before.groups[0].location, [
      { type: 'group', location: before.groups[1].location, inGroup: true },
      { type: 'group', location: before.groups[2].location, inGroup: true },
      { type: 'node', location: before.nodes[0].location, inGroup: true },
    ]);
    const after = inspectGraph(updated);
    expect(after.groups.map(group => group.id)).toHaveLength(3);
    expect(after.groups.find(group => group.id === 'cluster_other').parentId).toBe('cluster_team');
    expect(after.groups.find(group => group.id === 'cluster_child').parentId).toBe('cluster_team');
    expect(after.nodes[0].parentId).toBe('cluster_team');
  });
});

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

  it('places new elements by group ID or in the root when empty', () => {
    const dot = 'digraph { subgraph cluster_a {} }';
    const nested = createElement(dot, 'node', { id: 'n', parentId: 'cluster_a' });
    expect(inspectGraph(nested).nodes[0].parentId).toBe('cluster_a');
    expect(inspectGraph(createElement(dot, 'node', { id: 'n', parentId: '' })).nodes[0].parentId).toBeUndefined();
    expect(inspectGraph(createElement(dot, 'edge', { source: 'a', target: 'b', parentId: 'cluster_a' })).edges[0].parentId).toBe('cluster_a');
    expect(inspectGraph(createElement(dot, 'group', { id: 'cluster_b', parentId: 'cluster_a' })).groups[1].parentId).toBe('cluster_a');
    expect(() => createElement(dot, 'node', { id: 'n', parentId: 'missing' })).toThrow(/missing or ambiguous/);
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

    it('removes incoming and outgoing arrows connected to nodes in nested groups', () => {
      const dot = 'digraph { outside; subgraph cluster_a { a; subgraph cluster_b { b; } a -> b; } outside -> b; a -> outside; outside -> other; }';
      const group = inspectGraph(dot).groups[0];
      const { counts, deleted, kept } = planDeletion(dot, 'group', group.location);
      expect(counts).toEqual({ nodes: 2, arrows: 3, groups: 2 });
      expect(inspectGraph(deleted).edges.map(({ source, target }) => [source, target])).toEqual([['outside', 'other']]);
      expect(inspectGraph(deleted).nodes.map((node) => node.id)).toEqual(['outside', 'other']);
      expect(inspectGraph(kept).edges).toHaveLength(4);
    });

    it('deletes a nested group and its arrows in an ancestor without deleting the ancestor', () => {
      const dot = 'digraph { subgraph cluster_parent { parent; subgraph cluster_child { child; } parent -> child; parent -> safe; } outside -> child; }';
      const child = inspectGraph(dot).groups.find((group) => group.id === 'cluster_child');
      const { counts, deleted } = planDeletion(dot, 'group', child.location);
      expect(counts).toEqual({ nodes: 1, arrows: 2, groups: 1 });
      expect(inspectGraph(deleted).groups.map((group) => group.id)).toEqual(['cluster_parent']);
      expect(inspectGraph(deleted).edges.map(({ source, target }) => [source, target])).toEqual([['parent', 'safe']]);
      expect(inspectGraph(deleted).nodes.map((node) => node.id).sort()).toEqual(['outside', 'parent', 'safe']);
    });

    it('removes complex external arrows referencing nested nodes and group IDs', () => {
      const dot = 'digraph { subgraph cluster_a { subgraph cluster_b { inner; } } outside; outside -> inner:p; outside -> {inner other}; cluster_b -> outside; outside -> cluster_a; inner -> other -> outside; outside -> safe; }';
      const group = inspectGraph(dot).groups[0];
      const { counts, deleted } = planDeletion(dot, 'group', group.location);
      expect(counts).toEqual({ nodes: 3, arrows: 5, groups: 2 });
      expect(inspectGraph(deleted).edges.map(({ source, target }) => [source, target])).toEqual([['outside', 'safe']]);
      expect(inspectGraph(deleted).nodes.map((node) => node.id)).toEqual(['outside', 'other', 'safe']);
      expect(deleted).toContain('"other";');
    });

    it('preserves declarations outside the group even when they share an inside node ID', () => {
      const dot = 'digraph { shared [label=outside]; subgraph cluster_a { shared [label=inside]; child; } shared -> neighbor; neighbor -> child; neighbor -> safe; }';
      const { counts, deleted } = planDeletion(dot, 'group', inspectGraph(dot).groups[0].location);
      expect(counts).toEqual({ nodes: 1, arrows: 2, groups: 1 });
      expect(deleted).toContain('shared [label=outside];');
      expect(inspectGraph(deleted).nodes.map((node) => node.id)).toEqual(['shared', 'neighbor', 'safe']);
      expect(inspectGraph(deleted).edges.map(({ source, target }) => [source, target])).toEqual([['neighbor', 'safe']]);
    });

    it('materializes outside implicit endpoints orphaned by removed connecting arrows', () => {
      const dot = 'digraph { subgraph cluster_a { inner; } outer -> inner; inner -> another; }';
      const { counts, deleted } = planDeletion(dot, 'group', inspectGraph(dot).groups[0].location);
      expect(counts).toEqual({ nodes: 1, arrows: 2, groups: 1 });
      expect(inspectGraph(deleted).nodes.map((node) => node.id)).toEqual(['outer', 'another']);
      expect(deleted).toContain('"outer";');
      expect(deleted).toContain('"another";');
    });

    it('keeps an orphaned outside implicit endpoint in its original parent group', () => {
      const dot = 'digraph { subgraph cluster_parent { subgraph cluster_child { inner; } outer -> inner; } }';
      const child = inspectGraph(dot).groups[1];
      const { deleted } = planDeletion(dot, 'group', child.location);
      expect(inspectGraph(deleted).nodes).toEqual([
        expect.objectContaining({ id: 'outer', parentId: 'cluster_parent' }),
      ]);
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

  it('reports the containing cluster of nested and implicit elements', () => {
    const graph = inspectGraph('digraph { subgraph cluster_a { subgraph wrapper { a; a -> b; subgraph cluster_b { c; } } } }');
    expect(graph.nodes.find((node) => node.id === 'a').parentId).toBe('cluster_a');
    expect(graph.nodes.find((node) => node.id === 'b').parentId).toBe('cluster_a');
    expect(graph.edges[0].parentId).toBe('cluster_a');
    expect(graph.groups.find((group) => group.id === 'cluster_b').parentId).toBe('cluster_a');
  });

  it('moves a node between clusters and to the root, retaining attributes and other source', () => {
    const dot = 'digraph {\n  subgraph cluster_a { a [custom=keep, label=old]; }\n  // untouched\n  subgraph cluster_b { b; }\n  a -> b;\n}';
    const node = inspectGraph(dot).nodes.find((entry) => entry.id === 'a');
    const moved = updateElement(dot, 'node', node.location, { label: 'New', parentId: 'cluster_b' });
    expect(inspectGraph(moved).nodes.find((entry) => entry.id === 'a').parentId).toBe('cluster_b');
    expect(moved).toContain('a [custom=keep, label="New"]');
    expect(moved).toContain('// untouched');
    expect(moved).toContain('a -> b;');
    const toRoot = updateElement(moved, 'node', inspectGraph(moved).nodes.find((entry) => entry.id === 'a').location, { parentId: '' });
    expect(inspectGraph(toRoot).nodes.find((entry) => entry.id === 'a').parentId).toBeUndefined();
  });

  it('moves arrows and nested groups without losing their contents', () => {
    const dot = 'digraph { subgraph cluster_a { subgraph cluster_child { c; } a -> b [weight=2]; } subgraph cluster_b {} }';
    const arrow = inspectGraph(dot).edges[0];
    const movedArrow = updateElement(dot, 'edge', arrow.location, { parentId: 'cluster_b', label: 'Link' });
    expect(inspectGraph(movedArrow).edges[0].parentId).toBe('cluster_b');
    expect(movedArrow).toContain('weight=2');
    const child = inspectGraph(movedArrow).groups.find((entry) => entry.id === 'cluster_child');
    const intoB = updateElement(movedArrow, 'group', child.location, { parentId: 'cluster_b' });
    expect(inspectGraph(intoB).groups.find((entry) => entry.id === 'cluster_child').parentId).toBe('cluster_b');
    const movedGroup = updateElement(intoB, 'group', inspectGraph(intoB).groups.find((entry) => entry.id === 'cluster_child').location, { parentId: '' });
    expect(inspectGraph(movedGroup).groups.find((entry) => entry.id === 'cluster_child').parentId).toBeUndefined();
    expect(inspectGraph(movedGroup).nodes.find((entry) => entry.id === 'c').parentId).toBe('cluster_child');
  });

  it('keeps unchanged parents in place and rejects invalid destinations or group cycles', () => {
    const dot = 'digraph { subgraph cluster_a { subgraph cluster_child { a; } } subgraph cluster_b {} }';
    const group = inspectGraph(dot).groups.find((entry) => entry.id === 'cluster_a');
    expect(updateElement(dot, 'group', group.location, { parentId: '' })).toBe(dot);
    expect(() => updateElement(dot, 'group', group.location, { parentId: 'cluster_child' })).toThrow(/descendant/);
    expect(() => updateElement(dot, 'group', group.location, { parentId: 'cluster_a' })).toThrow(/itself/);
    const node = inspectGraph(dot).nodes[0];
    expect(updateElement(dot, 'node', node.location, { parentId: 'cluster_child' })).toBe(dot);
    expect(() => updateElement(dot, 'node', node.location, { parentId: 'missing' })).toThrow(/missing or ambiguous/);
    const duplicates = 'digraph { a; subgraph cluster_x {} subgraph cluster_x {} }';
    expect(() => updateElement(duplicates, 'node', inspectGraph(duplicates).nodes[0].location, { parentId: 'cluster_x' })).toThrow(/ambiguous/);
  });

  it('materializes implicit nodes in a chosen cluster or the root', () => {
    const dot = 'digraph { subgraph cluster_a { a -> b; } subgraph cluster_b {} }';
    const implicit = inspectGraph(dot).nodes.find((entry) => entry.id === 'a');
    expect(inspectGraph(updateElement(dot, 'node', implicit.location, { parentId: 'cluster_b' })).nodes.find((entry) => entry.id === 'a').parentId).toBe('cluster_b');
    expect(inspectGraph(updateElement(dot, 'node', implicit.location, { parentId: '' })).nodes.find((entry) => entry.id === 'a').parentId).toBeUndefined();
  });

  it('keeps an implicit node in its selected cluster when names are duplicated', () => {
    const dot = 'digraph { subgraph cluster_x { a -> b; } subgraph cluster_x { c; } }';
    const implicit = inspectGraph(dot).nodes.find((entry) => entry.id === 'a');
    const updated = updateElement(dot, 'node', implicit.location, { label: 'A', parentId: 'cluster_x' });
    expect(updated.indexOf('"a" [label="A"]')).toBeLessThan(updated.indexOf('subgraph cluster_x { c; }'));
    expect(inspectGraph(updated).nodes.find((entry) => entry.id === 'a').parentId).toBe('cluster_x');
  });

  it('moves nodes out of ordinary subgraphs when the parent ID is empty', () => {
    const dot = 'digraph { subgraph wrapper { a; b -> c; } }';
    const node = inspectGraph(dot).nodes.find((entry) => entry.id === 'a');
    const moved = updateElement(dot, 'node', node.location, { parentId: '' });
    expect(moved.indexOf('a;')).toBeGreaterThan(moved.indexOf('subgraph wrapper'));
    expect(moved.indexOf('a;')).toBeGreaterThan(moved.indexOf('}'));
    const implicit = inspectGraph(dot).nodes.find((entry) => entry.id === 'b');
    const materialized = updateElement(dot, 'node', implicit.location, { parentId: '' });
    expect(materialized.indexOf('"b";')).toBeGreaterThan(materialized.indexOf('}'));
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
