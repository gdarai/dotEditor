import { parse } from '@ts-graphviz/ast';

const ATTRIBUTES = {
  node: ['label', 'shape', 'color', 'fillcolor', 'style'],
  group: ['label', 'color', 'fillcolor', 'style', 'bgcolor'],
  edge: ['label', 'color', 'style', 'arrowhead'],
};
const GRAPH_OPTIONS = ['rankdir', 'rank', 'fontname', 'fontcolor'];
const ROOT_OPTIONS = [...GRAPH_OPTIONS, 'splines', 'compound'];

function read(dot) {
  if (typeof dot !== 'string') throw new TypeError('DOT source must be a string');
  try {
    const graph = parse(dot).children.find((child) => child.type === 'Graph');
    if (!graph?.location) throw new Error('No graph with source locations was found');
    return graph;
  } catch (error) {
    throw new Error(`Invalid DOT: ${error.message}`, { cause: error });
  }
}

function text(value, name) {
  if (typeof value !== 'string') throw new TypeError(`${name} must be a string`);
  return value;
}

function identifier(value, name) {
  if (!text(value, name).length) throw new Error(`${name} cannot be empty`);
  return quote(value);
}

function clusterId(value) {
  identifier(value, 'id');
  if (!value.startsWith('cluster_')) {
    throw new Error('Group IDs must start with "cluster_" (for example, "cluster_team")');
  }
  return quote(value);
}

function quote(value) {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n')}"`;
}

function offset(location) {
  if (!location || !Number.isInteger(location.start?.offset) || !Number.isInteger(location.end?.offset)) {
    throw new TypeError('A source location returned by inspectGraph is required');
  }
  return [location.start.offset, location.end.offset];
}

function sameLocation(a, b) {
  const [start, end] = offset(a);
  return b.location?.start.offset === start && b.location?.end.offset === end;
}

function walk(parent, visit, containingGroup = null) {
  for (const child of parent.children) {
    visit(child, parent, containingGroup);
    if (child.type === 'Subgraph') {
      walk(child, visit, child.id?.value.startsWith('cluster_') ? child : containingGroup);
    }
  }
}

function reference(target) {
  return target.type === 'NodeRef' && !target.port && !target.compass;
}

function attributesFor(type, item) {
  const attributes = {};
  const children = type === 'group'
    ? item.children.flatMap((child) => child.type === 'AttributeList' && child.kind === 'Graph'
      ? child.children : child.type === 'Attribute' ? [child] : [])
    : item.children;
  for (const child of children) {
    if (child.type !== 'Attribute') continue;
    const key = child.key.value.toLowerCase();
    if (ATTRIBUTES[type].includes(key)) attributes[key] = child.value.value;
  }
  return attributes;
}

export function inspectGraph(dot) {
  const graph = read(dot);
  const nodes = [];
  const groups = [];
  const edges = [];
  const explicit = new Set();
  const referenced = new Map();
  walk(graph, (item, _parent, containingGroup) => {
    const placement = containingGroup
      ? { parentId: containingGroup.id.value, parentLocation: containingGroup.location }
      : {};
    if (item.type === 'Node') {
      explicit.add(item.id.value);
      nodes.push({ id: item.id.value, location: item.location, attributes: attributesFor('node', item), ...placement });
    } else if (item.type === 'Subgraph' && item.id?.value.startsWith('cluster_')) {
      groups.push({ id: item.id.value, location: item.location, attributes: attributesFor('group', item), ...placement });
    } else if (item.type === 'Edge') {
      const simple = item.targets.length === 2 && item.targets.every(reference);
      edges.push({
        source: item.targets[0].type === 'NodeRef' ? item.targets[0].id.value : '',
        target: item.targets[1].type === 'NodeRef' ? item.targets[1].id.value : '',
        location: item.location,
        attributes: attributesFor('edge', item),
        ...placement,
        ...(!simple && { complex: true }),
      });
      for (const target of item.targets) {
        const refs = target.type === 'NodeRef' ? [target] : target.children;
        for (const ref of refs) {
          if (!referenced.has(ref.id.value)) referenced.set(ref.id.value, { location: ref.location, ...placement });
        }

      }
    }
  });
  for (const [id, reference] of referenced) {
    if (!explicit.has(id)) nodes.push({ id, ...reference, attributes: {}, implicit: true });
  }
  return { directed: graph.directed, nodes, groups, edges };
}

