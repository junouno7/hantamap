# Quick Implementation Guide - Factory Map Web App

## What to Build
A modern, responsive factory map viewer with search functionality that works on both mobile and desktop.

## Key Requirements
1. **Title**: "한국타이어 금산공장 (8/26 map ver.)" - centered at top
2. **Initial View**: Map fills screen height exactly (no white space)
3. **Search Bar**: Top center, searches node names and descriptions
4. **Responsive**: Works on mobile and desktop
5. **Deploy**: Ready for Vercel

## Files to Create
1. `index.html` - Main HTML structure
2. `style.css` - Modern dark theme with blue accents
3. `script.js` - All functionality
4. `vercel.json` - Deployment config

## Core Features to Implement

### 1. Map Display
- Load `factory-map.png` (19933x6042 approx)
- Initial zoom: fit to viewport height
- Center horizontally
- No background visible

### 2. Node System
- Load `nodes.json` (6722 nodes)
- Each node has: id, name, x, y, description
- Render as circles on map
- Click for details

### 3. Search
- Real-time search
- Search by name AND description
- Show top 10 results
- Click result to zoom to node
- Highlight searched nodes

### 4. Controls
- Zoom in/out buttons
- Reset view button
- Mouse wheel zoom
- Drag to pan
- Touch support for mobile

### 5. Zoom Limits
- Min: 10% (0.1)
- Max: 300% (3.0)
- Cannot zoom out past initial view

### 6. Visual Design
- Dark theme (#121212 background)
- Blue primary (#1976d2)
- Orange accent (#ff6f00)
- Glass morphism search bar
- Smooth animations

## Technical Details

### Canvas Strategy
```javascript
// Initial scale calculation
scale = window.innerHeight / mapImage.naturalHeight;
offsetX = (window.innerWidth - mapImage.naturalWidth * scale) / 2;
offsetY = 0;
```

### Search Implementation
```javascript
// Filter nodes by query
const results = nodes.filter(node => 
    node.name.toLowerCase().includes(query) ||
    node.description.toLowerCase().includes(query)
);
```

### Performance
- Use requestAnimationFrame
- Only render visible nodes
- Debounce search input
- Cache search results

## Mobile Optimizations
- Touch events for pan/zoom
- Responsive search bar
- Smaller control buttons
- Prevent accidental zoom

## Deployment
1. Put all files in `interactive-factory-map/`
2. Push to GitHub
3. Connect Vercel to repo
4. Deploy

## Testing Points
- ✓ No white space on load
- ✓ Search works correctly
- ✓ Smooth performance
- ✓ Mobile controls work
- ✓ Zoom limits enforced
