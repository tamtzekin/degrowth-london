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

// Music variables
let backgroundMusic = null;
let isMusicMuted = false; // Start unmuted but paused until user interaction
let musicReady = false;
let userHasInteracted = false;

// DOM elements
const container = document.getElementById("container");
const backgroundContainer = document.getElementById("backgroundContainer");
const interactivePoints = document.getElementById("interactivePoints");
const dialoguePanel = document.getElementById("dialoguePanel");
const locationTitle = document.getElementById("locationTitle");
const locationSubtitle = document.getElementById("locationSubtitle");
const dialogueTextContainer = document.getElementById("dialogueTextContainer");
// Removed dialogueOptions reference
const helpOverlay = document.getElementById("helpOverlay");
const helpClose = document.getElementById("helpClose");

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
    createMusicToggleButton();
    setupUserInteractionDetection();
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
      showDialogue(point, pointElement),
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
  container.addEventListener("touchstart", startDragTouch);
  container.addEventListener("touchmove", dragTouch);
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
      handleUserInteractionForMusic();
      // Show welcome message after help closes
      setTimeout(() => showWelcomeMessage(), 500);
    }
  });

  helpClose.addEventListener("click", () => {
    helpOverlay.classList.add("hidden");
    // Start music when user interacts (closes help overlay)
    handleUserInteractionForMusic();
    // Show welcome message after help closes
    setTimeout(() => showWelcomeMessage(), 500);
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
    isHighContrast = !isHighContrast;
    document.body.classList.toggle("high-contrast", isHighContrast);

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
                    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
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
  currentX = touch.clientX - startX;
  currentY = touch.clientY - startY;
  updateBackgroundPosition();
}

function endDrag() {
  isDragging = false;
  container.classList.remove("dragging");
}

function updateBackgroundPosition() {
  const maxX = window.innerWidth * 0.1;
  const maxY = window.innerHeight * 0.1;
  currentX = Math.max(-maxX, Math.min(maxX, currentX));
  currentY = Math.max(-maxY, Math.min(maxY, currentY));
  backgroundContainer.style.transform = `translate(${currentX}px, ${currentY}px)`;

  // Move points with the background using the same transform
  interactivePoints.style.transform = `translate(${currentX}px, ${currentY}px)`;
}

function updatePointPositions() {
  // Points now move with background via CSS transform, no individual positioning needed
}

function showDialogue(point, pointElement) {
  currentStoryPoint = point;
  locationTitle.textContent = point.title;

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

  // Show main text
  showMainText(point);
}

function centerPointOnScreen(pointElement) {
  const rect = pointElement.getBoundingClientRect();
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;

  // Calculate the exact center of the circle
  const circleCenterX = rect.left + rect.width / 2;
  const circleCenterY = rect.top + rect.height / 2;

  // Calculate how much we need to move to center it
  const offsetX = centerX - circleCenterX;
  const offsetY = centerY - circleCenterY;

  // Apply the offset to our current position
  currentX += offsetX;
  currentY += offsetY;

  // Clamp to prevent going too far out of bounds
  const maxX = window.innerWidth * 0.1;
  const maxY = window.innerHeight * 0.1;
  currentX = Math.max(-maxX, Math.min(maxX, currentX));
  currentY = Math.max(-maxY, Math.min(maxY, currentY));

  // Add smooth transition for camera movement
  backgroundContainer.style.transition = "transform 0.8s ease-out";
  interactivePoints.style.transition = "transform 0.8s ease-out";

  updateBackgroundPosition();

  // Remove transition after animation completes
  setTimeout(() => {
    backgroundContainer.style.transition = "transform 0.3s ease-out";
    interactivePoints.style.transition = "";
  }, 800);
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
  const option = point.options.find((opt) => opt.key === optionKey);
  if (!option || !option.content) return;

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
      linkSpan.addEventListener("click", () => hideDialogue());
    } else {
      // Target is now a key, not a section number
      linkSpan.addEventListener("click", () => {
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
        linkSpan.addEventListener("click", () => hideDialogue());
      } else {
        // Target is now a key, not a section number
        linkSpan.addEventListener("click", () => {
          showSection(point, part.target);
        });
      }

      element.appendChild(linkSpan);
    }
  });
}

