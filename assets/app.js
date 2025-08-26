// Main application variables
let storyPoints = [];
let isDragging = false;
let startX = 0;
let startY = 0;
let currentX = 0;
let currentY = 0;
let currentStoryPoint = null;
let pointElements = [];
let textSpeed = 15; // milliseconds between letters (default to medium)
let isTyping = false;
let currentTypingTimeout = null;
let skipToNextSentence = false;
let hasUsedSkip = false;
let navigationHistory = []; // Track navigation history for back button
let visitedContent = new Set(); // Track which dialogue content has been visited

// Pause/resume for typing animation with state tracking
let isTypingPaused = false;
let pausedTypingState = null; // Store the exact state when paused

// View toggle variables
let isMapView = true;
let panoramaScene, panoramaCamera, panoramaRenderer, panoramaSphere, panoramaSphereNight, panoramaAmbientLight;
let isMouseDown = false;
let mouseX = 0, mouseY = 0;
let lastMouseX = 0, lastMouseY = 0;
let isMouseMoving = false;
let mouseStopTimeout = null;
let resizeTimeout = null;

// Debounce function for performance
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
let targetRotation = { x: 0, y: 0 };
let currentRotation = { x: 0, y: 0 };
let panoramaPoints = [];
let raycaster, mouse;
let dragStartTime = 0;
let dragStartPosition = { x: 0, y: 0 };
let hasDragged = false;
let lon = 0, lat = 0; // Global panorama camera rotation

// Background music
let backgroundMusic = null;


// DOM elements
const container = document.getElementById("container");
const backgroundContainer = document.getElementById("backgroundContainer");
const interactivePoints = document.getElementById("interactivePoints");
const dialoguePanel = document.getElementById("dialoguePanel");
const locationTitle = document.getElementById("locationTitle");
const locationSubtitle = document.getElementById("locationSubtitle");
const dialogueTextContainer = document.getElementById("dialogueTextContainer");
const helpOverlay = document.getElementById("helpOverlay");
const helpClose = document.getElementById("helpClose");
const panoramaContainer = document.getElementById("panoramaContainer");
const panoramaCanvas = document.getElementById("panoramaCanvas");
const panoramaOverlay = document.getElementById("panoramaOverlay");

// Initialize the application
async function initialize() {
  try {
    // Load story data from JSON file
    const response = await fetch("assets/story-data.json");
    storyPoints = await response.json();

    createInteractivePoints();
    setupEventListeners();
    setupDialogueSkipListener();
    initializeMusic();
    initializePanorama();
    // Initial positioning of points
    updatePointPositions();
    // Welcome message will show after help overlay is closed
  } catch (error) {
    console.error("Failed to load story data:", error);
  }
}

function createInteractivePoints() {
  storyPoints.forEach((point, index) => {
    const pointElement = document.createElement("div");
    pointElement.className = "point";
    pointElement.style.left = `${point.x}%`;
    pointElement.style.top = `${point.y}%`;
    pointElement.dataset.index = index;
    pointElement.dataset.title = point.title;
    
    pointElement.addEventListener("click", () =>
      handleCircleClick(point, pointElement, index),
    );
    
    // Add hover event listeners for title display
    pointElement.addEventListener("mouseenter", (e) => {
      // Disable edge scrolling while hovering over circle
      isHoveringCircle = true;
      stopEdgeScrolling(); // Stop any current scrolling immediately
      // Add small delay to prevent flickering
      clearTimeout(pointElement.hoverTimeout);
      pointElement.hoverTimeout = setTimeout(() => showHoverTitle(e, point.title), 50);
    });
    pointElement.addEventListener("mouseleave", () => {
      // Re-enable edge scrolling when leaving circle
      isHoveringCircle = false;
      // Clear any pending hover timeout
      clearTimeout(pointElement.hoverTimeout);
      hideHoverTitle();
    });
    
    interactivePoints.appendChild(pointElement);
    pointElements.push(pointElement);
  });
}

let hoverTitleElement = null;

function showHoverTitle(event, title) {
  // Don't show title if the circle is already selected
  const pointElement = event.target;
  if (pointElement.classList.contains('selected')) {
    return;
  }
  
  // Remove existing hover title if any
  hideHoverTitle();
  
  // Create hover title element
  hoverTitleElement = document.createElement("div");
  hoverTitleElement.className = "hover-title";
  hoverTitleElement.textContent = title;
  
  // Position it next to the circle
  const pointRect = pointElement.getBoundingClientRect();
  
  // Add to body first to get dimensions
  document.body.appendChild(hoverTitleElement);
  const titleRect = hoverTitleElement.getBoundingClientRect();
  
  // Calculate position (to the right of the circle, vertically centered)
  let left = pointRect.right + 20;
  let top = pointRect.top + (pointRect.height / 2) - (titleRect.height / 2);
  
  // Keep within viewport bounds
  if (left + titleRect.width > window.innerWidth) {
    left = pointRect.left - titleRect.width - 20; // Show to the left instead
  }
  if (top < 0) top = 10;
  if (top + titleRect.height > window.innerHeight) {
    top = window.innerHeight - titleRect.height - 10;
  }
  
  hoverTitleElement.style.left = `${left}px`;
  hoverTitleElement.style.top = `${top}px`;
  
  // Store reference to the target element to ensure consistency
  hoverTitleElement.targetElement = pointElement;
  
  // Trigger animation immediately with requestAnimationFrame for better timing
  requestAnimationFrame(() => {
    if (hoverTitleElement && hoverTitleElement.targetElement === pointElement) {
      hoverTitleElement.classList.add("visible");
    }
  });
}

function hideHoverTitle() {
  if (hoverTitleElement) {
    // Remove the visible class immediately
    hoverTitleElement.classList.remove("visible");
    
    // Store reference to current element for cleanup
    const elementToRemove = hoverTitleElement;
    hoverTitleElement = null; // Clear the global reference immediately
    
    // Remove from DOM after transition
    setTimeout(() => {
      if (elementToRemove && elementToRemove.parentNode) {
        elementToRemove.parentNode.removeChild(elementToRemove);
      }
    }, 200);
  }
}

