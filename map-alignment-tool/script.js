document.addEventListener('DOMContentLoaded', () => {
    // Map dimensions for the latest hantafinal.png
    const mapWidth = 11575;
    const mapHeight = 8185;

    // --- DOM Elements ---
    const fileInput = document.getElementById('jsonFile');
    const outputArea = document.getElementById('output');
    const copyButton = document.getElementById('copyButton');
    const resetButton = document.getElementById('resetButton');
    const flipYCheckbox = document.getElementById('flipYCheckbox');
    const multiSelectButton = document.getElementById('multiSelectButton');
    const clearSelectButton = document.getElementById('clearSelectButton');
    const nudgeStepInput = document.getElementById('nudgeStep');
    const nudgeUpButton = document.getElementById('nudgeUp');
    const nudgeLeftButton = document.getElementById('nudgeLeft');
    const nudgeRightButton = document.getElementById('nudgeRight');
    const nudgeDownButton = document.getElementById('nudgeDown');
    const autoCenterButton = document.getElementById('autoCenterButton');

    const controls = {
        xScale: { slider: document.getElementById('xScale'), num: document.getElementById('xScaleNum') },
        yScale: { slider: document.getElementById('yScale'), num: document.getElementById('yScaleNum') },
        xOffset: { slider: document.getElementById('xOffset'), num: document.getElementById('xOffsetNum') },
        yOffset: { slider: document.getElementById('yOffset'), num: document.getElementById('yOffsetNum') },
    };

    // --- State Variables ---
    let originalNodes = [];
    let transformedNodes = [];
    let nodeMarkers = {};
    let selectedNodeIds = new Set();
    let groupDragStartPositions = null;
    let isMultiSelectMode = false;

    // --- Initialize Leaflet Map ---
    const map = L.map('map', { crs: L.CRS.Simple, minZoom: -5 });
    const bounds = [[0, 0], [mapHeight, mapWidth]];
    L.imageOverlay('factory-map.png', bounds).addTo(map);
    map.fitBounds(bounds);

    // --- Core Functions ---

    /**
     * Reads all control values and redraws nodes based on the originalNodes data.
     */
    function applyTransformations() {
        const xS = parseFloat(controls.xScale.num.value);
        const yS = parseFloat(controls.yScale.num.value);
        const xO = Number(controls.xOffset.num.value);
        const yO = Number(controls.yOffset.num.value);
        const isYFlipped = flipYCheckbox.checked;

        transformedNodes = originalNodes.map(node => {
            const baseY = isYFlipped ? (mapHeight - node.y) : node.y;
            const newX = Math.round((node.x * xS) + xO);
            const newY = Math.round((baseY * yS) + yO);
            
            const marker = nodeMarkers[node.id];
            if (marker) {
                marker.setLatLng([newY, newX]);
            }
            return { ...node, x: newX, y: newY };
        });
        updateJsonOutput();
    }

    function getStepPrecision(stepValue) {
        const stepText = String(stepValue || '1');
        if (stepText.includes('e-')) {
            const exp = stepText.split('e-')[1];
            const p = Number(exp);
            return Number.isFinite(p) ? p : 0;
        }
        const parts = stepText.split('.');
        return parts.length > 1 ? parts[1].length : 0;
    }

    function setControlValue(control, value) {
        const min = Number(control.slider.min);
        const max = Number(control.slider.max);
        const step = Number(control.slider.step || 1);
        const safeValue = Number.isFinite(value) ? value : Number(control.slider.value);

        let clamped = Math.max(min, Math.min(max, safeValue));
        if (Number.isFinite(step) && step > 0) {
            const snapped = min + Math.round((clamped - min) / step) * step;
            clamped = Math.max(min, Math.min(max, snapped));
            const precision = getStepPrecision(step);
            clamped = Number(clamped.toFixed(precision));
        }

        control.slider.value = String(clamped);
        control.num.value = String(clamped);
        return clamped;
    }

    function getNudgeStep() {
        const step = Math.round(Number(nudgeStepInput.value));
        if (!Number.isFinite(step) || step < 1) {
            nudgeStepInput.value = '100';
            return 100;
        }
        return step;
    }

    function nudgeOffsets(deltaX, deltaY) {
        const currentX = Number(controls.xOffset.num.value) || 0;
        const currentY = Number(controls.yOffset.num.value) || 0;
        setControlValue(controls.xOffset, currentX + deltaX);
        setControlValue(controls.yOffset, currentY + deltaY);
        applyTransformations();
    }

    function autoCenterNodes() {
        if (!originalNodes.length) {
            alert('Upload nodes.json first.');
            return;
        }

        const xS = parseFloat(controls.xScale.num.value);
        const yS = parseFloat(controls.yScale.num.value);
        const xO = Number(controls.xOffset.num.value);
        const yO = Number(controls.yOffset.num.value);
        const isYFlipped = flipYCheckbox.checked;

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        originalNodes.forEach((node) => {
            const baseY = isYFlipped ? (mapHeight - node.y) : node.y;
            const newX = (node.x * xS) + xO;
            const newY = (baseY * yS) + yO;
            minX = Math.min(minX, newX);
            maxX = Math.max(maxX, newX);
            minY = Math.min(minY, newY);
            maxY = Math.max(maxY, newY);
        });

        if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
            alert('Unable to center nodes. Check node data.');
            return;
        }

        const nodesCenterX = (minX + maxX) / 2;
        const nodesCenterY = (minY + maxY) / 2;
        const mapCenterX = mapWidth / 2;
        const mapCenterY = mapHeight / 2;

        const deltaX = mapCenterX - nodesCenterX;
        const deltaY = mapCenterY - nodesCenterY;
        nudgeOffsets(deltaX, deltaY);
    }

    /**
     * Clears and recreates all markers on the map from the originalNodes array.
     */
    function renderMarkers() {
        Object.values(nodeMarkers).forEach(marker => marker.remove());
        nodeMarkers = {};
        originalNodes.forEach(createMarker);
        applyTransformations();
    }

    /**
     * Updates the visual style of markers based on the current selection.
     */
    function updateMarkerStyles() {
        Object.keys(nodeMarkers).forEach(id => {
            const marker = nodeMarkers[id];
            if (selectedNodeIds.has(id)) {
                L.DomUtil.addClass(marker._icon, 'marker-selected');
            } else {
                L.DomUtil.removeClass(marker._icon, 'marker-selected');
            }
        });
        clearSelectButton.disabled = selectedNodeIds.size === 0;
    }

    /**
     * Creates a single marker and adds its click and drag event handlers.
     */
    function createMarker(node) {
        const marker = L.marker([node.y, node.x], { draggable: true }).addTo(map);
        marker.bindPopup(`<b>${node.name}</b><br>ID: ${node.id}`);
        nodeMarkers[node.id] = marker;

        marker.on('click', function(e) {
            if (isMultiSelectMode) {
                L.DomEvent.stop(e); // Prevent popup from opening
                if (selectedNodeIds.has(node.id)) {
                    selectedNodeIds.delete(node.id);
                } else {
                    selectedNodeIds.add(node.id);
                }
                updateMarkerStyles();
            }
        });

        marker.on('dragstart', function() {
            if (selectedNodeIds.size > 1 && selectedNodeIds.has(node.id)) {
                groupDragStartPositions = new Map();
                selectedNodeIds.forEach(id => {
                    groupDragStartPositions.set(id, nodeMarkers[id].getLatLng());
                });
            }
        });

        marker.on('drag', function(e) {
            if (groupDragStartPositions) {
                const startPos = groupDragStartPositions.get(node.id);
                const newPos = e.target.getLatLng();
                const delta = { lat: newPos.lat - startPos.lat, lng: newPos.lng - startPos.lng };
                groupDragStartPositions.forEach((originalLatLng, id) => {
                    if (id !== node.id) {
                        nodeMarkers[id].setLatLng({ lat: originalLatLng.lat + delta.lat, lng: originalLatLng.lng + delta.lng }, { dragging: true });
                    }
                });
            }
        });

        marker.on('dragend', function(e) {
            const allControlValues = {
                xS: parseFloat(controls.xScale.num.value),
                yS: parseFloat(controls.yScale.num.value),
                xO: Number(controls.xOffset.num.value),
                yO: Number(controls.yOffset.num.value),
                isYFlipped: flipYCheckbox.checked
            };

            const updateOriginalNode = (id, newLatLng) => {
                const originalNodeToUpdate = originalNodes.find(n => n.id === id);
                if (originalNodeToUpdate) {
                    const originalX = (newLatLng.lng - allControlValues.xO) / allControlValues.xS;
                    const transformedY = (newLatLng.lat - allControlValues.yO) / allControlValues.yS;
                    const originalY = allControlValues.isYFlipped ? (mapHeight - transformedY) : transformedY;
                    originalNodeToUpdate.x = originalX;
                    originalNodeToUpdate.y = originalY;
                }
            };

            if (groupDragStartPositions) {
                const startPos = groupDragStartPositions.get(node.id);
                const finalPos = e.target.getLatLng();
                const delta = { lat: finalPos.lat - startPos.lat, lng: finalPos.lng - startPos.lng };
                selectedNodeIds.forEach(id => {
                    const originalLatLng = groupDragStartPositions.get(id);
                    const newLatLng = { lat: originalLatLng.lat + delta.lat, lng: originalLatLng.lng + delta.lng };
                    nodeMarkers[id].setLatLng(newLatLng);
                    updateOriginalNode(id, newLatLng);
                });
                groupDragStartPositions = null;
            } else {
                updateOriginalNode(node.id, e.target.getLatLng());
            }
            applyTransformations();
        });
    }

    /**
     * Updates the JSON output text area.
     */
    function updateJsonOutput() {
        outputArea.textContent = JSON.stringify(transformedNodes, null, 2);
    }
    
    // --- Event Listeners ---

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                originalNodes = JSON.parse(e.target.result);
                resetButton.click();
                renderMarkers();
            } catch (error) {
                alert('Error parsing JSON file. Please ensure it is valid.');
            }
        };
        reader.readAsText(file);
    });

    multiSelectButton.addEventListener('click', () => {
        isMultiSelectMode = !isMultiSelectMode;
        if (isMultiSelectMode) {
            multiSelectButton.textContent = 'Multi-Select ACTIVE';
            L.DomUtil.addClass(multiSelectButton, 'active');
            map.dragging.disable();
        } else {
            multiSelectButton.textContent = 'Enable Multi-Select';
            L.DomUtil.removeClass(multiSelectButton, 'active');
            map.dragging.enable();
        }
    });

    clearSelectButton.addEventListener('click', () => {
        selectedNodeIds.clear();
        updateMarkerStyles();
    });

    flipYCheckbox.addEventListener('change', applyTransformations);

    for (const key in controls) {
        const { slider, num } = controls[key];
        slider.addEventListener('input', () => { num.value = slider.value; applyTransformations(); });
        num.addEventListener('input', () => {
            const raw = num.value.trim();
            if (raw === '' || raw === '-' || raw === '.' || raw === '-.') return;
            const value = Number(raw);
            if (!Number.isFinite(value)) return;
            setControlValue(controls[key], value);
            applyTransformations();
        });
        num.addEventListener('blur', () => {
            const raw = num.value.trim();
            if (raw === '' || raw === '-' || raw === '.' || raw === '-.') {
                num.value = slider.value;
                return;
            }
            const value = Number(raw);
            if (!Number.isFinite(value)) {
                num.value = slider.value;
                return;
            }
            setControlValue(controls[key], value);
            applyTransformations();
        });
    }

    nudgeUpButton.addEventListener('click', () => nudgeOffsets(0, -getNudgeStep()));
    nudgeDownButton.addEventListener('click', () => nudgeOffsets(0, getNudgeStep()));
    nudgeLeftButton.addEventListener('click', () => nudgeOffsets(-getNudgeStep(), 0));
    nudgeRightButton.addEventListener('click', () => nudgeOffsets(getNudgeStep(), 0));
    autoCenterButton.addEventListener('click', autoCenterNodes);
    
    map.on('click', (event) => {
        if (isMultiSelectMode) return; // Don't add nodes in multi-select mode
        const pos = event.latlng;
        const nodeName = prompt(`Enter name/ID for the new node:`);
        if (!nodeName) return;

        const xS = parseFloat(controls.xScale.num.value);
        const yS = parseFloat(controls.yScale.num.value);
        const xO = Number(controls.xOffset.num.value);
        const yO = Number(controls.yOffset.num.value);
        const isYFlipped = flipYCheckbox.checked;
        
        const originalX = (pos.lng - xO) / xS;
        const transformedY = (pos.lat - yO) / yS;
        const originalY = isYFlipped ? (mapHeight - transformedY) : transformedY;

        const newNode = {
            id: `node_${Date.now()}`,
            name: nodeName,
            x: originalX,
            y: originalY,
            description: ""
        };
        
        originalNodes.push(newNode);
        createMarker(newNode);
        applyTransformations();
    });

    resetButton.addEventListener('click', () => {
        flipYCheckbox.checked = false;
        for (const key in controls) {
            const { slider, num } = controls[key];
            const defaultValue = (key.includes('Scale')) ? 1 : 0;
            slider.value = defaultValue;
            num.value = defaultValue;
        }
        applyTransformations();
    });

    copyButton.addEventListener('click', () => {
        navigator.clipboard.writeText(outputArea.textContent).then(() => {
            copyButton.textContent = 'Copied!';
            setTimeout(() => { copyButton.textContent = 'Copy JSON'; }, 2000);
        }).catch(() => alert('Could not copy text.'));
    });
});