function optionContainer(graph, groupLocation) {
  if (groupLocation == null) return graph;
  const groups = [];
  walk(graph, (item) => {
    if (item.type === 'Subgraph' && item.id?.value.startsWith('cluster_') && sameLocation(groupLocation, item)) groups.push(item);
  });
  if (groups.length !== 1) throw new Error('Selected group location was not found or is ambiguous');
  return groups[0];
}

function graphOptionAttributes(container) {
  return container.children.flatMap((child) => child.type === 'AttributeList' && child.kind === 'Graph'
    ? child.children.filter((attr) => attr.type === 'Attribute').map((attr) => ({ attr, list: child }))
    : child.type === 'Attribute' ? [{ attr: child }] : []);
}

export function readGraphOptions(dot, groupLocation = null) {
  const container = optionContainer(read(dot), groupLocation);
  const allowed = groupLocation == null ? ROOT_OPTIONS : GRAPH_OPTIONS;
  const options = {};
  for (const { attr } of graphOptionAttributes(container)) {
    const key = attr.key.value.toLowerCase();
    if (allowed.includes(key)) options[key] = attr.value.value;
  }
  return options;
}

export function updateGraphOptions(dot, groupLocation, data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new TypeError('Graph options must be an object');
  const graph = read(dot);
  const container = optionContainer(graph, groupLocation);
  const allowed = groupLocation == null ? ROOT_OPTIONS : GRAPH_OPTIONS;
  for (const [key, value] of Object.entries(data)) {
    if (!allowed.includes(key)) throw new Error(`Unsupported graph option: ${key}`);
    text(value, key);
  }
  const existing = graphOptionAttributes(container);
  const changes = [];
  const additions = [];
  for (const [key, value] of Object.entries(data)) {
    const matches = existing.filter(({ attr }) => attr.key.value.toLowerCase() === key);
    if (value === '') {
      for (const { attr, list } of matches) {
        let start = attr.location.start.offset;
        if (list && !/[,;]\s*$/.test(dot.slice(start, attr.location.end.offset))) {
          const previous = list.children.filter((child) => child.type === 'Attribute' && child.location.end.offset <= start).at(-1);
          const between = dot.slice(previous?.location.end.offset ?? start, start);
          if (previous && !changes.some((change) => change.end === previous.location.end.offset && change.value === '') &&
              /[,;]$/.test(dot.slice(previous.location.start.offset, previous.location.end.offset)) && /^\s*$/.test(between)) {
            start = previous.location.end.offset - 1;
          } else if (previous && /^\s*[,;]\s*$/.test(between)) start -= between.length;
        }
        changes.push({ start, end: attr.location.end.offset, value: '' });
      }
    } else if (matches.length) {
      const { attr } = matches.at(-1);
      changes.push({ start: attr.value.location.start.offset, end: attr.value.location.end.offset, value: quote(value) });
    } else {
      additions.push(`${key}=${quote(value)}`);
    }
  }
  if (additions.length) {
    const lists = container.children.filter((child) => child.type === 'AttributeList' && child.kind === 'Graph');
    const list = lists.at(-1);
    if (list) {
      const bracket = attributeBracket(dot, list, list.location.start.offset);
      if (!bracket) throw new Error('Cannot locate graph attribute list');
      if (list.children.some((child) => child.type === 'Comment' && child.kind !== 'Block')) {
        throw new Error('Cannot safely append attributes after a line comment');
      }
      const remaining = remainingList(dot, bracket, changes);
      const separator = remaining.trim() && !/[,;]\s*$/.test(remaining) ? ', ' : '';
      changes.push({ start: bracket.close, end: bracket.close, value: `${separator}${additions.join(', ')}` });
    } else {
      const updated = patch(dot, changes);
      let fresh = read(updated);
      if (groupLocation != null) {
        const groups = [];
        walk(fresh, (item) => {
          if (item.type === 'Subgraph' && item.id?.value.startsWith('cluster_') &&
              item.location.start.offset === container.location.start.offset) groups.push(item);
        });
        if (groups.length !== 1) throw new Error('Updated group location was not found or is ambiguous');
        fresh = groups[0];
      }
      return validated(insert(updated, fresh, `graph [${additions.join(', ')}];`));
    }
  }
  return patch(dot, changes);
}

