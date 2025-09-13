document.addEventListener('DOMContentLoaded', () => {
    const mapContainer = document.getElementById('map-container');
    const mapImage = document.getElementById('factoryMap');
    const outputArea = document.getElementById('output');
    const copyButton = document.getElementById('copyButton');
    const downloadButton = document.getElementById('downloadButton');
    const undoButton = document.getElementById('undoButton');
    const clearButton = document.getElementById('clearButton');

    let nodesData = [];
    let markerElements = [];
    let stageDiv = null;
    let markersLayer = null;

    // Ensure we know the natural image size before enabling clicks
    function onImageReady() {
        const naturalWidth = mapImage.naturalWidth;
        const naturalHeight = mapImage.naturalHeight;
        if (!naturalWidth || !naturalHeight) return;

        // Build a stage container with fixed pixel size matching the image
        stageDiv = document.createElement('div');
        stageDiv.className = 'stage';
        stageDiv.style.width = naturalWidth + 'px';
        stageDiv.style.height = naturalHeight + 'px';

        // Move image into stage and size it to 1:1
        mapImage.remove();
        mapImage.style.width = '100%';
        mapImage.style.height = '100%';
        mapImage.setAttribute('draggable', 'false');
        stageDiv.appendChild(mapImage);

        // Overlay for markers
        markersLayer = document.createElement('div');
        markersLayer.className = 'markers-layer';
        stageDiv.appendChild(markersLayer);

        mapContainer.appendChild(stageDiv);

        // Click to capture coordinates in natural pixel space
        stageDiv.addEventListener('click', (event) => {
            // Ignore clicks that originated from buttons in the sidebar etc.
            if (event.target !== mapImage && event.target !== stageDiv) return;

            const rect = mapImage.getBoundingClientRect();
            const scaleX = mapImage.naturalWidth / rect.width;
            const scaleY = mapImage.naturalHeight / rect.height;
            const x = Math.round((event.clientX - rect.left) * scaleX);
            const y = Math.round((event.clientY - rect.top) * scaleY);

            const nodeName = prompt(`Enter name/ID for the node at (x: ${x}, y: ${y}):`);
            if (!nodeName) return;

            const newNode = {
                id: `node_${nodesData.length + 1}`,
                name: nodeName,
                x: x,
                y: y,
                description: ''
            };
            nodesData.push(newNode);

            // Place a visual marker
            const marker = document.createElement('div');
            marker.className = 'click-marker';
            // Convert natural coords to stage (1:1)
            marker.style.left = x + 'px';
            marker.style.top = y + 'px';
            marker.title = newNode.name;
            markersLayer.appendChild(marker);
            markerElements.push(marker);

            updateOutput();
        });
    }

    if (mapImage.complete) {
        onImageReady();
    } else {
        mapImage.addEventListener('load', onImageReady);
        mapImage.addEventListener('error', () => {
            alert('Could not load factory-map.png. Place the image in this folder and reload.');
        });
    }

    function updateOutput() {
        outputArea.textContent = JSON.stringify(nodesData, null, 2);
    }

    copyButton.addEventListener('click', () => {
        navigator.clipboard.writeText(outputArea.textContent).then(() => {
            copyButton.textContent = 'Copied!';
            setTimeout(() => { copyButton.textContent = 'Copy JSON'; }, 1500);
        }).catch(() => {
            alert('Could not copy. Please select and copy manually.');
        });
    });

    downloadButton.addEventListener('click', () => {
        const blob = new Blob([outputArea.textContent || '[]'], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'nodes.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    });

    undoButton.addEventListener('click', () => {
        if (nodesData.length === 0) return;
        nodesData.pop();
        const marker = markerElements.pop();
        if (marker) marker.remove();
        updateOutput();
    });

    clearButton.addEventListener('click', () => {
        if (!confirm('Clear all nodes?')) return;
        nodesData = [];
        markerElements.forEach(m => m.remove());
        markerElements = [];
        updateOutput();
    });
});


