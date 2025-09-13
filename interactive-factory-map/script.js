document.addEventListener('DOMContentLoaded', () => {
    const imageUrl = 'factory-map.png';

    // Create an image to detect natural size automatically
    const img = new Image();
    img.src = imageUrl;
    img.addEventListener('load', () => {
        const mapWidth = img.naturalWidth;
        const mapHeight = img.naturalHeight;

        const map = L.map('map', {
            crs: L.CRS.Simple,
            minZoom: -4,
            maxZoom: 4,
            zoomSnap: 0.25,
            attributionControl: false
        });

        const bounds = [[0, 0], [mapHeight, mapWidth]];
        L.imageOverlay(imageUrl, bounds).addTo(map);
        map.fitBounds(bounds);

        const searchInput = document.getElementById('searchInput');
        const searchResults = document.getElementById('searchResults');

        let nodeMarkers = [];
        fetch('nodes.json')
            .then(r => r.json())
            .then(nodes => {
                nodes.forEach(node => {
                    const marker = L.circleMarker([node.y, node.x], {
                        radius: 6,
                        color: '#ff4500',
                        weight: 1.5,
                        fillColor: '#ff7b54',
                        fillOpacity: 0.9
                    }).addTo(map);
                    marker.bindPopup(`<b>${node.name || node.id}</b>`);
                    nodeMarkers.push({ node, marker });
                });

                // Simple search UI
                searchInput.addEventListener('input', () => {
                    const term = searchInput.value.trim().toLowerCase();
                    searchResults.innerHTML = '';
                    if (!term) return;
                    const matches = nodeMarkers.filter(({ node }) =>
                        (node.name || node.id || '').toLowerCase().includes(term)
                    ).slice(0, 50);

                    matches.forEach(({ node, marker }, idx) => {
                        const li = document.createElement('li');
                        li.textContent = node.name || node.id;
                        if (idx === 0) li.classList.add('active');
                        li.addEventListener('click', () => focusNode(node, marker));
                        searchResults.appendChild(li);
                    });
                });

                // Keyboard navigation
                searchInput.addEventListener('keydown', (e) => {
                    const items = Array.from(searchResults.querySelectorAll('li'));
                    if (!items.length) return;
                    const currentIdx = items.findIndex(li => li.classList.contains('active'));
                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        const next = items[Math.min(items.length - 1, currentIdx + 1)];
                        items.forEach(li => li.classList.remove('active'));
                        next.classList.add('active');
                        next.scrollIntoView({ block: 'nearest' });
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        const prev = items[Math.max(0, currentIdx - 1)];
                        items.forEach(li => li.classList.remove('active'));
                        prev.classList.add('active');
                        prev.scrollIntoView({ block: 'nearest' });
                    } else if (e.key === 'Enter') {
                        e.preventDefault();
                        const active = items[Math.max(0, currentIdx)];
                        if (active) active.click();
                    }
                });

                function focusNode(node, marker) {
                    map.setView([node.y, node.x], 0, { animate: true });
                    marker.openPopup();
                    searchInput.value = '';
                    searchResults.innerHTML = '';
                }
            })
            .catch(() => {
                const msg = document.createElement('div');
                msg.style.padding = '8px';
                msg.style.color = '#c00';
                msg.textContent = 'Failed to load nodes.json. Ensure this file is present or serve via a local server due to browser CORS.';
                document.getElementById('controls').appendChild(msg);
            });
    });

    img.addEventListener('error', () => {
        const msg = document.createElement('div');
        msg.style.padding = '8px';
        msg.style.color = '#c00';
        msg.textContent = 'Could not load factory-map.png. Place the image in this folder and reload.';
        document.getElementById('controls').appendChild(msg);
    });
});



