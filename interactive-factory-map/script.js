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
// Search UI state
let currentSearchResults = [];
let selectedResultIndex = -1;
// Track popup follow behavior
let popupNodeRef = null;
let popupOpenScale = null;
let popupOpenOffsetX = null;
let popupOpenOffsetY = null;
// Beacon pulse state
let beaconNodeId = null; // node id that should beacon (from search highlight/selection)
let animationId = null; // For continuous animation

// Animation loop for continuous beacon effects
function startAnimationLoop() {
    if (animationId) return; // Already running
    
    function animate() {
        if (selectedNode || beaconNodeId) {
            render();
            animationId = requestAnimationFrame(animate);
        } else {
            animationId = null; // Stop animation when no beacon needed
        }
    }
    
    animationId = requestAnimationFrame(animate);
}

function stopAnimationLoop() {
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
}
// Click/drag discrimination
let dragStartX = 0;
let dragStartY = 0;
let dragMoved = false;
let suppressNextClick = false;
let isInteractingWithResults = false; // prevents premature blur/hide while interacting with results
let popupPanAccum = 0; // cumulative desktop pan distance while popup is open
let popupVisible = false;

// Cached base-scale map for smooth panning when zoomed out
let baseScaleCanvas = null; // kept for backward compatibility (now covered by mipCanvases)
let mipCanvases = []; // array of { scale: number, canvas: HTMLCanvasElement }

// Touch handling variables
let lastTouchDistance = 0;
let isZooming = false;
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
let touchMoved = false;

// Performance throttling variables
let lastWheelTime = 0;
let renderRequested = false;
// Wheel zoom micro-batching
let wheelAccum = 0;
let wheelRafId = 0;
let lastWheelX = 0;
let lastWheelY = 0;

// Constants
let MIN_SCALE = 0.1; // Will be calculated based on map size
const MAX_SCALE = 3;
const ZOOM_SPEED = 0.045; // 2x faster for better responsiveness
// Make markers ~15% larger (again)
const NODE_RADIUS = 11; // 9.2 * 1.15 ≈ 10.58
const HIGHLIGHTED_NODE_RADIUS = 17; // 13.8 * 1.15 ≈ 15.87

// Initialize on page load
window.addEventListener('DOMContentLoaded', init);

async function init() {
    canvas = document.getElementById('mapCanvas');
    ctx = canvas.getContext('2d');
    
    try {
        // Load resources in parallel
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
        
        console.log('Factory map initialized successfully');
    } catch (error) {
        console.error('Failed to initialize map:', error);
        showError('Failed to load map. Please refresh the page.');
    }
}

async function loadMap() {
    return new Promise((resolve, reject) => {
        mapImage = new Image();
        mapImage.onload = () => {
            console.log(`Map loaded: ${mapImage.naturalWidth}x${mapImage.naturalHeight}`);
            
            // Calculate minimum scale to fit map height exactly to viewport height
            const viewportHeight = window.innerHeight;
            const mapHeight = mapImage.naturalHeight;
            MIN_SCALE = viewportHeight / mapHeight;
            scale = MIN_SCALE;
            
            console.log(`MIN_SCALE set to: ${MIN_SCALE}`);
            
            // Center horizontally at minimum scale
            const viewportWidth = window.innerWidth;
            const scaledWidth = mapImage.naturalWidth * scale;
            offsetX = (viewportWidth - scaledWidth) / 2;
            offsetY = 0;
            
            // Build mipmap-like cached canvases for smooth panning near min zoom
            buildMipCanvases();

            // Set canvas size
            canvas.width = viewportWidth;
            canvas.height = viewportHeight;
            
            resolve();
        };
        mapImage.onerror = (error) => {
            console.error('Failed to load map image:', error);
            reject(new Error('Failed to load map image'));
        };
        mapImage.src = 'factory-map.png';
    });
}

function buildMipCanvases() {
    if (!mapImage) return;
    try {
        mipCanvases = [];
        // Build densely spaced cached levels from MIN_SCALE up to ~1.6x MIN_SCALE
        // Step factor chosen to keep per-level difference small (~7%)
        const maxFactor = 1.6;
        const step = 1.07;
        let s = MIN_SCALE;
        while (s <= MIN_SCALE * maxFactor + 1e-6) {
            const width = Math.max(1, Math.round(mapImage.naturalWidth * s));
            const height = Math.max(1, Math.round(mapImage.naturalHeight * s));
            const off = document.createElement('canvas');
            off.width = width;
            off.height = height;
            const bctx = off.getContext('2d');
            bctx.imageSmoothingEnabled = true;
            bctx.imageSmoothingQuality = 'medium';
            bctx.drawImage(mapImage, 0, 0, width, height);
            mipCanvases.push({ scale: s, canvas: off });
            s *= step;
        }
    } catch (e) {
        console.warn('Failed to build mip canvases', e);
        mipCanvases = [];
    }
}

