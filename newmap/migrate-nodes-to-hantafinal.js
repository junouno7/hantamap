#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const OLD_MAP_WIDTH = 19933;
const OLD_MAP_HEIGHT = 6042;
const NEW_MAP_WIDTH = 11575;
const NEW_MAP_HEIGHT = 8185;

const DEFAULTS = {
    xScale: NEW_MAP_WIDTH / OLD_MAP_WIDTH,
    yScale: NEW_MAP_HEIGHT / OLD_MAP_HEIGHT,
    xOffset: 0,
    yOffset: 0,
    dryRun: false
};

function parseArgs(argv) {
    const parsed = { ...DEFAULTS };

    argv.forEach((arg) => {
        if (!arg.startsWith('--')) return;
        const [rawKey, rawValue] = arg.slice(2).split('=');
        const key = rawKey.trim();
        const value = rawValue === undefined ? 'true' : rawValue.trim();

        if (key === 'dry-run') {
            parsed.dryRun = value !== 'false';
            return;
        }

        if (['xScale', 'yScale', 'xOffset', 'yOffset'].includes(key)) {
            const numeric = Number(value);
            if (!Number.isFinite(numeric)) {
                throw new Error(`Invalid numeric value for --${key}: ${value}`);
            }
            parsed[key] = numeric;
        }
    });

    return parsed;
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
    fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function migrateNodes(nodes, transform) {
    return nodes.map((node) => {
        const x = Number(node.x);
        const y = Number(node.y);

        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return node;
        }

        return {
            ...node,
            x: Math.round((x * transform.xScale) + transform.xOffset),
            y: Math.round((y * transform.yScale) + transform.yOffset)
        };
    });
}

function getBounds(nodes) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    nodes.forEach((node) => {
        if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x);
        maxY = Math.max(maxY, node.y);
    });

    return { minX, minY, maxX, maxY };
}

function main() {
    const repoRoot = path.resolve(__dirname, '..');
    const nodesPath = path.join(repoRoot, 'interactive-factory-map', 'nodes.json');
    const backupPath = path.join(__dirname, 'nodes-backup-19933x6042.json');

    const transform = parseArgs(process.argv.slice(2));
    const currentNodes = readJson(nodesPath);

    if (!Array.isArray(currentNodes)) {
        throw new Error('nodes.json must be an array');
    }

    let sourcePath = backupPath;
    let sourceNodes;

    if (!fs.existsSync(backupPath)) {
        writeJson(backupPath, currentNodes);
        console.log(`Backup created: ${backupPath}`);
        sourceNodes = currentNodes;
        sourcePath = nodesPath;
    } else {
        console.log(`Backup exists, reusing: ${backupPath}`);
        sourceNodes = readJson(backupPath);
    }

    if (!Array.isArray(sourceNodes)) {
        throw new Error('Source nodes must be an array');
    }

    const migrated = migrateNodes(sourceNodes, transform);
    const bounds = getBounds(migrated);

    console.log(`Source nodes: ${sourcePath}`);
    console.log('Transform used:', transform);
    console.log(`Node count: ${migrated.length}`);
    console.log(`Bounds: x=${bounds.minX}..${bounds.maxX}, y=${bounds.minY}..${bounds.maxY}`);
    console.log(`Target map dimensions: ${NEW_MAP_WIDTH}x${NEW_MAP_HEIGHT}`);

    if (transform.dryRun) {
        console.log('Dry run enabled: nodes.json was not modified.');
        return;
    }

    writeJson(nodesPath, migrated);
    console.log(`Updated nodes written to: ${nodesPath}`);
}

main();
