# Factory Layout Map Web App - Development Guide

## Overview
Build a modern, responsive factory layout map viewer with search functionality that works on both mobile and desktop. The app will display a factory map with searchable nodes (RFID points and other locations).

## Key Requirements
1. **Visual Design**: Modern, clean, and visually pleasing interface
2. **Initial View**: Map fills screen vertically with no whitespace
3. **Search Bar**: Top center position for searching nodes
4. **Title**: "한국타이어 금산공장 (8/26 map ver.)"
5. **Responsive**: Works on both mobile and desktop
6. **Deployment**: Vercel-ready

## Step-by-Step Implementation

### Step 1: Project Structure
Create the following files in the `interactive-factory-map` folder:
```
interactive-factory-map/
├── index.html
├── style.css
├── script.js
├── factory-map.png (existing)
├── nodes.json (existing)
└── vercel.json
```

### Step 2: HTML Structure (index.html)
Create a responsive HTML layout with:
1. **Header Section**:
   - Title: "한국타이어 금산공장 (8/26 map ver.)"
   - Search bar with modern styling
   - Search suggestions dropdown

2. **Map Container**:
   - Canvas element for rendering the map
   - Controls for zoom in/out
   - Mobile touch controls

3. **Node Information**:
   - Popup/tooltip for node details
   - Smooth animations

### Step 3: CSS Styling (style.css)
Implement modern design with:
1. **Color Scheme**:
   - Primary: Dark blue (#1a237e)
   - Accent: Orange (#ff6f00)
   - Background: Dark grey (#121212)
   - Text: White/light grey

2. **Layout**:
   - Flexbox/Grid for responsive design
   - Fixed header with search bar
   - Full-screen map container
   - No scrollbars on initial load

3. **Components**:
   - Modern search bar with glass morphism effect
   - Smooth transitions and hover effects
   - Mobile-first responsive design
   - Custom zoom controls

### Step 4: JavaScript Functionality (script.js)

#### 4.1 Map Initialization
```javascript
// Load and display the factory map
// Calculate initial zoom to fit screen height
// Center the map horizontally
// Prevent white space around edges
```

#### 4.2 Node Management
```javascript
// Load nodes.json
// Create searchable index
// Implement node types (CS, RFID, etc.)
// Handle node highlighting and selection
```

#### 4.3 Search Functionality
```javascript
// Real-time search with debouncing
// Fuzzy search for node names and descriptions
// Search suggestions dropdown
// Keyboard navigation for search results
// Highlight and zoom to selected node
```

#### 4.4 Map Controls
```javascript
// Pan functionality (mouse drag/touch)
// Zoom controls with limits:
  - Min zoom: fit to screen height
  - Max zoom: 300% (configurable)
// Mouse wheel zoom with limits
// Pinch-to-zoom for mobile
// Double-tap to zoom
```

#### 4.5 Node Rendering
```javascript
// Draw nodes on canvas
// Different styles for node types
// Interactive hover effects
// Click to show node details
// Smooth animations
```

### Step 5: Key Implementation Details

#### 5.1 Initial Map Loading
```javascript
// On page load:
1. Get viewport dimensions
2. Calculate zoom level where map height = viewport height
3. Center map horizontally
4. No background should be visible
```

#### 5.2 Search Implementation
```javascript
// Search features:
1. Search by node name (RFID numbers)
2. Search by description
3. Filter by node type (CS, RFID, etc.)
4. Auto-complete suggestions
5. Highlight search results on map
```

#### 5.3 Mobile Optimizations
- Touch-friendly controls
- Responsive search bar
- Optimized canvas rendering
- Prevent accidental zooming

### Step 6: Vercel Deployment Configuration
Create `vercel.json`:
```json
{
  "buildCommand": "echo 'No build required'",
  "outputDirectory": ".",
  "framework": null
}
```

### Step 7: Advanced Features

#### 7.1 Performance Optimizations
- Use requestAnimationFrame for smooth animations
- Implement viewport culling (only render visible nodes)
- Lazy load node details
- Optimize canvas rendering

#### 7.2 User Experience
- Loading spinner while map loads
- Smooth transitions between states
- Error handling for failed loads
- Offline support with service worker

#### 7.3 Accessibility
- Keyboard navigation
- Screen reader support
- High contrast mode option
- Focus indicators

### Step 8: Testing Checklist
- [ ] Map loads without white space
- [ ] Search finds all nodes correctly
- [ ] Zoom limits work properly
- [ ] Mobile touch controls work
- [ ] Performance is smooth with all nodes
- [ ] Works on various screen sizes
- [ ] Vercel deployment successful

### Step 9: Code Quality
- Use ES6+ JavaScript features
- Implement error boundaries
- Add JSDoc comments
- Follow consistent naming conventions
- Optimize images and assets

### Step 10: Final Polish
- Add subtle animations
- Implement dark/light theme toggle
- Add help/tutorial overlay
- Include keyboard shortcuts guide
- Add node statistics dashboard

## Technical Specifications

### Canvas Rendering Strategy
1. Use HTML5 Canvas for performance
2. Implement double buffering
3. Use transform matrix for zoom/pan
4. Batch render operations

### Search Algorithm
1. Create inverted index on load
2. Use Levenshtein distance for fuzzy matching
3. Weight results by relevance
4. Cache search results

### Responsive Breakpoints
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

### Browser Support
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers

## Example Code Structure

### Initial Zoom Calculation
```javascript
function calculateInitialZoom() {
  const viewportHeight = window.innerHeight;
  const mapHeight = mapImage.naturalHeight;
  const zoom = viewportHeight / mapHeight;
  return Math.max(zoom, 0.1); // Minimum 10% zoom
}
```

### Search Implementation
```javascript
function searchNodes(query) {
  const results = nodes.filter(node => {
    const searchTerm = query.toLowerCase();
    return node.name.toLowerCase().includes(searchTerm) ||
           node.description.toLowerCase().includes(searchTerm);
  });
  return results.slice(0, 10); // Limit to 10 results
}
```

This guide provides a comprehensive roadmap for building the factory map web app. Each step should be implemented carefully with attention to user experience and performance.
