#!/usr/bin/env node
/**
 * Validate an extracted Services-platform n8n Phase 1 workflow directory.
 * Usage:
 *   node scripts/validate-n8n-phase1.mjs path/to/workflows
 */
import fs from 'node:fs';
import path from 'node:path';

const workflowDir = path.resolve(process.argv[2] || 'automation/n8n/phase1/workflows');
if (!fs.existsSync(workflowDir) || !fs.statSync(workflowDir).isDirectory()) {
  console.error(`Workflow directory not found: ${workflowDir}`);
  console.error('Extract the Phase 1 ZIP and pass its workflows directory as the argument.');
  process.exit(2);
}

const files = fs.readdirSync(workflowDir).filter((name) => name.toLowerCase().endsWith('.json')).sort();
if (files.length === 0) {
  console.error('No workflow JSON files found.');
  process.exit(2);
}

const errors = [];
const webhookPaths = new Map();
let totalNodes = 0;

for (const file of files) {
  const fullPath = path.join(workflowDir, file);
  let wf;
  try {
    wf = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch (error) {
    errors.push(`${file}: invalid JSON: ${error.message}`);
    continue;
  }

  if (!wf.name || !Array.isArray(wf.nodes) || !wf.connections || typeof wf.connections !== 'object') {
    errors.push(`${file}: missing name, nodes, or connections`);
    continue;
  }

  const names = new Set();
  const ids = new Set();
  for (const node of wf.nodes) {
    if (!node.name || !node.id || !node.type) errors.push(`${file}: node missing name/id/type`);
    if (names.has(node.name)) errors.push(`${file}: duplicate node name ${node.name}`);
    if (ids.has(node.id)) errors.push(`${file}: duplicate node id ${node.id}`);
    names.add(node.name);
    ids.add(node.id);
    totalNodes += 1;

    if (node.type === 'n8n-nodes-base.webhook') {
      const method = String(node.parameters?.httpMethod || 'GET').toUpperCase();
      const route = String(node.parameters?.path || '');
      if (!route) errors.push(`${file}: webhook ${node.name} has no path`);
      const key = `${method} ${route}`;
      if (webhookPaths.has(key)) errors.push(`${file}: duplicate webhook ${key} also in ${webhookPaths.get(key)}`);
      else webhookPaths.set(key, file);
      if (node.parameters?.authentication === 'none') {
        errors.push(`${file}: webhook ${node.name} has no authentication`);
      }
    }
  }

  for (const [source, outputs] of Object.entries(wf.connections)) {
    if (!names.has(source)) errors.push(`${file}: connection source is unknown: ${source}`);
    for (const typeOutputs of Object.values(outputs || {})) {
      for (const group of typeOutputs || []) {
        for (const link of group || []) {
          if (!names.has(link.node)) errors.push(`${file}: connection target is unknown: ${link.node}`);
        }
      }
    }
  }
}

console.log(`Workflows: ${files.length}; Nodes: ${totalNodes}; Authenticated webhook paths: ${webhookPaths.size}`);
if (errors.length) {
  console.error(errors.map((e) => `- ${e}`).join('\n'));
  process.exit(1);
}
console.log('PASS: workflow JSON, node identities, graph links, and webhook uniqueness.');