function hideDialogue() {
  dialoguePanel.classList.remove("visible");
  pointElements.forEach((el) => el.classList.remove("selected"));

  // Reset all typing and skip state variables
  isTyping = false;
  skipToNextSentence = false;
  hasUsedSkip = false;
  dialogueTextContainer.classList.remove("typing");

  if (currentTypingTimeout) {
    clearTimeout(currentTypingTimeout);
    currentTypingTimeout = null;
  }
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

// Start music after user interaction (clicking "Got it")
function startMusicAfterUserInteraction() {
  if (backgroundMusic && !isMusicMuted) {
    backgroundMusic.play().catch((e) => {
      console.warn("Could not start background music:", e);
      // If autoplay still fails, we'll let the user manually start it with the toggle
    });
  }
}

// Music initialization and control functions
function initializeMusic() {
  backgroundMusic = new Audio("assets/sound/06-julian.mp3");
  backgroundMusic.loop = true;
  backgroundMusic.volume = 0.3; // Set to a comfortable level

  // Handle audio loading errors gracefully
  backgroundMusic.addEventListener("error", function (e) {
    console.warn("Background music failed to load:", e);
  });

  // Mark music as ready when loaded - don't autoplay, wait for user interaction
  backgroundMusic.addEventListener("canplaythrough", function () {
    musicReady = true;
    console.log("Background music loaded and ready to play");
  });
}

function createMusicToggleButton() {
  const musicToggle = document.createElement("div");
  musicToggle.className = "music-toggle";
  musicToggle.id = "musicToggle";

  // Simple quaver note icons for muted and unmuted states
  const mutedIcon = `
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
      <path d="M9 18V5l12-2v13"/>
      <circle cx="6" cy="18" r="3"/>
      <circle cx="18" cy="16" r="3"/>
      <path d="M15 9l6-6M21 9l-6-6" stroke="currentColor" stroke-width="2"/>
    </svg>
  `;

  const unmutedIcon = `
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
      <path d="M9 18V5l12-2v13"/>
      <circle cx="6" cy="18" r="3"/>
      <circle cx="18" cy="16" r="3"/>
    </svg>
  `;

  // Set initial icon (unmuted since we start playing)
  musicToggle.innerHTML = unmutedIcon;
  musicToggle.classList.add("playing");

  // Add click event listener
  musicToggle.addEventListener("click", toggleMusic);

  // Add to container
  container.appendChild(musicToggle);
}

function toggleMusic() {
  const musicToggle = document.getElementById("musicToggle");

  if (isMusicMuted) {
    // Unmute and play
    if (backgroundMusic) {
      backgroundMusic.play().catch((e) => {
        console.warn("Could not play background music:", e);
      });
    }
    isMusicMuted = false;

    // Update icon to unmuted
    musicToggle.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
        <path d="M9 18V5l12-2v13"/>
        <circle cx="6" cy="18" r="3"/>
        <circle cx="18" cy="16" r="3"/>
      </svg>
    `;
    musicToggle.classList.add("playing");
  } else {
    // Mute and pause
    if (backgroundMusic) {
      backgroundMusic.pause();
    }
    isMusicMuted = true;

    // Update icon to muted
    musicToggle.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
        <path d="M9 18V5l12-2v13"/>
        <circle cx="6" cy="18" r="3"/>
        <circle cx="18" cy="16" r="3"/>
        <path d="M15 9l6-6M21 9l-6-6" stroke="currentColor" stroke-width="2"/>
      </svg>
    `;
    musicToggle.classList.remove("playing");
  }
}

// Setup user interaction detection for autoplay
function setupUserInteractionDetection() {
  function handleFirstInteraction() {
    userHasInteracted = true;

    // Try to start music if it's ready and not muted
    if (musicReady && !isMusicMuted && backgroundMusic) {
      backgroundMusic.play().catch((e) => {
        console.log("Music will start when toggle is clicked");
      });
    }

    // Remove listeners after first interaction
    document.removeEventListener("click", handleFirstInteraction);
    document.removeEventListener("keydown", handleFirstInteraction);
    document.removeEventListener("touchstart", handleFirstInteraction);
  }

  // Listen for any user interaction
  document.addEventListener("click", handleFirstInteraction);
  document.addEventListener("keydown", handleFirstInteraction);
  document.addEventListener("touchstart", handleFirstInteraction);
}

// Function to handle user interaction and start music
function handleUserInteractionForMusic() {
  userHasInteracted = true;

  if (backgroundMusic && !isMusicMuted && musicReady) {
    backgroundMusic
      .play()
      .then(() => {
        console.log("Background music started successfully!");
      })
      .catch((e) => {
        console.warn(
          "Could not start background music after user interaction:",
          e,
        );
      });
  }
}

window.addEventListener("load", initialize);
