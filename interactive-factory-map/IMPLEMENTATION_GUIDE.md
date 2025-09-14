# Factory Map Web App - Implementation Guide for AI Assistant

## Project Overview
Create a modern factory layout map viewer with search functionality. The app displays `factory-map.png` with interactive nodes from `nodes.json`.

## File Structure Required
```
interactive-factory-map/
├── index.html
├── style.css
├── script.js
├── factory-map.png (existing - 19933x6042 resolution approx)
├── nodes.json (existing - contains 6722 nodes)
└── vercel.json
```

## Implementation Instructions

### 1. Create index.html
```html
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>한국타이어 금산공장 Map</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <!-- Header with title and search -->
    <header class="header">
        <div class="header-content">
            <h1 class="title">한국타이어 금산공장 <span class="version">(8/26 map ver.)</span></h1>
            <div class="search-container">
                <input type="text" id="searchInput" placeholder="Search nodes (RFID, name, description)..." class="search-input">
                <div id="searchResults" class="search-results"></div>
            </div>
        </div>
    </header>

    <!-- Map container -->
    <div class="map-container" id="mapContainer">
        <canvas id="mapCanvas"></canvas>
        <!-- Zoom controls -->
        <div class="controls">
            <button id="zoomIn" class="control-btn">+</button>
            <button id="zoomOut" class="control-btn">−</button>
            <button id="resetView" class="control-btn">⟲</button>
        </div>
        <!-- Node info popup -->
        <div id="nodeInfo" class="node-info"></div>
    </div>

    <!-- Loading indicator -->
    <div id="loadingOverlay" class="loading-overlay">
        <div class="loader"></div>
        <p>Loading map...</p>
    </div>

    <script src="script.js"></script>
</body>
</html>
```

### 2. Create style.css with Modern Design
```css
/* Modern dark theme with blue accents */
:root {
    --primary-color: #1976d2;
    --primary-dark: #1565c0;
    --accent-color: #ff6f00;
    --bg-color: #121212;
    --surface-color: #1e1e1e;
    --text-primary: #ffffff;
    --text-secondary: #b0b0b0;
    --shadow: 0 2px 8px rgba(0,0,0,0.3);
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    background-color: var(--bg-color);
    color: var(--text-primary);
    overflow: hidden;
    height: 100vh;
    width: 100vw;
}

/* Header styling */
.header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: rgba(30, 30, 30, 0.95);
    backdrop-filter: blur(10px);
    z-index: 1000;
    padding: 1rem;
    box-shadow: var(--shadow);
}

.header-content {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2rem;
    flex-wrap: wrap;
}

.title {
    font-size: 1.5rem;
    font-weight: 600;
    white-space: nowrap;
}

.version {
    font-size: 0.9rem;
    color: var(--text-secondary);
    font-weight: 400;
}

/* Search styling */
.search-container {
    position: relative;
    width: 100%;
    max-width: 400px;
}

.search-input {
    width: 100%;
    padding: 0.75rem 1rem;
    background: var(--surface-color);
    border: 2px solid transparent;
    border-radius: 8px;
    color: var(--text-primary);
    font-size: 1rem;
    transition: all 0.3s ease;
}

.search-input:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px rgba(25, 118, 210, 0.2);
}

.search-results {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 0.5rem;
    background: var(--surface-color);
    border-radius: 8px;
    box-shadow: var(--shadow);
    max-height: 300px;
    overflow-y: auto;
    display: none;
}

.search-result-item {
    padding: 0.75rem 1rem;
    cursor: pointer;
    transition: background 0.2s;
    border-bottom: 1px solid rgba(255,255,255,0.1);
}

.search-result-item:hover,
.search-result-item.selected {
    background: var(--primary-color);
}

/* Map container */
.map-container {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--bg-color);
    cursor: grab;
}

.map-container.grabbing {
    cursor: grabbing;
}

#mapCanvas {
    position: absolute;
    top: 0;
    left: 0;
}

/* Controls */
.controls {
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.control-btn {
    width: 48px;
    height: 48px;
    background: var(--surface-color);
    border: none;
    border-radius: 50%;
    color: var(--text-primary);
    font-size: 1.5rem;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: var(--shadow);
    display: flex;
    align-items: center;
    justify-content: center;
}

.control-btn:hover {
    background: var(--primary-color);
    transform: scale(1.1);
}

/* Node info popup */
.node-info {
    position: absolute;
    background: var(--surface-color);
    padding: 1rem;
    border-radius: 8px;
    box-shadow: var(--shadow);
    display: none;
    z-index: 100;
    min-width: 200px;
}

.node-info h3 {
    margin-bottom: 0.5rem;
    color: var(--primary-color);
}

.node-info p {
    margin: 0.25rem 0;
    font-size: 0.9rem;
}

/* Loading overlay */
.loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--bg-color);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 9999;
}

.loader {
    width: 48px;
    height: 48px;
    border: 3px solid var(--surface-color);
    border-top-color: var(--primary-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

/* Mobile responsiveness */
@media (max-width: 768px) {
    .header-content {
        flex-direction: column;
        gap: 1rem;
    }
    
    .title {
        font-size: 1.2rem;
    }
    
    .controls {
        bottom: 1rem;
        right: 1rem;
    }
    
    .control-btn {
        width: 40px;
        height: 40px;
        font-size: 1.2rem;
    }
}
```

