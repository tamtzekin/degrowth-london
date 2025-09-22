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

// Mobile paragraph dialogue system variables
let isMobileParagraphMode = false; // Track if we're in mobile paragraph mode
let currentParagraphs = []; // Array of paragraphs to display
let currentParagraphIndex = 0; // Current paragraph being displayed
let isExpandedMobileView = false; // Track if mobile dialogue is expanded to full screen
let completedParagraphs = []; // Store completed paragraphs for expanded view

// View toggle variables
let isMapView = true;
let isSceneMode = false; // Track if we're in a dedicated scene mode
let currentSceneType = null; // Track which scene we're in (Energy, Food, etc.)
let panoramaScene, panoramaCamera, panoramaRenderer, panoramaSphere, panoramaSphereNight, panoramaAmbientLight;

// Day/Night toggle uses simple direct image swap
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
// locationSubtitle removed
const dialogueTextContainer = document.getElementById("dialogueTextContainer");
const helpOverlay = document.getElementById("helpOverlay");
const helpClose = document.getElementById("helpClose");
const introOverlay = document.getElementById("introOverlay");
const introContinue = document.getElementById("introContinue");
const panoramaContainer = document.getElementById("panoramaContainer");
const panoramaCanvas = document.getElementById("panoramaCanvas");
const panoramaOverlay = document.getElementById("panoramaOverlay");

// Initialize scrollable street view background to replace CSS pseudo-elements
function initializeScrollableStreetView() {
  const backgroundContainer = document.getElementById('backgroundContainer');
  const backgroundImage = backgroundContainer?.querySelector('.background-image');
  
  if (backgroundImage) {
    // Check current day/night mode
    const isNightMode = document.body.classList.contains('high-contrast');
    
    // Set the default street view image with scrollable sizing
    const defaultImagePath = isNightMode ? 'assets/images/Full-Night.jpg' : 'assets/images/Full-Day.jpg';
    
    // Apply the default street background with scrollable width
    backgroundImage.style.backgroundImage = `url(${defaultImagePath})`;
    backgroundImage.style.backgroundSize = 'auto 100%';  // Full height, auto width for scrolling
    backgroundImage.style.backgroundPosition = 'center center';
    backgroundImage.style.backgroundRepeat = 'no-repeat';
    
    // Add scene-active class to hide pseudo-elements and use our custom background
    backgroundImage.classList.add('scene-active');
    backgroundImage.style.setProperty('--scene-active', '1');
    
    console.log('Initialized scrollable street view background:', defaultImagePath);
  }
}