function ensureData(type, data) {
  if (!Object.hasOwn(ATTRIBUTES, type)) throw new Error(`Unsupported element type: ${type}`);
  if (!data || typeof data !== 'object') throw new TypeError('Element data must be an object');
  const allowed = new Set([...ATTRIBUTES[type], ...(type === 'edge' ? ['source', 'target'] : ['id']), 'parentId', 'parentLocation']);
  for (const key of Object.keys(data)) {
    if (!allowed.has(key)) throw new Error(`Unsupported ${type} field: ${key}`);
  }
}

function attrs(type, data) {
  return ATTRIBUTES[type]
    .filter((key) => data[key] != null && data[key] !== '')
    .map((key) => `${key}=${quote(text(data[key], key))}`);
}

function parentFor(graph, data) {
  if (data.parentId === '') return graph;
  if (data.parentLocation != null) {
    const parents = [];
    walk(graph, (item) => {
      if (item.type === 'Subgraph' && sameLocation(data.parentLocation, item)) parents.push(item);
    });
    if (parents.length !== 1) throw new Error('Parent group location is missing or ambiguous');
    return parents[0];
  }
  if (data.parentId != null) {
    text(data.parentId, 'parentId');
    const parents = [];
    walk(graph, (item) => {
      if (item.type === 'Subgraph' && item.id?.value === data.parentId) parents.push(item);
    });
    if (parents.length !== 1) throw new Error('Parent group ID is missing or ambiguous; use parentLocation');
    return parents[0];
  }
  return graph;
}

function insert(dot, parent, statement) {
  const close = parent.location.end.offset - 1;
  if (dot[close] !== '}') throw new Error('Cannot locate graph closing brace');
  const eol = dot.includes('\r\n') ? '\r\n' : '\n';
  const lineStart = dot.lastIndexOf('\n', close - 1) + 1;
  const before = dot.slice(lineStart, close);
  const atLineStart = lineStart > 0 && /^[ \t]*$/.test(before);
  const parentIndent = atLineStart ? before : '';
  const childIndent = `${parentIndent}  `;
  const at = atLineStart ? lineStart : close;
  const leading = atLineStart || dot.slice(0, at).endsWith('\n') ? '' : eol;
  const addition = `${leading}${childIndent}${statement}${eol}`;
  return dot.slice(0, at) + addition + dot.slice(at);
}

function validated(dot) {
  read(dot);
  return dot;
}

export function createElement(dot, type, data) {
  ensureData(type, data);
  const graph = read(dot);
  const parent = parentFor(graph, data);
  const properties = attrs(type, data);
  let statement;
  if (type === 'edge') {
    statement = `${identifier(data.source, 'source')} ${graph.directed ? '->' : '--'} ${identifier(data.target, 'target')}`;
  } else if (type === 'group') {
    statement = `subgraph ${clusterId(data.id)} {${properties.length ? ` graph [${properties.join(', ')}];` : ''} }`;
  } else {
    statement = identifier(data.id, 'id');
  }
  if (properties.length && type !== 'group') statement += ` [${properties.join(', ')}]`;
  return validated(insert(dot, parent, type === 'group' ? statement : `${statement};`));
}

function patch(dot, changes) {
  let result = dot;
  for (const { start, end, value } of changes.sort((a, b) => b.start - a.start)) {
    if (start < 0 || end < start || end > dot.length) throw new Error('Invalid AST source range');
    result = result.slice(0, start) + value + result.slice(end);
  }
  return validated(result);
}

