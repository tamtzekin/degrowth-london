// Main application variables
let storyPoints = [];
let isDragging = false;
let startX = 0;
let startY = 0;
let currentX = 0;
let currentY = 0;
let currentStoryPoint = null;
let pointElements = [];
let textSpeed = 50; // milliseconds between letters (default to medium)

// DOM elements
const container = document.getElementById("container");
const backgroundContainer = document.getElementById("backgroundContainer");
const interactivePoints = document.getElementById("interactivePoints");
const dialoguePanel = document.getElementById("dialoguePanel");
const locationTitle = document.getElementById("locationTitle");
const locationSubtitle = document.getElementById("locationSubtitle");
const dialogueTextContainer = document.getElementById("dialogueTextContainer");
const dialogueOptions = document.getElementById("dialogueOptions");
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
      // Show welcome message after help closes
      setTimeout(() => showWelcomeMessage(), 500);
    }
  });

  helpClose.addEventListener("click", () => {
    helpOverlay.classList.add("hidden");
    // Show welcome message after help closes
    setTimeout(() => showWelcomeMessage(), 500);
  });
  container.addEventListener("contextmenu", (e) => e.preventDefault());

  // Update connection lines on window resize
  window.addEventListener("resize", () => {
    updatePointPositions();
  });

  // Number key support for dialogue options
  document.addEventListener("keydown", (e) => {
    if (dialoguePanel.classList.contains("visible")) {
      const num = parseInt(e.key);
      if (num >= 1 && num <= 9) {
        const options = document.querySelectorAll(".dialogue-option");
        if (options[num - 1]) {
          options[num - 1].click();
        }
      }
    }
  });

  // Text speed toggle
  const textSpeedToggle = document.getElementById("textSpeedToggle");
  const textSpeeds = ["FAST", "RELAXED", "ZEN"];
  const speedValues = { FAST: 0, RELAXED: 15, ZEN: 40 };
  let currentSpeedIndex = 1; // Start with "Relaxed"
  let currentSectionIndex = 0; // Track current section

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
      showSection(currentStoryPoint, currentSectionIndex);
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

  // Update selected state
  pointElements.forEach((el) => el.classList.remove("selected"));
  pointElement.classList.add("selected");

  // Show first section
  currentSectionIndex = 0;
  showSection(point, 0);
}

function showSection(point, sectionIndex) {
  currentSectionIndex = sectionIndex; // Track current section
  const section = point.sections[sectionIndex];

  // Clear container and any existing timeouts
  dialogueTextContainer.innerHTML = "";

  // Create dialogue entry
  const dialogueEntry = document.createElement("div");
  dialogueEntry.className = "dialogue-entry";

  const speaker = document.createElement("div");
  speaker.className = "dialogue-speaker";
  speaker.textContent = section.speaker;
  dialogueEntry.appendChild(speaker);

  // Create text container for letter-by-letter animation
  const text = document.createElement("div");
  text.className = "section-text";
  dialogueEntry.appendChild(text);

  // Add container first
  dialogueTextContainer.appendChild(dialogueEntry);

  // Animate text typing letter by letter
  typeWriter(text, section.text, 0);

  // Update options - filter out the selected option and show immediately
  dialogueOptions.innerHTML = "";
  point.options.forEach((option, index) => {
    // Skip the option that was just selected (except close option)
    if (option.section === sectionIndex && option.action !== "close") {
      return;
    }

    const optionButton = document.createElement("button");
    optionButton.className = "dialogue-option";

    // Renumber the remaining options
    const remainingOptions = point.options.filter(
      (opt, idx) => opt.action === "close" || opt.section !== sectionIndex,
    );
    const newIndex = remainingOptions.indexOf(option) + 1;

    optionButton.innerHTML = `<span class="option-number">${newIndex}.</span>${option.text}`;

    if (option.action === "close") {
      optionButton.addEventListener("click", () => hideDialogue());
    } else if (option.section !== undefined) {
      optionButton.addEventListener("click", () => {
        currentSectionIndex = option.section;
        showSection(point, option.section);
      });
    }

    dialogueOptions.appendChild(optionButton);
  });

  dialoguePanel.classList.add("visible");
  dialogueTextContainer.scrollTop = 0;
}

function typeWriter(element, text, index) {
  if (textSpeed === 0) {
    // FAST mode: show all text instantly
    element.textContent = text;
    return;
  }

  if (index < text.length) {
    element.textContent += text.charAt(index);
    setTimeout(() => typeWriter(element, text, index + 1), textSpeed);
  }
}

function hideDialogue() {
  dialoguePanel.classList.remove("visible");
  pointElements.forEach((el) => el.classList.remove("selected"));
}

function showWelcomeMessage() {
  currentStoryPoint = null; // Ensure intro popup can be auto-closed
  setTimeout(() => dialoguePanel.classList.add("visible"), 300);
}

window.addEventListener("load", initialize);