function setupEventListeners() {
  container.addEventListener("mousedown", startDrag);
  container.addEventListener("mousemove", drag);
  container.addEventListener("mouseup", endDrag);
  container.addEventListener("mouseleave", endDrag);
  
  // Add edge scrolling functionality
  document.addEventListener("mousemove", handleEdgeScrolling);
  container.addEventListener("touchstart", startDragTouch, { passive: false });
  container.addEventListener("touchmove", dragTouch, { passive: false });
  container.addEventListener("touchend", endDrag);

  // Auto-close intro popup when clicking on map or interacting with points
  container.addEventListener("click", (e) => {
    // Only close if the welcome message is showing and user clicks on map area
    if (
      dialoguePanel.classList.contains("visible") &&
      currentStoryPoint === null &&
      !dialoguePanel.contains(e.target) &&
      !e.target.closest(".point")
    ) {
      hideDialogue();
    }
    
    // Reset map position when clicking off a selected circle
    if (
      !e.target.closest(".point") &&
      !dialoguePanel.contains(e.target) &&
      !e.target.classList.contains("interactive-text") &&
      !e.target.closest(".interactive-text") &&
      currentStoryPoint !== null
    ) {
      resetMapPosition();
      hideDialogue();
    }
  });

  // Auto-close intro popup when any point is clicked
  document.addEventListener("click", (e) => {
    if (
      e.target.closest(".point") &&
      dialoguePanel.classList.contains("visible") &&
      currentStoryPoint === null
    ) {
      hideDialogue();
    }
  });

  // Auto-close help overlay when clicking anywhere except help overlay
  document.addEventListener("click", (e) => {
    if (
      !helpOverlay.classList.contains("hidden") &&
      !helpOverlay.contains(e.target) &&
      !dialoguePanel.contains(e.target)
    ) {
      helpOverlay.classList.add("hidden");
      // Start music when user interacts (closes help overlay)
      startMusicAfterUserInteraction();
      // Skip welcome message - go straight to dialogue
    }
  });

  helpClose.addEventListener("click", () => {
    helpOverlay.classList.add("hidden");
    // Start music when user interacts (closes help overlay)
    startMusicAfterUserInteraction();
    // Skip welcome message - go straight to dialogue
  });
  
  // Update help text for touchscreen devices
  updateHelpTextForDevice();
  container.addEventListener("contextmenu", (e) => e.preventDefault());

  // Update connection lines on window resize
  window.addEventListener("resize", () => {
    updatePointPositions();
  });

  // Removed number key support since we no longer use numbered options

  // Text speed toggle
  const textSpeedToggle = document.getElementById("textSpeedToggle");
  const textSpeeds = ["FAST", "RELAXED", "ZEN"];
  const speedValues = { FAST: 0, RELAXED: 30, ZEN: 50 };
  let currentSpeedIndex = 1; // Start with "Relaxed"

  textSpeedToggle.addEventListener("click", () => {
    // Play page turn sound effect
    playPageTurnSound();
    
    currentSpeedIndex = (currentSpeedIndex + 1) % textSpeeds.length;
    const speedName = textSpeeds[currentSpeedIndex];
    textSpeedToggle.textContent = speedName;
    textSpeed = speedValues[speedName];

    // Visual feedback for speed change
    textSpeedToggle.classList.add("speed-changed");
    setTimeout(() => {
      textSpeedToggle.classList.remove("speed-changed");
    }, 300);

    // Reload current text at new speed if dialogue is showing
    if (dialoguePanel.classList.contains("visible") && currentStoryPoint) {
      showMainText(currentStoryPoint);
    }
  });

  // Contrast toggle with sun/moon icon
  const contrastToggle = document.getElementById("contrastToggle");
  let isHighContrast = false;

  contrastToggle.addEventListener("click", (e) => {
    e.stopPropagation(); // Prevent event bubbling
    
    // Play light switch sound effect
    playLightSwitchSound();
    
    isHighContrast = !isHighContrast;
    document.body.classList.toggle("high-contrast", isHighContrast);

    // Update 360° scene day/night transition for all locations
    if (!isMapView && currentStoryPoint) {
      console.log('Day/night toggle triggered, transitioning 360° scene. Night mode:', isHighContrast);
      updateSceneOpacity();
    }

    // Toggle between sun and moon icons
    if (isHighContrast) {
      contrastToggle.innerHTML = `
                <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
            `;
    } else {
      contrastToggle.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="5"/>
                    <path d="M12 0.5v3M12 20.5v3M3.5 3.5l2.12 2.12M17.88 17.88l2.12 2.12M0.5 12h3M20.5 12h3M3.5 20.5l2.12-2.12M17.88 6.12l2.12-2.12"/>
                </svg>
            `;
    }
  });
}

function startDrag(e) {
  if (
    e.target.classList.contains("point") ||
    e.target.closest(".dialogue-panel")
  )
    return;
  isDragging = true;
  container.classList.add("dragging");
  startX = e.clientX - currentX;
  startY = e.clientY - currentY;
}

function startDragTouch(e) {
  if (
    e.target.classList.contains("point") ||
    e.target.closest(".dialogue-panel")
  )
    return;
  isDragging = true;
  container.classList.add("dragging");
  const touch = e.touches[0];
  startX = touch.clientX - currentX;
  startY = touch.clientY - currentY;
}

function drag(e) {
  if (!isDragging) return;
  e.preventDefault();
  currentX = e.clientX - startX;
  currentY = e.clientY - startY;
  updateBackgroundPosition();
}

function dragTouch(e) {
  if (!isDragging) return;
  e.preventDefault();
  const touch = e.touches[0];
  
  // Calculate new position with slight momentum
  const newX = touch.clientX - startX;
  const newY = touch.clientY - startY;
  
  // Apply some smoothing for more fluid feel
  currentX = newX;
  currentY = newY;
  
  updateBackgroundPosition();
}

function endDrag() {
  isDragging = false;
  container.classList.remove("dragging");
  
  // Re-enable smooth transitions after drag ends for a polished feel
  backgroundContainer.style.transition = 'transform 0.08s ease';
  interactivePoints.style.transition = 'transform 0.08s ease';
}

function updateBackgroundPosition() {
  const isMobile = window.innerWidth <= 480;
  
  let maxX, maxY;
  
  if (isMobile) {
    // Mobile: Allow full image width dragging
    // Container is 350% of viewport width, centered at -125%
    // So we can drag from -125% to +125% = 250% total range
    // Image is 2142px, viewport might be ~375px, so we need generous limits
    maxX = window.innerWidth * 1.25; // Allow dragging 125% of viewport width in each direction
    maxY = window.innerHeight * 0.15; // Keep Y limits reasonable
  } else {
    // Desktop: Keep original limits
    maxX = window.innerWidth * 0.1;
    maxY = window.innerHeight * 0.1;
  }
  
  currentX = Math.max(-maxX, Math.min(maxX, currentX));
  currentY = Math.max(-maxY, Math.min(maxY, currentY));
  
  // Remove any transitions during active dragging for instant response
  if (isDragging) {
    backgroundContainer.style.transition = 'none';
    interactivePoints.style.transition = 'none';
  }
  
  if (cachedElements.backgroundContainer) {
    cachedElements.backgroundContainer.style.transform = `translate(${currentX}px, ${currentY}px)`;
  }

  // Move points with the background using the same transform
  if (cachedElements.interactivePoints) {
    cachedElements.interactivePoints.style.transform = `translate(${currentX}px, ${currentY}px)`;
  }
  
  // Update spotlight position when map moves to keep it attached to the selected circle
  if (cachedElements.dimmingOverlay && cachedElements.dimmingOverlay.classList.contains('active')) {
    const selectedPoint = document.querySelector('.point.selected');
    if (selectedPoint) {
      updateSpotlightPosition(selectedPoint);
    }
  }
}

function updatePointPositions() {
  // Points now move with background via CSS transform, no individual positioning needed
}

// Update spotlight position to follow the selected circle
function updateSpotlightPosition(pointElement, animationProgress = 1) {
  const dimmingOverlay = document.getElementById('dimmingOverlay');
  if (!dimmingOverlay || !dimmingOverlay.classList.contains('active')) return;
  
  const pointRect = pointElement.getBoundingClientRect();
  const centerX = pointRect.left + pointRect.width / 2;
  const centerY = pointRect.top + pointRect.height / 2;
  
  // Calculate radius based on circle's current scale or animation progress
  const isSelected = pointElement.classList.contains('selected');
  const isDeselecting = pointElement.classList.contains('deselecting');
  const baseRadius = 130 / 2; // Base circle radius
  
  let currentScale = 1;
  
  if (animationProgress < 1) {
    // During animation, interpolate between 1 and 4 based on progress
    currentScale = 1 + (3 * animationProgress); // 1 -> 4
  } else if (isSelected) {
    currentScale = 4; // Fully scaled
  } else if (isDeselecting) {
    // During deselection, the scale is animating from 4 to 1
    // We'll use the transform to get the current scale
    const transform = window.getComputedStyle(pointElement).transform;
    if (transform && transform !== 'none') {
      const matrix = transform.match(/matrix\(([^)]+)\)/);
      if (matrix) {
        const values = matrix[1].split(',');
        currentScale = parseFloat(values[0]); // scaleX value
      }
    }
  }
  
  const radius = baseRadius * currentScale;
  
  // Use mask with soft gradient for smoother edge
  dimmingOverlay.style.mask = `radial-gradient(circle at ${centerX}px ${centerY}px, transparent ${radius - 15}px, rgba(0,0,0,0.1) ${radius - 5}px, black ${radius + 5}px)`;
  dimmingOverlay.style.webkitMask = `radial-gradient(circle at ${centerX}px ${centerY}px, transparent ${radius - 15}px, rgba(0,0,0,0.1) ${radius - 5}px, black ${radius + 5}px)`;
}

// Update help overlay text for touchscreen devices
function updateHelpTextForDevice() {
  // Detect touchscreen capability
  const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);
  
  if (isTouchDevice) {
    // Update help text for touchscreen devices
    const helpItems = document.querySelectorAll('.help-item span');
    
    helpItems.forEach(span => {
      let text = span.textContent;
      
      // Replace specific text patterns
      if (text.includes('DRAG or MOVE YOUR MOUSE to look around')) {
        span.textContent = 'SLIDE to look around';
      } else if (text.includes('CLICK to look at what\'s happening')) {
        span.textContent = 'TAP to look at what\'s happening';
      } else if (text.includes('CLICK to change reading speed')) {
        span.textContent = 'TAP to change reading speed';
      } else if (text.includes('CLICK to switch from day to night')) {
        span.textContent = 'TAP to switch from day to night (high contrast mode)';
      }
      // Replace any remaining instances of CLICK with TAP
      else if (text.includes('CLICK')) {
        span.textContent = text.replace(/CLICK/g, 'TAP');
      }
    });
  }
}

// Center-based scrolling functionality
let scrollDeadZone = 0.2; // 20% of screen from center has no effect (increased for more gradual)
let scrollActiveZone = 0.45; // 45% of screen from center has full effect (increased for more gradual)
let edgeScrollAnimationId = null;

// Performance optimization variables
let lastFrameTime = 0;
const targetFPS = 60;
const mobileTargetFPS = 30;
const frameInterval = 1000 / targetFPS;
const mobileFrameInterval = 1000 / mobileTargetFPS;

// Cache frequently accessed DOM elements
const cachedElements = {
  container: null,
  backgroundContainer: null,
  interactivePoints: null,
  dialoguePanel: null,
  helpOverlay: null,
  dimmingOverlay: null
};

function initCachedElements() {
  cachedElements.container = document.getElementById("container");
  cachedElements.backgroundContainer = document.getElementById("backgroundContainer");
  cachedElements.interactivePoints = document.getElementById("interactivePoints");
  cachedElements.dialoguePanel = document.getElementById("dialoguePanel");
  cachedElements.helpOverlay = document.getElementById("helpOverlay");
  cachedElements.dimmingOverlay = document.getElementById("dimmingOverlay");
}

// Mobile-specific optimizations
function applyMobileOptimizations() {
  const isMobile = window.innerWidth <= 768;
  
  if (isMobile) {
    // Reduce scroll sensitivity on mobile
    scrollDeadZone = 0.3; // Larger dead zone
    scrollActiveZone = 0.6; // Larger active zone
    
    // Disable hover effects that don't work well on mobile
    document.body.classList.add('mobile-optimized');
    
    // Add viewport meta tag if not present for better mobile performance
    if (!document.querySelector('meta[name="viewport"]')) {
      const viewport = document.createElement('meta');
      viewport.name = 'viewport';
      viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
      document.head.appendChild(viewport);
    }
  }
}
let currentScrollVelocityX = 0;
let currentScrollVelocityY = 0;
let targetScrollVelocityX = 0;
let targetScrollVelocityY = 0;
let isHoveringCircle = false;
let isHoveringDialogue = false; // Track when mouse is over dialogue panel
let visitedInteractiveLinks = new Set(); // Track visited interactive text links

function handleEdgeScrolling(e) {
  // Enable edge scrolling for both map and panorama modes, but not while dragging or when a circle is selected
  if (isDragging) return;
  
  // Different logic for map view vs 360° view
  if (isMapView) {
    // In map view: disable scrolling when dialogue is open (traditional behavior)
    if (cachedElements.dialoguePanel && cachedElements.dialoguePanel.classList.contains('visible')) return;
    // Disable scrolling when hovering over circles in map view
    if (isHoveringCircle) return;
  } else {
    // In 360° view: allow scrolling when dialogue is open, but not when hovering over dialogue or circles
    if (isHoveringDialogue) return;
    if (isHoveringCircle) return;
  }
  
  // Disable scrolling when help overlay is open
  if (cachedElements.helpOverlay && !cachedElements.helpOverlay.classList.contains('hidden')) return;
  
  const mouseX = e.clientX;
  const mouseY = e.clientY;
  
  // Check if mouse has actually moved
  const mouseMoved = Math.abs(mouseX - lastMouseX) > 1 || Math.abs(mouseY - lastMouseY) > 1;
  
  if (mouseMoved) {
    isMouseMoving = true;
    lastMouseX = mouseX;
    lastMouseY = mouseY;
    
    // Clear existing timeout
    if (mouseStopTimeout) {
      clearTimeout(mouseStopTimeout);
    }
    
    // Set timeout to detect when mouse stops moving
    mouseStopTimeout = setTimeout(() => {
      isMouseMoving = false;
      // Stop scrolling immediately when mouse stops
      targetScrollVelocityX = 0;
      targetScrollVelocityY = 0;
    }, 100); // delay to detect mouse stop
  }
  
  // Only scroll if mouse is actively moving
  if (!isMouseMoving) return;
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;
  
  // Calculate position relative to center (0,0 = center, -1,1 = corners)
  const centerX = windowWidth / 2;
  const centerY = windowHeight / 2;
  const relativeX = (mouseX - centerX) / (windowWidth / 2);
  const relativeY = (mouseY - centerY) / (windowHeight / 2);
  
  // Calculate distance from center
  const distanceFromCenter = Math.sqrt(relativeX * relativeX + relativeY * relativeY);
  
  // Only activate if outside dead zone
  if (distanceFromCenter > scrollDeadZone) {
    // Calculate scroll factor (0 at dead zone boundary, 1 at active zone boundary)
    const scrollFactor = Math.min(1, (distanceFromCenter - scrollDeadZone) / (scrollActiveZone - scrollDeadZone));
    
    // Apply linear curve for more direct response
    const smoothFactor = scrollFactor;
    
    // Calculate velocity based on direction and smooth factor (reversed for intuitive movement)
    const maxSpeed = 6.0; // Faster edge scrolling movement
    targetScrollVelocityX = -relativeX * smoothFactor * maxSpeed;
    targetScrollVelocityY = -relativeY * smoothFactor * maxSpeed;
  } else {
    targetScrollVelocityX = 0;
    targetScrollVelocityY = 0;
  }
  
  if (targetScrollVelocityX !== 0 || targetScrollVelocityY !== 0 || 
      currentScrollVelocityX !== 0 || currentScrollVelocityY !== 0) {
    startEdgeScrolling();
  } else {
    stopEdgeScrolling();
  }
}

function startEdgeScrolling() {
  if (edgeScrollAnimationId) return; // Already scrolling
  
  function scroll(currentTime) {
    // Frame rate limiting for performance
    const isMobile = window.innerWidth <= 768;
    const interval = isMobile ? mobileFrameInterval : frameInterval;
    
    if (currentTime - lastFrameTime < interval) {
      edgeScrollAnimationId = requestAnimationFrame(scroll);
      return;
    }
    lastFrameTime = currentTime;
    
    // Faster acceleration for quicker response
    const acceleration = 0.18; // Faster acceleration for quicker edge scrolling
    const bounceMultiplier = 1.0; // No bounce effect
    
    const deltaX = targetScrollVelocityX - currentScrollVelocityX;
    const deltaY = targetScrollVelocityY - currentScrollVelocityY;
    
    currentScrollVelocityX += deltaX * acceleration * bounceMultiplier;
    currentScrollVelocityY += deltaY * acceleration * bounceMultiplier;
    
    // Stop if velocity is very small
    if (Math.abs(currentScrollVelocityX) < 0.01 && Math.abs(currentScrollVelocityY) < 0.01 &&
        targetScrollVelocityX === 0 && targetScrollVelocityY === 0) {
      stopEdgeScrolling();
      return;
    }
    
    if (isMapView) {
      // Map scrolling
      currentX += currentScrollVelocityX;
      currentY += currentScrollVelocityY;
      
      // Apply the same bounds as regular dragging
      let maxX, maxY;
      if (window.innerWidth <= 768) {
        maxX = window.innerWidth * 0.8;
        maxY = window.innerHeight * 0.3;
      } else {
        maxX = window.innerWidth * 0.1;
        maxY = window.innerHeight * 0.1;
      }
      
      currentX = Math.max(-maxX, Math.min(maxX, currentX));
      currentY = Math.max(-maxY, Math.min(maxY, currentY));
      
      updateBackgroundPosition();
    } else {
      // Panorama scrolling - update lon/lat for smoother control (horizontal inverted, vertical natural)
      if (!isMapView && panoramaCamera) {
        lon -= currentScrollVelocityX * 0.1; // Horizontal rotation (slower, less dizzying)
        lat += currentScrollVelocityY * 0.1; // Vertical rotation (slower, less dizzying)
        
        // Clamp vertical rotation
        lat = Math.max(-85, Math.min(85, lat));
        
        // Update panorama point positions as camera rotates
        updatePanoramaPointPositions();
      }
    }
    
    edgeScrollAnimationId = requestAnimationFrame(scroll);
  }
  
  scroll();
}

function stopEdgeScrolling() {
  if (edgeScrollAnimationId) {
    cancelAnimationFrame(edgeScrollAnimationId);
    edgeScrollAnimationId = null;
  }
  currentScrollVelocityX = 0;
  currentScrollVelocityY = 0;
  targetScrollVelocityX = 0;
  targetScrollVelocityY = 0;
}

// Handle circle click - zoom and switch to 360° view only for Education and Food, otherwise show dialogue normally
function handleCircleClick(point, pointElement, index) {
  console.log('Circle clicked:', point.title);
  
  // Check if this point has a 360° image
  const has360Image = point.title === "Education" || point.title === "Food" || point.title === "Energy" || point.title === "Transport"; // These points go directly to 360°
  
  // Store has360Image on the point for later use
  point._has360Image = has360Image;
  
  if (!has360Image) {
    // No 360° image - just show dialogue in street view
    console.log('No 360° image for', point.title, '- showing dialogue in street view');
    showDialogue(point, pointElement);
    return;
  }
  
  // For 360° images, center the circle first before starting zoom transition
  centerPointOnScreen(pointElement);
  
  console.log('Has 360° image - starting zoom effect');
  
  // Set the current story point for panorama creation
  currentStoryPoint = point;
  
  // Start transition immediately for faster 360° access
  setTimeout(() => {
    // Get the circle's position for zoom target (after centering)
    const rect = pointElement.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Calculate the required translation to center the circle in viewport
    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;
    const targetX = viewportCenterX - centerX;
    const targetY = viewportCenterY - centerY;
    
    // Add zoom class to circle for visual feedback
    pointElement.classList.add('zooming');
    
    // Apply zoom transform to background and points
    backgroundContainer.style.transition = 'transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    interactivePoints.style.transition = 'transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    
    const zoomScale = 1.5; // Zoom level (reduced from 2 to 1.5 for gentler effect)
    const newTransform = `translate(${currentX + targetX}px, ${currentY + targetY}px) scale(${zoomScale})`;
    
    backgroundContainer.style.transform = newTransform;
    interactivePoints.style.transform = newTransform;
  
  // Start preparing 360° view early while zoom is happening
  setTimeout(() => {
    // Prepare panorama without showing it yet
    onPanoramaWindowResize();
    if (panoramaRenderer && panoramaScene && panoramaCamera) {
      panoramaRenderer.render(panoramaScene, panoramaCamera);
    }
    loadPanoramaImage(point);
    
    // Start showing panorama container (but transparent) to eliminate black screen
    panoramaContainer.style.display = 'block';
    panoramaContainer.style.opacity = '0';
    
    // Set up gradual cross-fade transitions
    panoramaContainer.style.transition = 'opacity 0.6s ease-in-out';
    backgroundContainer.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.6s ease-in-out';
    interactivePoints.style.transition = 'opacity 0.6s ease-in-out';
  }, 100); // Start prep earlier for faster zoom
  
  // Begin gradual cross-fade early in the zoom
  setTimeout(() => {
    // Start very gradual fade: panorama begins to appear, map begins to disappear
    panoramaContainer.style.opacity = '0.3';
    backgroundContainer.style.opacity = '0.7';
    interactivePoints.style.opacity = '0.7';
  }, 150); // Start fade early
  
  // Continue the cross-fade
  setTimeout(() => {
    // Mid-fade: both scenes equally visible
    panoramaContainer.style.opacity = '0.6';
    backgroundContainer.style.opacity = '0.4';
    interactivePoints.style.opacity = '0.4';
  }, 250);
  
  // Near completion of zoom
  setTimeout(() => {
    // Almost complete fade: panorama dominant, map nearly gone
    panoramaContainer.style.opacity = '0.9';
    backgroundContainer.style.opacity = '0.1';
    interactivePoints.style.opacity = '0.1';
  }, 350);
  
  // Complete the cross-fade after zoom finishes
  setTimeout(() => {
    // Final fade: panorama fully visible, map completely gone
    panoramaContainer.style.opacity = '1';
    backgroundContainer.style.opacity = '0';
    interactivePoints.style.opacity = '0';
  }, 400); // Complete at end of zoom
  
  // After cross-fade completes, finalize the view switch
  setTimeout(() => {
    // Remove zoom class
    pointElement.classList.remove('zooming');
    
    // Complete the switch (map is already invisible)
    isMapView = false;
    document.body.classList.add('panorama-view'); // Hide connection lines
    backgroundContainer.style.display = 'none';
    interactivePoints.style.display = 'none';
    
    // Disable dimming overlay and spotlight when entering 360° view
    const dimmingOverlay = document.getElementById('dimmingOverlay');
    if (dimmingOverlay && dimmingOverlay.classList.contains('active')) {
      dimmingOverlay.classList.remove('active');
      dimmingOverlay.style.mask = '';
      dimmingOverlay.style.webkitMask = '';
    }
    
    // Reset transforms for next time
    backgroundContainer.style.transform = `translate(${currentX}px, ${currentY}px)`;
    interactivePoints.style.transform = `translate(${currentX}px, ${currentY}px)`;
    
    // Show dialogue for all points (both regular and 360° views)
    setTimeout(() => {
      showDialogue(point, pointElement);
      // Add back to street view button for 360° views
      if (!isMapView) {
        showBackToStreetButton();
      }
    }, 100);
    
  }, 150); // Fast transition (reduced from 500ms)
  }, 100); // Start immediately (reduced from 650ms)
}

function showDialogue(point, pointElement) {
  currentStoryPoint = point;
  locationTitle.textContent = point.title;

  // Hide minimized tab when showing dialogue
  hideMinimizedDialogueTab();

  // Mark this point as visited
  visitedContent.add(point.title);
  
  // Remove pulse animation from this point since it's been visited
  pointElement.classList.add('visited');

  // Reset navigation history when opening new dialogue and add main state
  navigationHistory = [];
  // Add the main dialogue state to history so we can navigate back to it
  addToHistory(point, "main");

  // Reset skip-related state variables
  skipToNextSentence = false;
  hasUsedSkip = false;
  isTyping = false;
  isTypingPaused = false; // Reset pause when starting new dialogue
  pausedTypingState = null;
  console.log("showDialogue: Reset skip state variables");

  // Clear any existing typing timeout
  if (currentTypingTimeout) {
    clearTimeout(currentTypingTimeout);
    currentTypingTimeout = null;
  }

  // Update selected state
  pointElements.forEach((el) => el.classList.remove("selected"));
  pointElement.classList.add("selected");
  
  // Add dimming overlay effect when circle is selected (only in map view, not 360° view)
  const dimmingOverlay = document.getElementById('dimmingOverlay');
  if (dimmingOverlay && isMapView) {
    dimmingOverlay.classList.add('active');
    
    // Wait for map positioning to be established before starting spotlight
    setTimeout(() => {
      // Start spotlight at small size and animate it growing with the circle
      updateSpotlightPosition(pointElement, 0); // Start at 0 progress (1x scale)
      
      const animateSpotlight = () => {
        let startTime = null;
        const duration = 300; // Match growCircle animation duration
        
        function animate(currentTime) {
          if (!startTime) startTime = currentTime;
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          // Apply easing to match CSS animation (ease-out)
          const easedProgress = 1 - Math.pow(1 - progress, 3);
          
          updateSpotlightPosition(pointElement, easedProgress);
          
          if (progress < 1) {
            requestAnimationFrame(animate);
          }
        }
        
        requestAnimationFrame(animate);
      };
      
      // Start spotlight animation after positioning is established
      animateSpotlight();
    }, 50); // Small delay to let map positioning settle
    
    // Also update on window resize or scroll to keep spotlight attached
    const resizeHandler = () => {
      setTimeout(updateSpotlight, 50); // Small delay to ensure DOM updates
    };
    window.addEventListener('resize', resizeHandler);
    window.addEventListener('scroll', resizeHandler);
    
    // Update spotlight on orientation change (mobile)
    const orientationHandler = () => {
      setTimeout(updateSpotlight, 300); // Longer delay for orientation change
    };
    window.addEventListener('orientationchange', orientationHandler);
    
    // Store handlers for cleanup
    dimmingOverlay._resizeHandler = resizeHandler;
    dimmingOverlay._orientationHandler = orientationHandler;
  }

  // Center the selected point on screen
  centerPointOnScreen(pointElement);

  // Position speech bubble line to connect to selected circle
  positionSpeechBubbleLine(pointElement);

  // Show main text
  showMainText(point);
}

function centerPointOnScreen(pointElement) {
  // Different approach - calculate target position directly
  const isMobile = window.innerWidth <= 480;
  
  // Get point's current position relative to its container
  const pointRect = pointElement.getBoundingClientRect();
  const containerRect = interactivePoints.getBoundingClientRect();
  
  // Calculate where we want the point to be on screen
  const targetScreenX = window.innerWidth / 2;
  const targetScreenY = isMobile ? window.innerHeight / 3 : window.innerHeight / 2;
  
  // Current point center relative to its container
  const pointCenterX = pointRect.left + pointRect.width / 2 - containerRect.left;
  const pointCenterY = pointRect.top + pointRect.height / 2 - containerRect.top;
  
  // Calculate the container's current screen position
  const containerCurrentX = containerRect.left;
  const containerCurrentY = containerRect.top;
  
  // Calculate where the container needs to be to put the point at target position
  const newContainerX = targetScreenX - pointCenterX;
  const newContainerY = targetScreenY - pointCenterY;
  
  // Calculate the offset needed
  const offsetX = newContainerX - containerCurrentX;
  const offsetY = newContainerY - containerCurrentY;
  
  // Apply the offset to current position
  currentX += offsetX;
  currentY += offsetY;

  // More generous bounds for mobile
  const maxX = isMobile ? window.innerWidth * 0.4 : window.innerWidth * 0.15;
  const maxY = isMobile ? window.innerHeight * 0.4 : window.innerHeight * 0.15;
  currentX = Math.max(-maxX, Math.min(maxX, currentX));
  currentY = Math.max(-maxY, Math.min(maxY, currentY));

  // Add smooth transition for camera movement
  backgroundContainer.style.transition = "transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
  interactivePoints.style.transition = "transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)";

  updateBackgroundPosition();

  // Remove transition after animation completes
  setTimeout(() => {
    backgroundContainer.style.transition = "transform 0.15s ease-out";
    interactivePoints.style.transition = "transform 0.15s ease-out";
  }, 600);
}

function showMainText(point) {
  // Reset skip state variables for new main text
  skipToNextSentence = false;
  hasUsedSkip = false;
  isTyping = false;
  console.log("showMainText: Reset skip state variables");

  // Clear any existing typing timeout
  if (currentTypingTimeout) {
    clearTimeout(currentTypingTimeout);
    currentTypingTimeout = null;
  }

  // Clear container and any existing timeouts
  dialogueTextContainer.innerHTML = "";

  // Create dialogue entry
  const dialogueEntry = document.createElement("div");
  dialogueEntry.className = "dialogue-entry";

  const speaker = document.createElement("div");
  speaker.className = "dialogue-speaker";
  speaker.textContent = point.mainText.speaker;
  dialogueEntry.appendChild(speaker);

  // Create text container for letter-by-letter animation
  const text = document.createElement("div");
  text.className = "section-text";
  dialogueEntry.appendChild(text);

  // Add container first
  dialogueTextContainer.appendChild(dialogueEntry);

  // Animate text typing letter by letter with inline link parsing
  typeWriterWithLinks(text, point.mainText.text, 0, point, () => {
    addBackButton(text, point, "main");
  });

  dialoguePanel.classList.add("visible");
  dialogueTextContainer.scrollTop = 0;
}

function showSection(point, optionKey) {
  // Find the option with the matching key
  console.log('showSection called with:', optionKey, 'point:', point.title);
  console.log('Available options:', point.options.map(opt => opt.key));
  const option = point.options.find((opt) => opt.key === optionKey);
  if (!option || !option.content) {
    console.log('Option not found or no content:', option);
    return;
  }
  console.log('Found option:', option);

  // Add current state to history before navigating
  addToHistory(point, optionKey);

  // Reset skip state variables for new section
  skipToNextSentence = false;
  hasUsedSkip = false;
  isTyping = false;
  console.log("showSection: Reset skip state variables");

  // Clear any existing typing timeout
  if (currentTypingTimeout) {
    clearTimeout(currentTypingTimeout);
    currentTypingTimeout = null;
  }

  // Clear container and any existing timeouts
  dialogueTextContainer.innerHTML = "";

  // Create dialogue entry
  const dialogueEntry = document.createElement("div");
  dialogueEntry.className = "dialogue-entry";

  const speaker = document.createElement("div");
  speaker.className = "dialogue-speaker";
  speaker.textContent = option.content.speaker;
  dialogueEntry.appendChild(speaker);

  // Create text container for letter-by-letter animation
  const text = document.createElement("div");
  text.className = "section-text";
  dialogueEntry.appendChild(text);

  // Add container first
  dialogueTextContainer.appendChild(dialogueEntry);

  // Animate text typing letter by letter with inline link parsing
  typeWriterWithLinks(text, option.content.text, 0, point, () => {
    addBackButton(text, point, optionKey);
  });

  dialoguePanel.classList.add("visible");
  dialogueTextContainer.scrollTop = 0;
  
  // Mark interactive text link as visited (since user has clicked and engaged with it)
  // This is done after content creation so visited class is applied to newly created elements
  markInteractiveTextAsVisited(optionKey);
}

function addToHistory(point, optionKey) {
  navigationHistory.push({ point, optionKey });
}

function addBackButton(textContainer, point, currentKey) {
  if (navigationHistory.length > 1) {
    // Can go back to previous section (need at least main + current)
    const backButton = createBackButton(() => goBack());
    textContainer.appendChild(backButton);
  }
  // Note: Removed the fallback case since we always want to use goBack() when there's history
}

function createBackButton(clickHandler) {
  const backButton = document.createElement("span");
  backButton.className = "back-button";
  backButton.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" style="cursor: pointer; margin-right: 6px;">
      <path d="M8 1l-1.5 1.5L11 7H1v2h10l-4.5 4.5L8 15l7-7z" transform="rotate(180 8 8)"/>
    </svg>
    Back
  `;
  backButton.style.cursor = "pointer";
  backButton.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent the skip system from interfering
    clickHandler();
  });
  return backButton;
}

function goBack() {
  if (navigationHistory.length <= 1) return; // Need at least 2 items (main + current)

  // Remove current state from history
  navigationHistory.pop();
  
  // Get the previous state (what we want to go back to)
  const previousState = navigationHistory[navigationHistory.length - 1];
  
  if (previousState.optionKey === "main") {
    // Going back to main dialogue - clear and rebuild text without adding to history again
    // Reset skip state variables for new main text
    skipToNextSentence = false;
    hasUsedSkip = false;
    isTyping = false;

    // Clear any existing typing timeout
    if (currentTypingTimeout) {
      clearTimeout(currentTypingTimeout);
      currentTypingTimeout = null;
    }

    // Clear container and any existing timeouts
    dialogueTextContainer.innerHTML = "";

    // Create dialogue entry
    const dialogueEntry = document.createElement("div");
    dialogueEntry.className = "dialogue-entry";

    const speaker = document.createElement("div");
    speaker.className = "dialogue-speaker";
    speaker.textContent = previousState.point.mainText.speaker;
    dialogueEntry.appendChild(speaker);

    // Create text container for letter-by-letter animation
    const text = document.createElement("div");
    text.className = "section-text";
    dialogueEntry.appendChild(text);

    // Add container first
    dialogueTextContainer.appendChild(dialogueEntry);

    // Animate text typing letter by letter with inline link parsing
    typeWriterWithLinks(text, previousState.point.mainText.text, 0, previousState.point, () => {
      addBackButton(text, previousState.point, "main");
    });

    dialoguePanel.classList.add("visible");
    dialogueTextContainer.scrollTop = 0;
  } else {
    // Going back to previous sub-dialogue - rebuild without adding to history
    const option = previousState.point.options.find((opt) => opt.key === previousState.optionKey);
    if (!option || !option.content) return;

    // Reset skip state variables for new section
    skipToNextSentence = false;
    hasUsedSkip = false;
    isTyping = false;

    // Clear any existing typing timeout
    if (currentTypingTimeout) {
      clearTimeout(currentTypingTimeout);
      currentTypingTimeout = null;
    }

    // Clear container and any existing timeouts
    dialogueTextContainer.innerHTML = "";

    // Create dialogue entry
    const dialogueEntry = document.createElement("div");
    dialogueEntry.className = "dialogue-entry";

    const speaker = document.createElement("div");
    speaker.className = "dialogue-speaker";
    speaker.textContent = option.content.speaker;
    dialogueEntry.appendChild(speaker);

    // Create text container for letter-by-letter animation
    const text = document.createElement("div");
    text.className = "section-text";
    dialogueEntry.appendChild(text);

    // Add container first
    dialogueTextContainer.appendChild(dialogueEntry);

    // Animate text typing letter by letter with inline link parsing
    typeWriterWithLinks(text, option.content.text, 0, previousState.point, () => {
      addBackButton(text, previousState.point, previousState.optionKey);
    });

    dialoguePanel.classList.add("visible");
    dialogueTextContainer.scrollTop = 0;
  }
}

function parseTextWithLinksAndStyling(text, point) {
  // Parse text for inline links and styling
  // Links: [link text](key) or [link text](close)
  // Styling: *bold*
  // Line breaks: \\n or <br>
  const parts = [];
  let currentText = text;
  let currentIndex = 0;

  // First convert line break markers to actual line breaks
  text = text.replace(/\\n|<br>/g, '\n');

  // Combined regex to match all formatting types including line breaks
  const formatRegex = /(\[([^\]]+)\]\(([^)]+)\))|(\*([^*]+)\*)|\n/g;
  let match;

  while ((match = formatRegex.exec(text)) !== null) {
    // Add text before this match
    if (match.index > currentIndex) {
      parts.push({
        type: "text",
        content: text.substring(currentIndex, match.index),
      });
    }

    if (match[1]) {
      // Link: [text](target)
      parts.push({
        type: "link",
        content: match[2],
        target: match[3],
      });
    } else if (match[4]) {
      // Bold: *text*
      parts.push({
        type: "styled",
        content: match[5],
        styleClass: "text-bold",
      });
    } else if (match[0] === '\n') {
      // Line break
      parts.push({
        type: "linebreak",
      });
    }

    currentIndex = match.index + match[0].length;
  }

  // Add remaining text after last match
  if (currentIndex < text.length) {
    parts.push({
      type: "text",
      content: text.substring(currentIndex),
    });
  }

  // If no matches found, treat as plain text
  if (parts.length === 0) {
    parts.push({
      type: "text",
      content: text,
    });
  }

  return parts;
}