// Find the attribute bracket outside quoted strings and comments, using the AST
// statement/identifier ranges as bounds rather than searching the whole document.
function attributeBracket(dot, statement, after) {
  const end = statement.location.end.offset;
  let open = -1;
  let state = 'normal';
  for (let i = after; i < end; i++) {
    const ch = dot[i];
    const next = dot[i + 1];
    if (state === 'line') {
      if (ch === '\n') state = 'normal';
    } else if (state === 'block') {
      if (ch === '*' && next === '/') { state = 'normal'; i++; }
    } else if (state === 'quote') {
      if (ch === '\\') i++;
      else if (ch === '"') state = 'normal';
    } else if (state === 'html') {
      if (ch === '>') state = 'normal';
    } else if (ch === '"') state = 'quote';
    else if (ch === '<') state = 'html';
    else if (ch === '/' && next === '/') { state = 'line'; i++; }
    else if (ch === '/' && next === '*') { state = 'block'; i++; }
    else if (ch === '#') state = 'line';
    else if (ch === '[') open = i;
    else if (ch === ']' && open >= 0) return { open, close: i };
  }
  return null;
}

function remainingList(dot, bracket, changes) {
  let remaining = dot.slice(bracket.open + 1, bracket.close);
  for (const change of changes.filter((change) => change.value === '' && change.start >= bracket.open && change.end <= bracket.close).sort((a, b) => b.start - a.start)) {
    remaining = remaining.slice(0, change.start - bracket.open - 1) + remaining.slice(change.end - bracket.open - 1);
  }
  return remaining;
}

function attributeChanges(dot, type, item, data, after) {
  const changes = [];
  const existing = item.children.filter((child) => child.type === 'Attribute');
  const bracket = attributeBracket(dot, item, after);
  const additions = [];
  for (const key of ATTRIBUTES[type]) {
    if (!Object.hasOwn(data, key) || data[key] == null) continue;
    const value = text(data[key], key);
    const matches = existing.filter((attr) => attr.key.value.toLowerCase() === key);
    if (value === '') {
      for (const attr of matches) {
        let start = attr.location.start.offset;
        const end = attr.location.end.offset;
        if (!/[,;]\s*$/.test(dot.slice(start, end))) {
          const between = dot.slice(existing.filter((other) => other !== attr && other.location.end.offset <= start).at(-1)?.location.end.offset ?? bracket?.open + 1 ?? start, start);
          if (/^\s*[,;]\s*$/.test(between)) start -= between.length;
        }
        changes.push({ start, end, value: '' });
      }
    } else if (matches.length) {
      const attr = matches.at(-1);
      changes.push({ start: attr.value.location.start.offset, end: attr.value.location.end.offset, value: quote(value) });
    } else {
      additions.push(`${key}=${quote(value)}`);
    }
  }
  if (additions.length) {
    if (!bracket) {
      changes.push({ start: after, end: after, value: ` [${additions.join(', ')}]` });
    } else {
      if (item.children.some((child) => child.type === 'Comment' && child.kind !== 'Block')) {
        throw new Error('Cannot safely append attributes after a line comment');
      }
      const remaining = remainingList(dot, bracket, changes);
      const separator = remaining.trim() && !/[,;]\s*$/.test(remaining) ? ', ' : '';
      changes.push({ start: bracket.close, end: bracket.close, value: `${separator}${additions.join(', ')}` });
    }
  }
  return changes;
}

