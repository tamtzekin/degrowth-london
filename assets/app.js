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
let panoramaScene, panoramaCamera, panoramaRenderer, panoramaSphere, panoramaSun, panoramaAmbientLight;
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
    pointElement.addEventListener("click", () =>
      handleCircleClick(point, pointElement, index),
    );
    interactivePoints.appendChild(pointElement);
    pointElements.push(pointElement);
  });
}

function setupEventListeners() {
  container.addEventListener("mousedown", startDrag);
  container.addEventListener("mousemove", drag);
  container.addEventListener("mouseup", endDrag);
  container.addEventListener("mouseleave", endDrag);
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

    // Animate sun in 360° view if currently in panorama mode
    if (!isMapView) {
      animateSunPosition(isHighContrast);
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
}

function updatePointPositions() {
  // Points now move with background via CSS transform, no individual positioning needed
}

// Handle circle click - zoom and switch to 360° view only for Energy, otherwise show dialogue normally
function handleCircleClick(point, pointElement, index) {
  console.log('Circle clicked:', point.title);
  
  // Check if this point has a 360° image (only Energy for now)
  const has360Image = point.title === "Energy";
  
  if (!has360Image) {
    // No 360° image - just show dialogue in street view
    console.log('No 360° image for', point.title, '- showing dialogue in street view');
    showDialogue(point, pointElement);
    return;
  }
  
  console.log('Has 360° image - starting zoom effect');
  
  // Get the circle's position for zoom target
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
    panoramaContainer.style.transition = 'opacity 1.2s ease-in-out';
    backgroundContainer.style.transition = 'transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 1.2s ease-in-out';
    interactivePoints.style.transition = 'opacity 1.2s ease-in-out';
  }, 200); // Start prep earlier for slower zoom
  
  // Begin gradual cross-fade early in the zoom
  setTimeout(() => {
    // Start very gradual fade: panorama begins to appear, map begins to disappear
    panoramaContainer.style.opacity = '0.3';
    backgroundContainer.style.opacity = '0.7';
    interactivePoints.style.opacity = '0.7';
  }, 300); // Start fade early
  
  // Continue the cross-fade
  setTimeout(() => {
    // Mid-fade: both scenes equally visible
    panoramaContainer.style.opacity = '0.6';
    backgroundContainer.style.opacity = '0.4';
    interactivePoints.style.opacity = '0.4';
  }, 500);
  
  // Near completion of zoom
  setTimeout(() => {
    // Almost complete fade: panorama dominant, map nearly gone
    panoramaContainer.style.opacity = '0.9';
    backgroundContainer.style.opacity = '0.1';
    interactivePoints.style.opacity = '0.1';
  }, 700);
  
  // Complete the cross-fade after zoom finishes
  setTimeout(() => {
    // Final fade: panorama fully visible, map completely gone
    panoramaContainer.style.opacity = '1';
    backgroundContainer.style.opacity = '0';
    interactivePoints.style.opacity = '0';
  }, 800); // Complete at end of zoom
  
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
    
    // Show dialogue after cross-fade completes
    setTimeout(() => {
      showDialogue(point, pointElement);
    }, 100);
    
  }, 1200); // Wait for cross-fade to complete (800ms zoom + 400ms extra fade)
}

function showDialogue(point, pointElement) {
  currentStoryPoint = point;
  locationTitle.textContent = point.title;

  // Mark this point as visited
  visitedContent.add(point.title);
  
  // Remove pulse animation from this point since it's been visited
  pointElement.classList.add('visited');

  // Reset navigation history when opening new dialogue
  navigationHistory = [];

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
}

function addToHistory(point, optionKey) {
  navigationHistory.push({ point, optionKey });
}

function addBackButton(textContainer, point, currentKey) {
  if (navigationHistory.length === 0 && currentKey !== "main") {
    // If no history but not on main, can go back to main
    const backButton = createBackButton(() => showMainText(point));
    textContainer.appendChild(backButton);
  } else if (navigationHistory.length > 0) {
    // Can go back to previous section
    const backButton = createBackButton(() => goBack());
    textContainer.appendChild(backButton);
  }
}