function typeWriterWithLinks(element, text, charIndex, point, onComplete) {
  const textParts = parseTextWithLinksAndStyling(text, point);

  if (textSpeed === 0) {
    // FAST mode: show all text instantly
    renderParsedText(element, textParts, point);
    isTyping = false;
    dialogueTextContainer.classList.remove("typing");
    if (onComplete) onComplete();
    return;
  }

  // For typewriter effect, we'll type out each part
  isTyping = true;
  skipToNextSentence = false;
  console.log(
    "Starting typewriter - isTyping set to true, hasUsedSkip:",
    hasUsedSkip,
  );
  
  // Reset pause state when starting fresh animation
  isTypingPaused = false;
  pausedTypingState = null;
  
  dialogueTextContainer.classList.add("typing");
  typeWriterParts(element, textParts, 0, 0, point, onComplete);
}

function typeWriterParts(
  element,
  parts,
  partIndex,
  charIndex,
  point,
  onComplete,
) {
  // Save state for potential pausing
  pausedTypingState = {
    element,
    parts,
    partIndex,
    charIndex,
    point,
    onComplete
  };
  
  if (partIndex >= parts.length) {
    console.log("Typewriter completed - setting isTyping to false");
    isTyping = false;
    dialogueTextContainer.classList.remove("typing");
    if (onComplete) onComplete();
    return;
  }

  const currentPart = parts[partIndex];

  if (currentPart.type === "text") {
    // Check if we should skip to next sentence
    if (skipToNextSentence) {
      console.log("Processing skip to next sentence");
      // Find the next sentence end in current part
      const remainingText = currentPart.content.substring(charIndex);
      const sentenceEnd = remainingText.search(/[.!?]\s+/);

      if (sentenceEnd !== -1) {
        // Complete current sentence
        const completeToIndex = charIndex + sentenceEnd + 2; // Include punctuation and space
        const textToAdd = currentPart.content.substring(
          charIndex,
          completeToIndex,
        );
        element.appendChild(document.createTextNode(textToAdd));

        skipToNextSentence = false; // Reset skip flag
        console.log("Skipped to end of sentence, continuing...");

        // Continue from next sentence
        setTimeout(
          () =>
            typeWriterParts(
              element,
              parts,
              partIndex,
              completeToIndex,
              point,
              onComplete,
            ),
          textSpeed,
        );
        return;
      } else {
        // No sentence end found, complete this part
        const textToAdd = currentPart.content.substring(charIndex);
        element.appendChild(document.createTextNode(textToAdd));
        skipToNextSentence = false;
        console.log("No sentence end found, completed entire part");
        typeWriterParts(element, parts, partIndex + 1, 0, point, onComplete);
        return;
      }
    }

    // Type out regular text character by character
    if (charIndex < currentPart.content.length) {
      element.appendChild(
        document.createTextNode(currentPart.content.charAt(charIndex)),
      );
      currentTypingTimeout = setTimeout(
        () =>
          typeWriterParts(
            element,
            parts,
            partIndex,
            charIndex + 1,
            point,
            onComplete,
          ),
        textSpeed,
      );
    } else {
      // Move to next part
      typeWriterParts(element, parts, partIndex + 1, 0, point, onComplete);
    }
  } else if (currentPart.type === "link") {
    // Create clickable link element instantly
    const linkSpan = document.createElement("span");
    linkSpan.className = "interactive-text";
    linkSpan.textContent = currentPart.content;
    
    // Check if this link has been visited before and apply visited class
    if (visitedInteractiveLinks.has(currentPart.target)) {
      linkSpan.classList.add('visited');
    }

    // Add click handler based on target
    if (currentPart.target === "close") {
      linkSpan.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        hideDialogue();
      });
    } else {
      // Target is now a key, not a section number
      linkSpan.dataset.targetKey = currentPart.target; // Store the target key for later reference
      linkSpan.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Interactive text clicked:', currentPart.target);
        showSection(point, currentPart.target);
      });
    }

    element.appendChild(linkSpan);
    // Move to next part immediately
    typeWriterParts(element, parts, partIndex + 1, 0, point, onComplete);
  } else if (currentPart.type === "styled") {
    // Create styled text element instantly
    const styledSpan = document.createElement("span");
    styledSpan.className = currentPart.styleClass;
    styledSpan.textContent = currentPart.content;

    element.appendChild(styledSpan);
    // Move to next part immediately
    typeWriterParts(element, parts, partIndex + 1, 0, point, onComplete);
  } else if (currentPart.type === "linebreak") {
    // Create line break element instantly
    element.appendChild(document.createElement("br"));
    // Move to next part immediately
    typeWriterParts(element, parts, partIndex + 1, 0, point, onComplete);
  }
}