function pickMipForScale(currentScale) {
    if (!mipCanvases || mipCanvases.length === 0) return null;
    // Use mip if we're within ~60% above MIN_SCALE; otherwise use original image
    const threshold = MIN_SCALE * 1.6;
    if (currentScale > threshold) return null;
    // Prefer the mip that is closest to currentScale but not larger than currentScale by more than 2%
    let candidate = null;
    let bestDiff = Infinity;
    for (const m of mipCanvases) {
        const diff = Math.abs(currentScale - m.scale);
        if (m.scale <= currentScale * 1.02 && diff < bestDiff) {
            candidate = m;
            bestDiff = diff;
        }
    }
    // Fallback: choose the closest overall (might be very slightly larger)
    if (!candidate) {
        for (const m of mipCanvases) {
            const diff = Math.abs(currentScale - m.scale);
            if (diff < bestDiff) {
                candidate = m;
                bestDiff = diff;
            }
        }
    }
    return candidate;
}

async function loadNodes() {
    try {
        const response = await fetch('nodes.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        nodes = await response.json();
        console.log(`Loaded ${nodes.length} nodes`);
        
        // Validate node structure
        if (nodes.length > 0) {
            const sampleNode = nodes[0];
            if (!sampleNode.hasOwnProperty('x') || !sampleNode.hasOwnProperty('y') || !sampleNode.hasOwnProperty('name')) {
                console.warn('Node structure may be invalid');
            }
        }
    } catch (error) {
        console.error('Failed to load nodes:', error);
        throw new Error('Failed to load node data');
    }
}

function setupEventListeners() {
    // Canvas mouse events
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp); // Handle mouse leaving canvas
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('click', handleClick);
    
    // Canvas touch events for mobile
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    
    // Control buttons
    document.getElementById('zoomIn').addEventListener('click', () => zoomByStep(ZOOM_SPEED));
    document.getElementById('zoomOut').addEventListener('click', () => zoomByStep(-ZOOM_SPEED));
    document.getElementById('resetView').addEventListener('click', resetView);
    // Prevent sticky focus/hover on mobile by blurring on release
    [document.getElementById('zoomIn'), document.getElementById('zoomOut'), document.getElementById('resetView')]
        .forEach(btn => {
            if (!btn) return;
            const blur = () => { btn.blur(); btn.classList.remove('pressed'); };
            const press = () => btn.classList.add('pressed');
            btn.addEventListener('pointerdown', press);
            btn.addEventListener('mousedown', press);
            btn.addEventListener('touchstart', press, { passive: true });
            btn.addEventListener('pointerup', blur);
            btn.addEventListener('mouseup', blur);
            btn.addEventListener('touchend', blur);
            btn.addEventListener('pointercancel', blur);
            btn.addEventListener('touchcancel', blur);
        });
    
    // Search functionality
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearch');
    
    searchInput.addEventListener('input', (e) => {
        debounce(handleSearch, 300)();
        // Show/hide clear button based on input content
        toggleClearButton();
    });
    // Ensure clear button also appears on mobile when focusing the input
    searchInput.addEventListener('focus', () => {
        toggleClearButton();
        if (searchInput.value.trim()) handleSearch();
    });
    searchInput.addEventListener('blur', () => {
        // Hide search results after a short delay to allow clicking/long-press select
        setTimeout(() => {
            if (!isInteractingWithResults) {
                document.getElementById('searchResults').style.display = 'none';
            }
        }, 120);
    });
    
    // Clear search button functionality
    clearSearchBtn.addEventListener('click', () => {
        clearSearch();
    });
    // Prevent sticky focus/outline on mobile for clear button
    const blurClear = () => clearSearchBtn.blur();
    clearSearchBtn.addEventListener('pointerup', blurClear);
    clearSearchBtn.addEventListener('touchend', blurClear);
    clearSearchBtn.addEventListener('mouseup', blurClear);
    // Blur search when clicking outside the search container/results
    const blurIfOutside = (e) => {
        const container = document.querySelector('.search-container');
        if (!container) return;
        const insideResults = e.target && (e.target.closest && e.target.closest('#searchResults'));
        if (!container.contains(e.target) && !insideResults) {
            searchInput.blur();
            const resultsContainer = document.getElementById('searchResults');
            if (resultsContainer) resultsContainer.style.display = 'none';
        }
    };
    document.addEventListener('mousedown', blurIfOutside);
    document.addEventListener('touchstart', blurIfOutside, { passive: true });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyDown);
    
    // Window events
    window.addEventListener('resize', handleResize);
    window.addEventListener('beforeunload', () => {
        // Cleanup if needed
    });
    
    // Prevent context menu on canvas
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

// Constrain panning within map boundaries
function constrainPanning() {
    if (!mapImage) return;
    
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scaledWidth = mapImage.naturalWidth * scale;
    const scaledHeight = mapImage.naturalHeight * scale;
    
    // Calculate boundaries
    const minOffsetX = Math.min(0, viewportWidth - scaledWidth);
    const maxOffsetX = Math.max(0, viewportWidth - scaledWidth);
    
    // Allow small amount of panning past top edge, bottom edge stays locked
    const topOverpan = 150; // Allow 150px of overpan past top edge
    let minOffsetY, maxOffsetY;
    if (scale <= MIN_SCALE * 1.01) { // Small tolerance for floating point
        minOffsetY = 0; // Bottom edge locked to screen
        maxOffsetY = topOverpan; // Allow panning past top edge
    } else {
        minOffsetY = Math.min(0, viewportHeight - scaledHeight); // Normal bottom constraint
        maxOffsetY = topOverpan; // Allow panning past top edge
    }
    
    // Apply constraints
    offsetX = Math.max(minOffsetX, Math.min(maxOffsetX, offsetX));
    offsetY = Math.max(minOffsetY, Math.min(maxOffsetY, offsetY));
}