// Initialize the application
async function initialize() {
  try {
    // Load story data from JSON file
    const response = await fetch("assets/story-data.json");
    storyPoints = await response.json();

    // Initialize scrollable street view background
    initializeScrollableStreetView();
    
    // Day/night toggle uses direct image swap - no initialization needed
    
    // Setup background drag controls for horizontal scrolling
    setupBackgroundDragControls();
    
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

// Calculate image-relative positions that stay locked to image content
function calculateImageRelativePosition(percentX, percentY) {
  const backgroundContainer = document.getElementById('backgroundContainer');
  const backgroundImage = backgroundContainer?.querySelector('.background-image');
  
  if (!backgroundImage) {
    // Fallback to old percentage system if no background image
    return { left: `${percentX}%`, top: `${percentY}%` };
  }
  
  // Get container dimensions
  const containerRect = backgroundContainer.getBoundingClientRect();
  const containerWidth = containerRect.width;
  const containerHeight = containerRect.height;
  
  // For background-size: auto 100%, the image height matches container height
  // The width is scaled proportionally based on the actual image aspect ratio
  
  // Use the actual aspect ratio for 7000x2000 images
  let imageAspectRatio = 3.5; // 7000/2000 = 3.5:1 aspect ratio
  const backgroundUrl = backgroundImage.style.backgroundImage;
  
  if (backgroundUrl && backgroundUrl !== 'none') {
    // All your images are 7000x2000, so use consistent aspect ratio
    imageAspectRatio = 3.5; // All images are 7000x2000
  }
  
  const scaledImageWidth = containerHeight * imageAspectRatio;
  const scaledImageHeight = containerHeight;
  
  // Calculate position for 7000x2000 images with background-size: auto 100%
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // With background-size: auto 100%, image height = viewport height
  // Image width = viewport height * aspect ratio  
  const renderedImageHeight = viewportHeight;
  const renderedImageWidth = renderedImageHeight * imageAspectRatio;
  
  // Since background-position: center center, the image is centered in viewport
  const imageCenterX = viewportWidth / 2;
  
  // Calculate where the left edge of the image is relative to the viewport
  const imageLeftEdge = imageCenterX - (renderedImageWidth / 2);
  
  // Calculate actual position based on x,y coordinates from story-data
  // x,y are percentages relative to the 7000x2000 image
  const imageX = (percentX / 100) * renderedImageWidth;
  const imageY = (percentY / 100) * renderedImageHeight;
  
  // Convert image coordinates to viewport coordinates
  const finalX = imageLeftEdge + imageX;
  const finalY = imageY;
  
  return { 
    left: `${finalX}px`, 
    top: `${finalY}px`,
    // Store original percentages for reference
    dataPercentX: percentX,
    dataPercentY: percentY
  };
}

function createInteractivePoints() {
  storyPoints.forEach((point, index) => {
    const pointElement = document.createElement("div");
    pointElement.className = "point";
    // Use mobile coordinates on mobile devices, desktop coordinates otherwise
    const isMobile = window.innerWidth <= 480;
    const x = isMobile && point.mobileX !== undefined ? point.mobileX : point.x;
    const y = isMobile && point.mobileY !== undefined ? point.mobileY : point.y;
    
    // Calculate image-relative position
    const position = calculateImageRelativePosition(x, y);
    pointElement.style.left = position.left;
    pointElement.style.top = position.top;
    
    // Store original percentage coordinates for repositioning
    pointElement.dataset.percentX = x;
    pointElement.dataset.percentY = y;
    pointElement.dataset.index = index;
    pointElement.dataset.title = point.title;
    
    pointElement.addEventListener("click", () =>
      handleCircleClick(point, pointElement, index),
    );
    
    // Add hover event listeners for title display (desktop only)
    pointElement.addEventListener("mouseenter", (e) => {
      // Disable edge scrolling while hovering over circle
      isHoveringCircle = true;
      stopEdgeScrolling(); // Stop any current scrolling immediately
      
      // Only show hover titles on desktop (not mobile)
      const isMobile = window.innerWidth <= 480;
      if (!isMobile) {
        // Add small delay to prevent flickering
        clearTimeout(pointElement.hoverTimeout);
        pointElement.hoverTimeout = setTimeout(() => showHoverTitle(e, point.title), 50);
      }
    });
    pointElement.addEventListener("mouseleave", () => {
      // Re-enable edge scrolling when leaving circle
      isHoveringCircle = false;
      // Clear any pending hover timeout
      clearTimeout(pointElement.hoverTimeout);
      hideHoverTitle();
    });

    // Add mobile touch hold functionality
    let holdTimeout = null;
    let isHolding = false;
    
    pointElement.addEventListener("touchstart", (e) => {
      const isMobile = window.innerWidth <= 480;
      if (isMobile) {
        isHolding = false;
        
        // Start hold timer
        holdTimeout = setTimeout(() => {
          isHolding = true;
          // Scale up circle like desktop hover
          pointElement.style.transform = 'translate(-50%, -50%) scale(1.15)';
          pointElement.style.transition = 'transform 0.2s ease';
          
          // Show title with subtle animation
          showHoverTitle(e, point.title);
        }, 500); // 500ms hold to trigger
      }
    });
    
    pointElement.addEventListener("touchend", (e) => {
      const isMobile = window.innerWidth <= 480;
      if (isMobile) {
        // Clear hold timer
        if (holdTimeout) {
          clearTimeout(holdTimeout);
          holdTimeout = null;
        }
        
        if (isHolding) {
          // Was holding - reset scale and hide title
          pointElement.style.transform = 'translate(-50%, -50%) scale(1)';
          hideHoverTitle();
          isHolding = false;
          e.preventDefault(); // Prevent click
        }
        // If not holding, let normal click handler work
      }
    });
    
    pointElement.addEventListener("touchcancel", (e) => {
      const isMobile = window.innerWidth <= 480;
      if (isMobile && holdTimeout) {
        clearTimeout(holdTimeout);
        holdTimeout = null;
        if (isHolding) {
          pointElement.style.transform = 'translate(-50%, -50%) scale(1)';
          hideHoverTitle();
          isHolding = false;
        }
      }
    });
    
    interactivePoints.appendChild(pointElement);
    pointElements.push(pointElement);
  });
}

// Update all circle positions to stay locked to image coordinates
function updatePointPositions() {
  pointElements.forEach(pointElement => {
    const percentX = parseFloat(pointElement.dataset.percentX);
    const percentY = parseFloat(pointElement.dataset.percentY);
    
    const position = calculateImageRelativePosition(percentX, percentY);
    pointElement.style.left = position.left;
    pointElement.style.top = position.top;
  });
  
  // Also update scene circles if they exist
  const sceneCircles = document.querySelectorAll('.scene-circle');
  sceneCircles.forEach(circle => {
    const percentX = parseFloat(circle.dataset.percentX);
    const percentY = parseFloat(circle.dataset.percentY);
    
    if (!isNaN(percentX) && !isNaN(percentY)) {
      const position = calculateImageRelativePosition(percentX, percentY);
      circle.style.left = position.left;
      circle.style.top = position.top;
    }
  });
}

// Background drag system DISABLED - using main drag system instead
// This was causing conflicts and jankiness with the main dragging system

function setupBackgroundDragControls() {
  // Disabled to prevent conflicts with main drag system
  console.log('Background drag controls disabled - using main drag system');
}

let hoverTitleElement = null;
let objectOutlinesContainer = null;

// Initialize object outlines container
function initializeObjectOutlines() {
  if (!objectOutlinesContainer) {
    objectOutlinesContainer = document.createElement('div');
    objectOutlinesContainer.id = 'objectOutlinesContainer';
    objectOutlinesContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 100;
    `;
    document.body.appendChild(objectOutlinesContainer);
    console.log('Object outlines container initialized');
  }
}

// Show object outline for a specific circle
function showObjectOutline(circleTitle) {
  hideObjectOutlines(); // Clear any existing outlines
  
  const outline = getObjectOutlineDefinition(circleTitle);
  if (!outline) return;
  
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.className = `object-outline ${circleTitle.toLowerCase()}-outline`;
  svg.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 100;
  `;
  
  svg.innerHTML = outline;
  objectOutlinesContainer.appendChild(svg);
  
  console.log(`Showing object outline for: ${circleTitle}`);
}

// Hide all object outlines
function hideObjectOutlines() {
  if (objectOutlinesContainer) {
    objectOutlinesContainer.innerHTML = '';
  }
}

// Get SVG path definition for specific objects
function getObjectOutlineDefinition(circleTitle) {
  const outlines = {
    'Governance': `
      <path d="M45% 58% L58% 60% L58% 75% L45% 73% Z" 
            stroke="#f9c1ce" 
            stroke-width="3" 
            fill="none" 
            vector-effect="non-scaling-stroke"
            stroke-dasharray="8,4"
            opacity="0.8">
        <animate attributeName="stroke-dashoffset" 
                 values="0;12" 
                 dur="1s" 
                 repeatCount="indefinite"/>
      </path>
    `,
    'Transport': `
      <path d="M48% 60% L68% 62% L65% 75% L45% 73% Z" 
            stroke="#f9c1ce" 
            stroke-width="3" 
            fill="none" 
            vector-effect="non-scaling-stroke"
            stroke-dasharray="6,3"
            opacity="0.8">
        <animate attributeName="stroke-dashoffset" 
                 values="0;9" 
                 dur="0.8s" 
                 repeatCount="indefinite"/>
      </path>
    `,
    'Energy': `
      <ellipse cx="51%" cy="18%" rx="8%" ry="6%" 
               stroke="#f9c1ce" 
               stroke-width="3" 
               fill="none" 
               vector-effect="non-scaling-stroke"
               stroke-dasharray="10,5"
               opacity="0.8">
        <animate attributeName="stroke-dashoffset" 
                 values="0;15" 
                 dur="1.2s" 
                 repeatCount="indefinite"/>
      </ellipse>
    `,
    'Food': `
      <path d="M25% 55% L45% 58% L42% 70% L28% 67% Z" 
            stroke="#f9c1ce" 
            stroke-width="3" 
            fill="none" 
            vector-effect="non-scaling-stroke"
            stroke-dasharray="7,4"
            opacity="0.8">
        <animate attributeName="stroke-dashoffset" 
                 values="0;11" 
                 dur="0.9s" 
                 repeatCount="indefinite"/>
      </path>
    `,
    'Housing': `
      <rect x="75%" y="45%" width="15%" height="12%" 
            stroke="#f9c1ce" 
            stroke-width="3" 
            fill="none" 
            vector-effect="non-scaling-stroke"
            stroke-dasharray="8,3"
            opacity="0.8">
        <animate attributeName="stroke-dashoffset" 
                 values="0;11" 
                 dur="1s" 
                 repeatCount="indefinite"/>
      </rect>
    `,
    'Education': `
      <path d="M68% 8% L85% 10% L83% 22% L66% 20% Z" 
            stroke="#f9c1ce" 
            stroke-width="3" 
            fill="none" 
            vector-effect="non-scaling-stroke"
            stroke-dasharray="9,4"
            opacity="0.8">
        <animate attributeName="stroke-dashoffset" 
                 values="0;13" 
                 dur="1.1s" 
                 repeatCount="indefinite"/>
      </path>
    `
  };
  
  return outlines[circleTitle] || null;
}

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
  
  // Mobile-specific touch handler for closing dialogue
  container.addEventListener("touchend", (e) => {
    const isMobile = window.innerWidth <= 480;
    if (!isMobile) return;
    
    const target = e.changedTouches ? e.changedTouches[0].target : e.target;
    const isUIElement = target.closest('#helpButton') || 
                       target.closest('#contrastToggle') || 
                       target.closest('#textSpeedToggle') ||
                       target.closest('.help-overlay') ||
                       target.closest('.point');
    
    const clickedOutsideDialogue = !dialoguePanel.contains(target) && 
                                   !target.closest(".interactive-text") && 
                                   !target.closest(".interactive-text") &&
                                   !isUIElement;
    
    console.log('📱 Mobile TOUCHEND - dialogue check:', {
      dialogueVisible: dialoguePanel.classList.contains("visible"),
      clickedOutsideDialogue,
      wasDragging,
      target: target.tagName + (target.id ? '#' + target.id : ''),
      isUIElement,
      timeStamp: e.timeStamp
    });
    
    // Close dialogue on mobile single tap outside dialogue
    if (dialoguePanel.classList.contains("visible") && clickedOutsideDialogue && !wasDragging) {
      console.log('📱 Mobile touchend - closing dialogue');
      
      if (isMobileParagraphMode) {
        closeMobileDialogueWithAnimation();
      } else {
        hideDialogue();
      }
      e.preventDefault();
      e.stopPropagation(); // Prevent any subsequent click events
    }
  });

  // Auto-close intro popup when clicking on map or interacting with points
  container.addEventListener("click", (e) => {
    const isMobile = window.innerWidth <= 480;
    
    console.log('📱 Container CLICK event fired:', {
      isMobile,
      target: e.target.tagName + (e.target.id ? '#' + e.target.id : ''),
      timeStamp: e.timeStamp,
      type: e.type,
      preventDefault: e.defaultPrevented,
      closestUIElement: {
        helpButton: !!e.target.closest('#helpButton'),
        contrastToggle: !!e.target.closest('#contrastToggle'),
        textSpeedToggle: !!e.target.closest('#textSpeedToggle'),
        helpOverlay: !!e.target.closest('.help-overlay'),
        dialoguePanel: !!e.target.closest('.dialogue-panel'),
        point: !!e.target.closest('.point')
      }
    });
    
    // On mobile, only prevent click events for map area clicks, allow UI element clicks
    if (isMobile) {
      const isUIElement = e.target.closest('#helpButton') || 
                         e.target.closest('#contrastToggle') || 
                         e.target.closest('#textSpeedToggle') ||
                         e.target.closest('.help-overlay') ||
                         e.target.closest('.dialogue-panel') ||
                         e.target.closest('.point');
      
      console.log('📱 Mobile UI check:', { isUIElement, willPrevent: !isUIElement });
      
      if (!isUIElement) {
        // Only prevent map area clicks that would close dialogues
        console.log('📱 Preventing container click event (map area)');
        e.preventDefault();
        return;
      } else {
        console.log('📱 Allowing container click event (UI element)');
      }
    }
    
    const clickedOutsideDialogue = !dialoguePanel.contains(e.target) && 
                                   !e.target.closest(".point") && 
                                   !e.target.classList.contains("interactive-text") && 
                                   !e.target.closest(".interactive-text");
    
    // Close dialogue when clicking outside on desktop only
    if (dialoguePanel.classList.contains("visible") && clickedOutsideDialogue) {
      console.log('Outside click detected - closing dialogue (desktop)');
      hideDialogue();
      
      // Don't reset map position - keep current view
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
    const isHelpOverlayVisible = !helpOverlay.classList.contains("hidden");
    const isTargetInOverlay = helpOverlay.contains(e.target);
    const isTargetInDialogue = dialoguePanel.contains(e.target);
    const isHelpButton = e.target.id === 'helpButton' || e.target.closest('#helpButton');
    
    console.log('Document click - Help overlay check:', {
      target: e.target.tagName + (e.target.id ? '#' + e.target.id : '') + (e.target.className && typeof e.target.className === 'string' ? '.' + e.target.className.split(' ')[0] : ''),
      isHelpOverlayVisible,
      isTargetInOverlay,
      isTargetInDialogue,
      isHelpButton,
      currentTime: Date.now()
    });
    
    // Close help overlay when clicking outside it (single click should work)
    if (
      isHelpOverlayVisible &&
      !isTargetInOverlay &&
      !isTargetInDialogue &&
      !isHelpButton  // Don't close if clicking help button itself
    ) {
      console.log('✅ Closing help overlay via outside click');
      e.preventDefault();
      e.stopPropagation();
      closeHelpOverlay();
    }
  }, true); // Use capture phase to ensure we catch clicks first

  // Auto-close intro overlay when clicking anywhere except intro overlay (same pattern as help overlay)
  document.addEventListener("click", (e) => {
    const isIntroOverlayVisible = introOverlay && introOverlay.classList.contains('visible');
    const isTargetInIntroOverlay = introOverlay && introOverlay.contains(e.target);
    const isTargetInDialogue = dialoguePanel.contains(e.target);
    const isIntroContinueButton = e.target.id === 'introContinue' || e.target.closest('#introContinue');
    
    console.log('Document click - Intro overlay check:', {
      target: e.target.tagName + (e.target.id ? '#' + e.target.id : '') + (e.target.className && typeof e.target.className === 'string' ? '.' + e.target.className.split(' ')[0] : ''),
      isIntroOverlayVisible,
      isTargetInIntroOverlay,
      isTargetInDialogue,
      isIntroContinueButton,
      currentTime: Date.now()
    });
    
    // Close intro overlay when clicking outside it
    if (
      isIntroOverlayVisible &&
      !isTargetInIntroOverlay &&
      !isTargetInDialogue &&
      !isIntroContinueButton  // Don't close if clicking continue button itself
    ) {
      console.log('✅ Closing intro overlay via outside click');
      e.preventDefault();
      e.stopPropagation();
      closeIntroOverlay();
    }
  }, true); // Use capture phase to ensure we catch clicks first

  // Centralized function to close help overlay
  function closeHelpOverlay() {
    console.log('✅ Closing help overlay');
    helpOverlay.classList.add("hidden");
    // Remove active state from help button
    const helpButton = document.getElementById('helpButton');
    if (helpButton) helpButton.classList.remove('active');
    // Show help button after first close
    showHelpButtonAfterFirstClose();
    // Start music when user interacts (closes help overlay)
    startMusicAfterUserInteraction();
    
    // Prevent immediate dragging after help overlay closes
    window.helpOverlayJustClosed = true;
    
    // Ensure container is not in dragging state
    isDragging = false;
    container.classList.remove("dragging");
    
    setTimeout(() => {
      window.helpOverlayJustClosed = false;
    }, 300); // 300ms delay
    
    console.log('✅ Help overlay closed successfully');
  }
  
  // Multiple event listeners for OK button to ensure it works
  helpClose.addEventListener("click", (e) => {
    console.log('✅ Help close button clicked via click event');
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    closeHelpOverlay();
  });
  
  helpClose.addEventListener("touchend", (e) => {
    console.log('✅ Help close button touched via touchend event');
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    closeHelpOverlay();
  });
  
  helpClose.addEventListener("mouseup", (e) => {
    console.log('✅ Help close button clicked via mouseup event');
    e.preventDefault();
    e.stopPropagation();
    closeHelpOverlay();
  });
  
  // Debug logging
  helpClose.addEventListener("touchstart", () => {
    console.log('💆 Help close button touch started');
  });
  
  console.log('Help close button setup complete:', {
    element: helpClose,
    rect: helpClose.getBoundingClientRect(),
    computed: window.getComputedStyle(helpClose),
    parent: helpClose.parentElement
  });

  
  // Setup intro close handlers (removed - using global click handler like help overlay)
  
  
  // Setup intro overlay functionality
  function closeIntroOverlay() {
    console.log('🎬 Closing intro overlay and showing help overlay');
    
    // Hide intro overlay with slide animation, then remove from DOM
    introOverlay.classList.remove("visible");
    
    // Prevent immediate dragging after intro overlay closes (same pattern as help overlay)
    window.introOverlayJustClosed = true;
    
    // Ensure container is not in dragging state
    isDragging = false;
    container.classList.remove("dragging");
    
    setTimeout(() => {
      window.introOverlayJustClosed = false;
    }, 300); // 300ms delay - same as help overlay
    
    // Remove from DOM and show help overlay after animation completes
    setTimeout(() => {
      introOverlay.remove();
      helpOverlay.classList.remove("hidden");
    }, 300); // Match CSS transition duration
    
    console.log('✅ Intro overlay closed, help overlay shown');
  }
  
  // Multiple event listeners for intro continue button to ensure it works
  introContinue.addEventListener("click", (e) => {
    console.log('✅ Intro continue button clicked via click event');
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    closeIntroOverlay();
  });
  
  introContinue.addEventListener("touchend", (e) => {
    console.log('✅ Intro continue button touched via touchend event');
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    closeIntroOverlay();
  });
  
  introContinue.addEventListener("mouseup", (e) => {
    console.log('✅ Intro continue button clicked via mouseup event');
    e.preventDefault();
    e.stopPropagation();
    closeIntroOverlay();
  });
  
  console.log('Intro overlay setup complete:', {
    introOverlay: introOverlay,
    introContinue: introContinue
  });
  
  // Help button event listener to reopen help overlay
  const helpButton = document.getElementById("helpButton");
  helpButton.addEventListener("click", (e) => {
    console.log('❓ Help button CLICK event fired:', {
      isMobile: window.innerWidth <= 480,
      target: e.target,
      timeStamp: e.timeStamp,
      type: e.type,
      touches: e.touches?.length || 'N/A',
      preventDefault: e.defaultPrevented
    });
    helpOverlay.classList.remove("hidden");
    // Add active state to help button
    helpButton.classList.add('active');
  });
  
  // Also add touch event logging to help button
  helpButton.addEventListener("touchstart", (e) => {
    console.log('❓ Help button TOUCHSTART event fired:', {
      timeStamp: e.timeStamp,
      touches: e.touches.length,
      target: e.target
    });
  });
  
  helpButton.addEventListener("touchend", (e) => {
    console.log('❓ Help button TOUCHEND event fired:', {
      timeStamp: e.timeStamp,
      touches: e.touches.length,
      changedTouches: e.changedTouches.length,
      target: e.target,
      preventDefault: e.defaultPrevented
    });
    
    // Handle the help button directly on touchend for mobile to avoid double-tap
    const isMobile = window.innerWidth <= 480;
    if (isMobile) {
      console.log('❓ Opening help overlay via TOUCHEND (mobile)');
      e.preventDefault(); // Prevent subsequent click event
      
      // Execute the same logic as the click handler
      helpOverlay.classList.remove("hidden");
      helpButton.classList.add('active');
    }
  });
  
  // Check if help button should be shown on page load
  const hasClosedBefore = localStorage.getItem('helpOverlayClosedOnce');
  if (hasClosedBefore) {
    helpButton.classList.add('show');
  }
  
  // Imprint overlay functionality
  const spiralLogo = document.querySelector('.spiral-logo');
  const imprintOverlay = document.getElementById('imprintOverlay');
  const imprintClose = document.getElementById('imprintClose');
  
  // Spiral logo click handler to open imprint overlay
  spiralLogo.addEventListener("click", (e) => {
    console.log('🌀 Spiral logo CLICK event fired:', {
      isMobile: window.innerWidth <= 480,
      target: e.target,
      timeStamp: e.timeStamp,
      type: e.type
    });
    imprintOverlay.classList.remove("hidden");
  });
  
  // Spiral logo touch handler for mobile
  spiralLogo.addEventListener("touchend", (e) => {
    const isMobile = window.innerWidth <= 480;
    if (isMobile) {
      console.log('🌀 Opening imprint overlay via TOUCHEND (mobile)');
      e.preventDefault(); // Prevent subsequent click event
      imprintOverlay.classList.remove("hidden");
    }
  });
  
  // Imprint close button handler
  imprintClose.addEventListener("click", (e) => {
    console.log('✅ Closing imprint overlay');
    e.preventDefault();
    e.stopPropagation();
    imprintOverlay.classList.add("hidden");
  });
  
  // Close imprint overlay when clicking outside it
  document.addEventListener("click", (e) => {
    const isImprintOverlayVisible = !imprintOverlay.classList.contains("hidden");
    const isTargetInOverlay = imprintOverlay.contains(e.target);
    const isSpiralLogo = e.target.closest('.spiral-logo');
    
    if (isImprintOverlayVisible && !isTargetInOverlay && !isSpiralLogo) {
      console.log('✅ Closing imprint overlay (outside click)');
      imprintOverlay.classList.add("hidden");
    }
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
  const speedValues = { FAST: 0, RELAXED: 65, ZEN: 50 };
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
    console.log('🌙 Day/Night toggle CLICK event fired:', {
      isMobile: window.innerWidth <= 480,
      target: e.target,
      timeStamp: e.timeStamp,
      type: e.type,
      touches: e.touches?.length || 'N/A',
      preventDefault: e.defaultPrevented,
      stopPropagation: 'called'
    });
    e.stopPropagation(); // Prevent event bubbling
    
    // Play light switch sound effect
    playLightSwitchSound();
    
    isHighContrast = !isHighContrast;
    document.body.classList.toggle("high-contrast", isHighContrast);
    
    // Simple direct image swap - no complex transitions
    swapDayNightImage();

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
  
  // Also add touch event logging to day/night toggle
  contrastToggle.addEventListener("touchstart", (e) => {
    console.log('🌙 Day/Night toggle TOUCHSTART event fired:', {
      timeStamp: e.timeStamp,
      touches: e.touches.length,
      target: e.target
    });
  });
  
  contrastToggle.addEventListener("touchend", (e) => {
    console.log('🌙 Day/Night toggle TOUCHEND event fired:', {
      timeStamp: e.timeStamp,
      touches: e.touches.length,
      changedTouches: e.changedTouches.length,
      target: e.target,
      preventDefault: e.defaultPrevented
    });
    
    // Handle the toggle directly on touchend for mobile to avoid double-tap
    const isMobile = window.innerWidth <= 480;
    if (isMobile) {
      console.log('🌙 Executing day/night toggle via TOUCHEND (mobile)');
      e.preventDefault(); // Prevent subsequent click event
      
      // Execute the same logic as the click handler
      playLightSwitchSound();
      isHighContrast = !isHighContrast;
      document.body.classList.toggle("high-contrast", isHighContrast);
      swapDayNightImage();
      
      // Update the SVG icon
      if (isHighContrast) {
        contrastToggle.innerHTML = `
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>
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
    }
  });

}

function startDrag(e) {
  if (e.target.classList.contains("point") || e.target.closest(".dialogue-panel")) {
    console.log('🛑 Drag blocked: point or dialogue panel');
    return;
  }
  if (window.helpOverlayJustClosed) {
    console.log('🛑 Drag blocked: help overlay just closed');
    return;
  }
  if (window.introOverlayJustClosed) {
    console.log('🛑 Drag blocked: intro overlay just closed');
    return;
  }
  if (introOverlay && introOverlay.classList.contains('visible')) {
    console.log('🛑 Drag blocked: intro overlay is visible');
    return;
  }
  
  console.log('✅ Starting drag - intro overlay visible:', introOverlay?.classList.contains('visible'));
  isDragging = true;
  container.classList.add("dragging");
  startX = e.clientX - currentX;
  startY = e.clientY - currentY;
}

function startDragTouch(e) {
  if (e.target.classList.contains("point") || e.target.closest(".dialogue-panel")) {
    console.log('🛑 Touch drag blocked: point or dialogue panel');
    return;
  }
  if (window.helpOverlayJustClosed) {
    console.log('🛑 Touch drag blocked: help overlay just closed');
    return;
  }
  if (window.introOverlayJustClosed) {
    console.log('🛑 Touch drag blocked: intro overlay just closed');
    return;
  }
  if (introOverlay && introOverlay.classList.contains('visible')) {
    console.log('🛑 Touch drag blocked: intro overlay is visible');
    return;
  }
  
  console.log('✅ Starting touch drag - intro overlay visible:', introOverlay?.classList.contains('visible'));
  
  isDragging = true;
  container.classList.add("dragging");
  const touch = e.touches[0];
  
  // Store the initial touch position and current translation
  startX = touch.clientX - currentX;
  startY = touch.clientY - currentY;
  
  // Disable smooth transitions during drag to prevent conflicts
  document.documentElement.style.setProperty('--dragging', '1');
  
  // Prevent scrolling and other touch behaviors on mobile
  e.preventDefault();
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
  
  // Calculate new position - 1:1 movement with touch for smooth dragging
  const deltaX = (touch.clientX - startX) - currentX;
  const deltaY = (touch.clientY - startY) - currentY;
  
  // Close dialogue on mobile when user drags the map
  const isMobile = window.innerWidth <= 480;
  if (isMobile && dialoguePanel.classList.contains("visible")) {
    const dragDistance = Math.abs(deltaX) + Math.abs(deltaY);
    if (dragDistance > 20) { // Close after minimal drag movement
      console.log('Mobile drag detected - closing dialogue');
      
      if (isMobileParagraphMode) {
        closeMobileDialogueWithAnimation();
      } else {
        hideDialogue();
      }
    }
  }
  
  // Close intro overlay on mobile when user drags the map
  if (isMobile && introOverlay && introOverlay.classList.contains('visible')) {
    const dragDistance = Math.abs(deltaX) + Math.abs(deltaY);
    if (dragDistance > 20) { // Close after minimal drag movement
      console.log('Mobile drag detected - closing intro overlay');
      closeIntroOverlay();
    }
  }
  
  // Close help overlay on mobile when user drags the map
  if (isMobile && helpOverlay && !helpOverlay.classList.contains('hidden')) {
    const dragDistance = Math.abs(deltaX) + Math.abs(deltaY);
    if (dragDistance > 20) { // Close after minimal drag movement
      console.log('Mobile drag detected - closing help overlay');
      closeHelpOverlay();
    }
  }
  
  // Apply mobile sensitivity multiplier to the delta, not absolute position
  const mobileSensitivity = 1.3; // Slightly more responsive
  const newX = currentX + (deltaX * mobileSensitivity);
  const newY = currentY + (deltaY * mobileSensitivity);
  
  // Apply drag limits to prevent going beyond image boundaries
  const limits = calculateImageDragLimits();
  
  // Apply bounds smoothly
  currentX = Math.max(-limits.maxX, Math.min(limits.maxX, newX));
  currentY = Math.max(-limits.maxY, Math.min(limits.maxY, newY));
  
  updateBackgroundPosition();
}

function endDrag() {
  isDragging = false;
  container.classList.remove("dragging");
  
  // Re-enable smooth transitions after drag ends for a polished feel
  backgroundContainer.style.transition = 'transform 0.08s ease';
  interactivePoints.style.transition = 'transform 0.08s ease';
  // Also restore background image transition
  const backgroundImage = backgroundContainer?.querySelector('.background-image');
  if (backgroundImage) {
    backgroundImage.style.transition = '';
  }
  // Restore CSS variable to enable transitions again
  document.documentElement.style.setProperty('--dragging', '0');
}

// Cache for image aspect ratios
window.imageAspectRatios = {};

// Preload and cache aspect ratios for all images
function cacheImageDimensions() {
  const allImages = [
    'assets/images/Full-Day.jpg',
    'assets/images/Full-Night.jpg',
    'assets/images/Market-Day.jpg',
    'assets/images/Market-Night.jpg',
    'assets/images/Rooftop-Day.jpg',
    'assets/images/Rooftop-Night.jpg',
    'assets/images/Transport-Day.jpg',
    'assets/images/Transport-Night.jpg',
    'assets/images/Panels-Day.jpg',
    'assets/images/Panels-Night.jpg'
  ];
  
  console.log('📐 Preloading image dimensions...');
  
  allImages.forEach(imagePath => {
    const img = new Image();
    img.onload = function() {
      const aspectRatio = this.naturalWidth / this.naturalHeight;
      window.imageAspectRatios[imagePath] = aspectRatio;
      console.log('📐 Cached aspect ratio for', imagePath.split('/').pop(), ':', aspectRatio.toFixed(3), `(${this.naturalWidth}x${this.naturalHeight})`);
    };
    img.onerror = function() {
      console.warn('⚠️ Failed to load image for dimension caching:', imagePath);
    };
    img.src = imagePath;
  });
}

// Calculate precise drag limits based on actual image size, not assumed aspect ratio
function calculateImageDragLimits() {
  const isMobile = window.innerWidth <= 480;
  // Use actual container width (may be constrained by CSS max-width)
  const container = document.querySelector('.visual-novel-container');
  const viewportWidth = container ? container.offsetWidth : window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // Get current background image URL to look up its cached aspect ratio
  const backgroundImage = document.querySelector('.background-image');
  let naturalAspectRatio = 2.33; // fallback ratio for new 5950x2550 images
  
  if (backgroundImage) {
    const computedStyle = window.getComputedStyle(backgroundImage);
    const backgroundImageUrl = computedStyle.backgroundImage;
    const imgSrc = backgroundImageUrl.match(/url\(['"]?([^'"]+)['"]?\)/);
    
    if (imgSrc && imgSrc[1]) {
      // Check if we have a cached aspect ratio for this image
      const imagePath = imgSrc[1];
      if (window.imageAspectRatios[imagePath]) {
        naturalAspectRatio = window.imageAspectRatios[imagePath];
        console.log('📐 Using cached aspect ratio:', naturalAspectRatio, 'for', imagePath.split('/').pop());
      } else {
        console.log('⚠️ No cached aspect ratio for', imagePath.split('/').pop(), '- using fallback:', naturalAspectRatio);
      }
    }
  }
  
  // Calculate actual rendered image width based on natural aspect ratio
  let renderedImageWidth;
  
  if (isMobile) {
    // On mobile: Images are sized to fill viewport height (background-size: auto 100vh)
    const renderedImageHeight = viewportHeight;
    renderedImageWidth = renderedImageHeight * naturalAspectRatio;
  } else {
    // Desktop: same calculation
    const renderedImageHeight = viewportHeight;
    renderedImageWidth = renderedImageHeight * naturalAspectRatio;
  }
  
  const halfImageWidth = renderedImageWidth / 2;
  const halfViewportWidth = viewportWidth / 2;
  
  // Calculate precise drag limits to show exactly to image edges (no grey space)
  let maxDragDistance;
  
  if (isMobile) {
    // On mobile: Allow dragging exactly to image edges, no more, no less
    maxDragDistance = Math.max(0, halfImageWidth - halfViewportWidth);
  } else {
    // Desktop: keep some extra margin for safety
    const extraMargin = 200;
    maxDragDistance = Math.max(0, halfImageWidth - halfViewportWidth + extraMargin);
  }
  
  // Debug logging  
  if (isMobile) {
    console.log('🔍 MOBILE DRAG LIMITS DEBUG:', {
      viewportSize: `${viewportWidth}x${viewportHeight}`,
      renderedImageWidth: renderedImageWidth,
      calculatedImageSize: `${renderedImageWidth}x${viewportHeight}`,
      halfImage: halfImageWidth,
      halfViewport: halfViewportWidth,
      maxDragDistance: maxDragDistance,
      maxDragDistanceInScreens: (maxDragDistance / viewportWidth).toFixed(1) + 'x screens',
      finalMaxX: maxDragDistance,
      finalMaxY: 0
    });
  }
  
  return {
    maxX: maxDragDistance,
    // On mobile: NO vertical dragging since images should fill viewport height exactly
    // On desktop: allow some vertical movement  
    maxY: isMobile ? 0 : window.innerHeight * 0.1  // 0px on mobile (no grey space) vs 10% on desktop
  };
}

// Smooth background position updates with requestAnimationFrame batching
let backgroundUpdatePending = false;

function updateBackgroundPosition() {
  // Batch multiple calls into a single animation frame
  if (backgroundUpdatePending) return;
  
  backgroundUpdatePending = true;
  requestAnimationFrame(() => {
    backgroundUpdatePending = false;
    
    const { maxX, maxY } = calculateImageDragLimits();
    
    currentX = Math.max(-maxX, Math.min(maxX, currentX));
    currentY = Math.max(-maxY, Math.min(maxY, currentY));
    
    // Remove any transitions during active dragging for instant response
    if (isDragging) {
      backgroundContainer.style.transition = 'none';
      interactivePoints.style.transition = 'none';
      // Also ensure background image and all child elements have no transitions
      const backgroundImage = backgroundContainer?.querySelector('.background-image');
      if (backgroundImage) {
        backgroundImage.style.transition = 'none';
      }
      // Remove transitions from all pseudo-elements by setting CSS variable
      document.documentElement.style.setProperty('--dragging', '1');
    } else {
      // Restore smooth transitions when not dragging for better edge scrolling
      backgroundContainer.style.transition = 'transform 0.1s ease-out';
      interactivePoints.style.transition = 'transform 0.1s ease-out';
      const backgroundImage = backgroundContainer?.querySelector('.background-image');
      if (backgroundImage) {
        backgroundImage.style.transition = '';
      }
      document.documentElement.style.setProperty('--dragging', '0');
    }
    
    if (cachedElements.backgroundContainer) {
      cachedElements.backgroundContainer.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    }

    // Move points with the background using the same transform
    if (cachedElements.interactivePoints) {
      cachedElements.interactivePoints.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    }
    
    // Update spotlight position when map moves (but not during active dragging to prevent jankiness)
    if (!isDragging && cachedElements.dimmingOverlay && cachedElements.dimmingOverlay.classList.contains('active')) {
      const selectedPoint = document.querySelector('.point.selected');
      if (selectedPoint) {
        updateSpotlightPosition(selectedPoint);
      }
    }
  });
}

function updatePointPositions() {
  // Recalculate positions for all points when window resizes
  document.querySelectorAll('.point').forEach(pointElement => {
    const percentX = parseFloat(pointElement.dataset.percentX);
    const percentY = parseFloat(pointElement.dataset.percentY);
    
    if (!isNaN(percentX) && !isNaN(percentY)) {
      const position = calculateImageRelativePosition(percentX, percentY);
      pointElement.style.left = position.left;
      pointElement.style.top = position.top;
    }
  });
  
  // Also update scene circles if they exist
  document.querySelectorAll('.scene-circle').forEach(circle => {
    const percentX = parseFloat(circle.dataset.percentX);
    const percentY = parseFloat(circle.dataset.percentY);
    
    if (!isNaN(percentX) && !isNaN(percentY)) {
      const position = calculateImageRelativePosition(percentX, percentY);
      circle.style.left = position.left;
      circle.style.top = position.top;
    }
  });
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
  
  // Match spotlight exactly to circle's rotating border
  const spotlightRadius = radius; // Full radius to match the rotating circle border
  dimmingOverlay.style.mask = `radial-gradient(circle at ${centerX}px ${centerY}px, transparent ${spotlightRadius - 10}px, rgba(0,0,0,0.1) ${spotlightRadius - 2}px, black ${spotlightRadius + 2}px)`;
  dimmingOverlay.style.webkitMask = `radial-gradient(circle at ${centerX}px ${centerY}px, transparent ${spotlightRadius - 10}px, rgba(0,0,0,0.1) ${spotlightRadius - 2}px, black ${spotlightRadius + 2}px)`;
}

// Update spotlight position for scene circles (fixed positioning)
function updateSpotlightPositionForSceneCircle(circleElement) {
  const dimmingOverlay = document.getElementById('dimmingOverlay');
  if (!dimmingOverlay || !dimmingOverlay.classList.contains('active')) return;
  
  const circleRect = circleElement.getBoundingClientRect();
  const centerX = circleRect.left + circleRect.width / 2;
  const centerY = circleRect.top + circleRect.height / 2;
  
  // Use scene circle radius (60px / 2 = 30px base)
  const baseRadius = 30;
  const currentScale = circleElement.classList.contains('selected') ? 4 : 1;
  const radius = baseRadius * currentScale;
  
  // Apply spotlight mask
  dimmingOverlay.style.mask = `radial-gradient(circle at ${centerX}px ${centerY}px, transparent ${radius - 15}px, rgba(0,0,0,0.1) ${radius - 5}px, black ${radius + 5}px)`;
  dimmingOverlay.style.webkitMask = `radial-gradient(circle at ${centerX}px ${centerY}px, transparent ${radius - 15}px, rgba(0,0,0,0.1) ${radius - 5}px, black ${radius + 5}px)`;
}

// Center scene circle on screen with zoom animation (for fixed positioned elements)
function centerSceneCircleOnScreen(circleElement) {
  // Actually center the screen/camera on the scene circle
  const isMobile = window.innerWidth <= 480;
  
  // Get circle's current position
  const circleRect = circleElement.getBoundingClientRect();
  const circleScreenX = circleRect.left + circleRect.width / 2;
  const circleScreenY = circleRect.top + circleRect.height / 2;
  
  // Calculate where we want the circle to be on screen
  const targetScreenX = window.innerWidth / 2;
  const targetScreenY = isMobile ? window.innerHeight / 3 : window.innerHeight / 2;
  
  // Calculate the offset needed to center the circle
  const offsetX = targetScreenX - circleScreenX;
  const offsetY = targetScreenY - circleScreenY;
  
  // Apply the offset to current camera position
  currentX += offsetX;
  currentY += offsetY;
  
  // Apply reasonable bounds
  const maxX = isMobile ? window.innerWidth * 0.4 : window.innerWidth * 0.15;
  const maxY = isMobile ? window.innerHeight * 0.4 : window.innerHeight * 0.15;
  currentX = Math.max(-maxX, Math.min(maxX, currentX));
  currentY = Math.max(-maxY, Math.min(maxY, currentY));
  
  // Add smooth transition for camera movement
  backgroundContainer.style.transition = "transform 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
  interactivePoints.style.transition = "transform 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
  
  // Update background position to center on the circle
  updateBackgroundPosition();
  
  // Remove transition after animation completes
  setTimeout(() => {
    backgroundContainer.style.transition = "transform 0.15s ease-out";
    interactivePoints.style.transition = "transform 0.15s ease-out";
  }, 600);
  
  console.log('Centered camera on scene circle');
}

// Center scene circle considering dialogue box boundaries to avoid clashes
function centerSceneCircleWithDialogueBoundary(circleElement) {
  const isMobile = window.innerWidth <= 480;
  const isTablet = window.innerWidth > 480 && window.innerWidth <= 768;
  
  // For mobile/tablet, use simple centering as dialogue is at bottom
  if (isMobile || isTablet) {
    centerSceneCircleOnScreen(circleElement);
    return;
  }
  
  // Get circle's current position
  const circleRect = circleElement.getBoundingClientRect();
  const circleScreenX = circleRect.left + circleRect.width / 2;
  const circleScreenY = circleRect.top + circleRect.height / 2;
  
  // Calculate dialogue box typical dimensions and position
  const dialogueWidth = 400; // Typical dialogue width
  const dialogueHeight = 300; // Typical dialogue height
  const dialogueMargin = 20; // Margin from edges
  
  // Calculate dialogue box typical position (right side by default)
  const dialogueLeft = window.innerWidth - dialogueWidth - dialogueMargin;
  const dialogueTop = window.innerHeight * 0.2; // 20% from top
  
  // Calculate safe zone for circle (left side of screen, avoiding dialogue)
  const safeZoneRight = dialogueLeft - 60; // Extra margin for enlarged circle
  const targetScreenX = Math.min(window.innerWidth * 0.35, safeZoneRight / 2);
  const targetScreenY = window.innerHeight * 0.5;
  
  // Calculate the offset needed to position the circle in safe zone
  const offsetX = targetScreenX - circleScreenX;
  const offsetY = targetScreenY - circleScreenY;
  
  // Apply the offset to current camera position
  currentX += offsetX;
  currentY += offsetY;
  
  // Apply reasonable bounds but allow more movement to avoid dialogue
  const maxX = window.innerWidth * 0.25;
  const maxY = window.innerHeight * 0.2;
  currentX = Math.max(-maxX, Math.min(maxX, currentX));
  currentY = Math.max(-maxY, Math.min(maxY, currentY));
  
  // Add smooth transition for camera movement
  backgroundContainer.style.transition = "transform 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
  interactivePoints.style.transition = "transform 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
  
  // Update background position to center on the circle
  updateBackgroundPosition();
  
  // Remove transition after animation completes
  setTimeout(() => {
    backgroundContainer.style.transition = "transform 0.15s ease-out";
    interactivePoints.style.transition = "transform 0.15s ease-out";
  }, 600);
  
  console.log('Centered scene circle considering dialogue boundaries');
}

// Enter scene mode - use existing street view containers with scene background
function enterSceneMode(sceneType) {
  console.log(`🎬 Entering scene mode: ${sceneType}`);
  
  isSceneMode = true;
  currentSceneType = sceneType;
  
  // Keep using the existing street view containers but change the background
  // Fade out street view circles
  const streetCircles = document.querySelectorAll('.point:not(.scene-circle)');
  streetCircles.forEach(circle => {
    circle.style.transition = 'opacity 0.8s ease-out';
    circle.style.opacity = '0';
    setTimeout(() => {
      circle.style.display = 'none';
    }, 600); // Smooth fade out timing
  });
  
  // Load the correct scene image with smooth crossfade transition
  const isNightMode = document.body.classList.contains('high-contrast');
  const imagePath = getSceneImagePath(sceneType, isNightMode);
  
  const backgroundImage = document.querySelector('.background-image');
  if (backgroundImage) {
    // Create smooth crossfade to scene image
    createSmoothImageTransition(backgroundImage, imagePath);
    console.log(`✅ Starting crossfade to scene: ${imagePath}`);
  }
  
  // Create scene-specific circles after crossfade begins
  // Wait for image to fully load before creating circles and dialogue
  waitForImageTransition(imagePath, () => {
    console.log('✅ Scene background loaded, creating circles');
    createSceneSpecificCircles(currentStoryPoint);
    
    // Fade in scene circles after they're created
    setTimeout(() => {
      const sceneCircles = document.querySelectorAll('.scene-circle');
      sceneCircles.forEach(circle => {
        circle.style.opacity = '0';
        circle.style.transition = 'opacity 0.6s ease-in';
        setTimeout(() => {
          circle.style.opacity = '1';
        }, 50);
      });
    }, 100);
  });
}

// Exit scene mode - return to street view
function exitSceneMode() {
  console.log('🚪 Exiting scene mode, returning to street view');
  
  isSceneMode = false;
  currentSceneType = null;
  currentStoryPoint = null; // Reset story point when exiting scene
  isHoveringCircle = false; // Reset hover state to ensure edge scrolling works
  
  // Fade out scene circles first
  const sceneCircles = document.querySelectorAll('.scene-circle');
  sceneCircles.forEach(circle => {
    circle.style.transition = 'opacity 0.6s ease-out';
    circle.style.opacity = '0';
  });
  
  // Remove scene circles after fade and show street circles
  setTimeout(() => {
    sceneCircles.forEach(circle => circle.remove());
    
    // Show and fade in street view circles
    const streetCircles = document.querySelectorAll('.point:not(.scene-circle)');
    streetCircles.forEach(circle => {
      circle.style.display = 'block';
      circle.style.opacity = '0';
      circle.style.transition = 'opacity 0.8s ease-in';
      setTimeout(() => {
        circle.style.opacity = '1';
      }, 50);
    });
  }, 600);
  
  // Restore street view background with smooth crossfade
  const isNightMode = document.body.classList.contains('high-contrast');
  const streetImagePath = isNightMode ? 'assets/images/Full-Night.jpg' : 'assets/images/Full-Day.jpg';
  
  const backgroundImage = document.querySelector('.background-image');
  if (backgroundImage) {
    createSmoothImageTransition(backgroundImage, streetImagePath);
    console.log(`✅ Starting crossfade to street view: ${streetImagePath}`);
  }
}




// === DAY/NIGHT TRANSITION SYSTEM ===
// Separate system that handles smooth transitions without interfering with scenes

// Initialize the day/night overlay system
// Simple day/night image swap system
function swapDayNightImage() {
  const isNightMode = document.body.classList.contains('high-contrast');
  const backgroundImage = document.querySelector('.background-image');
  
  if (!backgroundImage) {
    console.log('❌ No .background-image element found!');
    return;
  }
  
  let targetImagePath;
  
  // Determine target image based on scene mode
  if (isSceneMode && currentStoryPoint) {
    // We're in a scene - get scene-specific image
    targetImagePath = getSceneImagePath(currentStoryPoint.title, isNightMode);
  } else {
    // We're in street view - get street image
    targetImagePath = isNightMode ? 'assets/images/Full-Night.jpg' : 'assets/images/Full-Day.jpg';
  }
  
  // Smooth fade transition
  createSmoothImageTransition(backgroundImage, targetImagePath);
  console.log(`✅ Starting fade transition to: ${targetImagePath}`);
}

// Wait for image to load before continuing with scene setup
function waitForImageTransition(imagePath, callback) {
  const img = new Image();
  img.onload = () => {
    console.log('✅ Scene image loaded:', imagePath);
    // Wait additional time for crossfade animation to complete
    setTimeout(callback, 1200);
  };
  img.onerror = () => {
    console.warn('⚠️ Scene image failed to load, continuing anyway:', imagePath);
    setTimeout(callback, 1200);
  };
  img.src = imagePath;
}

// Create a smooth crossfade transition between images
function createSmoothImageTransition(backgroundElement, targetImagePath) {
  // Create temporary overlay element for fade effect
  const fadeOverlay = document.createElement('div');
  fadeOverlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-image: url(${targetImagePath});
    background-size: auto 105%;
    background-position: center center;
    background-repeat: no-repeat;
    opacity: 0;
    z-index: 3;
    pointer-events: none;
    transition: opacity 2.5s cubic-bezier(0.25, 0.46, 0.45, 0.94), background-size 3.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  `;
  
  // Add overlay to background container
  backgroundElement.parentElement.appendChild(fadeOverlay);
  
  // Start the fade-in and zoom transition
  setTimeout(() => {
    fadeOverlay.style.opacity = '1';
    fadeOverlay.style.backgroundSize = 'auto 100%'; // Slow zoom from 105% to 100%
    
    // Simultaneously fade out the existing background for better crossfade
    backgroundElement.style.transition = 'opacity 2.0s ease-out';
    backgroundElement.style.opacity = '0.3';
  }, 100);
  
  // After transition completes, update the main background and remove overlay
  setTimeout(() => {
    backgroundElement.style.backgroundImage = `url(${targetImagePath})`;
    backgroundElement.style.opacity = '1'; // Restore full opacity
    backgroundElement.style.transition = ''; // Reset transition
    fadeOverlay.remove();
    console.log(`🌅 Fade transition completed: ${targetImagePath}`);
    
    // Recalculate drag limits with the new image's dimensions
    setTimeout(() => {
      const newLimits = calculateImageDragLimits();
      console.log('📐 Updated drag limits for new image:', newLimits);
      
      // Constrain current position to new limits
      currentX = Math.max(-newLimits.maxX, Math.min(newLimits.maxX, currentX));
      currentY = Math.max(-newLimits.maxY, Math.min(newLimits.maxY, currentY));
      
      // Update position with new constraints
      updateBackgroundPosition();
    }, 100); // Small delay to ensure image is fully set
  }, 3700); // Slightly longer than transition duration
}

// Get the appropriate image path for a scene
function getSceneImagePath(sceneType, isNightMode) {
  switch (sceneType) {
    case 'Food':
      return isNightMode ? 'assets/images/Market-Night.jpg' : 'assets/images/Market-Day.jpg';
    case 'Education':
      return isNightMode ? 'assets/images/Rooftop-Night.jpg' : 'assets/images/Rooftop-Day.jpg';
    case 'Energy':
      return isNightMode ? 'assets/images/Panels-Night.jpg' : 'assets/images/Panels-Day.jpg';
    case 'Transport':
      return isNightMode ? 'assets/images/Transport-Night.jpg' : 'assets/images/Transport-Day.jpg';
    case 'Governance':
      return isNightMode ? 'assets/images/Panels-Night.jpg' : 'assets/images/Panels-Day.jpg';
    case 'Housing':
      return isNightMode ? 'assets/images/Transport-night.jpg' : 'assets/images/Transport-Day.jpg';
    default:
      return isNightMode ? 'assets/images/Panels-Night.jpg' : 'assets/images/Panels-Day.jpg';
  }
}

function showHelpButtonAfterFirstClose() {
  // Check if this is the first time closing help overlay
  const hasClosedBefore = localStorage.getItem('helpOverlayClosedOnce');
  
  if (!hasClosedBefore) {
    // Mark that user has closed help overlay once
    localStorage.setItem('helpOverlayClosedOnce', 'true');
    
    // Show the help button
    const helpButton = document.getElementById("helpButton");
    if (helpButton) {
      helpButton.classList.add('show');
    }
  }
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
  // Enable edge scrolling for map view, scene mode, and panorama modes, but not while dragging
  if (isDragging) return;
  
  // Different logic for map view, scene mode, vs 360° view
  if (isMapView || isSceneMode) {
    // In map view or scene mode: disable scrolling when dialogue is open (traditional behavior)
    if (cachedElements.dialoguePanel && cachedElements.dialoguePanel.classList.contains('visible')) return;
    // Disable scrolling when hovering over circles in map/scene view
    if (isHoveringCircle) return;
  } else {
    // In 360° view: allow scrolling when dialogue is open, but not when hovering over dialogue or circles
    if (isHoveringDialogue) return;
    if (isHoveringCircle) return;
  }
  
  // Disable scrolling when help overlay is open
  if (cachedElements.helpOverlay && !cachedElements.helpOverlay.classList.contains('hidden')) {
    console.log('🛑 Edge scrolling blocked: help overlay is open');
    return;
  }
  
  // Disable scrolling when intro overlay is open
  if (introOverlay && introOverlay.classList.contains('visible')) {
    console.log('🛑 Edge scrolling blocked: intro overlay is open');
    return;
  }
  
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
      // Gradually slow down scrolling when mouse stops (don't set to 0 immediately)
      // The scrolling animation loop will handle the gradual deceleration
    }, 400); // stop edgescroll after mouse stops moving
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
    const maxSpeed = 7.0;
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
    
    // Much faster acceleration for snappier response
    const acceleration = 0.4; // Increased for snappier edge scrolling
    const bounceMultiplier = 1.0; // No bounce effect
    
    // If mouse stopped moving, gradually reduce target velocities for smooth deceleration
    if (!isMouseMoving) {
      const decelerationRate = 0.92; // Gradual slowdown (lower = slower deceleration)
      targetScrollVelocityX *= decelerationRate;
      targetScrollVelocityY *= decelerationRate;
      
      // Set to zero when very small to avoid infinite tiny movements
      if (Math.abs(targetScrollVelocityX) < 0.01) targetScrollVelocityX = 0;
      if (Math.abs(targetScrollVelocityY) < 0.01) targetScrollVelocityY = 0;
    }
    
    const deltaX = targetScrollVelocityX - currentScrollVelocityX;
    const deltaY = targetScrollVelocityY - currentScrollVelocityY;
    
    currentScrollVelocityX += deltaX * acceleration * bounceMultiplier;
    currentScrollVelocityY += deltaY * acceleration * bounceMultiplier;
    
    // Stop if velocity is very small (much lower threshold for longer movement)
    if (Math.abs(currentScrollVelocityX) < 0.0005 && Math.abs(currentScrollVelocityY) < 0.0005 &&
        targetScrollVelocityX === 0 && targetScrollVelocityY === 0) {
      // Actually stop the animation here
      if (edgeScrollAnimationId) {
        cancelAnimationFrame(edgeScrollAnimationId);
        edgeScrollAnimationId = null;
      }
      currentScrollVelocityX = 0;
      currentScrollVelocityY = 0;
      return;
    }
    
    if (isMapView) {
      // Map scrolling
      currentX += currentScrollVelocityX;
      currentY += currentScrollVelocityY;
      
      // Apply the same bounds as regular dragging using shared function
      const { maxX, maxY } = calculateImageDragLimits();
      
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
  // Don't immediately stop - let it decelerate naturally
  targetScrollVelocityX = 0;
  targetScrollVelocityY = 0;
  
  // The animation will stop itself when velocity gets low enough
  // This creates smoother, more natural deceleration
}

// Handle circle click - zoom and transition to scene-specific street view
function handleCircleClick(point, pointElement, index) {
  console.log('Circle clicked:', point.title);
  
  // Check if this point has a scene-specific image
  const hasSceneImage = point.title === "Education" || point.title === "Food" || point.title === "Energy" || point.title === "Transport";
  const skipDimmingOverlay = point.title === "Education" || point.title === "Food" || point.title === "Energy" || point.title === "Transport";
  
  // Store hasSceneImage on the point for later use
  point._hasSceneImage = hasSceneImage;
  
  if (!hasSceneImage) {
    // No scene image - show dialogue in street view with focus effects
    console.log('No scene image for', point.title, '- showing dialogue in street view with focus effects');
    
    // Apply focus/dimming animations for non-scene circles (centering disabled)
    // centerPointOnScreen(pointElement); // Disabled: centering movement not working well
    
    // Update selected state and add dimming overlay
    pointElements.forEach((el) => el.classList.remove("selected"));
    pointElement.classList.add("selected");
    
    const isMobile = window.innerWidth <= 480;
    const dimmingOverlay = document.getElementById('dimmingOverlay');
    if (dimmingOverlay && isMapView && !skipDimmingOverlay && !isMobile) {
      dimmingOverlay.classList.add('active');
      
      setTimeout(() => {
        updateSpotlightPosition(pointElement, 0);
      }, 150); // Wait longer for circle scaling to start
    }
    
    showDialogue(point, pointElement);
    return;
  }
  
  // For scene images, skip centering (disabled due to issues)
  // centerPointOnScreen(pointElement); // Disabled: centering movement not working well
  
  console.log('Has scene image - starting zoom transition to scene');
  
  // Set the current story point for scene creation
  currentStoryPoint = point;
  
  // Start zoom transition
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
    backgroundContainer.style.transition = 'transform 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    interactivePoints.style.transition = 'transform 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    
    const zoomScale = 1.5; // Zoom level
    
    // Apply bounds to prevent showing dead zones outside the image
    const { maxX, maxY } = calculateImageDragLimits();
    const finalX = Math.max(-maxX * zoomScale, Math.min(maxX * zoomScale, currentX + targetX));
    const finalY = Math.max(-maxY * zoomScale, Math.min(maxY * zoomScale, currentY + targetY));
    
    const newTransform = `translate3d(${finalX}px, ${finalY}px, 0) scale(${zoomScale})`;
    
    backgroundContainer.style.transform = newTransform;
    interactivePoints.style.transform = newTransform;
    
    // During zoom, fade out current circles and prepare scene transition
    setTimeout(() => {
      // Hide current street view circles completely (not just dim them)
      const currentCircles = document.querySelectorAll('.point:not(.scene-circle)');
      currentCircles.forEach(circle => {
        circle.style.transition = 'opacity 0.3s ease';
        circle.style.opacity = '0';
        // Hide them completely after fade
        setTimeout(() => {
          circle.style.display = 'none';
        }, 300);
      });
      
      // Enter scene mode with the specific scene type
      enterSceneMode(point.title);
      
      // Reset zoom and prepare for scene view
      setTimeout(() => {
        // Remove zoom class
        pointElement.classList.remove('zooming');
        
        // Reset transforms to normal
        backgroundContainer.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
        interactivePoints.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
        
        // Add scene-specific circles based on the story data
        createSceneSpecificCircles(point);
        
        // Add back to street button
        showBackToStreetButton();
        
        // Show the main dialogue for this scene
        setTimeout(() => {
          showDialogue(point, pointElement);
        }, 100);
        
      }, 150); // Time for background to change
    }, 200); // During zoom animation
  }, 50);
}

// Create scene-specific circle points based on story data
function createSceneSpecificCircles(point) {
  console.log('Creating scene-specific circles for:', point.title);
  
  // Remove any existing scene circles
  document.querySelectorAll('.scene-circle').forEach(circle => circle.remove());
  
  // Find the corresponding story data from the loaded JSON
  const storyData = storyPoints.find(sp => sp.title === point.title);
  if (!storyData || !storyData.options || !storyData.options.length) {
    console.log('No story options found for', point.title);
    return;
  }
  
  console.log('Found', storyData.options.length, 'options for', point.title);
  
  // Create circles for each option in this story point
  storyData.options.forEach((option, index) => {
    createSceneCircle(option, index, point);
  });
}

// Create a single scene-specific circle
function createSceneCircle(option, index, parentPoint) {
  const circle = document.createElement('div');
  circle.className = 'point scene-circle';
  
  // Use CSS classes for styling instead of inline styles
  circle.style.position = 'fixed';
  circle.style.zIndex = '15';
  
  // Add default pulse animation only when not selected
  circle.style.animation = 'pulse 4s infinite ease-in-out';
  
  // Use coordinates from story-data, with mobile-specific overrides if available
  let percentX, percentY;
  const isMobile = window.innerWidth <= 480;
  
  // Check for mobile-specific coordinates first, then desktop coordinates, then fallback
  if (isMobile && option.mobileX !== undefined && option.mobileY !== undefined) {
    // Use mobile-specific coordinates
    percentX = option.mobileX;
    percentY = option.mobileY;
    console.log(`Using mobile coordinates for ${option.key}: ${percentX}, ${percentY}`);
  } else if (option.x !== undefined && option.y !== undefined) {
    // Use desktop coordinates from the story-data
    percentX = option.x;
    percentY = option.y;
    console.log(`Using desktop coordinates for ${option.key}: ${percentX}, ${percentY}`);
  } else {
    // Fallback to spread positions if coordinates are not defined - more visible spread
    const positions = [
      { percentX: 25, percentY: 25 },   // Top left
      { percentX: 75, percentY: 25 },   // Top right
      { percentX: 40, percentY: 40 },   // Mid left
      { percentX: 60, percentY: 40 },   // Mid right
      { percentX: 50, percentY: 50 },   // Center
      { percentX: 30, percentY: 65 },   // Bottom left
      { percentX: 70, percentY: 65 },   // Bottom right
      { percentX: 50, percentY: 75 },   // Bottom center
      { percentX: 15, percentY: 50 },   // Left edge
      { percentX: 85, percentY: 50 },   // Right edge
    ];
    const pos = positions[index % positions.length];
    percentX = pos.percentX;
    percentY = pos.percentY;
  }
  
  // Calculate image-relative position
  const position = calculateImageRelativePosition(percentX, percentY);
  circle.style.left = position.left;
  circle.style.top = position.top;
  circle.style.position = 'absolute';  // Use absolute positioning within the container
  
  // Store original percentage coordinates for repositioning
  circle.dataset.percentX = percentX;
  circle.dataset.percentY = percentY;
  
  // Add title data for hover
  circle.dataset.title = option.content?.speaker || option.key;
  
  // Add click handler with same animations as street circles
  circle.addEventListener('click', (e) => {
    e.stopPropagation();
    console.log('Scene circle clicked:', option.key);
    
    // Add selected state and dimming effect like street circles
    const allSceneCircles = document.querySelectorAll('.scene-circle');
    allSceneCircles.forEach(c => {
      c.classList.remove('selected');
      // Restore default pulse animation for deselected circles
      c.style.animation = 'pulse 4s infinite ease-in-out';
    });
    circle.classList.add('selected');
    // Clear inline animation to let CSS .point.selected animations take over
    circle.style.animation = '';
    
    // No dimming overlay for sub-circles - just visual scaling and rotation effects
    
    // Stop map movement and center the scene circle to avoid dialogue clash
    stopEdgeScrolling();
    
    // Center the map so the circle is mostly in the centre and won't clash with dialogue
    const isMobile = window.innerWidth <= 480;
    if (!isMobile) {
      // Only center on desktop - mobile users can position themselves via dragging
      centerSceneCircleWithDialogueBoundary(circle);
    }
    
    // Temporarily disable edge scrolling to prevent movement during dialogue
    isHoveringCircle = true;
    
    // Show section after animation
    setTimeout(() => {
      showSection(parentPoint, option.key);
    }, 400);
  });
  
  // Add hover listeners for edge scrolling control and title display (desktop only)
  circle.addEventListener('mouseenter', (e) => {
    // Stop edge scrolling while hovering over scene circle
    isHoveringCircle = true;
    stopEdgeScrolling();
    
    // Only show hover titles on desktop (not mobile)
    const isMobile = window.innerWidth <= 480;
    if (!isMobile) {
      // Show hover title using speaker data, converted to title case
      const speakerTitle = option.content?.speaker || option.key;
      const titleCaseTitle = toTitleCase(speakerTitle);
      circle.hoverTimeout = setTimeout(() => showHoverTitle(e, titleCaseTitle), 50);
    }
  });
  
  circle.addEventListener('mouseleave', () => {
    // Re-enable edge scrolling when not hovering
    isHoveringCircle = false;
    
    // Clear any pending hover timeout
    clearTimeout(circle.hoverTimeout);
    hideHoverTitle();
  });
  
  // Add to the interactive points container
  const interactivePoints = document.getElementById('interactivePoints');
  if (interactivePoints) {
    // Always append to the main interactive points (like before)
    interactivePoints.appendChild(circle);
    console.log(`Scene circle created for ${option.key} at ${percentX}, ${percentY} - final position: ${position.left}, ${position.top}`);
  }
  
}

// Reset dialogue panel to default position  
function resetDialoguePosition() {
  const dialoguePanel = document.getElementById('dialoguePanel');
  if (!dialoguePanel) return;
  
  const isMobile = window.innerWidth <= 480;
  const isTablet = window.innerWidth > 480 && window.innerWidth <= 768;
  
  if (isMobile || isTablet) return; // Don't reset mobile/tablet positioning
  
  // Reset to default desktop position
  dialoguePanel.style.top = '20%';
  dialoguePanel.style.right = '0';
  dialoguePanel.style.left = 'auto';
  dialoguePanel.style.bottom = 'auto';
}

// Position dialogue to avoid covering enlarged circles
function positionDialogueToAvoidCircle(circleElement) {
  if (!circleElement) return;
  
  const isMobile = window.innerWidth <= 480;
  const isTablet = window.innerWidth > 480 && window.innerWidth <= 768;
  
  // Skip repositioning for tablet as they already position at bottom  
  if (isTablet) return;
  
  const dialoguePanel = document.getElementById('dialoguePanel');
  if (!dialoguePanel) return;
  
  // Check for collision with ALL visible circles (main circles + scene circles)
  const allCircles = document.querySelectorAll('.point:not(.hidden)');
  let hasCollision = false;
  let bestPosition = null;
  
  for (const circle of allCircles) {
    const circleRect = circle.getBoundingClientRect();
    const dialogueRect = dialoguePanel.getBoundingClientRect();
    
    // Calculate circle bounds when enlarged (scale 4x for selected, 1x for others)
    const circleScale = circle.classList.contains('selected') ? 4 : 1;
    const enlargedRadius = (circleRect.width / 2) * circleScale;
    const circleCenterX = circleRect.left + circleRect.width / 2;
    const circleCenterY = circleRect.top + circleRect.height / 2;
    
    const enlargedCircleBounds = {
      left: circleCenterX - enlargedRadius,
      right: circleCenterX + enlargedRadius,
      top: circleCenterY - enlargedRadius,
      bottom: circleCenterY + enlargedRadius
    };
    
    // Check if dialogue overlaps with this circle
    const isOverlapping = !(
      dialogueRect.right < enlargedCircleBounds.left ||
      dialogueRect.left > enlargedCircleBounds.right ||
      dialogueRect.bottom < enlargedCircleBounds.top ||
      dialogueRect.top > enlargedCircleBounds.bottom
    );
    
    if (isOverlapping) {
      hasCollision = true;
      
      // Determine best positioning strategy
      const spaceOnLeft = enlargedCircleBounds.left;
      const spaceOnRight = window.innerWidth - enlargedCircleBounds.right;
      const spaceOnTop = enlargedCircleBounds.top;
      const spaceOnBottom = window.innerHeight - enlargedCircleBounds.bottom;
      
      const dialogueWidth = dialogueRect.width;
      const dialogueHeight = dialogueRect.height;
      
      // Prioritize left side, then top, then right, then bottom
      if (spaceOnLeft >= dialogueWidth + 20) {
        bestPosition = { side: 'left', space: spaceOnLeft };
      } else if (spaceOnTop >= dialogueHeight + 40) {
        bestPosition = { side: 'top', space: spaceOnTop };
      } else if (spaceOnRight >= dialogueWidth + 20) {
        bestPosition = { side: 'right', space: spaceOnRight };
      } else if (spaceOnBottom >= dialogueHeight + 40) {
        bestPosition = { side: 'bottom', space: spaceOnBottom };
      }
      
      break; // Use first collision found
    }
  }
  
  if (hasCollision && bestPosition) {
    if (isMobile) {
      // On mobile, only move to top if there's collision (dialogue stays full width)
      if (bestPosition.side === 'top') {
        // Position below the spiral logo and day/night toggle (both at ~20px from top)
        // Spiral logo is 90px height, day/night toggle is 60px height  
        // Add extra space to clear both elements
        dialoguePanel.style.top = '120px'; // 90px (logo height) + 30px margin
        dialoguePanel.style.bottom = 'auto';
        console.log('Mobile dialogue moved to top (below UI elements) to avoid circle collision');
      }
      // For other positions, keep default bottom positioning on mobile
    } else {
      // Desktop positioning logic
      switch (bestPosition.side) {
        case 'left':
          dialoguePanel.style.right = 'auto';
          dialoguePanel.style.left = '20px';
          dialoguePanel.style.top = '20%';
          dialoguePanel.style.bottom = 'auto';
          break;
        case 'top':
          dialoguePanel.style.top = '70px';
          dialoguePanel.style.bottom = 'auto';
          break;
        case 'right':
          dialoguePanel.style.right = '20px';
          dialoguePanel.style.left = 'auto';
          dialoguePanel.style.top = '20%';
          dialoguePanel.style.bottom = 'auto';
          break;
        case 'bottom':
          dialoguePanel.style.top = 'auto';
          dialoguePanel.style.bottom = '20px';
          break;
      }
    }
    
    console.log(`Dialogue repositioned to ${bestPosition.side} side to avoid covering circles`);
  }
}

function showDialogue(point, pointElement) {
  currentStoryPoint = point;
  locationTitle.textContent = point.title;
  // locationSubtitle removed
  
  // Disabled automatic positioning - use only manual dialoguePosition from story-data.json
  // if (pointElement) {
  //   setTimeout(() => positionDialogueToAvoidCircle(pointElement), 100);
  // }

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
  // Skip dimming overlay for all scenes with background image switches
  const skipDimmingOverlay = point.title === "Education" || point.title === "Food" || point.title === "Energy" || point.title === "Transport";
  const isMobile = window.innerWidth <= 480;
  const dimmingOverlay = document.getElementById('dimmingOverlay');
  if (dimmingOverlay && isMapView && !skipDimmingOverlay && !isMobile) {
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
    }, 200); // Longer delay to let circle scaling and positioning settle
    
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
  // centerPointOnScreen(pointElement); // Disabled: centering movement not working well

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

  // More generous bounds for mobile and edge circles like Housing
  const maxX = isMobile ? window.innerWidth * 0.6 : window.innerWidth * 0.3;
  const maxY = isMobile ? window.innerHeight * 0.6 : window.innerHeight * 0.3;
  currentX = Math.max(-maxX, Math.min(maxX, currentX));
  currentY = Math.max(-maxY, Math.min(maxY, currentY));

  // Add smooth transition for camera movement
  backgroundContainer.style.transition = "transform 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
  interactivePoints.style.transition = "transform 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)";

  updateBackgroundPosition();

  // Remove transition after animation completes
  setTimeout(() => {
    backgroundContainer.style.transition = "transform 0.15s ease-out";
    interactivePoints.style.transition = "transform 0.15s ease-out";
  }, 600);
}

function showMainText(point) {
  currentStoryPoint = point;
  
  // Apply custom dialogue positioning if specified
  const isMobile = window.innerWidth <= 480;
  if (point.dialoguePosition) {
    const position = isMobile ? point.dialoguePosition.mobile : point.dialoguePosition.desktop;
    console.log('Setting dialogue position:', position, isMobile ? '(mobile)' : '(desktop)');
    setDialoguePosition(position, isMobile);
  } else {
    // Reset to default position
    resetDialoguePosition();
  }
  
  // Check if mobile paragraph mode should be used
  if (initMobileParagraphMode(point)) {
    // Use mobile paragraph system
    // Using subtitle class directly in mobile paragraph mode
    
    dialoguePanel.classList.add("visible");
    showMobileParagraph(); // This now handles pre-sizing internally
    updateBackButtonVisibility();
    return;
  }

  // Desktop/normal mode continues with existing system
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
  speaker.className = "subtitle";
  speaker.textContent = point.mainText.speaker;
  dialogueEntry.appendChild(speaker);

  // Create text container for letter-by-letter animation
  const text = document.createElement("div");
  text.className = "section-text";
  dialogueEntry.appendChild(text);

  // Add container first
  dialogueTextContainer.appendChild(dialogueEntry);

  // Pre-calculate height for mobile/tablet before starting typewriter
  // Reuse isMobile from earlier in function to avoid redeclaration
  const isTablet = window.innerWidth > 480 && window.innerWidth <= 768;
  
  if (isMobile || isTablet) {
    const preCalculatedHeight = calculateOptimalDialogueHeight(point.mainText.text, isMobile, isTablet);
    if (preCalculatedHeight) {
      if (isMobile) {
        resizeMobileDialogueToContent(preCalculatedHeight);
      } else {
        // For tablet
        dialoguePanel.classList.add('dynamic-height');
        dialoguePanel.style.transition = 'height 0.3s ease-out';
        dialoguePanel.style.height = `${preCalculatedHeight}px`;
        setTimeout(() => { dialoguePanel.style.transition = ''; }, 300);
      }
    }
  }

  // Animate text typing letter by letter with inline link parsing
  typeWriterWithLinks(text, point.mainText.text, 0, point, () => {
    addBackButton(text, point, "main");
  });

  dialoguePanel.classList.add("visible");
  dialogueTextContainer.scrollTop = 0;
  
  // Update back button visibility on mobile
  updateBackButtonVisibility();
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
  
  // Apply custom dialogue positioning for this option if specified
  const isMobile = window.innerWidth <= 480;
  if (option.dialoguePosition) {
    const position = isMobile ? option.dialoguePosition.mobile : option.dialoguePosition.desktop;
    console.log('Setting option dialogue position:', position, isMobile ? '(mobile)' : '(desktop)');
    setDialoguePosition(position, isMobile);
  } else {
    // Reset to default position if no custom position specified
    resetDialoguePosition();
  }

  // Add current state to history before navigating
  addToHistory(point, optionKey);

  // Store the current story point for mobile paragraph system
  currentStoryPoint = point;
  
  // Update location title and subtitle 
  locationTitle.textContent = point.title; // Use main section title
  // locationSubtitle removed

  // Check if mobile paragraph mode should be used for section content
  if (initMobileParagraphMode({ ...point, mainText: option.content })) {
    // Use mobile paragraph system for sections too
    dialoguePanel.classList.add("visible");
    showMobileParagraph();
    updateBackButtonVisibility();
    return;
  }

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
  speaker.className = "subtitle";
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
    // Resize dialogue to fit content after text completes
    setTimeout(() => resizeDialogueToContent(), 100);
  });

  dialoguePanel.classList.add("visible");
  dialogueTextContainer.scrollTop = 0;
  
  // Update back button visibility on mobile
  updateBackButtonVisibility();
  
  // Initial resize to fit content
  setTimeout(() => resizeDialogueToContent(), 300);
  
  // Mark interactive text link as visited (since user has clicked and engaged with it)
  // This is done after content creation so visited class is applied to newly created elements
  markInteractiveTextAsVisited(optionKey);
}

function addToHistory(point, optionKey) {
  navigationHistory.push({ point, optionKey });
}

function addBackButton(textContainer, point, currentKey) {
  // Back button removed - not wanted in scene texts
  // Function kept for compatibility but doesn't add any buttons
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
    speaker.className = "subtitle";
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
    speaker.className = "subtitle";
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
    // Create clickable link element that will be typed letter by letter
    const linkSpan = document.createElement("span");
    linkSpan.className = "interactive-text";
    
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
    
    // Type the link text letter by letter like regular text
    const linkText = currentPart.content;
    let linkCharIndex = 0;
    
    function typeLinkText() {
      if (linkCharIndex < linkText.length) {
        linkSpan.textContent += linkText[linkCharIndex];
        linkCharIndex++;
        currentTypingTimeout = setTimeout(typeLinkText, textSpeed);
      } else {
        // Link text complete, move to next part
        typeWriterParts(element, parts, partIndex + 1, 0, point, onComplete);
      }
    }
    
    // Start typing the link text
    typeLinkText();
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
  
  // ALWAYS reset mobile paragraph mode state when hiding dialogue
  if (isMobileParagraphMode) {
    console.log('Resetting mobile paragraph mode state in hideDialogue()');
    isMobileParagraphMode = false;
    isExpandedMobileView = false;
    currentParagraphs = [];
    currentParagraphIndex = 0;
    completedParagraphs = [];
    dialoguePanel.classList.remove('mobile-paragraph-mode');
    dialoguePanel.classList.remove('dynamic-height');
  }
  
  // Update back button visibility on mobile
  updateBackButtonVisibility();
  
  // Reset dialogue position for next use
  resetDialoguePosition();
  
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
  
  // Also clean up scene circles if any are selected
  const sceneCircles = document.querySelectorAll('.scene-circle');
  sceneCircles.forEach(circle => {
    if (circle.classList.contains('selected')) {
      circle.classList.remove('selected');
      // Reset the zoom and styling applied by centerSceneCircleOnScreen
      circle.style.transform = 'scale(1)';
      circle.style.zIndex = '15';
      circle.style.background = 'rgba(157, 110, 109, 0.4)';
      circle.style.borderColor = '#9d6e6d';
      circle.style.boxShadow = `
        inset 2px 2px 8px rgba(255, 255, 255, 0.6),
        inset -2px -2px 8px rgba(157, 110, 109, 0.4),
        0 0 0 2px rgba(157, 110, 109, 0.8),
        0 0 0 4px rgba(255, 255, 255, 0.3),
        0 4px 12px rgba(0, 0, 0, 0.3)
      `;
    }
  });
  
  // Reset current story point (but only if not in panorama view or scene mode)
  if (isMapView && !isSceneMode) {
    currentStoryPoint = null;
  } else {
    console.log('Keeping currentStoryPoint for panorama/scene view:', currentStoryPoint?.title);
  }

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

// Show back to street view button with smart mobile positioning
function showBackToStreetButton() {
  console.log('showBackToStreetButton called');
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
    GO TO STREET
  `;
  
  // Position button based on dialogue box location on mobile
  positionBackButtonSmartly(backButton);
  
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
  console.log('Back to street button added to body');
}

// Position back button smartly to avoid dialogue box on mobile
function positionBackButtonSmartly(backButton) {
  const isMobile = window.innerWidth <= 480;
  
  if (!isMobile) {
    // Desktop: keep default positioning (CSS handles this)
    return;
  }
  
  // Mobile: check dialogue box state and hide button if dialogue is open
  const dialoguePanel = document.getElementById('dialoguePanel');
  const isDialogueVisible = dialoguePanel && dialoguePanel.classList.contains('visible');
  
  if (isDialogueVisible) {
    // Hide button when dialogue is open
    backButton.style.display = 'none';
    console.log('Mobile: Back button hidden (dialogue is open)');
  } else {
    // Show button when dialogue is closed, positioned at bottom center
    backButton.style.display = 'flex';
    backButton.style.position = 'fixed';
    backButton.style.bottom = '20px';
    backButton.style.left = '50%';
    backButton.style.transform = 'translateX(-50%)';
    backButton.style.top = 'auto';
    console.log('Mobile: Back button shown at bottom (no dialogue)');
  }
}

// Update back button visibility based on dialogue state (mobile only)
function updateBackButtonVisibility() {
  const backButton = document.getElementById('backToStreetButton');
  const isMobile = window.innerWidth <= 480;
  
  if (!backButton || !isMobile) return;
  
  const dialoguePanel = document.getElementById('dialoguePanel');
  const isDialogueVisible = dialoguePanel && dialoguePanel.classList.contains('visible');
  
  if (isDialogueVisible) {
    backButton.style.display = 'none';
    console.log('Mobile: Back button hidden (dialogue opened)');
  } else {
    backButton.style.display = 'flex';
    console.log('Mobile: Back button shown (dialogue closed)');
  }
}

// Hide back to street view button
function hideBackToStreetButton() {
  const existingButton = document.getElementById('backToStreetButton');
  if (existingButton) {
    console.log('Removing existing back to street button');
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
  backgroundContainer.style.transition = "transform 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
  interactivePoints.style.transition = "transform 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
  
  updateBackgroundPosition();
  
  // Remove transition after animation completes
  setTimeout(() => {
    backgroundContainer.style.transition = "transform 0.15s ease-out";
    interactivePoints.style.transition = "transform 0.15s ease-out";
  }, 600);
}

function setupDialogueSkipListener() {
  // Separate click handlers for mobile and desktop
  dialogueTextContainer.addEventListener("click", (e) => {
    console.log(
      "Dialogue click detected - isTyping:",
      isTyping,
      "isMobileParagraphMode:",
      isMobileParagraphMode
    );

    // Don't process if clicking on interactive elements
    if (e.target.classList.contains("interactive-text") || 
        e.target.closest(".back-button") || 
        e.target.closest('.mobile-close-button') ||
        e.target.closest('.mobile-next-arrow')) {
      return;
    }

    // COMPLETELY DISABLE desktop click-to-skip functionality when in mobile paragraph mode
    if (isMobileParagraphMode) {
      console.log("Mobile: All click interactions handled by mobile system only - desktop skip disabled");
      return; // Do nothing - mobile paragraph mode has its own separate handlers
    }
    
    // Desktop mode behavior (only when NOT in mobile paragraph mode)
    if (isTyping) {
      console.log("Desktop: Skipping current typing animation");
      playSkipSound();
      skipToNextSentence = true;
      hasUsedSkip = true;
      dialogueTextContainer.classList.remove("typing");
      return;
    } else {
      // Desktop mode: no action when not typing (preserve existing behavior)
      console.log("Desktop: No action when not typing");
    }
  });
}

function playSkipSound() {
  // Create a high-pitched marimba-like wooden click sound using Web Audio API
  if (
    typeof AudioContext !== "undefined" ||
    typeof webkitAudioContext !== "undefined"
  ) {
    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();

    // Create a higher-pitched marimba-like wooden sound with natural resonance
    const oscillator1 = audioContext.createOscillator();
    const oscillator2 = audioContext.createOscillator();
    const oscillator3 = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const filterNode = audioContext.createBiquadFilter();

    oscillator1.connect(filterNode);
    oscillator2.connect(filterNode);
    oscillator3.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Set up filter for bright marimba-like resonance
    filterNode.type = "bandpass";
    filterNode.frequency.setValueAtTime(800, audioContext.currentTime);
    filterNode.Q.setValueAtTime(3, audioContext.currentTime);

    // Higher fundamental frequency for marimba-like tone
    oscillator1.frequency.setValueAtTime(440, audioContext.currentTime); // A4 note
    oscillator1.frequency.exponentialRampToValueAtTime(
      220,
      audioContext.currentTime + 0.12,
    );
    
    // Harmonic overtone for richer marimba sound
    oscillator2.frequency.setValueAtTime(880, audioContext.currentTime); // A5 note (octave)
    oscillator2.frequency.exponentialRampToValueAtTime(
      440,
      audioContext.currentTime + 0.08,
    );

    // Higher harmonic for bright attack
    oscillator3.frequency.setValueAtTime(1320, audioContext.currentTime); // E6 note
    oscillator3.frequency.exponentialRampToValueAtTime(
      660,
      audioContext.currentTime + 0.04,
    );

    // Quick attack with natural decay for wood resonance
    gainNode.gain.setValueAtTime(0.06, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.003,
      audioContext.currentTime + 0.15,
    );

    // Use triangle and sine for warm marimba-like wood tone
    oscillator1.type = "triangle";
    oscillator2.type = "sine";
    oscillator3.type = "triangle";
    
    oscillator1.start(audioContext.currentTime);
    oscillator2.start(audioContext.currentTime);
    oscillator3.start(audioContext.currentTime);
    oscillator1.stop(audioContext.currentTime + 0.15);
    oscillator2.stop(audioContext.currentTime + 0.12);
    oscillator3.stop(audioContext.currentTime + 0.06);
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

// Mobile paragraph dialogue system functions
function initMobileParagraphMode(point) {
  const isMobile = window.innerWidth <= 480;
  if (!isMobile) return false;
  
  console.log('Initializing mobile paragraph mode - previous state:', {
    wasMobileParagraphMode: isMobileParagraphMode,
    oldParagraphIndex: currentParagraphIndex,
    oldParagraphsLength: currentParagraphs.length
  });
  
  isMobileParagraphMode = true;
  isExpandedMobileView = false;
  currentParagraphIndex = 0;
  completedParagraphs = [];
  
  // Split text into paragraphs (split by double newlines or <br><br>)
  let textToSplit = point.mainText ? point.mainText.text : '';
  if (!textToSplit && point.options && point.options.length > 0) {
    // If no main text, use first option's content
    textToSplit = point.options[0].content ? point.options[0].content.text : '';
  }
  
  // Split by double line breaks or paragraph markers
  currentParagraphs = textToSplit.split(/\n\s*\n|<br>\s*<br>|\\\n\s*\\\n/).filter(p => p.trim());
  
  // If no paragraph breaks found but text is long, split by sentences for mobile readability
  if (currentParagraphs.length === 1 && textToSplit.length > 200) {
    // Split by sentence endings followed by whitespace
    const sentences = textToSplit.split(/(?<=[.!?])\s+/).filter(s => s.trim());
    if (sentences.length > 1) {
      // Group sentences into reasonable chunks (2-3 sentences per paragraph)
      currentParagraphs = [];
      for (let i = 0; i < sentences.length; i += 2) {
        const chunk = sentences.slice(i, i + 2).join(' ').trim();
        if (chunk) currentParagraphs.push(chunk);
      }
    }
  }
  
  console.log('Mobile paragraph mode initialized:', {
    totalParagraphs: currentParagraphs.length,
    firstParagraph: currentParagraphs[0]?.substring(0, 100),
    allParagraphs: currentParagraphs.map((p, i) => `${i}: ${p.substring(0, 50)}...`)
  });
  
  return true;
}

function showMobileParagraph() {
  if (!isMobileParagraphMode || currentParagraphIndex >= currentParagraphs.length) {
    console.log('Mobile: Cannot show paragraph - mode:', isMobileParagraphMode, 'index:', currentParagraphIndex, 'total:', currentParagraphs.length);
    return;
  }
  
  const paragraph = currentParagraphs[currentParagraphIndex];
  const isMobile = window.innerWidth <= 480;
  
  console.log('Mobile: Starting paragraph', currentParagraphIndex + 1, ':', paragraph.substring(0, 50) + '...');
  
  // Clear existing content
  dialogueTextContainer.innerHTML = '';
  
  // Use dynamic sizing that grows with content
  dialoguePanel.classList.add('dynamic-height');
  dialoguePanel.classList.add('mobile-paragraph-mode');
  
  // Ensure expanded mobile class is removed (leftover from old swipe system)
  dialoguePanel.classList.remove('mobile-expanded');
  
  // Reset to natural sizing - let it grow dynamically
  dialoguePanel.style.height = 'auto';
  dialoguePanel.style.minHeight = 'auto';
  dialoguePanel.style.maxHeight = 'none';
  
  // Create paragraph container
  const paragraphContainer = document.createElement('div');
  paragraphContainer.className = 'mobile-paragraph-container';
  
  // Add container to DOM first (so height calculation is stable)
  dialogueTextContainer.appendChild(paragraphContainer);
  
  // Add mobile-specific click handler to paragraph container
  paragraphContainer.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent event bubbling to desktop handlers
    
    console.log('Mobile paragraph click - isTyping:', isTyping);
    
    // Don't process clicks on interactive elements
    if (e.target.classList.contains("interactive-text") || 
        e.target.closest(".back-button") || 
        e.target.closest('.mobile-close-button') ||
        e.target.closest('.mobile-next-arrow')) {
      return;
    }
    
    if (isTyping) {
      // First tap: complete current paragraph text immediately
      console.log("Mobile: First tap - completing paragraph text");
      playSkipSound();
      skipToNextSentence = true;
      hasUsedSkip = true;
      dialogueTextContainer.classList.remove("typing");
    } else {
      // Text is complete, advance to next paragraph like the arrow does
      console.log("Mobile: Paragraph complete - advancing to next");
      currentParagraphIndex++;
      
      if (currentParagraphIndex < currentParagraphs.length) {
        console.log('Mobile: Container click - showing next paragraph');
        showMobileParagraph();
      } else {
        // All paragraphs completed - close dialogue with animation
        console.log('Mobile: Container click - final paragraph reached, closing dialogue');
        closeMobileDialogueWithAnimation();
      }
    }
  });
  
  // Now start typewriter animation - the box should not grow
  typeWriterWithLinks(paragraphContainer, paragraph, 0, currentStoryPoint, () => {
    // Paragraph completed, show Next arrow
    showMobileNextArrow(paragraphContainer);
    
    // Store completed paragraph
    completedParagraphs.push({
      index: currentParagraphIndex,
      content: paragraph,
      element: paragraphContainer.cloneNode(true)
    });
  });
  
  // Swipe handler removed - using click-only advancement
}

function calculateOptimalDialogueHeight(textContent, isMobile = false, isTablet = false) {
  // Create a temporary invisible element that exactly matches the dialogue structure
  const tempDialogue = document.createElement('div');
  tempDialogue.className = 'dialogue-panel visible'; // Add visible to get proper styling
  if (isMobile) tempDialogue.classList.add('dynamic-height');
  
  tempDialogue.style.cssText = `
    position: absolute;
    visibility: hidden;
    left: -9999px;
    top: -9999px;
    width: ${isMobile ? 'calc(100vw - 30px)' : isTablet ? 'calc(100vw - 40px)' : '450px'};
    opacity: 0;
    pointer-events: none;
    height: auto;
    max-height: none;
    min-height: auto;
  `;
  
  // Create the dialogue structure exactly as it appears
  const dialogueContent = document.createElement('div');
  dialogueContent.className = 'dialogue-content';
  
  const dialogueHeader = document.createElement('div');
  dialogueHeader.className = 'dialogue-header';
  
  // Use actual title content for more accurate measurement
  const locationTitle = document.createElement('div');
  locationTitle.className = 'location-title';
  locationTitle.textContent = currentStoryPoint?.title || 'Sample Title';
  
  dialogueHeader.appendChild(locationTitle);
  
  const textContainer = document.createElement('div');
  textContainer.className = 'dialogue-text-container';
  
  // Create the paragraph container structure
  const paragraphContainer = document.createElement('div');
  paragraphContainer.className = isMobile ? 'mobile-paragraph-container' : 'dialogue-entry';
  
  // Add the text content - render the FULL text at once to measure properly
  const textDiv = document.createElement('div');
  textDiv.className = 'section-text';
  
  // Process the text through the same parsing system to handle links/formatting
  const parsedParts = parseTextWithLinksAndStyling(textContent, currentStoryPoint || {});
  parsedParts.forEach(part => {
    if (part.type === 'text') {
      textDiv.appendChild(document.createTextNode(part.content));
    } else if (part.type === 'link') {
      const linkSpan = document.createElement('span');
      linkSpan.className = 'interactive-text';
      linkSpan.textContent = part.content;
      textDiv.appendChild(linkSpan);
    } else if (part.type === 'styled') {
      const styledSpan = document.createElement('span');
      styledSpan.className = part.styleClass;
      styledSpan.textContent = part.content;
      textDiv.appendChild(styledSpan);
    } else if (part.type === 'linebreak') {
      textDiv.appendChild(document.createElement('br'));
    }
  });
  
  paragraphContainer.appendChild(textDiv);
  textContainer.appendChild(paragraphContainer);
  dialogueContent.appendChild(dialogueHeader);
  dialogueContent.appendChild(textContainer);
  tempDialogue.appendChild(dialogueContent);
  
  document.body.appendChild(tempDialogue);
  
  // Force a reflow to ensure accurate measurement
  tempDialogue.offsetHeight;
  
  // Get the actual rendered height
  const totalHeight = tempDialogue.getBoundingClientRect().height;
  document.body.removeChild(tempDialogue);
  
  console.log('Height calculation for single paragraph:', {
    textPreview: textContent.substring(0, 50) + '...',
    fullTextLength: textContent.length,
    measuredHeight: totalHeight,
    isMobile,
    isTablet
  });
  
  // Add minimal breathing room for mobile paragraphs
  const breathingRoom = 10;
  const finalHeight = totalHeight + breathingRoom;
  
  let maxHeight, minHeight;
  if (isMobile) {
    maxHeight = window.innerHeight * 0.8;
    // For mobile paragraphs, use natural content height with small minimum
    minHeight = 80; // Small fixed minimum instead of percentage
  } else if (isTablet) {
    maxHeight = window.innerHeight * 0.7;
    minHeight = window.innerHeight * 0.3;
  } else {
    // Desktop - return null to use CSS defaults
    return null;
  }
  
  const result = Math.max(minHeight, Math.min(maxHeight, finalHeight));
  console.log('Final calculated height:', result);
  return result;
}

function resizeMobileDialogueToContent(preCalculatedHeight = null) {
  const isMobile = window.innerWidth <= 480;
  if (!isMobile) return;
  
  // Skip resizing if in expanded view
  if (isExpandedMobileView) return;
  
  let newHeight;
  if (preCalculatedHeight) {
    newHeight = preCalculatedHeight;
  } else {
    // Fallback to current method if no pre-calculated height (shouldn't happen in new system)
    console.warn('Mobile: Using fallback height calculation - this should not happen with pre-sizing');
    const contentHeight = dialogueTextContainer.scrollHeight;
    const headerHeight = 90;
    const padding = 60;
    const maxHeight = window.innerHeight * 0.8;
    const minHeight = window.innerHeight * 0.2;
    newHeight = Math.max(minHeight, Math.min(maxHeight, contentHeight + headerHeight + padding));
  }
  
  // Add dynamic height class to override CSS constraints
  dialoguePanel.classList.add('dynamic-height');
  
  // Apply the new height with smooth transition for paragraph changes
  dialoguePanel.style.transition = 'height 0.3s ease-out';
  dialoguePanel.style.height = `${newHeight}px`;
  dialoguePanel.style.minHeight = `${newHeight}px`;
  dialoguePanel.style.maxHeight = `${newHeight}px`;
  
  console.log('Mobile: Dialogue height set to', newHeight + 'px');
  
  // Remove transition after animation completes
  setTimeout(() => {
    dialoguePanel.style.transition = '';
  }, 300);
}

function resizeDialogueToContent() {
  const isMobile = window.innerWidth <= 480;
  const isTablet = window.innerWidth > 480 && window.innerWidth <= 768;
  
  if (isMobile) {
    resizeMobileDialogueToContent();
    return;
  }
  
  if (isTablet) {
    // For tablets, also resize dynamically
    const contentHeight = dialogueTextContainer.scrollHeight;
    const headerHeight = 90;
    const padding = 60;
    const maxHeight = window.innerHeight * 0.7;
    const minHeight = window.innerHeight * 0.3;
    
    const newHeight = Math.max(minHeight, Math.min(maxHeight, contentHeight + headerHeight + padding));
    
    // Add dynamic height class to override CSS constraints
    dialoguePanel.classList.add('dynamic-height');
    dialoguePanel.style.transition = 'height 0.3s ease-out';
    dialoguePanel.style.height = `${newHeight}px`;
    
    setTimeout(() => {
      dialoguePanel.style.transition = '';
    }, 300);
  } else {
    // Desktop: remove dynamic height class to use CSS defaults
    dialoguePanel.classList.remove('dynamic-height');
    dialoguePanel.style.height = '';
  }
}

function showMobileNextArrow(container) {
  // Don't show arrow if this is the final paragraph
  if (currentParagraphIndex >= currentParagraphs.length - 1) {
    console.log('Mobile: Final paragraph reached - not showing next arrow');
    return;
  }
  
  // Remove any existing next arrows
  const existingArrow = container.querySelector('.mobile-next-arrow');
  if (existingArrow) {
    existingArrow.remove();
  }
  
  // Create inline span element instead of div
  const nextArrow = document.createElement('span');
  nextArrow.className = 'mobile-next-arrow';
  nextArrow.innerHTML = `
    <svg width="16" height="12" viewBox="0 0 20 16" fill="currentColor">
      <path d="M12 2l6 6-6 6v-4H2V6h10V2z"/>
    </svg>
  `;
  
  nextArrow.addEventListener('click', (e) => {
    e.stopPropagation();
    currentParagraphIndex++;
    
    console.log('Mobile: Next arrow clicked', {
      newIndex: currentParagraphIndex,
      totalParagraphs: currentParagraphs.length,
      shouldShowNext: currentParagraphIndex < currentParagraphs.length
    });
    
    if (currentParagraphIndex < currentParagraphs.length) {
      console.log('Mobile: Showing next paragraph');
      showMobileParagraph();
    } else {
      // All paragraphs completed - close dialogue with animation
      console.log('Mobile: Final paragraph reached, closing dialogue');
      closeMobileDialogueWithAnimation();
    }
  });
  
  // Find the last text node and append the arrow inline right at the end of the text
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  
  let lastTextNode = null;
  let node;
  while (node = walker.nextNode()) {
    if (node.nodeValue.trim()) { // Only consider non-empty text nodes
      lastTextNode = node;
    }
  }
  
  if (lastTextNode && lastTextNode.parentElement) {
    // Insert arrow right after the last text content
    lastTextNode.parentElement.appendChild(nextArrow);
  } else {
    // Fallback: append to container
    container.appendChild(nextArrow);
  }
  
  // Animate in the arrow
  setTimeout(() => {
    nextArrow.style.opacity = '1';
    nextArrow.style.transform = 'translateY(0)';
  }, 100);
}

// Swipe handler removed - mobile dialogue now uses click-only advancement

// Dialogue positioning system
function setDialoguePosition(position, isMobile = false) {
  const panel = dialoguePanel;
  
  // Clear existing position classes
  panel.classList.remove('dialogue-top', 'dialogue-bottom', 'dialogue-left', 'dialogue-right');
  
  if (isMobile) {
    // Mobile positioning: top or bottom
    if (position === 'top' || position === 'mobile-top') {
      panel.classList.add('dialogue-top');
      panel.style.top = '70px';
      panel.style.bottom = 'auto';
    } else if (position === 'bottom' || position === 'mobile-bottom') {
      panel.classList.add('dialogue-bottom');
      panel.style.bottom = '20px';
      panel.style.top = 'auto';
    }
  } else {
    // Desktop positioning: left or right
    if (position === 'left' || position === 'desktop-left') {
      panel.classList.add('dialogue-left');
      panel.style.setProperty('left', '20px', 'important');
      panel.style.setProperty('right', 'auto', 'important');
    } else if (position === 'right' || position === 'desktop-right') {
      panel.classList.add('dialogue-right');
      panel.style.setProperty('right', '20px', 'important');
      panel.style.setProperty('left', 'auto', 'important');
    }
  }
  
  console.log('Dialogue positioned:', position, isMobile ? '(mobile)' : '(desktop)');
}

function resetDialoguePosition() {
  const panel = dialoguePanel;
  
  // Clear all position classes and styles
  panel.classList.remove('dialogue-top', 'dialogue-bottom', 'dialogue-left', 'dialogue-right');
  panel.style.top = '';
  panel.style.bottom = '';
  panel.style.left = '';
  panel.style.right = '';
}

function closeMobileDialogueWithAnimation() {
  console.log('Closing mobile dialogue with animation');
  
  // Add close animation class
  dialoguePanel.classList.add('closing');
  
  // Hide the dialogue after animation completes
  setTimeout(() => {
    hideDialogue();
    dialoguePanel.classList.remove('closing');
    dialoguePanel.classList.remove('mobile-paragraph-mode');
    
    // Clean up mobile paragraph mode
    isMobileParagraphMode = false;
    isExpandedMobileView = false;
    currentParagraphs = [];
    currentParagraphIndex = 0;
    completedParagraphs = [];
  }, 300); // Match animation duration
}

function expandMobileDialogue() {
  isExpandedMobileView = true;
  
  // Clear current content and show all completed paragraphs
  dialogueTextContainer.innerHTML = '';
  
  // Create scrollable container with all paragraphs
  const expandedContainer = document.createElement('div');
  expandedContainer.className = 'mobile-expanded-container';
  
  // Add all completed paragraphs
  completedParagraphs.forEach(para => {
    const paraDiv = para.element.cloneNode(true);
    // Remove next arrows from completed paragraphs
    const arrows = paraDiv.querySelectorAll('.mobile-next-arrow');
    arrows.forEach(arrow => arrow.remove());
    expandedContainer.appendChild(paraDiv);
    
    // Add spacing between paragraphs
    const spacer = document.createElement('div');
    spacer.style.height = '20px';
    expandedContainer.appendChild(spacer);
  });
  
  // Add X button in top-right
  const closeButton = document.createElement('div');
  closeButton.className = 'mobile-close-button';
  closeButton.innerHTML = '×';
  closeButton.addEventListener('click', () => {
    contractMobileDialogue();
  });
  
  // Style the expanded view
  dialoguePanel.classList.add('mobile-expanded');
  dialogueTextContainer.appendChild(expandedContainer);
  dialogueTextContainer.appendChild(closeButton);
  
  // Scroll to bottom to show latest content
  setTimeout(() => {
    dialogueTextContainer.scrollTop = dialogueTextContainer.scrollHeight;
  }, 100);
}

function contractMobileDialogue() {
  isExpandedMobileView = false;
  dialoguePanel.classList.remove('mobile-expanded');
  
  // Return to paragraph mode
  showMobileParagraph();
}

function exitMobileParagraphMode() {
  isMobileParagraphMode = false;
  isExpandedMobileView = false;
  
  // Don't restart dialogue - just show completed paragraphs with interactive options
  // The last paragraph should already have all the interactive text/links from the typewriter system
  console.log('Mobile paragraph mode finished - staying on completed content');
  
  // Reset variables for next time
  currentParagraphs = [];
  currentParagraphIndex = 0;
  completedParagraphs = [];
  
  // Remove the next arrow from the last paragraph since we're done
  const lastArrow = dialogueTextContainer.querySelector('.mobile-next-arrow');
  if (lastArrow) {
    lastArrow.remove();
  }
  
  // Make sure the dialogue box is sized correctly for the final content
  setTimeout(() => resizeMobileDialogueToContent(), 100);
}

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
  console.log('Initializing flat panoramic view');
  
  // Get panorama elements
  const panoramaView = document.getElementById('panoramaView');
  const panoramaContainer = document.getElementById('panoramaContainer');
  const panoramaImage = document.getElementById('panoramaImage');
  
  if (!panoramaView || !panoramaContainer || !panoramaImage) {
    console.error('Panorama elements not found');
    return;
  }
  
  // Setup flat panorama drag controls (similar to street view)
  setupFlatPanoramaControls();
  
  console.log('Flat panoramic view initialized successfully');
}

// Load scene-specific street view image (no panoramic system - just change background)

// Update scene image when day/night mode changes

// Setup drag controls for flat panorama (similar to street view)
function setupFlatPanoramaControls() {
  const panoramaContainer = document.getElementById('panoramaContainer');
  if (!panoramaContainer) return;
  
  let isDragging = false;
  let startX = 0;
  let currentTransformX = 0;
  let hasDragged = false;
  
  // Mouse events
  panoramaContainer.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    hasDragged = false;
    panoramaContainer.style.cursor = 'grabbing';
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - startX;
    if (Math.abs(deltaX) > 5) hasDragged = true;
    
    // Move panorama horizontally (1:1 with mouse movement)
    currentTransformX = deltaX;
    panoramaContainer.style.transform = `translate3d(calc(-100% + ${currentTransformX}px), 0, 0)`;
    
    // Update circle positions
    updateFlatPanoramaCircles(currentTransformX);
  });
  
  document.addEventListener('mouseup', () => {
    isDragging = false;
    panoramaContainer.style.cursor = 'grab';
    
    // Reset drag flag after delay
    setTimeout(() => {
      hasDragged = false;
    }, 10);
  });
  
  // Touch events  
  panoramaContainer.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      isDragging = true;
      startX = e.touches[0].clientX;
      hasDragged = false;
      e.preventDefault();
    }
  });
  
  document.addEventListener('touchmove', (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    
    const deltaX = e.touches[0].clientX - startX;
    if (Math.abs(deltaX) > 5) hasDragged = true;
    
    // Move panorama horizontally (1:1 with touch movement)
    currentTransformX = deltaX;
    panoramaContainer.style.transform = `translate3d(calc(-100% + ${currentTransformX}px), 0, 0)`;
    
    // Update circle positions
    updateFlatPanoramaCircles(currentTransformX);
    
    e.preventDefault();
  });
  
  document.addEventListener('touchend', () => {
    isDragging = false;
    
    // Reset drag flag after delay
    setTimeout(() => {
      hasDragged = false;
    }, 10);
  });
  
  console.log('Flat panorama controls setup complete');
}

// Load day and night textures for non-Food scenes
function loadSinglePanoramaImage(point) {
  let dayImagePath, nightImagePath;
  
  switch (point.title) {
    case 'Education':
      dayImagePath = 'assets/images/Rooftop-Day.jpg';
      nightImagePath = 'assets/images/Rooftop-Night.jpg';
      break;
    case 'Energy':
      dayImagePath = 'assets/images/Panels-Day.jpg';
      nightImagePath = 'assets/images/Panels-Night.jpg';
      break;
    case 'Transport':
      dayImagePath = 'assets/images/Transport-Day.jpg';
      nightImagePath = 'assets/images/Transport-Night.jpg';
      break;
    case 'Food':
      dayImagePath = 'assets/images/Market-Day.jpg';
      nightImagePath = 'assets/images/Market-Night.jpg';
      break;
    default:
      dayImagePath = 'assets/images/Full-Day.jpg';
      nightImagePath = 'assets/images/Full-Night.jpg';
      console.log(`No specific scene image for ${point.title}, using energy scene`);
      break;
  }
  
  console.log(`Loading day and night 2D scene images for ${point.title}...`);
  
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
      console.log('currentStoryPoint at transition completion:', currentStoryPoint?.title);
      // Trigger panorama dialogue with points after transition completes
      if (currentStoryPoint) {
        console.log('Calling showPanoramaDialogue after transition completion');
        showPanoramaDialogue(currentStoryPoint);
      } else {
        console.log('ERROR: No currentStoryPoint available for panorama dialogue');
      }
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
        // Show minimized dialogue tab when dragging starts in panorama mode
        if (currentStoryPoint && dialoguePanel.classList.contains("visible")) {
          hideDialogue();
          showMinimizedDialogueTab();
        }
      }
      
      // Handle dragging (increased sensitivity for faster movement)
      // Restrict movement to predominantly one axis to prevent diagonal spinning
      const deltaX = onMouseDownMouseX - event.clientX;
      const deltaY = event.clientY - onMouseDownMouseY;
      
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal movement dominates - only move horizontally
        lon = deltaX * 0.18 + onMouseDownLon;
        lat = onMouseDownLat; // Keep vertical position fixed
      } else {
        // Vertical movement dominates - only move vertically
        lon = onMouseDownLon; // Keep horizontal position fixed
        lat = deltaY * 0.18 + onMouseDownLat;
      }
      
      // Limit vertical rotation
      lat = Math.max(-85, Math.min(85, lat));
      
      // IMMEDIATE real-time update of panorama point positions during drag
      requestAnimationFrame(() => {
        updatePanoramaPointPositions();
      });
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
      hasDragged = false;
      dragStartTime = Date.now();
      
      onMouseDownMouseX = event.touches[0].pageX;
      onMouseDownMouseY = event.touches[0].pageY;
      dragStartPosition.x = event.touches[0].pageX;
      dragStartPosition.y = event.touches[0].pageY;
      onMouseDownLon = lon;
      onMouseDownLat = lat;
    }
  }
  
  function onTouchMove(event) {
    if (event.touches.length === 1 && isMouseDown) {
      event.preventDefault();
      
      // Check if this constitutes a drag
      const dragDistance = Math.sqrt(
        Math.pow(event.touches[0].pageX - dragStartPosition.x, 2) + 
        Math.pow(event.touches[0].pageY - dragStartPosition.y, 2)
      );
      
      if (dragDistance > 5) { // Threshold for distinguishing touch from drag
        hasDragged = true;
        // Show minimized dialogue tab when dragging starts in panorama mode
        if (currentStoryPoint && dialoguePanel.classList.contains("visible")) {
          hideDialogue();
          showMinimizedDialogueTab();
        }
      }
      
      // Handle touch dragging - restrict to one axis like mouse movement
      const touchDeltaX = onMouseDownMouseX - event.touches[0].pageX;
      const touchDeltaY = event.touches[0].pageY - onMouseDownMouseY;
      
      if (Math.abs(touchDeltaX) > Math.abs(touchDeltaY)) {
        // Horizontal movement dominates - only move horizontally
        lon = touchDeltaX * 0.18 + onMouseDownLon;
        lat = onMouseDownLat; // Keep vertical position fixed
      } else {
        // Vertical movement dominates - only move vertically
        lon = onMouseDownLon; // Keep horizontal position fixed
        lat = touchDeltaY * 0.18 + onMouseDownLat;
      }
      
      // Limit vertical rotation
      lat = Math.max(-85, Math.min(85, lat));
      
      // IMMEDIATE real-time update of panorama point positions during touch drag
      requestAnimationFrame(() => {
        updatePanoramaPointPositions();
      });
    }
  }
  
  function onTouchEnd() {
    isMouseDown = false;
    
    // Reset drag flag after a short delay to allow click event to process
    setTimeout(() => {
      hasDragged = false;
    }, 10);
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
      
      // Update panorama point positions every frame for smooth movement
      updatePanoramaPointPositions();
      
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


// Create simple test panorama circles without text parsing
function createPanoramaCirclePoints(storyPoint) {
  console.log('createPanoramaCirclePoints called - creating test circles');
  console.log('panoramaOverlay exists:', !!panoramaOverlay);
  
  // Clear existing panorama points (except back-to-street button)
  document.querySelectorAll('.panorama-point').forEach(p => {
    if (!p.classList.contains('back-to-street')) {
      p.remove();
    }
  });
  console.log('Cleared existing panorama points');
  
  // Get manually positioned circles for this panorama
  const manualCircles = getManualCirclePositions(storyPoint.title);
  
  console.log('Creating', manualCircles.length, 'manually positioned circles');
  
  // Create panorama points with manually set positions
  panoramaPoints = manualCircles.map((circle, index) => ({
    ...circle,
    key: circle.key || `manual${index}`,
    element: null
  }));
  
  // Create the actual DOM elements
  panoramaPoints.forEach((point, index) => {
    createTestPanoramaCircle(point, index);
  });
  
  console.log('Created', panoramaPoints.length, 'manually positioned panorama circles');
  
  // Set initial positions and start continuous updates to move with panorama
  setTimeout(() => {
    console.log('Setting initial positions for panorama circles');
    setInitialPanoramaPositions();
    
    // Start continuous updates so circles move with panorama rotation
    const positionInterval = setInterval(() => {
      updatePanoramaPointPositions();
    }, 16); // 60fps for smooth movement with panorama
    
    // Store interval reference to clean up later if needed
    if (window.panoramaPositionInterval) {
      clearInterval(window.panoramaPositionInterval);
    }
    window.panoramaPositionInterval = positionInterval;
    
    console.log('Started continuous position updates for panorama circles');
  }, 100);
}

// Manual positioning configuration for each panorama
// Longitude: -180 to +180 (left to right, 0 = center/front)
// Latitude: -90 to +90 (bottom to top, 0 = horizon)
function getManualCirclePositions(panoramaTitle) {
  const positions = {
    'Food': [
      { title: 'Rooftop Gardens', longitude: -90, latitude: 15, key: 'farmers_markets' },
      { title: 'Blooming Gardens', longitude: 45, latitude: -10, key: 'fair_design' },
      { title: 'Compost Area', longitude: 120, latitude: 5, key: 'waste' },
      { title: 'Slow Food Kitchen', longitude: -150, latitude: -5, key: 'slow_food' }
    ],
    'Transport': [
      { title: 'Connected Networks', longitude: -100, latitude: 15, key: 'networks' },
      { title: 'Car Alternatives', longitude: 45, latitude: -25, key: 'private_cars' },
      { title: 'Reclaimed Spaces', longitude: 100, latitude: 10, key: 'returned_people' },
      { title: 'Traffic-Free Zone', longitude: -45, latitude: -10, key: 'traffic_gone' }
    ],
    'Education': [
      { title: 'Cooperative Learning', longitude: -120, latitude: 20, key: 'cooperation_first' },
      { title: 'Knowledge Hub', longitude: 30, latitude: -15, key: 'connected_knowledge' },
      { title: 'Lifelong Learning Center', longitude: 90, latitude: 10, key: 'lifelong_education' }
    ],
    'Energy': [
      { title: 'Energy Cooperative', longitude: -75, latitude: 25, key: 'energy_coops' },
      { title: 'Fair Share Hub', longitude: 60, latitude: -20, key: 'fair_share' },
      { title: 'Living System', longitude: 135, latitude: 0, key: 'living_system' }
    ],
    'Housing': [
      { title: 'Blossoming Neighborhood', longitude: -150, latitude: 25, key: 'blossoming_neighbourhoods' },
      { title: 'Community Planning', longitude: 0, latitude: -30, key: 'bottom_up_planning' },
      { title: 'Heritage Space', longitude: 75, latitude: 15, key: 'place_based' },
      { title: 'Diverse Community', longitude: 120, latitude: -10, key: 'diversity_care' },
      { title: 'Fluid Housing', longitude: -75, latitude: 0, key: 'ownership' }
    ],
    'Governance': [
      { title: 'Citizens Assembly', longitude: -135, latitude: 20, key: 'citizens_assemblies' },
      { title: 'Decentralized Network', longitude: 30, latitude: -15, key: 'decentralised_connected' },
      { title: 'Community Joy', longitude: 90, latitude: 5, key: 'joy' },
      { title: 'Local Power Hub', longitude: -30, latitude: -20, key: 'local_power' }
    ]
  };
  
  // Return positions for the requested panorama, or default test positions
  return positions[panoramaTitle] || [
    { title: 'Test Circle 1', longitude: 0, latitude: 0, key: 'test1' },
    { title: 'Test Circle 2', longitude: 90, latitude: 0, key: 'test2' },
    { title: 'Test Circle 3', longitude: 180, latitude: 0, key: 'test3' },
    { title: 'Test Circle 4', longitude: -90, latitude: 0, key: 'test4' }
  ];
}

// Show story content for clicked panorama circle
function showPanoramaStoryContent(pointData) {
  console.log('showPanoramaStoryContent called with:', pointData);
  console.log('currentStoryPoint:', currentStoryPoint);
  
  // Get the current panorama's main story point
  const storyPoint = storyPoints.find(point => point.title === currentStoryPoint?.title);
  console.log('Found main story point:', storyPoint?.title);
  
  if (!storyPoint || !storyPoint.options) {
    console.log('No story point or options found for:', currentStoryPoint?.title);
    console.log('Available story points:', storyPoints.map(p => p.title));
    
    // Fallback: show a simple dialogue with the circle info
    locationTitle.textContent = pointData.title;
    // No longer using locationSubtitle element
    storyText.innerHTML = `<p>This is the ${pointData.title} section content.</p>`;
    dialoguePanel.classList.add("visible");
    hideMinimizedDialogueTab();
    return;
  }
  
  // Find the specific content option based on the circle's key
  const contentOption = storyPoint.options.find(option => option.key === pointData.key);
  console.log('Looking for content with key:', pointData.key);
  console.log('Available option keys:', storyPoint.options.map(opt => opt.key));
  console.log('Found content option:', contentOption);
  
  if (!contentOption || !contentOption.content) {
    console.log('No content found for key:', pointData.key);
    
    // Fallback: show basic info
    locationTitle.textContent = pointData.title;
    // No longer using locationSubtitle element
    storyText.innerHTML = `<p>Content for ${pointData.title} (${pointData.key})</p>`;
    dialoguePanel.classList.add("visible");
    hideMinimizedDialogueTab();
    return;
  }
  
  console.log('Found content option:', contentOption);
  
  // Get dialogue text container
  const dialogueTextContainer = document.querySelector('.dialogue-text');
  if (!dialogueTextContainer) {
    console.error('Dialogue text container not found');
    return;
  }
  
  // Clear the dialogue text container
  dialogueTextContainer.innerHTML = '';
  
  // Create dialogue entry for this option content
  const dialogueEntry = document.createElement('div');
  dialogueEntry.classList.add('dialogue-entry');
  
  // Create speaker element
  const speakerElement = document.createElement('div');
  speakerElement.classList.add('speaker');
  speakerElement.textContent = contentOption.content.speaker || pointData.title;
  dialogueEntry.appendChild(speakerElement);
  
  // Create story text element
  const textElement = document.createElement('div');
  textElement.classList.add('story-text');
  
  // Process and display the text content with interactive text processing
  const processedText = processInteractiveText(contentOption.content.text || "");
  textElement.innerHTML = processedText;
  dialogueEntry.appendChild(textElement);
  
  // Add back button to return to main section
  const backButton = document.createElement('button');
  backButton.classList.add('back-button');
  backButton.innerHTML = '← Back to ' + (currentStoryPoint?.title || 'Main');
  backButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Return to main section content
    if (currentStoryPoint && currentStoryPoint.mainText) {
      showMainDialogueContent(currentStoryPoint);
    }
  });
  dialogueEntry.appendChild(backButton);
  
  // Add the dialogue entry to container
  dialogueTextContainer.appendChild(dialogueEntry);
  
  // Update title
  locationTitle.textContent = contentOption.content.speaker || pointData.title;
  // No longer using locationSubtitle element
  
  // Show the dialogue panel
  dialoguePanel.classList.add("visible");
  
  // Hide minimized tab if showing
  hideMinimizedDialogueTab();
  
  console.log('Displayed story content for:', pointData.title);
}

// Show main dialogue content for a section (when returning from option view)
function showMainDialogueContent(storyPoint) {
  // Get dialogue text container
  const dialogueTextContainer = document.querySelector('.dialogue-text');
  if (!dialogueTextContainer) {
    console.error('Dialogue text container not found');
    return;
  }
  
  // Clear the dialogue text container
  dialogueTextContainer.innerHTML = '';
  
  // Create dialogue entry for main content
  const dialogueEntry = document.createElement('div');
  dialogueEntry.classList.add('dialogue-entry');
  
  // Create speaker element
  const speakerElement = document.createElement('div');
  speakerElement.classList.add('speaker');
  speakerElement.textContent = storyPoint.mainText.speaker || storyPoint.title;
  dialogueEntry.appendChild(speakerElement);
  
  // Create story text element
  const textElement = document.createElement('div');
  textElement.classList.add('story-text');
  
  // Process and display the main text content
  const processedText = processInteractiveText(storyPoint.mainText.text || "");
  textElement.innerHTML = processedText;
  dialogueEntry.appendChild(textElement);
  
  // Add the dialogue entry to container
  dialogueTextContainer.appendChild(dialogueEntry);
  
  // Update title
  locationTitle.textContent = storyPoint.title;
  // locationSubtitle removed
  
  console.log('Displayed main dialogue content for:', storyPoint.title);
}

// Set initial positions for panorama circles (like street view)
function setInitialPanoramaPositions() {
  if (!panoramaPoints || panoramaPoints.length === 0) {
    return;
  }
  
  panoramaPoints.forEach(pointData => {
    const circleElement = pointData.element;
    if (!circleElement) return;
    
    // Convert longitude/latitude to screen position percentage
    // Map longitude (-180 to 180) to horizontal position (0% to 100%)
    const screenX = ((pointData.longitude + 180) / 360) * 100;
    
    // Map latitude (-90 to 90) to vertical position (0% to 100%, inverted)
    const screenY = ((90 - pointData.latitude) / 180) * 100;
    
    // Set fixed position on the panorama container
    circleElement.style.left = `${screenX}%`;
    circleElement.style.top = `${screenY}%`;
    
    console.log(`Positioned ${pointData.title} at ${screenX.toFixed(1)}%, ${screenY.toFixed(1)}%`);
  });
}

// Create a simple test panorama circle
function createTestPanoramaCircle(pointData, index) {
  console.log('Creating test panorama circle:', pointData.title);
  
  const circleElement = document.createElement('div');
  circleElement.className = 'panorama-point test-circle';
  circleElement.dataset.key = pointData.key;
  circleElement.dataset.index = index;
  circleElement.dataset.title = pointData.title;
  
  // Style exactly like street view circles
  circleElement.style.position = 'absolute';
  circleElement.style.zIndex = '999';
  circleElement.style.transform = 'translate(-50%, -50%) scale(1)';
  circleElement.style.opacity = '1';
  circleElement.style.pointerEvents = 'auto';
  circleElement.style.cursor = 'pointer';
  
  // Use mobile-optimized sizing
  const isMobile = window.innerWidth <= 480;
  if (isMobile) {
    circleElement.style.width = '80px';
    circleElement.style.height = '80px';
    circleElement.style.borderWidth = '2px';
  } else {
    circleElement.style.width = '150px';
    circleElement.style.height = '150px';
    circleElement.style.borderWidth = '7px';
  }
  
  // Apply street view circle styling
  circleElement.style.background = 'radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.2), rgba(0, 0, 0, 0.1))';
  circleElement.style.border = `${circleElement.style.borderWidth} dashed #e8e8e8`;
  circleElement.style.borderRadius = '50%';
  circleElement.style.transition = 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)';
  circleElement.style.boxShadow = `
    inset 5px 5px 15px rgba(255, 255, 255, 0.3),
    inset -5px -5px 15px rgba(0, 0, 0, 0.4),
    0 10px 30px rgba(0, 0, 0, 0.3),
    0 0 0 2px rgba(255, 255, 255, 0.1)
  `;
  circleElement.style.animation = 'gentlePulse 6s ease-in-out infinite';
  
  // Add debug number in center
  circleElement.innerHTML = `<div style="color: #e8e8e8; text-align: center; line-height: ${isMobile ? '74px' : '136px'}; font-size: ${isMobile ? '14px' : '18px'}; font-weight: bold; text-shadow: 0 0 5px rgba(0,0,0,0.8);">${index + 1}</div>`;
  
  // Add hover animations like street view circles
  circleElement.addEventListener('mouseenter', () => {
    circleElement.style.transform = 'translate(-50%, -50%) scale(1.15)';
  });
  
  circleElement.addEventListener('mouseleave', () => {
    if (!circleElement.classList.contains('selected')) {
      circleElement.style.transform = 'translate(-50%, -50%) scale(1)';
    }
  });
  
  // Add click handler with selection animation
  circleElement.addEventListener('click', (e) => {
    console.log('Circle clicked!', pointData.title, 'Key:', pointData.key);
    e.preventDefault();
    e.stopPropagation();
    
    if (hasDragged) {
      console.log('Click ignored - hasDragged is true');
      hasDragged = false;
      return;
    }
    
    // Add selection state like street view circles
    circleElement.classList.add('selected');
    circleElement.style.transform = 'translate(-50%, -50%) scale(1.3)';
    
    // Show the story content for this circle
    console.log(`Showing story content for: ${pointData.title} (key: ${pointData.key})`);
    showPanoramaStoryContent(pointData);
    
    // Remove selection after delay
    setTimeout(() => {
      circleElement.classList.remove('selected');
      circleElement.style.transform = 'translate(-50%, -50%) scale(1)';
    }, 1000);
  });
  
  // Set initial position based on longitude/latitude for immediate visibility
  const pointLongitude = pointData.longitude || 0;
  const pointLatitude = pointData.latitude || 0;
  const initialX = 50 + (pointLongitude / 180) * 30; // Spread across screen
  const initialY = 50 - (pointLatitude / 90) * 20;   // Spread vertically
  
  circleElement.style.left = `${initialX}%`;
  circleElement.style.top = `${initialY}%`;
  circleElement.style.display = 'block';
  circleElement.style.opacity = '1';
  
  console.log(`Created circle ${pointData.title} at initial position:`, {
    longitude: pointLongitude,
    latitude: pointLatitude,
    screenX: initialX,
    screenY: initialY
  });
  
  console.log('panoramaOverlay element:', panoramaOverlay);
  console.log('panoramaOverlay display style:', panoramaOverlay ? getComputedStyle(panoramaOverlay).display : 'null');
  
  // Add to panorama container instead of overlay, like street view circles
  const panoramaContainer = document.getElementById('panoramaContainer');
  if (panoramaContainer) {
    panoramaContainer.appendChild(circleElement);
    console.log('Test circle appended to panorama container. Children count:', panoramaContainer.children.length);
    
    // Store reference for position updates
    pointData.element = circleElement;
    
    console.log('Test panorama circle created for:', pointData.title);
  } else {
    console.error('panoramaContainer is null - cannot append circle');
  }
}

// Show content for an interactive link clicked in panorama view
function showInteractiveLinkContent(pointData) {
  if (!pointData.content) return;
  
  // Update the dialogue panel with the new content
  locationTitle.textContent = pointData.title;
  // No longer using locationSubtitle element // Clear subtitle for sub-content
  
  // Clear existing dialogue content
  dialogueTextContainer.innerHTML = "";
  
  // Create the dialogue entry
  const dialogueEntry = document.createElement("div");
  dialogueEntry.className = "dialogue-entry";
  
  // Add speaker if present
  if (pointData.content.speaker) {
    const speaker = document.createElement("div");
    speaker.className = "subtitle";
    speaker.textContent = pointData.content.speaker;
    dialogueEntry.appendChild(speaker);
  }
  
  // Add the content text
  const text = document.createElement("div");
  text.className = "section-text";
  text.textContent = pointData.content.text;
  dialogueEntry.appendChild(text);
  
  // Add back button
  const backButton = document.createElement("div");
  backButton.className = "back-button";
  backButton.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.42-1.41L7.83 13H20v-2z"/>
    </svg>
    Back
  `;
  
  backButton.addEventListener("click", () => {
    // Return to main panorama view
    showDialogue(currentStoryPoint, null);
  });
  
  dialogueEntry.appendChild(backButton);
  dialogueTextContainer.appendChild(dialogueEntry);
  
  // Show the dialogue panel
  dialoguePanel.classList.add("visible");
  
  // Hide minimized tab if it exists
  hideMinimizedDialogueTab();
}

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
  console.log('showPanoramaDialogue called for:', point.title);
  console.log('Point structure:', {
    title: point.title,
    hasMainText: !!point.mainText,
    mainTextHasText: !!(point.mainText && point.mainText.text),
    mainTextPreview: point.mainText ? point.mainText.text.substring(0, 100) + '...' : 'none'
  });
  
  currentStoryPoint = point;
  locationTitle.textContent = point.title;
  // locationSubtitle removed

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
  
  // Create panorama circle points like street view
  console.log('Setting timeout to create panorama circle points in 500ms...');
  setTimeout(() => {
    console.log('Timeout triggered - calling createPanoramaCirclePoints');
    createPanoramaCirclePoints(point);
    // Position update is now handled inside createPanoramaCirclePoints
  }, 500); // Small delay to ensure panorama is fully loaded
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
  
  // Check if mobile paragraph mode should be used
  if (initMobileParagraphMode(currentStoryPoint)) {
    // Use mobile paragraph system
    // Speaker content handled via subtitle class
    
    dialoguePanel.classList.add("visible");
    showMobileParagraph();
    console.log('Food sub-content displayed (mobile mode):', foodSubPoint.title);
    return;
  }

  // Desktop mode continues with existing system
  // No longer using locationSubtitle element
  
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
  
  // Add main text with typewriter effect instead of innerHTML
  const textDiv = document.createElement('div');
  textDiv.className = 'section-text';
  dialogueEntry.appendChild(textDiv);
  
  // Use typewriter system like main dialogues
  typeWriterWithLinks(textDiv, actualContent.text, 0, currentStoryPoint, () => {
    // Add back button after text completes
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
    
    // Resize dialogue to fit content after text completes
    setTimeout(() => resizeDialogueToContent(), 100);
  });
  
  dialogueTextContainer.appendChild(dialogueEntry);
  
  // Show dialogue panel
  dialoguePanel.classList.add('visible');
  
  // Initial resize to fit content
  setTimeout(() => resizeDialogueToContent(), 300);
  
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
  
  // Check if mobile paragraph mode should be used
  if (initMobileParagraphMode(currentStoryPoint)) {
    // Use mobile paragraph system
    // Speaker content handled via subtitle class
    
    dialoguePanel.classList.add("visible");
    showMobileParagraph();
    console.log('Transport sub-content displayed (mobile mode):', transportSubPoint.title);
    return;
  }

  // Desktop mode continues with existing system
  // No longer using locationSubtitle element
  
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
  dialogueEntry.appendChild(textDiv);
  
  // Use typewriter system like main dialogues
  typeWriterWithLinks(textDiv, actualContent.text, 0, currentStoryPoint, () => {
    // Add back button after text completes
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
  });
  
  dialogueTextContainer.appendChild(dialogueEntry);
  dialoguePanel.classList.add('visible');
  
  console.log('Transport sub-content displayed:', transportSubPoint.title);
}

// Update panorama circle positions to move WITH the panorama rotation
// Update circle positions for 2D panoramic view (like street view)
function updateFlatPanoramaCircles(transformX) {
  if (!panoramaPoints || panoramaPoints.length === 0) {
    return;
  }
  
  // Calculate movement as percentage of screen width
  const movementPercent = (transformX / window.innerWidth) * 100;
  
  panoramaPoints.forEach(pointData => {
    const circleElement = pointData.element;
    if (!circleElement) return;
    
    // Skip the back-to-street button - it should stay fixed on screen
    if (circleElement.classList.contains('back-to-street')) return;
    
    // Initialize position if not set (like street view circles)
    if (!pointData.baseX) {
      // Set base position based on longitude/latitude (spread across panorama)
      pointData.baseX = 50 + (pointData.longitude || 0) / 4; // Spread horizontally
      pointData.baseY = 50 + (pointData.latitude || 0) / 2;  // Spread vertically
    }
    
    // Move circle opposite to panorama movement (like street view)
    const currentX = pointData.baseX - movementPercent;
    const currentY = pointData.baseY;
    
    // Show circle if it's in visible range
    if (currentX >= -20 && currentX <= 120) {
      circleElement.style.display = 'block';
      circleElement.style.left = `${currentX}%`;
      circleElement.style.top = `${currentY}%`;
      circleElement.style.transform = 'translate(-50%, -50%)';
      circleElement.style.position = 'absolute';
      circleElement.style.zIndex = '999';
      circleElement.style.pointerEvents = 'auto';
    } else {
      circleElement.style.display = 'none';
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
  
  // Check if mobile paragraph mode should be used
  if (initMobileParagraphMode(currentStoryPoint)) {
    // Use mobile paragraph system
    // Speaker content handled via subtitle class
    
    dialoguePanel.classList.add("visible");
    showMobileParagraph();
    console.log('Energy sub-content displayed (mobile mode):', energySubPoint.title);
    return;
  }

  // Desktop mode continues with existing system
  // No longer using locationSubtitle element
  
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
  
  // Add text content with typewriter effect
  const textElement = document.createElement('div');
  textElement.className = 'section-text';
  dialogueEntry.appendChild(textElement);
  
  // Use typewriter system like main dialogues
  typeWriterWithLinks(textElement, actualContent.text, 0, currentStoryPoint, () => {
    // Add back to main option after text completes
    const backElement = document.createElement('div');
    backElement.className = 'section-text';
    backElement.style.marginTop = '20px';
    backElement.innerHTML = '[Back to Energy overview](close)';
    dialogueEntry.appendChild(backElement);
  });
  
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
  
  // Check if mobile paragraph mode should be used
  if (initMobileParagraphMode(currentStoryPoint)) {
    // Use mobile paragraph system
    // Speaker content handled via subtitle class
    
    dialoguePanel.classList.add("visible");
    showMobileParagraph();
    console.log('Education sub-content displayed (mobile mode):', educationSubPoint.title);
    return;
  }

  // Desktop mode continues with existing system
  // No longer using locationSubtitle element
  
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
  
  // Add text content with typewriter effect
  const textElement = document.createElement('div');
  textElement.className = 'section-text';
  dialogueEntry.appendChild(textElement);
  
  // Use typewriter system like main dialogues
  typeWriterWithLinks(textElement, actualContent.text, 0, currentStoryPoint, () => {
    // Add back to main option after text completes
    const backElement = document.createElement('div');
    backElement.className = 'section-text';
    backElement.style.marginTop = '20px';
    backElement.innerHTML = '[Back to Education overview](close)';
    dialogueEntry.appendChild(backElement);
  });
  
  dialogueTextContainer.appendChild(dialogueEntry);
  
  // Show dialogue panel
  dialoguePanel.classList.add('visible');
  
  console.log('Showing education sub-content:', educationSubPoint.title);
}


// Return to street view from scene
function returnToStreetView() {
  console.log('Returning to street view from scene...');
  
  // Exit scene mode first
  exitSceneMode();
  
  // Hide back to street button immediately
  hideBackToStreetButton();
  
  // Start zoom-out transition effect
  const backgroundContainer = document.getElementById('backgroundContainer');
  const interactivePoints = document.getElementById('interactivePoints');
  
  // Phase 1: Start zoom-out and fade scene circles
  const sceneCircles = document.querySelectorAll('.scene-circle');
  sceneCircles.forEach(circle => {
    circle.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    circle.style.opacity = '0';
    circle.style.transform = 'scale(0.5)';  // Shrink as they fade
  });
  
  // Phase 2: Apply smoother reverse zoom effect with cross-fade preparation
  setTimeout(() => {
    backgroundContainer.style.transition = 'transform 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 1.2s ease';
    interactivePoints.style.transition = 'transform 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    
    // Apply smoother zoom-out effect
    const zoomOutScale = 0.85;
    backgroundContainer.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) scale(${zoomOutScale})`;
    interactivePoints.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) scale(${zoomOutScale})`;
    
    // Start fading out current background for cross-fade
    const backgroundImage = backgroundContainer.querySelector('.background-image');
    if (backgroundImage) {
      backgroundImage.style.transition = 'opacity 0.6s ease';
      backgroundImage.style.opacity = '0.3';
    }
  }, 150);
  
  // Phase 3: Reset zoom and start background cross-fade
  setTimeout(() => {
    // Smoothly reset transforms
    backgroundContainer.style.transition = 'transform 1.0s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    interactivePoints.style.transition = 'transform 1.0s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    backgroundContainer.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    interactivePoints.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    
    // Remove scene circles from DOM
    sceneCircles.forEach(circle => circle.remove());
    
    // Restore street view circles with smoother fade in
    const streetCircles = document.querySelectorAll('.point:not(.scene-circle)');
    streetCircles.forEach(circle => {
      circle.style.display = 'block';
      circle.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
      circle.style.transform = 'scale(0.7)';  // Start smaller
      circle.style.opacity = '0';
      
      // Stagger the animation for smoother appearance
      setTimeout(() => {
        circle.style.opacity = '1';
        circle.style.transform = 'scale(1)';
      }, Math.random() * 200 + 50); // Random delay between 50-250ms
    });
  }, 600);
  
  // Phase 4: Complete cross-fade to street view background
  setTimeout(() => {
    // Restore original street view background with cross-fade
    const backgroundContainer = document.getElementById('backgroundContainer');
    const backgroundImage = backgroundContainer.querySelector('.background-image');
    
    if (backgroundImage) {
      // Check current day/night mode
      const isNightMode = document.body.classList.contains('high-contrast');
      
      // Set the default street view image with scrollable sizing
      const defaultImagePath = isNightMode ? 'assets/images/Full-Night.jpg' : 'assets/images/Full-Day.jpg';
      
      // Apply the default street background with cross-fade using overlay technique
      const fadeOverlay = document.createElement('div');
      fadeOverlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-image: url(${defaultImagePath});
        background-size: auto 100%;
        background-position: center center;
        background-repeat: no-repeat;
        opacity: 0;
        z-index: 3;
        transition: opacity 0.8s ease-in-out;
        pointer-events: none;
      `;
      
      backgroundContainer.appendChild(fadeOverlay);
      
      // Trigger fade-in after a short delay
      setTimeout(() => {
        fadeOverlay.style.opacity = '1';
      }, 50);
      
      // After fade completes, apply to main background and remove overlay
      setTimeout(() => {
        backgroundImage.style.backgroundImage = `url(${defaultImagePath})`;
        backgroundImage.style.backgroundSize = 'auto 100%';
        backgroundImage.style.backgroundPosition = 'center center';
        backgroundImage.style.backgroundRepeat = 'no-repeat';
        
        // Remove the fade overlay
        fadeOverlay.remove();
        
        console.log('Cross-fade to street view completed');
      }, 850);
      
      // Keep scene-active class to hide pseudo-elements but use our custom street background
      backgroundImage.classList.add('scene-active');
      backgroundImage.style.setProperty('--scene-active', '1');
      
      console.log('Cross-faded to street view background:', defaultImagePath);
    }
    
    // Hide any open dialogue
    if (dialoguePanel.classList.contains('visible')) {
      hideDialogue();
    }
    
    // Remove any dimming overlay that might be stuck active and reset background brightness
    const dimmingOverlay = document.getElementById('dimmingOverlay');
    if (dimmingOverlay) {
      dimmingOverlay.classList.remove('active');
      dimmingOverlay.style.mask = '';
      dimmingOverlay.style.webkitMask = '';
      dimmingOverlay.style.opacity = '0';
      console.log('Removed dimming overlay when returning to street view');
    }
    
    // Reset background image brightness and filters to normal
    if (backgroundImage) {
      backgroundImage.style.filter = '';
      backgroundImage.style.opacity = '1';
      backgroundImage.style.brightness = '';
      console.log('Reset background image brightness to normal');
    }
    
    // Clear current story point and scene flag
    if (currentStoryPoint) {
      currentStoryPoint._hasSceneImage = false;
    }
    currentStoryPoint = null;
    
    console.log('Returned to street view with zoom-out transition');
  }, 700);
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
  
  backgroundMusic = new Audio("assets/sound/london_soundscape.mp3");
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

// Convert text to proper title case (only first letter and after certain punctuation)
function toTitleCase(str) {
  return str.toLowerCase().replace(/^.|[.!?]\s+./g, function(match) {
    return match.toUpperCase();
  });
}

// Note: Panorama click handling now done via HTML overlay elements directly

// Initialize intro overlay - simple single box for both mobile and desktop (GLOBAL SCOPE)
function initializeIntroOverlay() {
  console.log('🎬 Initializing intro overlay');
  
  // Simply show the overlay - CSS handles mobile/desktop positioning
  introOverlay.classList.add("visible");
  
  console.log('✅ Intro overlay is now visible:', introOverlay.classList.contains('visible'));
  console.log('✅ Help overlay is hidden:', helpOverlay.classList.contains('hidden'));
}

window.addEventListener("load", () => {
  // Initialize cached DOM elements for performance
  initCachedElements();
  
  // Ensure container starts in proper state (not dragging)
  isDragging = false;
  container.classList.remove("dragging");
  
  // Cache image dimensions for proper drag limits
  cacheImageDimensions();
  
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
  
  // Show intro overlay with slide-in animation
  setTimeout(() => {
    initializeIntroOverlay();
  }, 100); // Small delay to ensure DOM is ready
  
  initialize();
});