export function updateElement(dot, type, location, data) {
  ensureData(type, data);
  const graph = read(dot);
  if (data.parentLocation != null) throw new Error('Use a parent group ID when moving an existing element');
  const candidates = [];
  let actualParent;
  walk(graph, (item, parent) => {
    if (item.type === { group: 'Subgraph', node: 'Node', edge: 'Edge' }[type] && sameLocation(location, item)) {
      candidates.push(item);
      actualParent = parent;
    }
  });
  if (candidates.length !== 1 && type === 'node') {
    const implicit = inspectGraph(dot).nodes.find((node) => node.implicit && sameLocation(location, node));
    if (implicit) {
      if (data.id != null && data.id !== implicit.id) throw new Error('Cannot rename an implicit node; create an explicit node first');
      let containingGroup;
      walk(graph, (item, parent) => {
        if (item.type !== 'Edge') return;
        for (const target of item.targets) {
          const refs = target.type === 'NodeRef' ? [target] : target.children;
          if (refs.some((ref) => sameLocation(location, ref)) && parent.type === 'Subgraph') {
            containingGroup = parent;
          }
        }
      });
      const { parentId, ...nodeData } = data;
      return createElement(dot, 'node', {
        ...nodeData,
        id: implicit.id,
        ...(parentId != null && (parentId !== implicit.parentId || (parentId === '' && containingGroup))
          ? { parentId }
          : containingGroup ? { parentLocation: containingGroup.location } : {}),
      });
    }
  }
  if (candidates.length !== 1) throw new Error(`${type} location was not found or is ambiguous`);
  const item = candidates[0];
  const currentParent = inspectGraph(dot)[`${type}s`]?.find((entry) => sameLocation(location, entry))?.parentId ?? '';
  const moving = data.parentId != null &&
    (data.parentId !== currentParent || (data.parentId === '' && actualParent.type !== 'Graph'));
  if (moving) {
    const destination = parentFor(graph, data);
    if (type === 'group' && destination !== graph &&
        destination.location.start.offset >= item.location.start.offset &&
        destination.location.end.offset <= item.location.end.offset) {
      throw new Error('A group cannot be moved into itself or a descendant');
    }
  }
  const changes = [];
  let after;
  if (type === 'edge') {
    if (item.targets.length !== 2 || !item.targets.every(reference)) {
      throw new Error('Editing chained, grouped, or port edges is unsupported; edit DOT source directly');
    }
    const [source, target] = item.targets;
    if (data.source != null) changes.push({ start: source.id.location.start.offset, end: source.id.location.end.offset, value: identifier(data.source, 'source') });
    if (data.target != null) changes.push({ start: target.id.location.start.offset, end: target.id.location.end.offset, value: identifier(data.target, 'target') });
    after = target.location.end.offset;
  } else {
    if (type === 'group' && !item.id) throw new Error('Cannot rename an anonymous group');
    if (data.id != null) changes.push({ start: item.id.location.start.offset, end: item.id.location.end.offset, value: type === 'group' ? clusterId(data.id) : identifier(data.id, 'id') });
    after = item.id.location.end.offset;
  }
  if (type === 'group') {
    const graphLists = item.children.filter((child) => child.type === 'AttributeList' && child.kind === 'Graph');
    const attributes = item.children.flatMap((child) => child.type === 'AttributeList' && child.kind === 'Graph'
      ? child.children.filter((attr) => attr.type === 'Attribute')
      : child.type === 'Attribute' ? [child] : []).filter((attr) => ATTRIBUTES.group.includes(attr.key.value.toLowerCase()));
    for (const attr of attributes) {
      const key = attr.key.value.toLowerCase();
      if (!Object.hasOwn(data, key) || data[key] == null) continue;
      const value = text(data[key], key);
      if (value && attributes.findLast((candidate) => candidate.key.value.toLowerCase() === key) !== attr) continue;
      changes.push(value ? { start: attr.value.location.start.offset, end: attr.value.location.end.offset, value: quote(value) }
        : { start: attr.location.start.offset, end: attr.location.end.offset, value: '' });
    }
    const existing = new Set(attributes.map((attr) => attr.key.value.toLowerCase()));
    const missing = Object.fromEntries(ATTRIBUTES.group.filter((key) => data[key] != null && data[key] !== '' && !existing.has(key)).map((key) => [key, data[key]]));
    const added = attrs('group', missing);
    if (added.length) {
      if (graphLists.length) {
        const list = graphLists[0];
        const bracket = attributeBracket(dot, list, list.location.start.offset);
        if (!bracket) throw new Error('Cannot locate group attribute list');
        if (list.children.some((child) => child.type === 'Comment' && child.kind !== 'Block')) {
          throw new Error('Cannot safely append attributes after a line comment');
        }
        const remaining = remainingList(dot, bracket, changes);
        const separator = remaining.trim() && !/[,;]\s*$/.test(remaining) ? ', ' : '';
        changes.push({ start: bracket.close, end: bracket.close, value: `${separator}${added.join(', ')}` });
      } else {
        const brace = dot.indexOf('{', after);
        if (brace < 0 || brace >= item.location.end.offset) throw new Error('Cannot locate group body');
        changes.push({ start: brace + 1, end: brace + 1, value: ` graph [${added.join(', ')}];` });
      }
    }
  } else {
    changes.push(...attributeChanges(dot, type, item, data, after));
  }
  const updated = patch(dot, changes);
  if (!moving) return updated;
  let edited;
  walk(read(updated), (candidate) => {
    if (candidate.type === item.type && candidate.location.start.offset === item.location.start.offset) edited = candidate;
  });
  if (!edited) throw new Error('Updated element location was not found');
  const [start, end] = offset(edited.location);
  const statement = updated.slice(start, end);
  const without = validated(updated.slice(0, start) + updated.slice(end));
  return validated(insert(without, parentFor(read(without), data), statement));
}