// Mouse event handlers
function handleMouseDown(e) {
    e.preventDefault();
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragMoved = false;
    // Record popup open offsets for pan-distance close, if popup is visible
    const nodeInfo = document.getElementById('nodeInfo');
    if (nodeInfo && nodeInfo.style.display === 'block') {
        popupOpenOffsetX = offsetX;
        popupOpenOffsetY = offsetY;
    } else {
        popupOpenOffsetX = null;
        popupOpenOffsetY = null;
    }
    canvas.style.cursor = 'grabbing';
    document.getElementById('mapContainer').classList.add('grabbing');
}

function handleMouseMove(e) {
    if (!isDragging) return;
    
    const deltaX = e.clientX - lastX;
    const deltaY = e.clientY - lastY;
    
    offsetX += deltaX;
    offsetY += deltaY;
    if (Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY) > 3) {
        dragMoved = true;
    }
    
    // Apply boundary constraints
    constrainPanning();
    
    // Close popup when cumulative pan distance exceeds threshold (desktop)
    if (popupVisible) {
        popupPanAccum += Math.hypot(deltaX, deltaY);
        if (popupPanAccum > 260) {
            const keepSelected = selectedNode;
            hideNodeInfo();
            selectedNode = keepSelected;
            popupPanAccum = 0;
        }
    }
    
    lastX = e.clientX;
    lastY = e.clientY;
    
    throttledRender();
}

function handleMouseUp() {
    isDragging = false;
    canvas.style.cursor = 'grab';
    document.getElementById('mapContainer').classList.remove('grabbing');
    // Suppress the next click if the mouse moved (to avoid deselecting after drag)
    if (dragMoved) {
        suppressNextClick = true;
        setTimeout(() => { suppressNextClick = false; }, 0);
    }
}

// Touch event handlers
function handleTouchStart(e) {
    e.preventDefault();
    
    if (e.touches.length === 1) {
        // Single touch - start dragging
        const touch = e.touches[0];
        isDragging = true;
        isZooming = false;
        lastX = touch.clientX;
        lastY = touch.clientY;
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        touchStartTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        touchMoved = false;
    } else if (e.touches.length === 2) {
        // Two touches - start zooming
        isDragging = false;
        isZooming = true;
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        lastTouchDistance = Math.sqrt(
            Math.pow(touch2.clientX - touch1.clientX, 2) +
            Math.pow(touch2.clientY - touch1.clientY, 2)
        );
    }
}

function handleTouchMove(e) {
    e.preventDefault();
    
    if (e.touches.length === 1 && isDragging && !isZooming) {
        // Single touch drag
        const touch = e.touches[0];
        const deltaX = touch.clientX - lastX;
        const deltaY = touch.clientY - lastY;
        
        // Increase pan sensitivity for mobile (1.3x multiplier)
        const panSensitivity = 1.3;
        offsetX += deltaX * panSensitivity;
        offsetY += deltaY * panSensitivity;
        
        // Apply boundary constraints
        constrainPanning();
        
        lastX = touch.clientX;
        lastY = touch.clientY;
        const moveDist = Math.hypot(touch.clientX - touchStartX, touch.clientY - touchStartY);
        if (moveDist > 8) touchMoved = true;
        
        // Close popup if panned farther than threshold since popup opened (mirror mouse logic)
        if (popupOpenOffsetX != null && popupOpenOffsetY != null) {
            const dx = offsetX - popupOpenOffsetX;
            const dy = offsetY - popupOpenOffsetY;
            const dist = Math.hypot(dx, dy);
            if (dist > 260) {
                const keepSelected = selectedNode;
                hideNodeInfo();
                selectedNode = keepSelected;
                popupOpenOffsetX = null;
                popupOpenOffsetY = null;
            }
        }

        throttledRender();
    } else if (e.touches.length === 2 && isZooming) {
        // Pinch to zoom
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentDistance = Math.sqrt(
            Math.pow(touch2.clientX - touch1.clientX, 2) +
            Math.pow(touch2.clientY - touch1.clientY, 2)
        );
        
        if (lastTouchDistance > 0) {
            const distanceRatio = currentDistance / lastTouchDistance;
            const centerX = (touch1.clientX + touch2.clientX) / 2;
            const centerY = (touch1.clientY + touch2.clientY) / 2;
            
            // Calculate zoom delta with reduced sensitivity for touch
            // Lower pinch sensitivity for better control
            const zoomDelta = (distanceRatio - 1) * 0.33;
            zoom(zoomDelta, centerX, centerY);
        }
        
        lastTouchDistance = currentDistance;
    }
}