function createBackButton(clickHandler) {
  const backButton = document.createElement("span");
  backButton.className = "back-button";
  backButton.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="cursor: pointer; opacity: 0.7;">
      <path d="M8 1l-1.5 1.5L11 7H1v2h10l-4.5 4.5L8 15l7-7z" transform="rotate(180 8 8)"/>
    </svg>
  `;
  backButton.style.cursor = "pointer";
  backButton.addEventListener("click", clickHandler);
  return backButton;
}

function goBack() {
  if (navigationHistory.length === 0) return;

  // Remove current state from history
  navigationHistory.pop();

  if (navigationHistory.length === 0) {
    // Go back to main text
    showMainText(currentStoryPoint);
  } else {
    // Go back to previous section
    const previousState = navigationHistory[navigationHistory.length - 1];
    navigationHistory.pop(); // Remove it so showSection doesn't add it again
    showSection(previousState.point, previousState.optionKey);
  }
}

function parseTextWithLinks(text, point) {
  // Parse text for inline links using syntax: [link text](key) or [link text](close)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = linkRegex.exec(text)) !== null) {
    // Add text before the link
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        content: text.substring(lastIndex, match.index),
      });
    }

    // Add the link
    const linkText = match[1];
    const linkTarget = match[2];

    parts.push({
      type: "link",
      content: linkText,
      target: linkTarget,
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last link
  if (lastIndex < text.length) {
    parts.push({
      type: "text",
      content: text.substring(lastIndex),
    });
  }

  // If no links found, treat as plain text
  if (parts.length === 0) {
    parts.push({
      type: "text",
      content: text,
    });
  }

  return parts;
}

function typeWriterWithLinks(element, text, charIndex, point, onComplete) {
  const textParts = parseTextWithLinks(text, point);

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
    }
  });
}

function hideDialogue() {
  dialoguePanel.classList.remove("visible");
  
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
  
  // Use base circle size (100px) instead of current transformed size
  const baseCircleSize = 100;
  const baseRadius = baseCircleSize / 2;
  
  // Calculate the center of the circle using visual center
  const circleCenterX = pointRect.left + pointRect.width / 2;
  const circleCenterY = pointRect.top + pointRect.height / 2;
  
  // Calculate the connection point on the dialogue panel (left edge center)
  const panelX = dialogueRect.left;
  const panelY = dialogueRect.top + dialogueRect.height / 2;
  
  // Calculate angle from circle center to panel
  const deltaX = panelX - circleCenterX;
  const deltaY = panelY - circleCenterY;
  const angle = Math.atan2(deltaY, deltaX);
  
  // Calculate the point on the circle rim using base radius
  // This ensures consistency regardless of transform scale
  const circleX = circleCenterX + Math.cos(angle) * baseRadius;
  const circleY = circleCenterY + Math.sin(angle) * baseRadius;
  
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

    // Only skip if we're typing and not clicking on interactive text
    if (isTyping && !e.target.classList.contains("interactive-text")) {
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
      parseTextWithLinks(welcomeText, fakePoint),
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
      'assets/360.jpg',
      function (texture) {
        console.log('360.jpg loaded successfully');
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
        console.error('Error loading 360.jpg:', error);
      }
    );
    
    // Create material that responds to lighting
    const material = new THREE.MeshLambertMaterial({ 
      color: 0x0066cc, // Blue color as temporary placeholder
      side: THREE.BackSide // Inside-out sphere
    });
    
    // Create sphere mesh
    panoramaSphere = new THREE.Mesh(geometry, material);
    panoramaScene.add(panoramaSphere);
    
    // Create sun for sunset effect
    const sunGeometry = new THREE.SphereGeometry(20, 32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xffd700, // Golden yellow
      emissive: 0xffa500, // Orange glow
      transparent: true,
      opacity: 0.8
    });
    panoramaSun = new THREE.Mesh(sunGeometry, sunMaterial);
    // Position sun based on current contrast mode
    const isCurrentlyDarkMode = document.body.classList.contains('high-contrast');
    const initialSunY = isCurrentlyDarkMode ? -100 : 150;
    const initialSunOpacity = isCurrentlyDarkMode ? 0.3 : 0.8;
    panoramaSun.position.set(-200, initialSunY, -300);
    panoramaSun.material.opacity = initialSunOpacity;
    panoramaScene.add(panoramaSun);
    
    // Add ambient lighting that changes with sun position
    const initialLightIntensity = document.body.classList.contains('high-contrast') ? 0.8 : 1.2;
    panoramaAmbientLight = new THREE.AmbientLight(0xffffff, initialLightIntensity);
    panoramaScene.add(panoramaAmbientLight);
    
    // Set initial camera position
    panoramaCamera.position.set(0, 0, 0.1);
    panoramaCamera.lookAt(0, 0, -1);
    
    // Handle window resize
    window.addEventListener('resize', onPanoramaWindowResize, false);
    
    // Setup panorama controls
    setupPanoramaControls();
    
    // Create 3D story points
    createPanoramaStoryPoints();
    
    // Initialize raycaster for click detection
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    
    console.log('Panorama initialized successfully');
  } catch (error) {
    console.error('Error initializing panorama:', error);
  }
}

// Animate sun setting/rising for dark mode transition
function animateSunPosition(isDarkMode) {
  if (!panoramaSun || !panoramaAmbientLight) return;
  
  const startY = isDarkMode ? 150 : -100; // Starting position
  const endY = isDarkMode ? -100 : 150;   // Ending position
  const startOpacity = isDarkMode ? 0.8 : 0.3;
  const endOpacity = isDarkMode ? 0.3 : 0.8;
  const startLightIntensity = isDarkMode ? 1.2 : 0.8; // Bright day to dim night
  const endLightIntensity = isDarkMode ? 0.8 : 1.2;   // Dim night to bright day
  
  const duration = 2000; // 2 seconds
  const startTime = Date.now();
  
  function animateFrame() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Use easing function for smooth animation
    const easeProgress = 1 - Math.pow(1 - progress, 3); // Cubic ease-out
    
    // Interpolate position, opacity, and lighting
    const currentY = startY + (endY - startY) * easeProgress;
    const currentOpacity = startOpacity + (endOpacity - startOpacity) * easeProgress;
    const currentLightIntensity = startLightIntensity + (endLightIntensity - startLightIntensity) * easeProgress;
    
    panoramaSun.position.y = currentY;
    panoramaSun.material.opacity = currentOpacity;
    panoramaAmbientLight.intensity = currentLightIntensity;
    
    // Continue animation if not finished
    if (progress < 1) {
      requestAnimationFrame(animateFrame);
    }
  }
  
  animateFrame();
}

// Load different 360° image for each location
function loadPanoramaImage(point) {
  if (!panoramaSphere || !panoramaSphere.material) return;
  
  // Only Energy has a 360° image for now
  const imagePath = 'assets/360-energy.jpg'; // Only Energy has a 360° image
  
  console.log(`Loading 360° image for ${point.title}: ${imagePath}`);
  
  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(
    imagePath,
    function (texture) {
      console.log('360° image loaded successfully for:', point.title);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.flipY = false;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      
      // Update the sphere material with the new texture
      panoramaSphere.material.map = texture;
      panoramaSphere.material.color.setHex(0xffffff); // Ensure no color tint
      panoramaSphere.material.needsUpdate = true;
      
      // Re-render the scene
      if (panoramaRenderer && panoramaScene && panoramaCamera) {
        panoramaRenderer.render(panoramaScene, panoramaCamera);
      }
    },
    function (progress) {
      console.log('Loading progress for', point.title, ':', progress);
    },
    function (error) {
      console.error('Error loading 360° image for', point.title, ':', error);
    }
  );
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
  panoramaOverlay.innerHTML = '';
  panoramaPoints = [];
  
  // For Energy 360° view, create 3 specific clickable points based on Energy story options
  const energyPoint = storyPoints.find(point => point.title === "Energy");
  if (!energyPoint) return;
  
  // Define 3 specific locations on the 360° image with their story content
  const energyPoints = [
    {
      title: "Energy Cooperatives",
      key: "cooperatives",
      x: 25, // Left side - solar panels area
      y: 35,
      longitude: -120, // Map to specific view angles
      latitude: 10,
      content: energyPoint.options.find(opt => opt.key === "cooperatives")
    },
    {
      title: "Fair Distribution", 
      key: "distribution",
      x: 75, // Right side - residential buildings
      y: 45,
      longitude: 60,
      latitude: 5,
      content: energyPoint.options.find(opt => opt.key === "distribution")
    },
    {
      title: "Community Response",
      key: "community_response", 
      x: 50, // Center - community space
      y: 60,
      longitude: 0,
      latitude: -20,
      content: energyPoint.options.find(opt => opt.key === "community_response")
    }
  ];
  
  // Create HTML overlay points for each energy-specific point
  energyPoints.forEach((energySubPoint, index) => {
    // Create HTML element for the point
    const pointElement = document.createElement('div');
    pointElement.className = 'panorama-point energy-point';
    pointElement.dataset.index = index;
    pointElement.dataset.key = energySubPoint.key;
    
    // Store 3D coordinates for panorama positioning
    pointElement.dataset.longitude = energySubPoint.longitude;
    pointElement.dataset.latitude = energySubPoint.latitude;
    
    // Initial position will be updated by panorama positioning
    pointElement.style.left = `${energySubPoint.x}%`;
    pointElement.style.top = `${energySubPoint.y}%`;
    
    // Add click handler
    pointElement.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Energy panorama point clicked:', energySubPoint.title);
      
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
      
      // Show dialogue with the energy sub-content
      showEnergySubContent(energySubPoint);
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
  
  // Add a special "back to street view" point in the center
  const backToStreetPoint = document.createElement('div');
  backToStreetPoint.className = 'panorama-point back-to-street';
  backToStreetPoint.style.left = '50%';
  backToStreetPoint.style.top = '20%'; // Position it in upper middle area
  
  // Add EXIT icon
  backToStreetPoint.innerHTML = `
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" style="width: 24px; height: 24px;">
      <path d="M18 6L6 18M6 6l12 12"/>
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