export function rearrangeGroup(dot, groupLocation, changes) {
  const graph = read(dot);
  const inspected = inspectGraph(dot);
  const ids = inspected.groups.map((group) => group.id);
  if (new Set(ids).size !== ids.length) throw new Error('Group IDs must be unique to rearrange a group');
  const selected = inspected.groups.find((group) => sameLocation(groupLocation, group));
  if (!selected) throw new Error('Selected group location was not found');
  if (!Array.isArray(changes)) throw new TypeError('Changes must be an array');

  const entries = new Map();
  for (const [type, items] of [['node', inspected.nodes], ['edge', inspected.edges], ['group', inspected.groups]]) {
    for (const item of items) entries.set(`${type}:${item.location.start.offset}`, item);
  }
  const selectedKey = `group:${selected.location.start.offset}`;
  const ancestors = new Set([selectedKey]);
  let parent = selected;
  while (parent.parentLocation) {
    parent = inspected.groups.find((group) => sameLocation(parent.parentLocation, group));
    if (!parent) throw new Error('Selected group ancestry could not be resolved');
    ancestors.add(`group:${parent.location.start.offset}`);
  }

  const moves = new Map();
  const implicit = [];
  for (const change of changes) {
    if (!['node', 'edge', 'group'].includes(change?.type) || typeof change.inGroup !== 'boolean') {
      throw new TypeError('A change needs a type, location and inGroup boolean');
    }
    const key = `${change.type}:${change.location?.start?.offset}`;
    const item = entries.get(key);
    if (!item || !sameLocation(change.location, item)) throw new Error('Changed element location was not found');
    if (moves.has(key)) throw new Error('Duplicate change for an element');
    if (change.type === 'group' && ancestors.has(key)) throw new Error('Cannot rearrange the selected group or its ancestors');
    const currentlyInGroup = item.parentLocation != null && sameLocation(selected.location, { location: item.parentLocation });
    if (change.inGroup === currentlyInGroup) continue;
    if (item.implicit) implicit.push({ id: item.id, inGroup: change.inGroup });
    else moves.set(key, change.inGroup);
  }
  if (!moves.size && !implicit.length) return dot;

  const movedToGroup = [];
  const movedToRoot = [];
  function collect(container) {
    for (const child of container.children) {
      const type = child.type === 'Subgraph' && child.id?.value.startsWith('cluster_') ? 'group'
        : child.type === 'Node' ? 'node' : child.type === 'Edge' ? 'edge' : null;
      const key = `${type}:${child.location?.start.offset}`;
      if (moves.has(key)) (moves.get(key) ? movedToGroup : movedToRoot).push(child);
      if (child.type === 'Subgraph') collect(child);
    }
  }
  collect(graph);
  if (movedToGroup.length + movedToRoot.length !== moves.size) throw new Error('Changed statements could not be resolved');
  const eol = dot.includes('\r\n') ? '\r\n' : '\n';
  const at = (item) => item.location.start.offset;
  const end = (item) => item.location.end.offset;
  function render(container) {
    let result = '';
    let position = at(container);
    for (const child of container.children) {
      if (!child.location || at(child) < position || end(child) > end(container)) continue;
      result += dot.slice(position, at(child));
      const type = child.type === 'Subgraph' && child.id?.value.startsWith('cluster_') ? 'group'
        : child.type === 'Node' ? 'node' : child.type === 'Edge' ? 'edge' : null;
      if (!moves.has(`${type}:${at(child)}`)) {
        result += child.type === 'Subgraph' ? render(child) : dot.slice(at(child), end(child));
      }
      position = end(child);
    }
    const tail = dot.slice(position, end(container));
    const additions = container.type === 'Graph' ? movedToRoot
      : container.type === 'Subgraph' && at(container) === selected.location.start.offset ? movedToGroup : [];
    if (!additions.length) return result + tail;
    const closing = tail.lastIndexOf('}');
    if (closing < 0) throw new Error('Cannot locate container closing brace');
    return result + tail.slice(0, closing) +
      additions.map((item) => `${eol}${render(item)}`).join('') + eol + tail.slice(closing);
  }
  let updated = validated(dot.slice(0, at(graph)) + render(graph) + dot.slice(end(graph)));
  for (const item of implicit) {
    const parentGraph = read(updated);
    const destination = item.inGroup ? parentFor(parentGraph, { parentId: selected.id }) : parentGraph;
    updated = validated(insert(updated, destination, `${identifier(item.id, 'id')};`));
  }
  return updated;
}