function handleTouchEnd(e) {
    e.preventDefault();
    const wasZooming = isZooming;
    
    if (e.touches.length === 0) {
        isDragging = false;
        isZooming = false;
        lastTouchDistance = 0;

        // Detect quick tap (not a drag, not a pinch) and treat like a click
        const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        const duration = now - touchStartTime;
        if (!wasZooming && !touchMoved && duration < 300 && e.changedTouches && e.changedTouches.length) {
            const t = e.changedTouches[0];
            const rect = canvas.getBoundingClientRect();
            const x = t.clientX - rect.left;
            const y = t.clientY - rect.top;
            // Convert to map coordinates
            const mapX = (x - offsetX) / scale;
            const mapY = (y - offsetY) / scale;
            // Find tapped node (same logic as handleClick)
            const clickRadius = Math.max(NODE_RADIUS, 15) / scale;
            const clickedNode = nodes.find(node => {
                const flippedY = mapImage.naturalHeight - node.y;
                const distance = Math.sqrt(
                    Math.pow(node.x - mapX, 2) +
                    Math.pow(flippedY - mapY, 2)
                );
                return distance < clickRadius;
            });
            if (clickedNode) {
                showNodeInfo(clickedNode, t.clientX, t.clientY);
                selectedNode = clickedNode;
                beaconNodeId = null;
                highlightedNodes = [];
                startAnimationLoop();
                throttledRender();
            } else {
                hideNodeInfo();
                selectedNode = null;
                beaconNodeId = null;
                highlightedNodes = [];
                stopAnimationLoop();
                throttledRender();
            }
            // Suppress any synthetic click that may follow
            suppressNextClick = true;
            setTimeout(() => { suppressNextClick = false; }, 0);
        }
    } else if (e.touches.length === 1) {
        // Switch back to dragging mode
        isDragging = true;
        isZooming = false;
        const touch = e.touches[0];
        lastX = touch.clientX;
        lastY = touch.clientY;
    }
}

// Zoom handling
function handleWheel(e) {
    e.preventDefault();
    
    // Normalize wheel delta for consistent behavior across browsers
    let delta = e.deltaY;
    if (e.deltaMode === 1) { // Line mode
        delta *= 16;
    } else if (e.deltaMode === 2) { // Page mode
        delta *= 16 * 24;
    }
    
    // Clamp delta to prevent excessive zoom from high-precision mice
    delta = Math.max(-100, Math.min(100, delta));
    
    // Calculate zoom delta with Google Maps-like sensitivity
    const normalizedDelta = delta / 100; // Normalize to -1 to 1 range
    const zoomDelta = -normalizedDelta * ZOOM_SPEED; // Negative to invert: wheel up = zoom in
    
    // Accumulate deltas and apply once per animation frame to avoid trailing zoom
    wheelAccum += zoomDelta;
    lastWheelX = e.clientX;
    lastWheelY = e.clientY;
    if (!wheelRafId) {
        wheelRafId = requestAnimationFrame(() => {
            const d = wheelAccum;
            wheelAccum = 0;
            wheelRafId = 0;
            if (Math.abs(d) > 0) {
                zoom(d, lastWheelX, lastWheelY);
            }
        });
    }
}

function zoom(delta, centerX = canvas.width / 2, centerY = canvas.height / 2) {
    const oldScale = scale;
    // Apply easing to delta for smoother feel
    const eased = delta * 0.9;
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale + eased));
    
    if (newScale !== oldScale) {
        // Zoom towards the specified center point
        const scaleRatio = newScale / oldScale;
        offsetX = centerX - (centerX - offsetX) * scaleRatio;
        offsetY = centerY - (centerY - offsetY) * scaleRatio;
        scale = newScale;
        
        // Apply boundary constraints after zooming
        constrainPanning();
        
        // When crossing around min zoom, switch mip levels seamlessly
        // (No action needed here; pickMipForScale is queried during render)
        // Close popup if zoom changed too much since it opened (relative threshold)
        if (popupOpenScale != null && Math.abs(Math.log(scale / popupOpenScale)) > Math.log(1.8)) {
            hideNodeInfo();
        }
        
        throttledRender();
    }
}

// Throttled render function to prevent excessive rendering
function throttledRender() {
    if (!renderRequested) {
        renderRequested = true;
        requestAnimationFrame(() => {
            render();
            renderRequested = false;
        });
    }
}

function zoomByStep(delta) {
    zoom(delta, canvas.width / 2, canvas.height / 2);
}

// Click handling for nodes
function handleClick(e) {
    if (isDragging || suppressNextClick) return; // Ignore click right after drag
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Convert to map coordinates
    const mapX = (x - offsetX) / scale;
    const mapY = (y - offsetY) / scale;
    
    // Find clicked node
    const clickRadius = Math.max(NODE_RADIUS, 15) / scale; // Minimum click area
    const clickedNode = nodes.find(node => {
        // Flip Y coordinate to match rendering
        const flippedY = mapImage.naturalHeight - node.y;
        const distance = Math.sqrt(
            Math.pow(node.x - mapX, 2) + 
            Math.pow(flippedY - mapY, 2)
        );
        return distance < clickRadius;
    });
    
    if (clickedNode) {
        showNodeInfo(clickedNode, e.clientX, e.clientY);
        selectedNode = clickedNode;
        beaconNodeId = null; // Clear search beacon when manually selecting a node
        highlightedNodes = []; // Clear search highlights
        startAnimationLoop(); // Start animation for clicked node
        throttledRender();
    } else {
        // Only deselect on click (not drag). Since we're here, it's a click.
        hideNodeInfo();
        selectedNode = null;
        beaconNodeId = null;
        highlightedNodes = []; // Clear all highlights
        stopAnimationLoop(); // Stop animation when no node selected
        throttledRender();
    }
}

