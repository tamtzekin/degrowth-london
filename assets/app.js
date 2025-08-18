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

// View toggle variables
let isMapView = true;
let panoramaScene, panoramaCamera, panoramaRenderer, panoramaSphere, panoramaSphereNight, panoramaAmbientLight;
let isMouseDown = false;
let mouseX = 0, mouseY = 0;
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
      // Add small delay to prevent flickering
      clearTimeout(pointElement.hoverTimeout);
      pointElement.hoverTimeout = setTimeout(() => showHoverTitle(e, point.title), 50);
    });
    pointElement.addEventListener("mouseleave", () => {
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
  const speedValues = { FAST: 0, RELAXED: 15, ZEN: 40 };
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

    // Update Food 360° scene day/night transition
    if (!isMapView && currentStoryPoint && currentStoryPoint.title === 'Food') {
      console.log('Day/night toggle triggered, transitioning Food 360° scene. Night mode:', isHighContrast);
      updateFoodSceneOpacity();
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
  backgroundContainer.style.transition = 'transform 0.15s ease-out';
  interactivePoints.style.transition = 'transform 0.15s ease-out';
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
  
  backgroundContainer.style.transform = `translate(${currentX}px, ${currentY}px)`;

  // Move points with the background using the same transform
  interactivePoints.style.transform = `translate(${currentX}px, ${currentY}px)`;
  
  // Update spotlight position when map moves to keep it attached to the selected circle
  const dimmingOverlay = document.getElementById('dimmingOverlay');
  if (dimmingOverlay && dimmingOverlay.classList.contains('active')) {
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
let currentScrollVelocityX = 0;
let currentScrollVelocityY = 0;
let targetScrollVelocityX = 0;
let targetScrollVelocityY = 0;

function handleEdgeScrolling(e) {
  // Enable edge scrolling for both map and panorama modes, but not while dragging or when a circle is selected
  if (isDragging) return;
  
  // Disable map dragging when a circle is selected (dialogue is open)
  if (isMapView && dialoguePanel.classList.contains('visible')) return;
  
  const mouseX = e.clientX;
  const mouseY = e.clientY;
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
    
    // Apply exponential curve for more natural feel (increased for more gradual)
    const smoothFactor = Math.pow(scrollFactor, 2.2);
    
    // Calculate velocity based on direction and smooth factor (reversed for intuitive movement)
    const maxSpeed = 2.8; // Further reduced for more gradual movement
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
  
  function scroll() {
    // Smooth acceleration/deceleration with bounce effect
    const acceleration = 0.08; // Much slower for more gradual movement
    const bounceMultiplier = 1.02; // Tiny bounce effect when starting
    
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
      // Panorama scrolling
      if (window.panoramaCamera) {
        window.panoramaCamera.rotation.y += currentScrollVelocityX * 0.01;
        window.panoramaCamera.rotation.x += currentScrollVelocityY * 0.01;
        
        // Clamp vertical rotation
        window.panoramaCamera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, window.panoramaCamera.rotation.x));
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
  const has360Image = point.title === "Education"; // Only Education goes directly to 360°
  
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
  
  // Wait for centering animation to complete before starting zoom
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
    backgroundContainer.style.display = 'none';
    interactivePoints.style.display = 'none';
    
    // Reset transforms for next time
    backgroundContainer.style.transform = `translate(${currentX}px, ${currentY}px)`;
    interactivePoints.style.transform = `translate(${currentX}px, ${currentY}px)`;
    
    // For 360° points, create panorama points instead of showing dialogue
    setTimeout(() => {
      if (point._has360Image) {
        createPanoramaStoryPoints();
        console.log('Created panorama story points for 360° view');
      } else {
        showDialogue(point, pointElement);
      }
    }, 100);
    
  }, 500); // Wait for cross-fade to complete (400ms zoom + 100ms extra)
  }, 650); // Wait for centering animation to complete (600ms) before starting zoom
}