function edgeReferences(item, id) {
  function contains(target) {
    if (target.type === 'NodeRef') return target.id.value === id;
    return target.children?.some(contains) ?? false;
  }
  return item.targets.some(contains);
}

function groupBodyStart(dot, item) {
  let state = 'normal';
  const start = item.id?.location.end.offset ?? item.location.start.offset;
  for (let i = start; i < item.location.end.offset - 1; i++) {
    const ch = dot[i];
    const next = dot[i + 1];
    if (state === 'line') {
      if (ch === '\n') state = 'normal';
    } else if (state === 'block') {
      if (ch === '*' && next === '/') { state = 'normal'; i++; }
    } else if (state === 'quote') {
      if (ch === '\\') i++;
      else if (ch === '"') state = 'normal';
    } else if (ch === '/' && next === '/') { state = 'line'; i++; }
    else if (ch === '/' && next === '*') { state = 'block'; i++; }
    else if (ch === '"') state = 'quote';
    else if (ch === '{') return i + 1;
  }
  throw new Error('Cannot locate group body');
}

function keepEdgeNodes(edge, before, remainingIds) {
  if (!edge.targets.every(reference)) return undefined;
  const ids = [...new Set(edge.targets.map((target) => target.id.value))];
  const missing = ids.filter((id) => before.has(id) && !remainingIds.has(id));
  return missing.length ? missing.map((id) => `${id};`).join(' ') : undefined;
}

function keepGroupChildren(dot, group) {
  const start = groupBodyStart(dot, group);
  const end = group.location.end.offset - 1;
  if (dot[end] !== '}') throw new Error('Cannot locate group closing brace');
  let body = dot.slice(start, end);
  for (const child of [...group.children].reverse()) {
    if (child.type !== 'Attribute' && !(child.type === 'AttributeList' && child.kind === 'Graph')) continue;
    const from = child.location.start.offset - start;
    const to = child.location.end.offset - start;
    body = body.slice(0, from) + body.slice(to);
  }
  return body;
}