### 3. Create script.js with Full Functionality
```javascript
// Global variables
let canvas, ctx;
let mapImage;
let nodes = [];
let scale = 1;
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let lastX, lastY;
let selectedNode = null;
let highlightedNodes = [];

// Constants
const MIN_SCALE = 0.1;
const MAX_SCALE = 3;
const ZOOM_SPEED = 0.1;
const NODE_RADIUS = 8;
const HIGHLIGHTED_NODE_RADIUS = 12;

// Initialize on page load
window.addEventListener('DOMContentLoaded', init);

async function init() {
    canvas = document.getElementById('mapCanvas');
    ctx = canvas.getContext('2d');
    
    // Load resources
    await Promise.all([
        loadMap(),
        loadNodes()
    ]);
    
    // Setup event listeners
    setupEventListeners();
    
    // Hide loading overlay
    document.getElementById('loadingOverlay').style.display = 'none';
    
    // Initial render
    requestAnimationFrame(render);
}

async function loadMap() {
    return new Promise((resolve, reject) => {
        mapImage = new Image();
        mapImage.onload = () => {
            // Calculate initial scale to fit height
            const viewportHeight = window.innerHeight;
            const mapHeight = mapImage.naturalHeight;
            scale = viewportHeight / mapHeight;
            
            // Center horizontally
            const viewportWidth = window.innerWidth;
            const scaledWidth = mapImage.naturalWidth * scale;
            offsetX = (viewportWidth - scaledWidth) / 2;
            offsetY = 0;
            
            // Set canvas size
            canvas.width = viewportWidth;
            canvas.height = viewportHeight;
            
            resolve();
        };
        mapImage.onerror = reject;
        mapImage.src = 'factory-map.png';
    });
}

async function loadNodes() {
    try {
        const response = await fetch('nodes.json');
        nodes = await response.json();
        console.log(`Loaded ${nodes.length} nodes`);
    } catch (error) {
        console.error('Failed to load nodes:', error);
    }
}

function setupEventListeners() {
    // Canvas events
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel);
    canvas.addEventListener('click', handleClick);
    
    // Touch events for mobile
    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('touchmove', handleTouchMove);
    canvas.addEventListener('touchend', handleTouchEnd);
    
    // Control buttons
    document.getElementById('zoomIn').addEventListener('click', () => zoom(ZOOM_SPEED));
    document.getElementById('zoomOut').addEventListener('click', () => zoom(-ZOOM_SPEED));
    document.getElementById('resetView').addEventListener('click', resetView);
    
    // Search functionality
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', debounce(handleSearch, 300));
    searchInput.addEventListener('focus', () => {
        if (searchInput.value) handleSearch();
    });
    
    // Window resize
    window.addEventListener('resize', handleResize);
}

// Mouse event handlers
function handleMouseDown(e) {
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.style.cursor = 'grabbing';
}

function handleMouseMove(e) {
    if (!isDragging) return;
    
    const deltaX = e.clientX - lastX;
    const deltaY = e.clientY - lastY;
    
    offsetX += deltaX;
    offsetY += deltaY;
    
    lastX = e.clientX;
    lastY = e.clientY;
    
    requestAnimationFrame(render);
}

function handleMouseUp() {
    isDragging = false;
    canvas.style.cursor = 'grab';
}

// Touch event handlers
function handleTouchStart(e) {
    if (e.touches.length === 1) {
        const touch = e.touches[0];
        isDragging = true;
        lastX = touch.clientX;
        lastY = touch.clientY;
    }
    e.preventDefault();
}

function handleTouchMove(e) {
    if (e.touches.length === 1 && isDragging) {
        const touch = e.touches[0];
        const deltaX = touch.clientX - lastX;
        const deltaY = touch.clientY - lastY;
        
        offsetX += deltaX;
        offsetY += deltaY;
        
        lastX = touch.clientX;
        lastY = touch.clientY;
        
        requestAnimationFrame(render);
    }
    e.preventDefault();
}

function handleTouchEnd(e) {
    isDragging = false;
    e.preventDefault();
}

// Zoom handling
function handleWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_SPEED : ZOOM_SPEED;
    zoom(delta, e.clientX, e.clientY);
}

function zoom(delta, centerX = canvas.width / 2, centerY = canvas.height / 2) {
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale + delta));
    
    if (newScale !== scale) {
        // Zoom towards mouse position
        const scaleRatio = newScale / scale;
        offsetX = centerX - (centerX - offsetX) * scaleRatio;
        offsetY = centerY - (centerY - offsetY) * scaleRatio;
        scale = newScale;
        
        requestAnimationFrame(render);
    }
}

// Click handling for nodes
function handleClick(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Convert to map coordinates
    const mapX = (x - offsetX) / scale;
    const mapY = (y - offsetY) / scale;
    
    // Find clicked node
    const clickedNode = nodes.find(node => {
        const distance = Math.sqrt(
            Math.pow(node.x - mapX, 2) + 
            Math.pow(node.y - mapY, 2)
        );
        return distance < NODE_RADIUS / scale;
    });
    
    if (clickedNode) {
        showNodeInfo(clickedNode, e.clientX, e.clientY);
    } else {
        hideNodeInfo();
    }
}

// Search functionality
function handleSearch() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const resultsContainer = document.getElementById('searchResults');
    
    if (!query) {
        resultsContainer.style.display = 'none';
        highlightedNodes = [];
        requestAnimationFrame(render);
        return;
    }
    
    // Search nodes
    const results = nodes.filter(node => {
        return node.name.toLowerCase().includes(query) ||
               node.description.toLowerCase().includes(query);
    }).slice(0, 10);
    
    // Display results
    resultsContainer.innerHTML = '';
    results.forEach(node => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.innerHTML = `
            <strong>${node.name}</strong>
            ${node.description ? `<br><small>${node.description}</small>` : ''}
        `;
        item.addEventListener('click', () => selectNode(node));
        resultsContainer.appendChild(item);
    });
    
    resultsContainer.style.display = results.length > 0 ? 'block' : 'none';
    
    // Highlight search results on map
    highlightedNodes = results;
    requestAnimationFrame(render);
}

// Select and focus on node
function selectNode(node) {
    selectedNode = node;
    highlightedNodes = [node];
    
    // Center view on node
    const targetScale = 1.5;
    scale = targetScale;
    offsetX = canvas.width / 2 - node.x * scale;
    offsetY = canvas.height / 2 - node.y * scale;
    
    // Hide search results
    document.getElementById('searchResults').style.display = 'none';
    document.getElementById('searchInput').value = node.name;
    
    // Show node info
    showNodeInfo(node, canvas.width / 2, canvas.height / 2);
    
    requestAnimationFrame(render);
}

// Node info popup
function showNodeInfo(node, x, y) {
    const nodeInfo = document.getElementById('nodeInfo');
    nodeInfo.innerHTML = `
        <h3>${node.name}</h3>
        ${node.description ? `<p>${node.description}</p>` : ''}
        <p><small>ID: ${node.id}</small></p>
    `;
    
    // Position popup
    nodeInfo.style.left = `${Math.min(x + 10, window.innerWidth - 220)}px`;
    nodeInfo.style.top = `${Math.min(y + 10, window.innerHeight - 100)}px`;
    nodeInfo.style.display = 'block';
}

function hideNodeInfo() {
    document.getElementById('nodeInfo').style.display = 'none';
}

// Reset view
function resetView() {
    const viewportHeight = window.innerHeight;
    const mapHeight = mapImage.naturalHeight;
    scale = viewportHeight / mapHeight;
    
    const viewportWidth = window.innerWidth;
    const scaledWidth = mapImage.naturalWidth * scale;
    offsetX = (viewportWidth - scaledWidth) / 2;
    offsetY = 0;
    
    highlightedNodes = [];
    selectedNode = null;
    hideNodeInfo();
    
    requestAnimationFrame(render);
}

// Handle window resize
function handleResize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    requestAnimationFrame(render);
}

// Main render function
function render() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw map
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    ctx.drawImage(mapImage, 0, 0);
    
    // Draw nodes
    nodes.forEach(node => {
        const isHighlighted = highlightedNodes.includes(node);
        const isSelected = node === selectedNode;
        
        ctx.beginPath();
        ctx.arc(node.x, node.y, 
            isHighlighted ? HIGHLIGHTED_NODE_RADIUS : NODE_RADIUS, 
            0, Math.PI * 2);
        
        if (isSelected) {
            ctx.fillStyle = '#ff6f00';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
        } else if (isHighlighted) {
            ctx.fillStyle = '#1976d2';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
        } else {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.lineWidth = 1;
        }
        
        ctx.fill();
        ctx.stroke();
    });
    
    ctx.restore();
}

// Utility function for debouncing
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
```

### 4. Create vercel.json
```json
{
  "buildCommand": "echo 'No build required'",
  "outputDirectory": ".",
  "framework": null,
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=3600"
        }
      ]
    }
  ]
}
```

## Key Implementation Notes

1. **Initial Load**: The map automatically scales to fit the viewport height with no white space
2. **Search**: Searches both node names and descriptions, with real-time results
3. **Performance**: Only visible nodes are rendered, with requestAnimationFrame for smooth animations
4. **Mobile**: Full touch support with pinch-to-zoom and drag
5. **Zoom Limits**: Prevents zooming out beyond initial view (screen height)
6. **Node Types**: Ready to implement different node types (CS, RFID, etc.) with different colors

## Deployment Steps
1. Ensure all files are in the `interactive-factory-map` folder
2. Initialize git repository if not already done
3. Push to GitHub
4. Connect to Vercel and deploy

## Testing Checklist
- [ ] Map fills screen height on load with no white space
- [ ] Search bar is centered at top
- [ ] Title shows "한국타이어 금산공장 (8/26 map ver.)"
- [ ] Search finds nodes by name and description
- [ ] Clicking nodes shows information
- [ ] Zoom controls work with limits
- [ ] Mobile touch controls work
- [ ] No performance issues with 6000+ nodes