// Keyboard handling
function handleKeyDown(e) {
    // Don't trigger shortcuts when user is typing in search input
    const searchInput = document.getElementById('searchInput');
    const isSearchFocused = document.activeElement === searchInput;
    
    switch (e.key) {
        case 'Escape':
            hideNodeInfo();
            clearSearch();
            document.getElementById('searchInput').blur();
            break;
        case 'ArrowDown':
            if (isSearchFocused && currentSearchResults && currentSearchResults.length > 0) {
                e.preventDefault();
                const next = Math.min(currentSearchResults.length - 1, (selectedResultIndex >= 0 ? selectedResultIndex + 1 : 0));
                updateSearchSelection(next);
                if (currentSearchResults[next]) {
                    beaconNodeId = currentSearchResults[next].id;
                    highlightedNodes = [currentSearchResults[next]];
                    startAnimationLoop();
                    throttledRender();
                }
            }
            break;
        case 'ArrowUp':
            if (isSearchFocused && currentSearchResults && currentSearchResults.length > 0) {
                e.preventDefault();
                const prev = Math.max(0, (selectedResultIndex >= 0 ? selectedResultIndex - 1 : 0));
                updateSearchSelection(prev);
                if (currentSearchResults[prev]) {
                    beaconNodeId = currentSearchResults[prev].id;
                    highlightedNodes = [currentSearchResults[prev]];
                    startAnimationLoop();
                    throttledRender();
                }
            }
            break;
        case 'Enter':
            if (isSearchFocused) {
                e.preventDefault();
                // Select current highlighted result or first
                if (currentSearchResults && currentSearchResults.length > 0) {
                    const idx = selectedResultIndex >= 0 ? selectedResultIndex : 0;
                    const node = currentSearchResults[idx];
                    if (node) selectNode(node);
                }
            }
            break;
        case '+':
        case '=':
            if (!isSearchFocused) {
                e.preventDefault();
                zoomByStep(ZOOM_SPEED);
            }
            break;
        case '-':
            if (!isSearchFocused) {
                e.preventDefault();
                zoomByStep(-ZOOM_SPEED);
            }
            break;
        case '0':
            if (!isSearchFocused) {
                e.preventDefault();
                resetView();
            }
            break;
        case '/':
            if (!isSearchFocused) {
                e.preventDefault();
                document.getElementById('searchInput').focus();
            }
            break;
    }
}