function showDialogue(point, pointElement) {
  currentStoryPoint = point;
  locationTitle.textContent = point.title;

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
  console.log("showDialogue: Reset skip state variables");

  // Clear any existing typing timeout
  if (currentTypingTimeout) {
    clearTimeout(currentTypingTimeout);
    currentTypingTimeout = null;
  }

  // Update selected state
  pointElements.forEach((el) => el.classList.remove("selected"));
  pointElement.classList.add("selected");
  
  // Add dimming overlay effect when circle is selected
  const dimmingOverlay = document.getElementById('dimmingOverlay');
  if (dimmingOverlay) {
    dimmingOverlay.classList.add('active');
    
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
    
    // Start spotlight animation immediately when circle starts scaling
    animateSpotlight();
    
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
  // Handle special case for Food 360° view
  if (optionKey === 'food_360' && point.title === 'Food') {
    console.log('Triggering Food 360° view');
    // Hide dialogue and transition to 360° view
    hideDialogue();
    // Transition to Food 360° view directly
    setTimeout(() => {
      enterFoodPanoramaView(point);
    }, 300);
    return;
  }
  
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

    // Add click handler based on target
    if (currentPart.target === "close") {
      linkSpan.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        hideDialogue();
      });
    } else {
      // Target is now a key, not a section number
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

      // Add click handler based on target
      if (part.target === "close") {
        linkSpan.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          hideDialogue();
        });
      } else {
        // Target is now a key, not a section number
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

// Initialize 360° panorama view
function initializePanorama() {
  try {
    console.log('Initializing panorama...');
    
    // Create scene
    panoramaScene = new THREE.Scene();
    
    // Create camera
    panoramaCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    // Create renderer
    panoramaRenderer = new THREE.WebGLRenderer({ canvas: panoramaCanvas, antialias: true });
    panoramaRenderer.setSize(window.innerWidth, window.innerHeight);
    panoramaRenderer.setClearColor(0x000000);
    
    // Create sphere geometry for 360° photo - higher resolution for better quality
    const geometry = new THREE.SphereGeometry(500, 60, 40);
    
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
        // Texture loaded successfully - don't set format manually
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.flipY = false; // Don't flip - we'll handle it with UV mapping
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        
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
  
  if (point.title === 'Food') {
    // For Food scenes, load both day and night textures for smooth fading
    loadFoodPanoramaImages(point);
  } else {
    // For other scenes (like Energy), use single texture
    loadSinglePanoramaImage(point);
  }
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

// Load single texture for non-Food scenes
function loadSinglePanoramaImage(point) {
  let imagePath;
  switch (point.title) {
    case 'Energy':
      imagePath = 'assets/images/360-energy.jpg';
      break;
    default:
      imagePath = 'assets/images/360-energy.jpg';
      console.log(`No specific 360° image for ${point.title}, using energy scene`);
      break;
  }
  
  console.log(`Loading single 360° image: ${imagePath}`);
  
  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(
    imagePath,
    function (texture) {
      setupTexture(texture);
      
      // Dispose old textures
      if (panoramaSphere.material.map) {
        panoramaSphere.material.map.dispose();
      }
      if (panoramaSphereNight.material.map) {
        panoramaSphereNight.material.map.dispose();
      }
      
      // Apply to day sphere, hide night sphere
      panoramaSphere.material.map = texture;
      panoramaSphere.material.color.setHex(0xffffff);
      panoramaSphere.material.opacity = 1;
      panoramaSphere.material.needsUpdate = true;
      
      panoramaSphereNight.material.opacity = 0;
      panoramaSphereNight.material.needsUpdate = true;
      
      console.log('Single panorama texture loaded for:', point.title);
    },
    undefined,
    function (error) {
      console.error('Error loading 360° image for', point.title, ':', error);
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
  
  function onMouseDown(event) {
    event.preventDefault();
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
      
      // Handle dragging
      lon = (onMouseDownMouseX - event.clientX) * 0.1 + onMouseDownLon;
      lat = (event.clientY - onMouseDownMouseY) * 0.1 + onMouseDownLat;
      
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
      
      lon = (onMouseDownMouseX - event.touches[0].pageX) * 0.1 + onMouseDownLon;
      lat = (event.touches[0].pageY - onMouseDownMouseY) * 0.1 + onMouseDownLat;
      
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

// Create HTML overlay points for panorama view
function createPanoramaStoryPoints() {
  // Clear existing panorama points
  if (!panoramaOverlay) {
    console.error('panoramaOverlay element not found!');
    return;
  }
  
  panoramaOverlay.innerHTML = '';
  panoramaPoints = [];
  
  console.log('Creating panorama story points for:', currentStoryPoint ? currentStoryPoint.title : 'no story point');
  
  // Create points based on current story point
  if (!currentStoryPoint) return;
  
  if (currentStoryPoint.title === "Education") {
    createEducationPanoramaPoints();
  } else if (currentStoryPoint.title === "Food") {
    createFoodPanoramaPoints();
  }
}

// Create Education-specific 360° points
function createEducationPanoramaPoints() {
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
  
  // Create HTML overlay points for each education-specific point
  educationPoints.forEach((educationSubPoint, index) => {
    // Create HTML element for the point
    const pointElement = document.createElement('div');
    pointElement.className = 'panorama-point education-point';
    pointElement.dataset.index = index;
    pointElement.dataset.key = educationSubPoint.key;
    
    // Store 3D coordinates for panorama positioning
    pointElement.dataset.longitude = educationSubPoint.longitude;
    pointElement.dataset.latitude = educationSubPoint.latitude;
    
    // Initial position will be updated by panorama positioning
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
    
    // Add to overlay
    panoramaOverlay.appendChild(pointElement);
    
    // Store in array
    panoramaPoints.push({
      element: pointElement,
      educationSubPoint: educationSubPoint,
      index: index
    });
  });
  
  // Add a special "back to street view" point in the center
  const backToStreetPoint = document.createElement('div');
  backToStreetPoint.className = 'panorama-point back-to-street';
  backToStreetPoint.style.left = '50%';
  backToStreetPoint.style.top = '20%'; // Position it in upper middle area
  
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

// Enter Food panorama view directly (used when clicking "Visit the local market" link)
function enterFoodPanoramaView(point) {
  console.log('Entering Food panorama view directly');
  
  // Set current story point and mark as having 360° image
  currentStoryPoint = point;
  point._has360Image = true;
  
  // Hide street view elements and show panorama
  const backgroundContainer = document.getElementById('backgroundContainer');
  const interactivePoints = document.getElementById('interactivePoints');
  
  backgroundContainer.style.opacity = '0';
  interactivePoints.style.opacity = '0';
  
  setTimeout(() => {
    // Hide street view
    backgroundContainer.style.display = 'none';
    interactivePoints.style.display = 'none';
    
    // Show panorama
    panoramaContainer.style.display = 'block';
    panoramaContainer.style.opacity = '0';
    
    // Initialize panorama
    isMapView = false;
    loadPanoramaImage(point);
    
    setTimeout(() => {
      panoramaContainer.style.opacity = '1';
      createFoodPanoramaPoints();
    }, 100);
  }, 300);
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
  
  // Create HTML overlay points for each food-specific point
  foodPoints.forEach((foodSubPoint, index) => {
    // Create HTML element for the point
    const pointElement = document.createElement('div');
    pointElement.className = 'panorama-point food-point';
    pointElement.dataset.index = index;
    pointElement.dataset.key = foodSubPoint.key;
    
    // Store 3D coordinates for panorama positioning
    pointElement.dataset.longitude = foodSubPoint.longitude;
    pointElement.dataset.latitude = foodSubPoint.latitude;
    
    // Initial position will be updated by panorama positioning
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
    
    // Add to overlay
    panoramaOverlay.appendChild(pointElement);
    
    // Store in array
    panoramaPoints.push({
      element: pointElement,
      foodSubPoint: foodSubPoint,
      index: index
    });
  });
  
  // Add a special "back to street view" point in the center
  const backToStreetPoint = document.createElement('div');
  backToStreetPoint.className = 'panorama-point back-to-street';
  backToStreetPoint.style.left = '50%';
  backToStreetPoint.style.top = '20%';
  
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
  
  // Mark this panorama point as visited
  visitedContent.add(foodSubPoint.title);
  
  currentStoryPoint = { 
    title: foodSubPoint.title,
    mainText: foodSubPoint.content
  };
  
  locationTitle.textContent = foodSubPoint.title;
  locationSubtitle.textContent = "";
  
  // Clear dialogue content
  dialogueTextContainer.innerHTML = '';
  
  // Create dialogue entry
  const dialogueEntry = document.createElement('div');
  dialogueEntry.className = 'dialogue-entry';
  
  // Add speaker if available
  if (foodSubPoint.content.speaker) {
    const speakerDiv = document.createElement('div');
    speakerDiv.className = 'dialogue-speaker';
    speakerDiv.textContent = foodSubPoint.content.speaker;
    dialogueEntry.appendChild(speakerDiv);
  }
  
  // Add main text
  const textDiv = document.createElement('div');
  textDiv.className = 'section-text';
  textDiv.innerHTML = parseTextWithLinks(foodSubPoint.content.text);
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

// Update panorama point positions based on camera rotation
function updatePanoramaPointPositions() {
  if (!panoramaPoints || panoramaPoints.length === 0 || !panoramaCamera) return;
  
  panoramaPoints.forEach(pointData => {
    const pointElement = pointData.element;
    if (!pointElement) return;
    
    // Skip the back-to-street button - it should stay fixed on screen
    if (pointElement.classList.contains('back-to-street')) return;
    
    // Get stored 3D coordinates from element dataset
    const pointLon = parseFloat(pointElement.dataset.longitude);
    const pointLat = parseFloat(pointElement.dataset.latitude);
    
    // Skip points without valid coordinates
    if (isNaN(pointLon) || isNaN(pointLat)) {
      return;
    }
    
    // Convert spherical coordinates to 3D position on the panorama sphere
    const phi = THREE.MathUtils.degToRad(90 - pointLat);
    const theta = THREE.MathUtils.degToRad(pointLon);
    
    // Position on sphere (same radius as panorama sphere)
    const sphereRadius = 490; // Slightly inside the panorama sphere (500)
    const worldPosition = new THREE.Vector3(
      sphereRadius * Math.sin(phi) * Math.cos(theta),
      sphereRadius * Math.cos(phi),
      sphereRadius * Math.sin(phi) * Math.sin(theta)
    );
    
    // Project 3D world position to 2D screen coordinates
    const screenPosition = worldPosition.clone().project(panoramaCamera);
    
    // Convert normalized device coordinates to screen percentages
    const screenX = (screenPosition.x + 1) * 50;
    const screenY = (1 - screenPosition.y) * 50;
    
    // Update point position smoothly - no constraints or limits
    pointElement.style.left = `${screenX}%`;
    pointElement.style.top = `${screenY}%`;
    
    // Always keep points visible and interactive
    pointElement.style.opacity = '1';
    pointElement.style.pointerEvents = 'auto';
  });
}

// Show energy sub-content dialogue
function showEnergySubContent(energySubPoint) {
  if (!energySubPoint.content) return;
  
  // Mark this panorama point as visited
  visitedContent.add(energySubPoint.title);
  
  currentStoryPoint = { 
    title: energySubPoint.title,
    mainText: energySubPoint.content
  };
  
  locationTitle.textContent = energySubPoint.title;
  locationSubtitle.textContent = "";
  
  // Clear dialogue content
  dialogueTextContainer.innerHTML = '';
  
  // Create dialogue entry
  const dialogueEntry = document.createElement('div');
  dialogueEntry.className = 'dialogue-entry';
  
  // Add speaker if exists
  if (energySubPoint.content.speaker) {
    const speakerElement = document.createElement('div');
    speakerElement.className = 'dialogue-speaker';
    speakerElement.textContent = energySubPoint.content.speaker;
    dialogueEntry.appendChild(speakerElement);
  }
  
  // Add text content
  const textElement = document.createElement('div');
  textElement.className = 'section-text';
  textElement.textContent = energySubPoint.content.text;
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
  
  // Mark this panorama point as visited
  visitedContent.add(educationSubPoint.title);
  
  currentStoryPoint = { 
    title: educationSubPoint.title,
    mainText: educationSubPoint.content
  };
  
  locationTitle.textContent = educationSubPoint.title;
  locationSubtitle.textContent = "";
  
  // Clear dialogue content
  dialogueTextContainer.innerHTML = '';
  
  // Create dialogue entry
  const dialogueEntry = document.createElement('div');
  dialogueEntry.className = 'dialogue-entry';
  
  // Add speaker if exists
  if (educationSubPoint.content.speaker) {
    const speakerElement = document.createElement('div');
    speakerElement.className = 'dialogue-speaker';
    speakerElement.textContent = educationSubPoint.content.speaker;
    dialogueEntry.appendChild(speakerElement);
  }
  
  // Add text content
  const textElement = document.createElement('div');
  textElement.className = 'section-text';
  textElement.textContent = educationSubPoint.content.text;
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
  
  // Fade out panorama view
  panoramaContainer.style.opacity = '0';
  
  setTimeout(() => {
    // Switch back to map view
    isMapView = true;
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
  
  // Smooth transition to new camera position
  const startLon = lon;
  const startLat = lat;
  const targetLon = targetLongitude;
  const targetLat = Math.max(-85, Math.min(85, targetLatitude)); // Clamp latitude
  
  const duration = 800; // Animation duration in ms
  const startTime = Date.now();
  
  function animateCamera() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Easing function (ease-out)
    const easeOut = 1 - Math.pow(1 - progress, 3);
    
    // Interpolate between start and target positions
    lon = startLon + (targetLon - startLon) * easeOut;
    lat = startLat + (targetLat - startLat) * easeOut;
    
    if (progress < 1) {
      requestAnimationFrame(animateCamera);
    }
  }
  
  animateCamera();
}

// Initialize background music
function initializeMusic() {
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

// Note: Panorama click handling now done via HTML overlay elements directly

window.addEventListener("load", initialize);