function renderParsedText(element, parts, point) {
  parts.forEach((part) => {
    if (part.type === "text") {
      element.appendChild(document.createTextNode(part.content));
    } else if (part.type === "link") {
      const linkSpan = document.createElement("span");
      linkSpan.className = "interactive-text";
      linkSpan.textContent = part.content;
      
      // Check if this link has been visited before and apply visited class
      if (visitedInteractiveLinks.has(part.target)) {
        linkSpan.classList.add('visited');
      }

      // Add click handler based on target
      if (part.target === "close") {
        linkSpan.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          hideDialogue();
        });
      } else {
        // Target is now a key, not a section number
        linkSpan.dataset.targetKey = part.target; // Store the target key for later reference
        linkSpan.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('Interactive text clicked (fast mode):', part.target);
          showSection(point, part.target);
        });
      }

      element.appendChild(linkSpan);
    } else if (part.type === "styled") {
      const styledSpan = document.createElement("span");
      styledSpan.className = part.styleClass;
      styledSpan.textContent = part.content;
      element.appendChild(styledSpan);
    } else if (part.type === "linebreak") {
      element.appendChild(document.createElement("br"));
    }
  });
}

function hideDialogue() {
  dialoguePanel.classList.remove("visible");
  
  // Pause typing animation if currently active
  if (isTyping) {
    isTypingPaused = true;
    console.log('Pausing typing animation and clearing timeouts');
    
    // Clear current timeout to truly pause
    if (currentTypingTimeout) {
      clearTimeout(currentTypingTimeout);
      currentTypingTimeout = null;
    }
  }
  
  // In 360° views, show a minimized tab when dialogue is closed
  if (!isMapView) {
    showMinimizedDialogueTab();
  }
  
  // Animate spotlight scaling down with circle deselection
  const selectedPoint = document.querySelector('.point.selected');
  const dimmingOverlay = document.getElementById('dimmingOverlay');
  
  if (selectedPoint && dimmingOverlay && dimmingOverlay.classList.contains('active')) {
    // Animate spotlight scaling down during deselection
    const animateSpotlightDown = () => {
      let startTime = null;
      const duration = 300; // Match shrinkCircle animation duration
      
      function animate(currentTime) {
        if (!startTime) startTime = currentTime;
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Apply easing to match CSS animation (ease-out) and reverse the scale
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        const reverseProgress = 1 - easedProgress; // 1 -> 0 over time
        
        updateSpotlightPosition(selectedPoint, reverseProgress);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // Remove spotlight after animation completes
          dimmingOverlay.classList.remove('active');
          dimmingOverlay.style.mask = '';
          dimmingOverlay.style.webkitMask = '';
        }
      }
      
      requestAnimationFrame(animate);
    };
    
    animateSpotlightDown();
  } else if (dimmingOverlay) {
    // No animation needed, just remove immediately
    dimmingOverlay.classList.remove('active');
    dimmingOverlay.style.mask = '';
    dimmingOverlay.style.webkitMask = '';
  }
  
  // Clean up event listeners
  if (dimmingOverlay && dimmingOverlay._resizeHandler) {
    window.removeEventListener('resize', dimmingOverlay._resizeHandler);
    window.removeEventListener('scroll', dimmingOverlay._resizeHandler);
    window.removeEventListener('orientationchange', dimmingOverlay._orientationHandler);
    dimmingOverlay._resizeHandler = null;
  }
  
  // Animate de-selection of circles
  pointElements.forEach((el) => {
    if (el.classList.contains("selected")) {
      el.classList.remove("selected");
      el.classList.add("deselecting");
      
      // Remove deselecting class after animation completes
      setTimeout(() => {
        el.classList.remove("deselecting");
      }, 300);
    }
  });
  
  // Reset current story point
  currentStoryPoint = null;

  // Reset all typing and skip state variables
  isTyping = false;
  skipToNextSentence = false;
  hasUsedSkip = false;
  dialogueTextContainer.classList.remove("typing");

  if (currentTypingTimeout) {
    clearTimeout(currentTypingTimeout);
    currentTypingTimeout = null;
  }
  
  // Reset panorama points when dialogue is hidden
  if (panoramaPoints) {
    document.querySelectorAll('.panorama-point').forEach(p => {
      if (p.classList.contains('selected')) {
        p.classList.remove('selected');
        p.classList.add('deselecting');
        // Remove deselecting class after animation
        setTimeout(() => {
          p.classList.remove('deselecting');
        }, 300);
      }
    });
  }
}

// Show minimized dialogue tab in 360° views
function showMinimizedDialogueTab() {
  // Remove any existing tab first
  hideMinimizedDialogueTab();
  
  // Create the minimized tab element
  const minimizedTab = document.createElement('div');
  minimizedTab.id = 'minimizedDialogueTab';
  minimizedTab.className = 'minimized-dialogue-tab';
  
  // Get the current story point title for the tab
  const tabTitle = currentStoryPoint ? currentStoryPoint.title : 'Info';
  minimizedTab.textContent = tabTitle;
  
  // Add click handler to reopen dialogue
  minimizedTab.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Hide the tab immediately when clicked so it gets out of the way
    hideMinimizedDialogueTab();
    
    // Then show the dialogue with a small delay to ensure smooth transition
    setTimeout(() => {
      // Simply restore dialogue panel visibility
      dialoguePanel.classList.add('visible');
      
      // Resume typing animation if it was paused
      if (isTypingPaused && pausedTypingState) {
        isTypingPaused = false;
        console.log('Resuming typing animation from saved state');
        
        // Restore typing state and features
        isTyping = true;
        dialogueTextContainer.classList.add("typing");
        
        // Resume from where we left off
        const state = pausedTypingState;
        typeWriterParts(
          state.element,
          state.parts,
          state.partIndex,
          state.charIndex,
          state.point,
          state.onComplete
        );
      } else if (currentStoryPoint) {
        // Start fresh dialogue animation if no animation was paused
        const pointElement = document.querySelector('.point.selected') || null;
        showDialogue(currentStoryPoint, pointElement);
      }
    }, 50);
  });
  
  // Add hover listeners for edge scrolling control
  minimizedTab.addEventListener("mouseenter", () => {
    isHoveringDialogue = true;
  });
  minimizedTab.addEventListener("mouseleave", () => {
    isHoveringDialogue = false;
  });
  
  // Add to the panorama container
  document.body.appendChild(minimizedTab);
  
  // Trigger show animation after a brief delay
  setTimeout(() => {
    minimizedTab.classList.add('show');
  }, 50);
}

// Hide minimized dialogue tab
function hideMinimizedDialogueTab() {
  const existingTab = document.getElementById('minimizedDialogueTab');
  if (existingTab) {
    // Animate out first
    existingTab.classList.remove('show');
    // Remove after animation completes
    setTimeout(() => {
      if (existingTab.parentNode) {
        existingTab.remove();
      }
    }, 500);
  }
}

// Reopen dialogue from minimized state
function reopenDialogue() {
  // This function is now handled directly in the tab click handler
  // Keeping for backwards compatibility if called elsewhere
  console.log('reopenDialogue called - functionality moved to tab click handler');
}