// Search functionality
function handleSearch() {
    const query = document.getElementById('searchInput').value.toLowerCase().trim();
    const resultsContainer = document.getElementById('searchResults');
    
    if (!query) {
        resultsContainer.style.display = 'none';
        highlightedNodes = [];
        currentSearchResults = [];
        selectedResultIndex = -1;
        beaconNodeId = null; // Clear search beacon
        // Only stop animation if no node is selected
        if (!selectedNode) {
            stopAnimationLoop();
        }
        throttledRender();
        return;
    }
    
    // Search nodes by name and description
    const results = nodes.filter(node => {
        const nameMatch = node.name.toLowerCase().includes(query);
        const descMatch = node.description && node.description.toLowerCase().includes(query);
        return nameMatch || descMatch;
    })
    // Prioritize fields starting with the query (including numeric substrings), then includes; sort ascending within each tier
    .sort((a, b) => {
        const q = query;
        const get = (x) => ({
            n: (x.name || '').toLowerCase(),
            d: (x.description || '').toLowerCase()
        });
        const da = get(a);
        const db = get(b);
        const digits = (s) => s.replace(/\D+/g, '');
        const qa = digits(da.n);
        const qb = digits(db.n);
        const qDigits = digits(q);
        const starts = (text) => text.startsWith(q);
        const includes = (text) => text.includes(q);
        const startsDigits = (text) => qDigits.length > 0 && text.startsWith(qDigits);
        const includesDigits = (text) => qDigits.length > 0 && text.includes(qDigits);
        const score = (obj) => {
            // Rank 0: name startsWith q OR nameDigits startsWith qDigits
            if (starts(obj.n) || startsDigits(digits(obj.n))) return 0;
            // Rank 1: desc startsWith q OR descDigits startsWith qDigits
            if (starts(obj.d) || startsDigits(digits(obj.d))) return 1;
            // Rank 2: name includes q or digits includes qDigits
            if (includes(obj.n) || includesDigits(digits(obj.n))) return 2;
            // Rank 3: desc includes q or digits includes qDigits
            if (includes(obj.d) || includesDigits(digits(obj.d))) return 3;
            return 4;
        };
        const sa = score(da);
        const sb = score(db);
        if (sa !== sb) return sa - sb;
        // Within same rank, sort naturally by numeric-aware name (digits-first if both present)
        const aName = a.name || '';
        const bName = b.name || '';
        const aNum = digits(aName);
        const bNum = digits(bName);
        if (aNum && bNum) {
            const ai = parseInt(aNum, 10);
            const bi = parseInt(bNum, 10);
            if (!Number.isNaN(ai) && !Number.isNaN(bi) && ai !== bi) return ai - bi;
        }
        const nameCmp = aName.localeCompare(bName, undefined, { numeric: true, sensitivity: 'base' });
        if (nameCmp !== 0) return nameCmp;
        return (a.description || '').localeCompare(b.description || '', undefined, { numeric: true, sensitivity: 'base' });
    })
    .slice(0, 10); // Limit to 10 results for performance
    
    // Display search results
    resultsContainer.innerHTML = '';
    
    if (results.length === 0) {
        const noResults = document.createElement('div');
        noResults.className = 'search-result-item';
        noResults.innerHTML = '<small>No results found</small>';
        resultsContainer.appendChild(noResults);
        currentSearchResults = [];
        selectedResultIndex = -1;
    } else {
        currentSearchResults = results;
        selectedResultIndex = 0; // highlight top result by default
        results.forEach((node, index) => {
            const item = document.createElement('div');
            item.className = 'search-result-item';
            if (index === 0) item.classList.add('selected');
            item.innerHTML = `
                <strong>${highlightText(node.name, query)}</strong>
                ${node.description ? `<small>${highlightText(node.description, query)}</small>` : ''}
            `;
            item.dataset.index = String(index);
            item.addEventListener('click', () => selectNode(node));
            // Desktop long-press support: keep dropdown open during press, select on mouseup if not moved far
            let pressMoved = false;
            let pressStartX = 0;
            let pressStartY = 0;
            const pressMoveThreshold = 6;
            item.addEventListener('mousedown', (ev) => {
                isInteractingWithResults = true;
                pressMoved = false;
                pressStartX = ev.clientX;
                pressStartY = ev.clientY;
            });
            item.addEventListener('mousemove', (ev) => {
                if (isInteractingWithResults) {
                    const d = Math.hypot(ev.clientX - pressStartX, ev.clientY - pressStartY);
                    if (d > pressMoveThreshold) pressMoved = true;
                }
            });
            item.addEventListener('mouseup', (ev) => {
                if (isInteractingWithResults && !pressMoved) {
                    selectNode(node);
                }
                isInteractingWithResults = false;
            });
            item.addEventListener('mouseleave', () => {
                if (isInteractingWithResults) {
                    // user dragged away; treat as cancel
                    isInteractingWithResults = false;
                }
            });
            item.addEventListener('mouseenter', () => {
                // Clear previous selections
                document.querySelectorAll('.search-result-item').forEach(el => {
                    el.classList.remove('selected');
                });
                item.classList.add('selected');
                selectedResultIndex = index;
                // Update highlighted node and beacon
                highlightedNodes = [node];
                beaconNodeId = node.id;
                startAnimationLoop();
                throttledRender();
            });
            resultsContainer.appendChild(item);
        });
    }
    
    resultsContainer.style.display = 'block';
    
    // Only highlight the currently selected result (first one by default)
    highlightedNodes = results.length > 0 ? [results[0]] : [];
    // Set beacon to the highlighted result
    beaconNodeId = results.length > 0 ? results[0].id : null;
    
    // Start animation loop if we have a beacon
    if (beaconNodeId) {
        startAnimationLoop();
    } else {
        stopAnimationLoop();
    }
    
    throttledRender();
}

function highlightText(text, query) {
    if (!query || !text) return text;
    const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi');
    return text.replace(regex, '<mark style="background: #ff6f00; color: #000; padding: 0 2px; border-radius: 2px;">$1</mark>');
}

function updateSearchSelection(newIndex) {
    const resultsContainer = document.getElementById('searchResults');
    const items = resultsContainer ? Array.from(resultsContainer.querySelectorAll('.search-result-item')) : [];
    if (items.length === 0) return;
    items.forEach(el => el.classList.remove('selected'));
    const clamped = Math.max(0, Math.min(items.length - 1, newIndex));
    const activeEl = items[clamped];
    if (activeEl) {
        activeEl.classList.add('selected');
        selectedResultIndex = clamped;
        // Ensure the selected item is visible
        const containerRect = resultsContainer.getBoundingClientRect();
        const itemRect = activeEl.getBoundingClientRect();
        if (itemRect.top < containerRect.top) {
            resultsContainer.scrollTop -= (containerRect.top - itemRect.top);
        } else if (itemRect.bottom > containerRect.bottom) {
            resultsContainer.scrollTop += (itemRect.bottom - containerRect.bottom);
        }
    }
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Select and focus on node
function selectNode(node) {
    selectedNode = node;
    highlightedNodes = []; // Clear search highlights - node is now selected, not searched
    beaconNodeId = null; // Clear search beacon, selected node will have its own beacon
    startAnimationLoop(); // Start animation for selected node beacon
    
    // Calculate target scale for good visibility
    const targetScale = Math.min(1.5, MAX_SCALE);
    const animationDuration = 500; // ms
    const startTime = performance.now();
    const startScale = scale;
    const startX = offsetX;
    const startY = offsetY;
    
    // Target position (center the node) - use flipped Y coordinate
    const flippedY = mapImage.naturalHeight - node.y;
    const targetX = canvas.width / 2 - node.x * targetScale;
    const targetY = canvas.height / 2 - flippedY * targetScale;
    
    // Animate to the node
    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / animationDuration, 1);
        
        // Easing function (ease-out)
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        
        scale = startScale + (targetScale - startScale) * easeProgress;
        offsetX = startX + (targetX - startX) * easeProgress;
        offsetY = startY + (targetY - startY) * easeProgress;
        
        // Apply boundary constraints during animation
        constrainPanning();
        
        throttledRender();
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            // Animation complete - show node info
            showNodeInfo(node, canvas.width / 2, canvas.height / 2);
        }
    }
    
    requestAnimationFrame(animate);
    
    // Clear search completely when a node is selected
    clearSearch();
    // Remember which node the popup is tied to
    popupNodeRef = node;
    popupOpenScale = scale;
}