export function planDeletion(dot, type, location) {
  if (!['node', 'edge', 'group'].includes(type)) throw new Error(`Unsupported element type: ${type}`);
  const graph = read(dot);
  const candidates = [];
  walk(graph, (item) => {
    if (item.type === { node: 'Node', edge: 'Edge', group: 'Subgraph' }[type] && sameLocation(location, item)) {
      candidates.push(item);
    }
  });
  let nodeId;
  if (type === 'node') {
    const selected = inspectGraph(dot).nodes.filter((node) => sameLocation(location, node));
    if (selected.length !== 1) throw new Error('node location was not found or is ambiguous');
    nodeId = selected[0].id;
  } else if (candidates.length !== 1 || (type === 'group' && !candidates[0].id?.value.startsWith('cluster_'))) {
    throw new Error(`${type} location was not found or is ambiguous`);
  }

  const removed = [];
  if (type === 'node') {
    walk(graph, (item) => {
      if ((item.type === 'Node' && item.id.value === nodeId) ||
          (item.type === 'Edge' && edgeReferences(item, nodeId))) removed.push(item);
    });
  } else if (type === 'group') {
    const group = candidates[0];
    const [start, end] = offset(group.location);
    const inside = (item) => item.location.start.offset >= start && item.location.end.offset <= end;
    const before = inspectGraph(dot);
    const ids = new Set([
      ...before.nodes.filter(inside).map((node) => node.id),
      ...before.groups.filter(inside).map((child) => child.id),
    ]);
    removed.push(group);
    const externalEdges = [];
    walk(graph, (item) => {
      if (item.type === 'Edge' && !inside(item) && [...ids].some((id) => edgeReferences(item, id))) {
        removed.push(item);
        externalEdges.push(item);
      }
    });
    const without = patch(dot, removed.map((item) => ({
      start: item.location.start.offset, end: item.location.end.offset, value: '',
    })));
    const remaining = new Set(inspectGraph(without).nodes.map((node) => node.id));
    const outsideIds = before.nodes.filter((node) => node.implicit && !inside(node) && !ids.has(node.id) && !remaining.has(node.id));
    const missing = outsideIds.filter((node) => externalEdges.some((edge) => edgeReferences(edge, node.id)));
    const replacements = new Map();
    for (const node of missing) {
      const edge = externalEdges.find((item) => edgeReferences(item, node.id));
      replacements.set(edge, `${replacements.get(edge) ?? ''}${identifier(node.id, 'id')}; `);
    }
    const deleted = missing.length ? patch(dot, removed.map((item) => ({
      start: item.location.start.offset, end: item.location.end.offset, value: replacements.get(item) ?? '',
    }))) : without;
    const after = inspectGraph(deleted);
    const afterIds = new Set(after.nodes.map((node) => node.id));
    return {
      counts: {
        nodes: new Set(before.nodes.map((node) => node.id).filter((id) => !afterIds.has(id))).size,
        arrows: before.edges.length - after.edges.length,
        groups: before.groups.length - after.groups.length,
      },
      deleted,
      kept: patch(dot, [{ start, end, value: keepGroupChildren(dot, group) }]),
    };
  } else {
    removed.push(candidates[0]);
  }
  const changes = removed.map((item) => ({
    start: item.location.start.offset, end: item.location.end.offset, value: '',
  }));
  const next = patch(dot, changes);
  const before = inspectGraph(dot);
  const after = inspectGraph(next);
  const remainingIds = new Set(after.nodes.map((node) => node.id));
  const counts = {
    nodes: new Set(before.nodes.map((node) => node.id).filter((id) => !remainingIds.has(id))).size,
    arrows: before.edges.length - after.edges.length,
    groups: before.groups.length - after.groups.length,
  };
  const beforeIds = new Set(before.nodes.map((node) => node.id));
  const keptValue = type === 'group'
    ? keepGroupChildren(dot, candidates[0])
    : type === 'edge' ? keepEdgeNodes(candidates[0], beforeIds, remainingIds) : undefined;
  return {
    counts,
    deleted: next,
    ...(keptValue != null && {
      kept: patch(dot, [{
        start: candidates[0].location.start.offset,
        end: candidates[0].location.end.offset,
        value: keptValue,
      }]),
    }),
  };
}