// Show back to street view button for 360° views
function showBackToStreetButton() {
  // Remove any existing button first
  hideBackToStreetButton();
  
  // Create the back to street button
  const backButton = document.createElement('div');
  backButton.id = 'backToStreetButton';
  backButton.className = 'back-to-street-button';
  backButton.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1l-1.5 1.5L11 7H1v2h10l-4.5 4.5L8 15l7-7z" transform="rotate(180 8 8)"/>
    </svg>
    Back to Street View
  `;
  
  // Add click handler to return to street view
  backButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    returnToStreetView();
  });
  
  // Add hover listeners for edge scrolling control
  backButton.addEventListener("mouseenter", () => {
    isHoveringCircle = true;
    stopEdgeScrolling();
  });
  backButton.addEventListener("mouseleave", () => {
    isHoveringCircle = false;
  });
  
  // Add to body
  document.body.appendChild(backButton);
}

// Hide back to street view button
function hideBackToStreetButton() {
  const existingButton = document.getElementById('backToStreetButton');
  if (existingButton) {
    existingButton.remove();
  }
}

function positionSpeechBubbleLine(pointElement) {
  const pointRect = pointElement.getBoundingClientRect();
  const dialogueRect = dialoguePanel.getBoundingClientRect();
  
  // Calculate the center of the circle using visual center
  const circleCenterX = pointRect.left + pointRect.width / 2;
  const circleCenterY = pointRect.top + pointRect.height / 2;
  
  // Calculate actual radius based on current circle scale
  const isSelected = pointElement.classList.contains('selected');
  const baseCircleSize = 130;
  const scale = isSelected ? 4 : 1; // Selected circles scale to 4x
  const actualRadius = (baseCircleSize / 2) * scale;
  
  // Calculate the connection point on the dialogue panel (left edge center)
  const panelX = dialogueRect.left;
  const panelY = dialogueRect.top + dialogueRect.height / 2;
  
  // Calculate angle from circle center to panel
  const deltaX = panelX - circleCenterX;
  const deltaY = panelY - circleCenterY;
  const angle = Math.atan2(deltaY, deltaX);
  
  // Calculate the point on the circle rim using actual scaled radius
  const circleX = circleCenterX + Math.cos(angle) * actualRadius;
  const circleY = circleCenterY + Math.sin(angle) * actualRadius;
  
  // Calculate distance and angle for the line
  const finalDeltaX = panelX - circleX;
  const finalDeltaY = panelY - circleY;
  const distance = Math.sqrt(finalDeltaX * finalDeltaX + finalDeltaY * finalDeltaY);
  const lineAngle = Math.atan2(finalDeltaY, finalDeltaX) * (180 / Math.PI);
  
  // Update the speech bubble line
  const line = dialoguePanel;
  line.style.setProperty('--line-length', `${distance}px`);
  line.style.setProperty('--line-angle', `${lineAngle}deg`);
  line.style.setProperty('--line-top', `${circleY - dialogueRect.top}px`);
}

function resetMapPosition() {
  // Reset map to default position with smooth animation
  currentX = 0;
  currentY = 0;
  
  // Add smooth transition for camera movement
  backgroundContainer.style.transition = "transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
  interactivePoints.style.transition = "transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
  
  updateBackgroundPosition();
  
  // Remove transition after animation completes
  setTimeout(() => {
    backgroundContainer.style.transition = "transform 0.15s ease-out";
    interactivePoints.style.transition = "transform 0.15s ease-out";
  }, 600);
}

function setupDialogueSkipListener() {
  // Add click handler to dialogue text container for skip functionality
  dialogueTextContainer.addEventListener("click", (e) => {
    console.log(
      "Skip click detected - isTyping:",
      isTyping,
      "target:",
      e.target,
      "hasInteractiveClass:",
      e.target.classList.contains("interactive-text"),
    );

    // Only skip if we're typing and not clicking on interactive text or back button
    if (isTyping && !e.target.classList.contains("interactive-text") && !e.target.closest(".back-button")) {
      console.log("Executing skip to next sentence");

      // Play gentle click sound
      playSkipSound();

      skipToNextSentence = true;
      hasUsedSkip = true;
      dialogueTextContainer.classList.remove("typing");
    } else {
      console.log(
        "Skip blocked - isTyping:",
        isTyping,
        "isInteractive:",
        e.target.classList.contains("interactive-text"),
      );
    }
  });
}

function playSkipSound() {
  // Create a gentle click sound using Web Audio API
  if (
    typeof AudioContext !== "undefined" ||
    typeof webkitAudioContext !== "undefined"
  ) {
    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();

    // Create a gentle, leafy click sound
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Gentle, high-pitched click with quick decay
    oscillator.frequency.setValueAtTime(1200, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      800,
      audioContext.currentTime + 0.1,
    );

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + 0.15,
    );

    oscillator.type = "sine";
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.15);
  }
}

function playPageTurnSound() {
  // Create a page turn sound using Web Audio API
  if (
    typeof AudioContext !== "undefined" ||
    typeof webkitAudioContext !== "undefined"
  ) {
    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();

    // Create a gentle page turn sound with multiple frequencies
    const oscillator1 = audioContext.createOscillator();
    const oscillator2 = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const filterNode = audioContext.createBiquadFilter();

    oscillator1.connect(filterNode);
    oscillator2.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Set up filter for paper-like texture
    filterNode.type = "highpass";
    filterNode.frequency.setValueAtTime(200, audioContext.currentTime);

    // Two frequencies for a rustling paper sound
    oscillator1.frequency.setValueAtTime(150, audioContext.currentTime);
    oscillator1.frequency.exponentialRampToValueAtTime(
      80,
      audioContext.currentTime + 0.2,
    );
    
    oscillator2.frequency.setValueAtTime(300, audioContext.currentTime);
    oscillator2.frequency.exponentialRampToValueAtTime(
      200,
      audioContext.currentTime + 0.15,
    );

    gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + 0.25,
    );

    oscillator1.type = "sawtooth";
    oscillator2.type = "triangle";
    
    oscillator1.start(audioContext.currentTime);
    oscillator2.start(audioContext.currentTime);
    oscillator1.stop(audioContext.currentTime + 0.25);
    oscillator2.stop(audioContext.currentTime + 0.2);
  }
}

function playLightSwitchSound() {
  // Create a light switch sound using Web Audio API
  if (
    typeof AudioContext !== "undefined" ||
    typeof webkitAudioContext !== "undefined"
  ) {
    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();

    // Create a sharp click sound like a light switch
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const filterNode = audioContext.createBiquadFilter();

    oscillator.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Set up filter for sharp click
    filterNode.type = "bandpass";
    filterNode.frequency.setValueAtTime(2000, audioContext.currentTime);
    filterNode.Q.setValueAtTime(10, audioContext.currentTime);

    // Sharp, brief frequency for switch sound
    oscillator.frequency.setValueAtTime(2500, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      1500,
      audioContext.currentTime + 0.05,
    );

    gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + 0.08,
    );

    oscillator.type = "square";
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.08);
  }
}

function showWelcomeMessage() {
  currentStoryPoint = null; // Ensure intro popup can be auto-closed

  // Parse and render the welcome message with inline links
  const welcomeTextElement = document.querySelector(
    ".dialogue-text-container .section-text:last-child",
  );
  if (welcomeTextElement) {
    const welcomeText = welcomeTextElement.textContent;
    welcomeTextElement.innerHTML = ""; // Clear existing content

    // Create a fake point object for parsing
    const fakePoint = { options: [] };
    renderParsedText(
      welcomeTextElement,
      parseTextWithLinksAndStyling(welcomeText, fakePoint),
      fakePoint,
      0,
    );
  }

  setTimeout(() => dialoguePanel.classList.add("visible"), 300);
}


// Update speech bubble line position on window resize
window.addEventListener('resize', () => {
  if (dialoguePanel.classList.contains('visible') && currentStoryPoint) {
    const selectedPoint = document.querySelector('.point.selected');
    if (selectedPoint) {
      setTimeout(() => positionSpeechBubbleLine(selectedPoint), 100);
    }
  }
});

// Optimize texture setup for performance
function setupTexture(texture) {
  const isMobile = window.innerWidth <= 768;
  
  // Optimize texture filtering for performance
  texture.minFilter = isMobile ? THREE.LinearFilter : THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.flipY = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = !isMobile;
  
  return texture;
}

// Progressive image loading for better performance
function loadImageProgressively(imagePath, onLoad, onProgress, onError) {
  const img = new Image();
  
  // Add progressive JPEG hint for browsers that support it
  img.decoding = 'async';
  
  img.onload = () => {
    if (onLoad) onLoad(img);
  };
  
  img.onprogress = (event) => {
    if (onProgress && event.lengthComputable) {
      const progress = (event.loaded / event.total) * 100;
      onProgress(progress);
    }
  };
  
  img.onerror = (error) => {
    console.warn(`Failed to load image: ${imagePath}`, error);
    if (onError) onError(error);
  };
  
  img.src = imagePath;
  return img;
}

// Initialize 360° panorama view
function initializePanorama() {
  try {
    console.log('Initializing panorama...');
    
    // Create scene
    panoramaScene = new THREE.Scene();
    
    // Create camera
    panoramaCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    // Create renderer
    // Optimize renderer for mobile performance
    const isMobile = window.innerWidth <= 768;
    panoramaRenderer = new THREE.WebGLRenderer({ 
      canvas: panoramaCanvas, 
      antialias: !isMobile, // Disable antialiasing on mobile for better performance
      alpha: false,
      powerPreference: isMobile ? "low-power" : "high-performance"
    });
    panoramaRenderer.setSize(window.innerWidth, window.innerHeight);
    panoramaRenderer.setClearColor(0x000000);
    
    // Mobile-specific optimizations
    if (isMobile) {
      panoramaRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    } else {
      panoramaRenderer.setPixelRatio(window.devicePixelRatio);
    }
    
    // Create sphere geometry for 360° photo - adaptive quality based on device
    const sphereSegments = isMobile ? 32 : 60; // Reduce geometry complexity on mobile
    const sphereRings = isMobile ? 20 : 40;
    const geometry = new THREE.SphereGeometry(500, sphereSegments, sphereRings);
    
    // Fix UV mapping for correct orientation - flip both U and V
    const uvs = geometry.attributes.uv.array;
    for (let i = 0; i < uvs.length; i += 2) {
      uvs[i] = 1 - uvs[i]; // Flip U coordinate
      uvs[i + 1] = 1 - uvs[i + 1]; // Flip V coordinate
    }
    geometry.attributes.uv.needsUpdate = true;
    
    // Load texture with error handling
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load(
      'assets/images/360-energy.jpg',
      function (texture) {
        console.log('360-energy.jpg loaded successfully');
        // Optimize texture filtering for performance
        texture.minFilter = isMobile ? THREE.LinearFilter : THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.flipY = false; // Don't flip - we'll handle it with UV mapping
        texture.wrapS = THREE.ClampToEdgeWrapping; // More efficient than repeat
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.generateMipmaps = !isMobile; // Skip mipmaps on mobile
        
        // Update the material with the loaded texture
        if (panoramaSphere && panoramaSphere.material) {
          panoramaSphere.material.map = texture;
          panoramaSphere.material.color.setHex(0xffffff); // Remove blue tint
          panoramaSphere.material.needsUpdate = true;
          console.log('Texture applied to sphere material');
        } else {
          console.error('Panorama sphere or material not found');
        }
      },
      function (progress) {
        console.log('Loading progress:', progress);
      },
      function (error) {
        console.error('Error loading 360-energy.jpg:', error);
      }
    );
    
    // Create material for day sphere
    const materialDay = new THREE.MeshLambertMaterial({ 
      color: 0x0066cc, // Blue color as temporary placeholder
      side: THREE.BackSide, // Inside-out sphere
      transparent: true,
      opacity: 1
    });
    
    // Create material for night sphere
    const materialNight = new THREE.MeshLambertMaterial({ 
      color: 0x0066cc, // Blue color as temporary placeholder
      side: THREE.BackSide, // Inside-out sphere
      transparent: true,
      opacity: 0
    });
    
    // Create sphere meshes for day and night
    panoramaSphere = new THREE.Mesh(geometry, materialDay);
    panoramaSphereNight = new THREE.Mesh(geometry.clone(), materialNight);
    panoramaScene.add(panoramaSphere);
    panoramaScene.add(panoramaSphereNight);
    
    // Add ambient lighting
    const initialLightIntensity = 1.2;
    panoramaAmbientLight = new THREE.AmbientLight(0xffffff, initialLightIntensity);
    panoramaScene.add(panoramaAmbientLight);
    
    // Set initial camera position
    panoramaCamera.position.set(0, 0, 0.1);
    panoramaCamera.lookAt(0, 0, -1);
    
    // Handle window resize
    window.addEventListener('resize', onPanoramaWindowResize, false);
    
    // Setup panorama controls
    setupPanoramaControls();
    
    // Initialize raycaster for click detection
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    
    console.log('Panorama initialized successfully');
  } catch (error) {
    console.error('Error initializing panorama:', error);
  }
}


// Load different 360° image for each location
function loadPanoramaImage(point) {
  if (!panoramaSphere || !panoramaSphere.material) return;
  
  console.log('loadPanoramaImage called for:', point.title);
  
  // Use the working Food loading method for all 360° scenes
  loadPanoramaImages(point);
}

// Load both day and night textures for all 360° scenes
function loadPanoramaImages(point) {
  let dayImagePath, nightImagePath;
  
  switch (point.title) {
    case 'Food':
      dayImagePath = 'assets/images/market-360-day.jpg';
      nightImagePath = 'assets/images/market-360-night.jpg';
      break;
    case 'Education':
      dayImagePath = 'assets/images/rooftop-day.jpg';
      nightImagePath = 'assets/images/rooftop-night.jpg';
      break;
    case 'Energy':
      dayImagePath = 'assets/images/energy-360-day.jpg';
      nightImagePath = 'assets/images/energy-360-night.jpg';
      break;
    case 'Transport':
      dayImagePath = 'assets/images/transport-day.jpg';
      nightImagePath = 'assets/images/transport-night.jpg';
      break;
    default:
      dayImagePath = 'assets/images/energy-360-day.jpg';
      nightImagePath = 'assets/images/energy-360-night.jpg';
      console.log(`No specific 360° image for ${point.title}, using energy scene`);
      break;
  }
  
  const textureLoader = new THREE.TextureLoader();
  let dayLoaded = false;
  let nightLoaded = false;
  
  console.log(`Loading ${point.title} panorama day and night images...`);
  
  // Load day texture
  textureLoader.load(
    dayImagePath,
    function (dayTexture) {
      console.log(`${point.title} day 360° image loaded`);
      setupTexture(dayTexture);
      
      // Dispose old texture
      if (panoramaSphere.material.map) {
        panoramaSphere.material.map.dispose();
      }
      
      panoramaSphere.material.map = dayTexture;
      panoramaSphere.material.color.setHex(0xffffff);
      panoramaSphere.material.needsUpdate = true;
      
      dayLoaded = true;
      if (nightLoaded) updateSceneOpacity();
    },
    undefined,
    function (error) {
      console.error(`Error loading ${point.title} day image:`, error);
    }
  );
  
  // Load night texture
  textureLoader.load(
    nightImagePath,
    function (nightTexture) {
      console.log(`${point.title} night 360° image loaded`);
      setupTexture(nightTexture);
      
      // Dispose old texture
      if (panoramaSphereNight.material.map) {
        panoramaSphereNight.material.map.dispose();
      }
      
      panoramaSphereNight.material.map = nightTexture;
      panoramaSphereNight.material.color.setHex(0xffffff);
      panoramaSphereNight.material.needsUpdate = true;
      
      nightLoaded = true;
      if (dayLoaded) updateSceneOpacity();
    },
    undefined,
    function (error) {
      console.error(`Error loading ${point.title} night image:`, error);
    }
  );
}

// Load both day and night textures for Food scenes  
function loadFoodPanoramaImages(point) {
  const textureLoader = new THREE.TextureLoader();
  let dayLoaded = false;
  let nightLoaded = false;
  
  console.log('Loading Food panorama day and night images...');
  
  // Load day texture
  textureLoader.load(
    'assets/images/market-360-day.jpg',
    function (dayTexture) {
      console.log('Food day 360° image loaded');
      setupTexture(dayTexture);
      
      // Dispose old texture
      if (panoramaSphere.material.map) {
        panoramaSphere.material.map.dispose();
      }
      
      panoramaSphere.material.map = dayTexture;
      panoramaSphere.material.color.setHex(0xffffff);
      panoramaSphere.material.needsUpdate = true;
      
      dayLoaded = true;
      if (nightLoaded) updateFoodSceneOpacity();
    },
    undefined,
    function (error) {
      console.error('Error loading Food day image:', error);
    }
  );
  
  // Load night texture
  textureLoader.load(
    'assets/images/market-360-night.jpg',
    function (nightTexture) {
      console.log('Food night 360° image loaded');
      setupTexture(nightTexture);
      
      // Dispose old texture
      if (panoramaSphereNight.material.map) {
        panoramaSphereNight.material.map.dispose();
      }
      
      panoramaSphereNight.material.map = nightTexture;
      panoramaSphereNight.material.color.setHex(0xffffff);
      panoramaSphereNight.material.needsUpdate = true;
      
      nightLoaded = true;
      if (dayLoaded) updateFoodSceneOpacity();
    },
    undefined,
    function (error) {
      console.error('Error loading Food night image:', error);
    }
  );
}

// Load day and night textures for non-Food scenes
function loadSinglePanoramaImage(point) {
  let dayImagePath, nightImagePath;
  
  switch (point.title) {
    case 'Education':
      dayImagePath = 'assets/images/rooftop-day.jpg';
      nightImagePath = 'assets/images/rooftop-night.jpg';
      break;
    case 'Energy':
      dayImagePath = 'assets/images/energy-360-day.jpg';
      nightImagePath = 'assets/images/energy-360-night.jpg';
      break;
    case 'Transport':
      dayImagePath = 'assets/images/transport-day.jpg';
      nightImagePath = 'assets/images/transport-night.jpg';
      break;
    default:
      dayImagePath = 'assets/images/energy-360-day.jpg';
      nightImagePath = 'assets/images/energy-360-night.jpg';
      console.log(`No specific 360° image for ${point.title}, using energy scene`);
      break;
  }
  
  console.log(`Loading day and night 360° images for ${point.title}...`);
  
  const textureLoader = new THREE.TextureLoader();
  
  // Load day texture
  textureLoader.load(
    dayImagePath,
    function (dayTexture) {
      console.log(`Day texture loaded successfully for ${point.title}:`, dayTexture);
      console.log('Texture dimensions:', dayTexture.image.width, 'x', dayTexture.image.height);
      
      setupTexture(dayTexture);
      
      // Dispose old day texture
      if (panoramaSphere.material.map) {
        panoramaSphere.material.map.dispose();
      }
      
      panoramaSphere.material.map = dayTexture;
      panoramaSphere.material.color.setHex(0xffffff);
      panoramaSphere.material.opacity = isHighContrast ? 0 : 1;
      panoramaSphere.material.needsUpdate = true;
      
      console.log(`Day 360° image applied to sphere for ${point.title}`);
    },
    function (progress) {
      console.log(`Loading day image for ${point.title}:`, (progress.loaded / progress.total * 100).toFixed(1) + '%');
    },
    function (error) {
      console.error(`Error loading day 360° image for ${point.title} from ${dayImagePath}:`, error);
    }
  );
  
  // Load night texture
  textureLoader.load(
    nightImagePath,
    function (nightTexture) {
      console.log(`Night texture loaded successfully for ${point.title}:`, nightTexture);
      console.log('Night texture dimensions:', nightTexture.image.width, 'x', nightTexture.image.height);
      
      setupTexture(nightTexture);
      
      // Dispose old night texture
      if (panoramaSphereNight.material.map) {
        panoramaSphereNight.material.map.dispose();
      }
      
      panoramaSphereNight.material.map = nightTexture;
      panoramaSphereNight.material.color.setHex(0xffffff);
      panoramaSphereNight.material.opacity = isHighContrast ? 1 : 0;
      panoramaSphereNight.material.needsUpdate = true;
      
      console.log(`Night 360° image applied to sphere for ${point.title}`);
    },
    function (progress) {
      console.log(`Loading night image for ${point.title}:`, (progress.loaded / progress.total * 100).toFixed(1) + '%');
    },
    function (error) {
      console.error(`Error loading night 360° image for ${point.title} from ${nightImagePath}:`, error);
    }
  );
}

// Setup common texture properties
function setupTexture(texture) {
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.flipY = false;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
}

// Update scene opacity based on day/night mode with smooth transition
function updateSceneOpacity() {
  const isNightMode = document.body.classList.contains('high-contrast');
  console.log('Updating 360° scene opacity, night mode:', isNightMode);
  
  const duration = 4000; // 4 second fade to match street scene
  const startTime = Date.now();
  
  const startDayOpacity = panoramaSphere.material.opacity;
  const startNightOpacity = panoramaSphereNight.material.opacity;
  
  const targetDayOpacity = isNightMode ? 0 : 1;
  const targetNightOpacity = isNightMode ? 1 : 0;
  
  function animateFade() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Use cubic ease-out for smooth transition
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    
    panoramaSphere.material.opacity = startDayOpacity + (targetDayOpacity - startDayOpacity) * easeProgress;
    panoramaSphereNight.material.opacity = startNightOpacity + (targetNightOpacity - startNightOpacity) * easeProgress;
    
    panoramaSphere.material.needsUpdate = true;
    panoramaSphereNight.material.needsUpdate = true;
    
    if (progress < 1) {
      requestAnimationFrame(animateFade);
    } else {
      console.log('360° day/night transition completed');
    }
  }
  
  animateFade();
}

// Update Food scene opacity based on day/night mode with smooth transition
function updateFoodSceneOpacity() {
  const isNightMode = document.body.classList.contains('high-contrast');
  console.log('Updating Food scene opacity, night mode:', isNightMode);
  
  const duration = 4000; // 4 second fade to match street scene
  const startTime = Date.now();
  
  const startDayOpacity = panoramaSphere.material.opacity;
  const startNightOpacity = panoramaSphereNight.material.opacity;
  
  const targetDayOpacity = isNightMode ? 0 : 1;
  const targetNightOpacity = isNightMode ? 1 : 0;
  
  function animateFade() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Use cubic ease-out for smooth transition
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    
    panoramaSphere.material.opacity = startDayOpacity + (targetDayOpacity - startDayOpacity) * easeProgress;
    panoramaSphereNight.material.opacity = startNightOpacity + (targetNightOpacity - startNightOpacity) * easeProgress;
    
    panoramaSphere.material.needsUpdate = true;
    panoramaSphereNight.material.needsUpdate = true;
    
    if (progress < 1) {
      requestAnimationFrame(animateFade);
    } else {
      console.log('Food 360° day/night transition completed');
    }
  }
  
  animateFade();
}

// Setup panorama mouse/touch controls
function setupPanoramaControls() {
  let onMouseDownMouseX = 0, onMouseDownMouseY = 0;
  let onMouseDownLon = 0, onMouseDownLat = 0;
  let phi = 0, theta = 0;
  
  // Function to check if mouse is in back button area
  function isMouseInBackButtonArea(clientX, clientY) {
    const canvasRect = panoramaCanvas.getBoundingClientRect();
    const relativeX = (clientX - canvasRect.left) / canvasRect.width;
    const relativeY = (clientY - canvasRect.top) / canvasRect.height;
    
    // Back button is positioned at 50% left, 20% top
    // Create a dead zone around it (roughly 150px radius in a typical view)
    const buttonCenterX = 0.5;
    const buttonCenterY = 0.2;
    const deadZoneRadius = 0.12; // 12% of canvas size as radius
    
    const distanceToButton = Math.sqrt(
      Math.pow(relativeX - buttonCenterX, 2) + 
      Math.pow(relativeY - buttonCenterY, 2)
    );
    
    return distanceToButton < deadZoneRadius;
  }
  
  function onMouseDown(event) {
    event.preventDefault();
    
    // Check if mouse is in back button area - if so, don't start dragging
    if (isMouseInBackButtonArea(event.clientX, event.clientY)) {
      return;
    }
    
    isMouseDown = true;
    hasDragged = false;
    dragStartTime = Date.now();
    panoramaCanvas.style.cursor = 'grabbing';
    
    onMouseDownMouseX = event.clientX;
    onMouseDownMouseY = event.clientY;
    dragStartPosition.x = event.clientX;
    dragStartPosition.y = event.clientY;
    onMouseDownLon = lon;
    onMouseDownLat = lat;
  }
  
  function onMouseMove(event) {
    if (isMouseDown) {
      // Check if this constitutes a drag
      const dragDistance = Math.sqrt(
        Math.pow(event.clientX - dragStartPosition.x, 2) + 
        Math.pow(event.clientY - dragStartPosition.y, 2)
      );
      
      if (dragDistance > 5) { // Threshold for distinguishing click from drag
        hasDragged = true;
      }
      
      // Handle dragging (increased sensitivity for faster movement)
      lon = (onMouseDownMouseX - event.clientX) * 0.18 + onMouseDownLon;
      lat = (event.clientY - onMouseDownMouseY) * 0.18 + onMouseDownLat;
      
      // Limit vertical rotation
      lat = Math.max(-85, Math.min(85, lat));
      
      // Update panorama point positions when camera moves
      updatePanoramaPointPositions();
    }
  }
  
  function onMouseUp() {
    isMouseDown = false;
    panoramaCanvas.style.cursor = 'grab';
    
    // Reset drag flag after a short delay to allow click event to process
    setTimeout(() => {
      hasDragged = false;
    }, 10);
  }
  
  function onTouchStart(event) {
    if (event.touches.length === 1) {
      event.preventDefault();
      
      // Check if touch is in back button area - if so, don't start dragging
      if (isMouseInBackButtonArea(event.touches[0].clientX, event.touches[0].clientY)) {
        return;
      }
      
      isMouseDown = true;
      
      onMouseDownMouseX = event.touches[0].pageX;
      onMouseDownMouseY = event.touches[0].pageY;
      onMouseDownLon = lon;
      onMouseDownLat = lat;
    }
  }
  
  function onTouchMove(event) {
    if (event.touches.length === 1 && isMouseDown) {
      event.preventDefault();
      
      lon = (onMouseDownMouseX - event.touches[0].pageX) * 0.18 + onMouseDownLon;
      lat = (event.touches[0].pageY - onMouseDownMouseY) * 0.18 + onMouseDownLat;
      
      // Limit vertical rotation
      lat = Math.max(-85, Math.min(85, lat));
      
      // Update panorama point positions when camera moves
      updatePanoramaPointPositions();
    }
  }
  
  function onTouchEnd() {
    isMouseDown = false;
  }
  
  // Animation loop for smooth camera movement
  function animate() {
    requestAnimationFrame(animate);
    
    if (!isMapView && panoramaRenderer && panoramaScene && panoramaCamera) {
      // Convert spherical coordinates to camera rotation
      phi = THREE.MathUtils.degToRad(90 - lat);
      theta = THREE.MathUtils.degToRad(lon);
      
      const target = new THREE.Vector3(
        500 * Math.sin(phi) * Math.cos(theta),
        500 * Math.cos(phi),
        500 * Math.sin(phi) * Math.sin(theta)
      );
      
      panoramaCamera.lookAt(target);
      panoramaRenderer.render(panoramaScene, panoramaCamera);
      
      // Debug info every 60 frames (roughly 1 second at 60fps)
      if (Math.floor(Date.now() / 1000) % 5 === 0 && Math.floor(Date.now() / 16) % 60 === 0) {
        console.log('Rendering panorama - Camera position:', panoramaCamera.position, 'Target:', target);
      }
    }
  }
  
  // Add event listeners to panorama canvas (removed click handler - now using HTML overlay)
  panoramaCanvas.addEventListener('mousedown', onMouseDown, false);
  panoramaCanvas.addEventListener('mousemove', onMouseMove, false);
  panoramaCanvas.addEventListener('mouseup', onMouseUp, false);
  panoramaCanvas.addEventListener('mouseleave', onMouseUp, false); // Stop dragging when mouse leaves canvas
  panoramaCanvas.addEventListener('touchstart', onTouchStart, false);
  panoramaCanvas.addEventListener('touchmove', onTouchMove, false);
  panoramaCanvas.addEventListener('touchend', onTouchEnd, false);
  
  // Start animation loop immediately
  animate();
}

// Handle window resize for panorama
function onPanoramaWindowResize() {
  if (panoramaCamera && panoramaRenderer) {
    panoramaCamera.aspect = window.innerWidth / window.innerHeight;
    panoramaCamera.updateProjectionMatrix();
    panoramaRenderer.setSize(window.innerWidth, window.innerHeight);
  }
}


// Removed panorama point creation functions - now showing main dialogue instead

// Removed: createEducationPanoramaPoints() 
// Removed: createFoodPanoramaPoints()
// Removed: createEnergyPanoramaPoints()  
// Removed: createTransportPanoramaPoints()
// These functions have been removed since 360° views now show main dialogue directly

function PLACEHOLDER_TO_REPLACE() {
  const educationPoint = storyPoints.find(point => point.title === "Education");
  if (!educationPoint) return;
  
  // Define 3 specific locations on the 360° image with their story content
  const educationPoints = [
    {
      title: "Learning Together",
      key: "cooperation_first",
      x: 25, // Left side - school garden area
      y: 35,
      longitude: -120, // Map to specific view angles
      latitude: 10,
      content: educationPoint.options.find(opt => opt.key === "cooperation_first")
    },
    {
      title: "Interdisciplinary Learning", 
      key: "connected_knowledge",
      x: 75, // Right side - workshop area
      y: 45,
      longitude: 60,
      latitude: 5,
      content: educationPoint.options.find(opt => opt.key === "connected_knowledge")
    },
    {
      title: "Education for Life",
      key: "lifelong_education", 
      x: 50, // Center - community learning space
      y: 60,
      longitude: 0,
      latitude: -20,
      content: educationPoint.options.find(opt => opt.key === "lifelong_education")
    }
  ];
  
  // Add interactive links from the main text as additional panorama points
  const interactiveLinkPoints = createInteractiveLinkPanoramaPoints(educationPoint, educationPoints);
  const allEducationPoints = [...educationPoints, ...interactiveLinkPoints];
  
  // Create HTML overlay points for each education-specific point (including interactive links)
  allEducationPoints.forEach((educationSubPoint, index) => {
    // Create HTML element for the point
    const pointElement = document.createElement('div');
    let className = 'panorama-point education-point';
    if (educationSubPoint.isInteractiveLink) {
      className += ' interactive-link';
    }
    pointElement.className = className;
    pointElement.dataset.index = index;
    pointElement.dataset.key = educationSubPoint.key;
    
    // Store original position for simplified panorama positioning system
    pointElement.dataset.originalX = educationSubPoint.x;
    pointElement.dataset.originalY = educationSubPoint.y;
    
    // Initial position - will be updated by panorama positioning system
    pointElement.style.left = `${educationSubPoint.x}%`;
    pointElement.style.top = `${educationSubPoint.y}%`;
    
    // Add click handler
    pointElement.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Education panorama point clicked:', educationSubPoint.title);
      
      // Remove selected and deselecting classes from all points
      document.querySelectorAll('.panorama-point').forEach(p => {
        if (p.classList.contains('selected')) {
          p.classList.remove('selected');
          p.classList.add('deselecting');
          setTimeout(() => {
            p.classList.remove('deselecting');
          }, 300);
        }
      });
      
      // Add selected class to clicked point
      pointElement.classList.add('selected');
      
      // Mark this panorama point as visited by adding visited class
      pointElement.classList.add('visited');
      
      // Center the panorama view on the selected point
      centerPanoramaOnPoint(pointElement);
      
      // Show dialogue with the education sub-content
      showEducationSubContent(educationSubPoint);
    });
    
    // Add hover event listeners to disable edge scrolling
    pointElement.addEventListener("mouseenter", () => {
      isHoveringCircle = true;
      stopEdgeScrolling(); // Stop any current scrolling immediately
    });
    pointElement.addEventListener("mouseleave", () => {
      isHoveringCircle = false;
    });
    
    // Add to overlay
    panoramaOverlay.appendChild(pointElement);
    
    // Store in array
    panoramaPoints.push({
      element: pointElement,
      educationSubPoint: educationSubPoint,
      index: index
    });
  });
  
  // Add a special "back to street view" point below day/night toggle
  const backToStreetPoint = document.createElement('div');
  backToStreetPoint.className = 'panorama-point back-to-street';
  backToStreetPoint.style.left = '50%'; // Centered with day/night toggle
  backToStreetPoint.style.top = '140px'; // Moved down from 120px
  backToStreetPoint.style.transform = 'translateX(-50%)'; // Keep centered on its position
  backToStreetPoint.style.position = 'fixed'; // Keep fixed position, don't move with panorama
  
  // Add clear back arrow icon
  backToStreetPoint.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="width: 32px; height: 32px;">
      <!-- Back arrow -->
      <path d="M19 12H5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
  
  // Add click handler to return to street view
  backToStreetPoint.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Back to street view clicked');
    returnToStreetView();
  });
  
  // Add to overlay
  panoramaOverlay.appendChild(backToStreetPoint);
  
  // Initial positioning of points
  updatePanoramaPointPositions();
  
  console.log(`Created ${panoramaPoints.length} HTML panorama story points + 1 back button`);
  
  // Show the main Education dialogue after panorama points are created
  showPanoramaDialogue(educationPoint);
}

// Show dialogue in panorama view without street view manipulations
function showPanoramaDialogue(point) {
  currentStoryPoint = point;
  locationTitle.textContent = point.title;
  locationSubtitle.textContent = point.subtitle || "";

  // Mark this point as visited
  visitedContent.add(point.title);
  
  // Reset navigation history when opening new dialogue and add main state
  navigationHistory = [];
  // Add the main dialogue state to history so we can navigate back to it
  addToHistory(point, "main");

  // Reset skip-related state variables
  skipToNextSentence = false;
  hasUsedSkip = false;
  isTyping = false;
  console.log("showPanoramaDialogue: Reset skip state variables");

  // Clear any existing typing timeout
  if (currentTypingTimeout) {
    clearTimeout(currentTypingTimeout);
    currentTypingTimeout = null;
  }

  // Show main text (skip street view positioning)
  showMainText(point);
}


// Create Food-specific 360° points for market scenes
function createFoodPanoramaPoints() {
  const foodPoint = storyPoints.find(point => point.title === "Food");
  if (!foodPoint) return;
  
  // Define 4 specific locations on the market 360° image, each linking to unique Food content
  const foodPoints = [
    {
      title: "Farmers Markets",
      key: "farmers_markets",
      x: 25, // Left side - market stalls
      y: 40,
      longitude: -90,
      latitude: 0,
      content: foodPoint.options.find(opt => opt.key === "farmers_markets")
    },
    {
      title: "Slow Food Movement", 
      key: "slow_food",
      x: 75, // Right side - community gathering area
      y: 35,
      longitude: 90,
      latitude: 5,
      content: foodPoint.options.find(opt => opt.key === "slow_food")
    },
    {
      title: "Circular Food System",
      key: "waste", 
      x: 50, // Center - composting/reuse area
      y: 65,
      longitude: 0,
      latitude: -15,
      content: foodPoint.options.find(opt => opt.key === "waste")
    },
    {
      title: "Fair Food Design",
      key: "fair_design",
      x: 80, // Far right - community space
      y: 50,
      longitude: 120,
      latitude: -10,
      content: foodPoint.options.find(opt => opt.key === "fair_design")
    }
  ];
  
  // Add interactive links from the main text as additional panorama points
  const interactiveLinkPoints = createInteractiveLinkPanoramaPoints(foodPoint, foodPoints);
  const allFoodPoints = [...foodPoints, ...interactiveLinkPoints];
  
  // Create HTML overlay points for each food-specific point (including interactive links)
  allFoodPoints.forEach((foodSubPoint, index) => {
    // Create HTML element for the point
    const pointElement = document.createElement('div');
    let className = 'panorama-point food-point';
    if (foodSubPoint.isInteractiveLink) {
      className += ' interactive-link';
    }
    pointElement.className = className;
    pointElement.dataset.index = index;
    pointElement.dataset.key = foodSubPoint.key;
    
    // Store original position for simplified panorama positioning system
    pointElement.dataset.originalX = foodSubPoint.x;
    pointElement.dataset.originalY = foodSubPoint.y;
    
    // Initial position - will be updated by panorama positioning system
    pointElement.style.left = `${foodSubPoint.x}%`;
    pointElement.style.top = `${foodSubPoint.y}%`;
    
    // Add click handler
    pointElement.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Food panorama point clicked:', foodSubPoint.title);
      
      // Remove selected and deselecting classes from all points
      document.querySelectorAll('.panorama-point').forEach(p => {
        if (p.classList.contains('selected')) {
          p.classList.remove('selected');
          p.classList.add('deselecting');
          setTimeout(() => {
            p.classList.remove('deselecting');
          }, 300);
        }
      });
      
      // Add selected class to clicked point
      pointElement.classList.add('selected');
      
      // Mark this panorama point as visited by adding visited class
      pointElement.classList.add('visited');
      
      // Center the panorama view on the selected point
      centerPanoramaOnPoint(pointElement);
      
      // Show dialogue with the food sub-content
      showFoodSubContent(foodSubPoint);
    });
    
    // Add hover event listeners to disable edge scrolling
    pointElement.addEventListener("mouseenter", () => {
      isHoveringCircle = true;
      stopEdgeScrolling(); // Stop any current scrolling immediately
    });
    pointElement.addEventListener("mouseleave", () => {
      isHoveringCircle = false;
    });
    
    // Add to overlay
    panoramaOverlay.appendChild(pointElement);
    
    // Store in array
    panoramaPoints.push({
      element: pointElement,
      foodSubPoint: foodSubPoint,
      index: index
    });
  });
  
  // Add a special "back to street view" point below day/night toggle
  const backToStreetPoint = document.createElement('div');
  backToStreetPoint.className = 'panorama-point back-to-street';
  backToStreetPoint.style.left = '50%'; // Centered with day/night toggle
  backToStreetPoint.style.top = '140px'; // Moved down from 120px
  backToStreetPoint.style.transform = 'translateX(-50%)'; // Keep centered on its position
  backToStreetPoint.style.position = 'fixed'; // Keep fixed position, don't move with panorama
  
  // Add clear back arrow icon
  backToStreetPoint.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="width: 32px; height: 32px;">
      <!-- Back arrow -->
      <path d="M19 12H5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
  
  backToStreetPoint.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Back to street clicked from food panorama');
    returnToStreetView();
  });
  
  panoramaOverlay.appendChild(backToStreetPoint);
  
  // Initial positioning of points
  updatePanoramaPointPositions();
  
  console.log(`Created ${panoramaPoints.length} unique HTML food panorama story points + 1 back button`);
  
  // Show the main Food dialogue after panorama points are created
  showPanoramaDialogue(foodPoint);
}

// Show food sub-content in dialogue panel
function showFoodSubContent(foodSubPoint) {
  if (!foodSubPoint.content) return;
  
  // Extract the actual content - handle both regular points and interactive link points
  const actualContent = foodSubPoint.content.content || foodSubPoint.content;
  
  // Mark this panorama point as visited
  visitedContent.add(foodSubPoint.title);
  
  currentStoryPoint = { 
    title: foodSubPoint.title,
    mainText: actualContent
  };
  
  locationTitle.textContent = foodSubPoint.title;
  locationSubtitle.textContent = "";
  
  // Clear dialogue content
  dialogueTextContainer.innerHTML = '';
  
  // Create dialogue entry
  const dialogueEntry = document.createElement('div');
  dialogueEntry.className = 'dialogue-entry';
  
  // Add speaker if available
  if (actualContent.speaker) {
    const speakerDiv = document.createElement('div');
    speakerDiv.className = 'dialogue-speaker';
    speakerDiv.textContent = actualContent.speaker;
    dialogueEntry.appendChild(speakerDiv);
  }
  
  // Add main text
  const textDiv = document.createElement('div');
  textDiv.className = 'section-text';
  textDiv.innerHTML = parseTextWithLinks(actualContent.text);
  dialogueEntry.appendChild(textDiv);
  
  // Add back button
  const backButton = document.createElement('div');
  backButton.className = 'back-button';
  backButton.innerHTML = '← Back to Food Overview';
  backButton.addEventListener('click', () => {
    // Return to main food overview
    const mainFoodPoint = storyPoints.find(point => point.title === "Food");
    if (mainFoodPoint) {
      showMainText(mainFoodPoint);
    }
  });
  dialogueEntry.appendChild(backButton);
  
  dialogueTextContainer.appendChild(dialogueEntry);
  
  // Show dialogue panel
  dialoguePanel.classList.add('visible');
  
  console.log('Food sub-content displayed:', foodSubPoint.title);
}

// Create Energy-specific 360° points
function createEnergyPanoramaPoints() {
  const energyPoint = storyPoints.find(point => point.title === "Energy");
  if (!energyPoint) return;
  
  // Define 3 specific locations on the energy 360° image with their story content
  const energyPoints = [
    {
      title: "Community energy",
      key: "energy_coops",
      x: 20, // Left side - solar panels area
      y: 40,
      longitude: -90,
      latitude: 5,
      content: energyPoint.options.find(opt => opt.key === "energy_coops")
    },
    {
      title: "Fair share", 
      key: "fair_share",
      x: 70, // Right side - energy systems
      y: 35,
      longitude: 90,
      latitude: -10,
      content: energyPoint.options.find(opt => opt.key === "fair_share")
    },
    {
      title: "A living system",
      key: "living_system",
      x: 50, // Center - sustainable infrastructure
      y: 60,
      longitude: 0,
      latitude: -15,
      content: energyPoint.options.find(opt => opt.key === "living_system")
    }
  ];

  // Add interactive links from the main text as additional panorama points
  const interactiveLinkPoints = createInteractiveLinkPanoramaPoints(energyPoint, energyPoints);
  const allEnergyPoints = [...energyPoints, ...interactiveLinkPoints];

  // Create HTML overlay points (including interactive links)
  allEnergyPoints.forEach((energySubPoint, index) => {
    const pointElement = document.createElement('div');
    let className = 'panorama-point';
    if (energySubPoint.isInteractiveLink) {
      className += ' interactive-link';
    }
    pointElement.className = className;
    // Initial position - will be updated by panorama positioning system
    // Store original position for simplified panorama positioning system
    pointElement.dataset.originalX = energySubPoint.x;
    pointElement.dataset.originalY = energySubPoint.y;
    
    // Initial position - will be updated by panorama positioning system
    pointElement.style.left = `${energySubPoint.x}%`;
    pointElement.style.top = `${energySubPoint.y}%`;
    
    // Add click handler
    pointElement.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Energy panorama point clicked:', energySubPoint.title);
      showEnergySubContent(energySubPoint);
      centerPanoramaOnPoint(pointElement);
    });
    
    // Add hover event listeners to disable edge scrolling
    pointElement.addEventListener("mouseenter", () => {
      isHoveringCircle = true;
      stopEdgeScrolling(); // Stop any current scrolling immediately
    });
    pointElement.addEventListener("mouseleave", () => {
      isHoveringCircle = false;
    });
    
    // Add to overlay
    panoramaOverlay.appendChild(pointElement);
    
    // Store in array
    panoramaPoints.push({
      element: pointElement,
      energySubPoint: energySubPoint,
      index: index
    });
  });
  
  // Add back to street view button below day/night toggle
  const backToStreetPoint = document.createElement('div');
  backToStreetPoint.className = 'panorama-point back-to-street';
  backToStreetPoint.style.left = '50%'; // Centered with day/night toggle
  backToStreetPoint.style.top = '140px'; // Moved down from 120px
  backToStreetPoint.style.transform = 'translateX(-50%)'; // Keep centered on its position
  backToStreetPoint.style.position = 'fixed'; // Keep fixed position, don't move with panorama
  
  backToStreetPoint.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="width: 32px; height: 32px;">
      <path d="M19 12H5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
  
  backToStreetPoint.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Back to street clicked from energy panorama');
    returnToStreetView();
  });
  
  panoramaOverlay.appendChild(backToStreetPoint);
  
  updatePanoramaPointPositions();
  
  console.log(`Created ${panoramaPoints.length} energy panorama story points + 1 back button`);
  
  // Show the main Energy dialogue after panorama points are created
  showPanoramaDialogue(energyPoint);
}

// Show energy sub-content in dialogue panel

// Create Transport-specific 360° points
function createTransportPanoramaPoints() {
  const transportPoint = storyPoints.find(point => point.title === "Transport");
  if (!transportPoint) return;
  
  // Define 3 specific locations on the transport 360° image with their story content
  const transportPoints = [
    {
      title: "Connected Networks",
      key: "networks",
      x: 25, // Left side - bike lanes area
      y: 45,
      longitude: -80,
      latitude: 0,
      content: transportPoint.options.find(opt => opt.key === "networks")
    },
    {
      title: "Rethinking Private Cars", 
      key: "private_cars",
      x: 75, // Right side - public transport
      y: 40,
      longitude: 80,
      latitude: 5,
      content: transportPoint.options.find(opt => opt.key === "private_cars")
    },
    {
      title: "Reclaimed Spaces",
      key: "returned_people",
      x: 50, // Center - community spaces
      y: 65,
      longitude: 0,
      latitude: -20,
      content: transportPoint.options.find(opt => opt.key === "returned_people")
    }
  ];

  // Add interactive links from the main text as additional panorama points
  const interactiveLinkPoints = createInteractiveLinkPanoramaPoints(transportPoint, transportPoints);
  const allTransportPoints = [...transportPoints, ...interactiveLinkPoints];

  // Create HTML overlay points (including interactive links)
  allTransportPoints.forEach((transportSubPoint, index) => {
    const pointElement = document.createElement('div');
    let className = 'panorama-point';
    if (transportSubPoint.isInteractiveLink) {
      className += ' interactive-link';
    }
    pointElement.className = className;
    // Store original position for simplified panorama positioning system
    pointElement.dataset.originalX = transportSubPoint.x;
    pointElement.dataset.originalY = transportSubPoint.y;
    
    // Initial position - will be updated by panorama positioning system
    pointElement.style.left = `${transportSubPoint.x}%`;
    pointElement.style.top = `${transportSubPoint.y}%`;
    
    // Add click handler
    pointElement.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Transport panorama point clicked:', transportSubPoint.title);
      showTransportSubContent(transportSubPoint);
      centerPanoramaOnPoint(pointElement);
    });
    
    // Add hover event listeners to disable edge scrolling
    pointElement.addEventListener("mouseenter", () => {
      isHoveringCircle = true;
      stopEdgeScrolling(); // Stop any current scrolling immediately
    });
    pointElement.addEventListener("mouseleave", () => {
      isHoveringCircle = false;
    });
    
    // Add to overlay
    panoramaOverlay.appendChild(pointElement);
    
    // Store in array
    panoramaPoints.push({
      element: pointElement,
      transportSubPoint: transportSubPoint,
      index: index
    });
  });
  
  // Add back to street view button below day/night toggle
  const backToStreetPoint = document.createElement('div');
  backToStreetPoint.className = 'panorama-point back-to-street';
  backToStreetPoint.style.left = '50%'; // Centered with day/night toggle
  backToStreetPoint.style.top = '140px'; // Moved down from 120px
  backToStreetPoint.style.transform = 'translateX(-50%)'; // Keep centered on its position
  backToStreetPoint.style.position = 'fixed'; // Keep fixed position, don't move with panorama
  
  backToStreetPoint.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="width: 32px; height: 32px;">
      <path d="M19 12H5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
  
  backToStreetPoint.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Back to street clicked from transport panorama');
    returnToStreetView();
  });
  
  panoramaOverlay.appendChild(backToStreetPoint);
  
  updatePanoramaPointPositions();
  
  console.log(`Created ${panoramaPoints.length} transport panorama story points + 1 back button`);
  
  // Show the main Transport dialogue after panorama points are created
  showPanoramaDialogue(transportPoint);
}

// Show transport sub-content in dialogue panel
function showTransportSubContent(transportSubPoint) {
  if (!transportSubPoint.content) return;
  
  // Extract the actual content - handle both regular points and interactive link points
  const actualContent = transportSubPoint.content.content || transportSubPoint.content;
  
  visitedContent.add(transportSubPoint.title);
  
  currentStoryPoint = { 
    title: transportSubPoint.title,
    mainText: actualContent
  };
  
  locationTitle.textContent = transportSubPoint.title;
  locationSubtitle.textContent = "";
  
  dialogueTextContainer.innerHTML = '';
  
  const dialogueEntry = document.createElement('div');
  dialogueEntry.className = 'dialogue-entry';
  
  if (actualContent.speaker) {
    const speakerDiv = document.createElement('div');
    speakerDiv.className = 'dialogue-speaker';
    speakerDiv.textContent = actualContent.speaker;
    dialogueEntry.appendChild(speakerDiv);
  }
  
  const textDiv = document.createElement('div');
  textDiv.className = 'section-text';
  textDiv.innerHTML = actualContent.text;
  dialogueEntry.appendChild(textDiv);
  
  const backButton = document.createElement('div');
  backButton.className = 'section-text dialogue-option';
  backButton.innerHTML = '[Back to main Transport view](back)';
  backButton.addEventListener('click', () => {
    const mainTransportPoint = storyPoints.find(point => point.title === "Transport");
    if (mainTransportPoint) {
      showMainText(mainTransportPoint);
    }
  });
  dialogueEntry.appendChild(backButton);
  
  dialogueTextContainer.appendChild(dialogueEntry);
  dialoguePanel.classList.add('visible');
  
  console.log('Transport sub-content displayed:', transportSubPoint.title);
}

// Update panorama point positions based on camera rotation
function updatePanoramaPointPositions() {
  if (!panoramaPoints || panoramaPoints.length === 0) return;
  
  panoramaPoints.forEach(pointData => {
    const pointElement = pointData.element;
    if (!pointElement) return;
    
    // Skip the back-to-street button - it should stay fixed on screen
    if (pointElement.classList.contains('back-to-street')) return;
    
    // Get the original position stored when point was created
    const originalX = parseFloat(pointElement.dataset.originalX);
    const originalY = parseFloat(pointElement.dataset.originalY);
    
    // Skip points without valid original coordinates
    if (isNaN(originalX) || isNaN(originalY)) {
      return;
    }
    
    // Calculate 1:1 movement with camera rotation
    // Convert camera rotation (degrees) back to screen percentage movement
    // Mouse drag: lon = (mouseX - startX) * 0.18, so screen movement = lon / 0.18
    // Then convert to percentage: percentage = (pixels / screenWidth) * 100
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    // Convert lon/lat rotation back to pixel movement, then to percentage
    const pixelMovementX = lon / 0.18; // Reverse the mouse drag calculation
    const pixelMovementY = lat / 0.18; // Reverse the mouse drag calculation
    
    const horizontalOffset = (pixelMovementX / screenWidth) * 100; // Convert to percentage
    const verticalOffset = (pixelMovementY / screenHeight) * 100; // Convert to percentage
    
    // Move points opposite to camera movement for 1:1 tracking
    let newX = originalX - horizontalOffset;
    let newY = originalY - verticalOffset;
    
    // Handle horizontal wrapping for 360° panorama
    while (newX < -100) newX += 200;
    while (newX > 200) newX -= 200;
    
    // Clamp vertical movement
    newY = Math.max(-100, Math.min(200, newY));
    
    // Update point position
    pointElement.style.left = `${newX}%`;
    pointElement.style.top = `${newY}%`;
    
    // Hide points that are completely off screen
    if (newX < -50 || newX > 150 || newY < -50 || newY > 150) {
      pointElement.style.opacity = '0.2';
      pointElement.style.pointerEvents = 'none';
    } else {
      pointElement.style.opacity = '1';
      pointElement.style.pointerEvents = 'auto';
    }
  });
}

// Show energy sub-content dialogue
function showEnergySubContent(energySubPoint) {
  if (!energySubPoint.content) return;
  
  // Extract the actual content - handle both regular points and interactive link points
  const actualContent = energySubPoint.content.content || energySubPoint.content;
  
  // Mark this panorama point as visited
  visitedContent.add(energySubPoint.title);
  
  currentStoryPoint = { 
    title: energySubPoint.title,
    mainText: actualContent
  };
  
  locationTitle.textContent = energySubPoint.title;
  locationSubtitle.textContent = "";
  
  // Clear dialogue content
  dialogueTextContainer.innerHTML = '';
  
  // Create dialogue entry
  const dialogueEntry = document.createElement('div');
  dialogueEntry.className = 'dialogue-entry';
  
  // Add speaker if exists
  if (actualContent.speaker) {
    const speakerElement = document.createElement('div');
    speakerElement.className = 'dialogue-speaker';
    speakerElement.textContent = actualContent.speaker;
    dialogueEntry.appendChild(speakerElement);
  }
  
  // Add text content
  const textElement = document.createElement('div');
  textElement.className = 'section-text';
  textElement.textContent = actualContent.text;
  dialogueEntry.appendChild(textElement);
  
  // Add back to main option
  const backElement = document.createElement('div');
  backElement.className = 'section-text';
  backElement.style.marginTop = '20px';
  backElement.innerHTML = '[Back to Energy overview](close)';
  dialogueEntry.appendChild(backElement);
  
  dialogueTextContainer.appendChild(dialogueEntry);
  
  // Show dialogue panel
  dialoguePanel.classList.add('visible');
  
  console.log('Showing energy sub-content:', energySubPoint.title);
}

function showEducationSubContent(educationSubPoint) {
  if (!educationSubPoint.content) return;
  
  // Extract the actual content - handle both regular points and interactive link points
  const actualContent = educationSubPoint.content.content || educationSubPoint.content;
  
  // Mark this panorama point as visited
  visitedContent.add(educationSubPoint.title);
  
  currentStoryPoint = { 
    title: educationSubPoint.title,
    mainText: actualContent
  };
  
  locationTitle.textContent = educationSubPoint.title;
  locationSubtitle.textContent = "";
  
  // Clear dialogue content
  dialogueTextContainer.innerHTML = '';
  
  // Create dialogue entry
  const dialogueEntry = document.createElement('div');
  dialogueEntry.className = 'dialogue-entry';
  
  // Add speaker if exists
  if (actualContent.speaker) {
    const speakerElement = document.createElement('div');
    speakerElement.className = 'dialogue-speaker';
    speakerElement.textContent = actualContent.speaker;
    dialogueEntry.appendChild(speakerElement);
  }
  
  // Add text content
  const textElement = document.createElement('div');
  textElement.className = 'section-text';
  textElement.textContent = actualContent.text;
  dialogueEntry.appendChild(textElement);
  
  // Add back to main option
  const backElement = document.createElement('div');
  backElement.className = 'section-text';
  backElement.style.marginTop = '20px';
  backElement.innerHTML = '[Back to Education overview](close)';
  dialogueEntry.appendChild(backElement);
  
  dialogueTextContainer.appendChild(dialogueEntry);
  
  // Show dialogue panel
  dialoguePanel.classList.add('visible');
  
  console.log('Showing education sub-content:', educationSubPoint.title);
}


// Return to street view from 360° panorama
function returnToStreetView() {
  console.log('Returning to street view...');
  
  // Hide back to street button
  hideBackToStreetButton();
  
  // Fade out panorama view
  panoramaContainer.style.opacity = '0';
  
  setTimeout(() => {
    // Switch back to map view
    isMapView = true;
    document.body.classList.remove('panorama-view'); // Show connection lines again
    panoramaContainer.style.display = 'none';
    backgroundContainer.style.display = 'block';
    interactivePoints.style.display = 'block';
    backgroundContainer.style.opacity = '1';
    interactivePoints.style.opacity = '1';
    
    // Hide any open dialogue
    if (dialoguePanel.classList.contains('visible')) {
      hideDialogue();
    }
    
    console.log('Returned to street view');
  }, 250); // Wait for fade out
}

// Center panorama camera on selected point
function centerPanoramaOnPoint(pointElement) {
  if (!panoramaCamera || isMapView) return;
  
  // Get the point's position as percentages
  const leftPercent = parseFloat(pointElement.style.left);
  const topPercent = parseFloat(pointElement.style.top);
  
  // Convert percentage position to longitude/latitude
  // Map x (0-100%) to longitude (-180 to 180 degrees)
  // Map y (0-100%) to latitude (-90 to 90 degrees)
  const targetLongitude = (leftPercent - 50) * 3.6; // -180 to 180
  const targetLatitude = (50 - topPercent) * 1.8; // 90 to -90 (inverted Y)
  
  // Direct camera movement without bounce-back animation
  lon = targetLongitude;
  lat = Math.max(-85, Math.min(85, targetLatitude)); // Clamp latitude
}

// Initialize background music (lazy load for performance)
function initializeMusic() {
  // Only load music on desktop or when user explicitly enables it
  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    console.log("Skipping background music on mobile for performance");
    return;
  }
  
  backgroundMusic = new Audio("assets/sound/06-julian.mp3");
  backgroundMusic.loop = true;
  backgroundMusic.volume = 0.3; // Set to a comfortable level

  // Handle audio loading errors gracefully
  backgroundMusic.addEventListener("error", function (e) {
    console.warn("Background music failed to load:", e);
  });

  // Start music when loaded, after user interaction
  backgroundMusic.addEventListener("canplaythrough", function () {
    console.log("Background music loaded and ready to play");
  });
}

// Start music after user interaction (clicking "Got it")
function startMusicAfterUserInteraction() {
  if (backgroundMusic) {
    backgroundMusic.play().catch((e) => {
      console.warn("Could not start background music:", e);
    });
  }
}

// Mark interactive text link as visited when user has engaged with it
function markInteractiveTextAsVisited(targetKey) {
  // Add to persistent visited set
  visitedInteractiveLinks.add(targetKey);
  
  // Find all interactive text elements with this target key and mark as visited
  const interactiveElements = document.querySelectorAll(`.interactive-text[data-target-key="${targetKey}"]`);
  interactiveElements.forEach(element => {
    element.classList.add('visited');
  });
}

// Helper function to extract interactive links from text and create panorama points for them
function createInteractiveLinkPanoramaPoints(point, existingPoints = []) {
  if (!point.mainText || !point.mainText.text) return [];
  
  // Parse the main text to find interactive links
  const textParts = parseTextWithLinksAndStyling(point.mainText.text, point);
  const linkParts = textParts.filter(part => part.type === "link" && part.target !== "close");
  
  if (linkParts.length === 0) return [];
  
  const linkPoints = [];
  
  // Calculate positions for interactive links around the panorama
  // Position them in different quadrants to avoid overlap with existing points
  const basePositions = [
    { x: 85, y: 25 }, // Top right
    { x: 15, y: 75 }, // Bottom left  
    { x: 65, y: 80 }, // Bottom right
    { x: 35, y: 20 }, // Top left
    { x: 50, y: 90 }  // Bottom center
  ];
  
  linkParts.forEach((linkPart, index) => {
    // Find the corresponding content from the point's options
    const linkedOption = point.options?.find(opt => opt.key === linkPart.target);
    if (!linkedOption) return;
    
    // Use base position, cycling through available positions
    const position = basePositions[index % basePositions.length];
    
    // Create the link point
    const linkPoint = {
      title: linkPart.content,
      key: linkPart.target,
      x: position.x,
      y: position.y,
      longitude: (position.x - 50) * 3.6, // Convert to panorama coordinates
      latitude: (50 - position.y) * 1.8,
      content: linkedOption, // Use the whole option object to match regular panorama points
      isInteractiveLink: true // Flag to identify these as converted dialogue links
    };
    
    linkPoints.push(linkPoint);
  });
  
  return linkPoints;
}

// Note: Panorama click handling now done via HTML overlay elements directly

window.addEventListener("load", () => {
  // Initialize cached DOM elements for performance
  initCachedElements();
  
  // Apply mobile-specific optimizations
  applyMobileOptimizations();
  
  // Add hover listeners to dialogue panel for edge scrolling control
  if (dialoguePanel) {
    dialoguePanel.addEventListener("mouseenter", () => {
      isHoveringDialogue = true;
    });
    dialoguePanel.addEventListener("mouseleave", () => {
      isHoveringDialogue = false;
    });
  }
  
  initialize();
});