// Node info popup
function showNodeInfo(node, _x, _y) {
    const nodeInfo = document.getElementById('nodeInfo');
    nodeInfo.innerHTML = `
        <h3>${node.name}</h3>
        ${node.description ? `<p>${node.description}</p>` : ''}
    `;
    
    // Show offscreen to measure true dimensions
    nodeInfo.style.visibility = 'hidden';
    nodeInfo.style.display = 'block';
    const popupWidth = nodeInfo.offsetWidth || 220;
    const popupHeight = nodeInfo.offsetHeight || 80;
    
    // Compute node screen coordinates (always from node, not click position)
    const flippedY = mapImage.naturalHeight - node.y;
    const screenX = node.x * scale + offsetX;
    const screenY = flippedY * scale + offsetY;
    
    // Position at top-right of the node
    const margin = 8;
    let leftPos = screenX + 12;
    let topPos = screenY - popupHeight - 12;
    
    // Clamp to viewport
    leftPos = Math.max(margin, Math.min(window.innerWidth - popupWidth - margin, leftPos));
    topPos = Math.max(margin, Math.min(window.innerHeight - popupHeight - margin, topPos));
    
    nodeInfo.style.left = `${leftPos}px`;
    nodeInfo.style.top = `${topPos}px`;
    nodeInfo.style.visibility = 'visible';
    // Track scale at open to support auto-close on large zoom change
    popupOpenScale = scale;
    // Reset pan baseline
    popupOpenOffsetX = offsetX;
    popupOpenOffsetY = offsetY;
    popupPanAccum = 0;
    popupVisible = true;
}

function hideNodeInfo() {
    document.getElementById('nodeInfo').style.display = 'none';
    popupNodeRef = null;
    popupOpenScale = null;
    popupVisible = false;
}

// Reset view to initial state
function resetView() {
    // Reset to minimum scale (map fills screen height)
    scale = MIN_SCALE;
    
    const viewportWidth = window.innerWidth;
    const scaledWidth = mapImage.naturalWidth * scale;
    offsetX = (viewportWidth - scaledWidth) / 2;
    offsetY = 0;
    
    // Apply boundary constraints
    constrainPanning();
    
    // Clear selections and highlights
    highlightedNodes = [];
    selectedNode = null;
    hideNodeInfo();
    
    // Clear search
    document.getElementById('searchInput').value = '';
    document.getElementById('searchResults').style.display = 'none';
    
    throttledRender();
}

// Handle window resize
function handleResize() {
    const oldWidth = canvas.width;
    const oldHeight = canvas.height;
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Recalculate minimum scale based on new viewport
    if (mapImage) {
        const viewportHeight = window.innerHeight;
        const mapHeight = mapImage.naturalHeight;
        MIN_SCALE = viewportHeight / mapHeight;
        
        // If current scale is below new minimum, reset to minimum
        if (scale < MIN_SCALE) {
            scale = MIN_SCALE;
            // Recenter the map
            const viewportWidth = window.innerWidth;
            const scaledWidth = mapImage.naturalWidth * scale;
            offsetX = (viewportWidth - scaledWidth) / 2;
            offsetY = 0;
            // Rebuild mip caches when MIN_SCALE changes
            buildMipCanvases();
        } else {
            // Adjust offset to maintain the relative position
            const widthRatio = canvas.width / oldWidth;
            const heightRatio = canvas.height / oldHeight;
            
            offsetX *= widthRatio;
            offsetY *= heightRatio;
        }
        
        // Apply boundary constraints
        constrainPanning();
    }
    
    throttledRender();
}

// Main render function
function render() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (!mapImage) return;
    
    // Save context state
    ctx.save();
    
    // Apply transformations
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    
    // Draw map image using nearest cached mip level when near min zoom
    const mip = pickMipForScale(scale);
    if (mip) {
        const inv = 1 / mip.scale; // counter our ctx.scale(scale)
        ctx.scale(inv, inv);
        ctx.drawImage(mip.canvas, 0, 0);
        ctx.scale(mip.scale, mip.scale);
    } else {
        ctx.drawImage(mapImage, 0, 0);
    }
    
    // Calculate visible bounds for optimization
    const visibleLeft = -offsetX / scale;
    const visibleTop = -offsetY / scale;
    const visibleRight = visibleLeft + canvas.width / scale;
    const visibleBottom = visibleTop + canvas.height / scale;
    
    // Draw nodes (only visible ones for performance)
    const renderRadius = Math.max(NODE_RADIUS, HIGHLIGHTED_NODE_RADIUS) * 2;
    
    // More aggressive culling at high zoom levels to maintain performance
    let nodeCount = 0;
    const maxNodes = scale > 2.0 ? 250 : scale > 1.5 ? 550 : scale > 1.0 ? 750 : 960;
    
    nodes.forEach(node => {
        // Flip Y coordinate to match map orientation (nodes.json Y=0 at bottom, canvas Y=0 at top)
        const flippedY = mapImage.naturalHeight - node.y;
        
        // Skip nodes outside visible area (using flipped Y)
        if (node.x < visibleLeft - renderRadius || 
            node.x > visibleRight + renderRadius ||
            flippedY < visibleTop - renderRadius || 
            flippedY > visibleBottom + renderRadius) {
            return;
        }
        
        // Limit total nodes rendered to prevent performance issues
        if (nodeCount++ > maxNodes) {
            return;
        }
        
        const isHighlighted = highlightedNodes.includes(node);
        const isSelected = node === selectedNode;
        const descText = (node.description || '').toLowerCase();
        const hasDescription = descText.trim().length > 0;
        const isCharging = descText.includes('cs');
        // Neon-like colors
        const colorDesc = '#ff1744';   // bright red for nodes with description (Docking Point)
        const colorNoDesc = '#39ff14'; // neon green for nodes without description (Road)
        const colorCS = '#ffeb3b';     // bright yellow for Charging Station
        
        ctx.beginPath();
        ctx.arc(
            node.x,
            flippedY,
            isSelected || (beaconNodeId && node.id === beaconNodeId) || isHighlighted ? HIGHLIGHTED_NODE_RADIUS : NODE_RADIUS,
            0,
            Math.PI * 2
        );
        
        if (isSelected) {
            // Selected nodes stay orange for clear focus
            ctx.fillStyle = '#ff6f00';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3 / scale;
        } else if ((beaconNodeId && node.id === beaconNodeId) || isHighlighted) {
            // Only blue if actively beaconed from search OR highlighted in search results
            ctx.fillStyle = '#0096ff'; // Bright blue
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2 / scale;
        } else {
            // Normal nodes colored by description presence
            ctx.fillStyle = isCharging ? colorCS : (hasDescription ? colorDesc : colorNoDesc);
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.lineWidth = 1 / scale;
        }
        
        ctx.fill();
        ctx.stroke();
        
        // Beacon pulsing effect for selected or beaconed nodes (from search)
        if (isSelected || (beaconNodeId && node.id === beaconNodeId)) {
            const t = performance.now() * 0.0025; // slower pulse
            const waves = 2;
            const baseRadius = isSelected ? HIGHLIGHTED_NODE_RADIUS : NODE_RADIUS;
            
            for (let i = 0; i < waves; i++) {
                const phase = (t + i * 0.33) % 1;
                // Make pulses extend well beyond the node marker
                const pulseRadius = baseRadius + 20 * phase; // Bigger pulse range
                const alpha = 0.5 * (1 - phase); // More visible
                
                ctx.beginPath();
                ctx.arc(node.x, flippedY, pulseRadius, 0, Math.PI * 2);
                ctx.strokeStyle = isSelected ? 
                    `rgba(255, 111, 0, ${alpha.toFixed(3)})` : // Orange for selected
                    `rgba(0, 150, 255, ${alpha.toFixed(3)})`; // Bright blue for search
                ctx.lineWidth = (isSelected ? 3 : 2.5) / scale; // Thicker lines
                ctx.stroke();
            }
        }
    });
    
    // Restore context state
    ctx.restore();

    // No follow-on-zoom/pan; popup position remains static
}

// Clear search functionality
function clearSearch() {
    const searchInput = document.getElementById('searchInput');
    const resultsContainer = document.getElementById('searchResults');
    const clearBtn = document.getElementById('clearSearch');
    
    searchInput.value = '';
    resultsContainer.style.display = 'none';
    clearBtn.style.display = 'none';
    
    // Clear all search-related state
    highlightedNodes = [];
    currentSearchResults = [];
    selectedResultIndex = -1;
    beaconNodeId = null;
    
    // Stop animation if no node is selected
    if (!selectedNode) {
        stopAnimationLoop();
    }
    
    throttledRender();
}

// Toggle clear button visibility
function toggleClearButton() {
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearch');
    
    if (searchInput.value.trim()) {
        clearBtn.style.display = 'flex';
    } else {
        clearBtn.style.display = 'none';
    }
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

// Error handling
function showError(message) {
    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.innerHTML = `
        <div style="color: #ff6f00; font-size: 2rem; margin-bottom: 1rem;">⚠️</div>
        <p style="color: #ff6f00; font-size: 1.2rem; margin-bottom: 1rem;">Error</p>
        <p style="color: #b0b0b0;">${message}</p>
    `;
    loadingOverlay.style.display = 'flex';
}

// Initialize performance monitoring
if (typeof performance !== 'undefined') {
    let frameCount = 0;
    let lastTime = performance.now();
    
    function measureFPS() {
        frameCount++;
        const currentTime = performance.now();
        if (currentTime - lastTime >= 1000) {
            console.log(`FPS: ${frameCount}`);
            frameCount = 0;
            lastTime = currentTime;
        }
        requestAnimationFrame(measureFPS);
    }
    
    // Uncomment to monitor FPS in development
    // measureFPS();
}

