# Degrowth London - Interactive Vision

An interactive exploration of a reimagined London transformed by degrowth principles, where community, sustainability, and wellbeing take priority over endless growth.

## Project Structure

The project has been organized into a clean, modular structure for easy editing and maintenance:

```
degrowth-london/
├── london.html              # Main HTML file
├── market-street.jpg         # Background image
├── LICENSE                   # Project license
├── README.md                # This file
├── package.json             # npm configuration and dependencies
├── server.js                # Custom development server
├── setup.sh                 # Setup script for Unix/Linux/macOS
├── start.bat                # Launch script for Windows
├── .gitignore               # Git ignore rules
└── assets/
    ├── styles.css           # All CSS styles
    ├── app.js               # Main JavaScript application logic
    ├── story-data.json      # Story content and dialogue data
    └── fonts/               # Custom fonts
        ├── QuestaSans-Light.woff2
        └── QuestaSans-Light.woff
```

## File Descriptions

### `london.html`
The main HTML file containing the basic structure and markup. Clean and focused on semantic HTML without embedded styles or scripts.

### `assets/styles.css`
Contains all CSS styling including:
- Typography and layout
- Interactive point animations
- Dialogue panel styling
- Responsive design rules
- Help overlay styles
- High contrast mode support

### `assets/app.js`
Main JavaScript application containing:
- Story data loading from JSON
- Interactive point management
- Drag and zoom functionality
- Dialogue system logic
- Event handlers and controls
- Responsive behavior

### `assets/story-data.json`
Structured story content including:
- Story point locations (x, y coordinates)
- Dialogue sections for each topic
- Navigation options
- Speaker information

## Features

- **Interactive Exploration**: Click on glowing points to explore different aspects of degrowth London
- **Drag Navigation**: Drag the background to explore the market scene
- **Responsive Design**: Works on desktop and mobile devices
- **Accessibility**: High contrast mode and keyboard navigation support
- **Modular Content**: Easy to edit story content through the JSON file

## Topics Covered

1. **Democracy** - Community-driven governance and decision-making
2. **Energy** - Renewable energy cooperatives and fair distribution
3. **Education** - Living classrooms and interdisciplinary learning
4. **Food** - Local farmers markets and sustainable food systems
5. **Housing** - Community stewardship and diverse housing models
6. **Transport** - Car-free streets and sustainable mobility

## Getting Started

### Quick Setup

1. **Run the setup script (recommended):**
   ```bash
   ./setup.sh
   ```
   This will check your environment, install dependencies, and verify all files.

2. **Or manually install:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm start
   # or
   npm run dev
   ```

4. **Open your browser:**
   The application will automatically open at `http://localhost:3000`

### Alternative Setup Methods

If you prefer not to use our custom server, you can use any static file server:

```bash
# Using the simple http-server
npm run serve-simple

# Using Python 3
python -m http.server 3000

# Using PHP
php -S localhost:3000

# Using Node.js http-server globally
npx http-server . -p 3000 -o
```

### Navigation

1. Use the help overlay (press 'H' or click spiral logo) for navigation tips
2. Click on the green glowing points to explore different topics
3. Drag the background to navigate around the scene

### First Time Setup Troubleshooting

- **Node.js not installed?** Download from [nodejs.org](https://nodejs.org/)
- **CORS errors?** Always use `npm start` instead of opening HTML directly
- **Port 3000 busy?** The server will try alternative ports automatically

## Editing Content

### To modify story content:
- Edit `assets/story-data.json` to change dialogue, add new sections, or modify story points

### To update styling:
- Edit `assets/styles.css` to change colors, layouts, animations, or responsive behavior

### To modify functionality:
- Edit `assets/app.js` to change interactive behavior, add new features, or modify the dialogue system

## Development Commands

- `npm start` or `npm run dev` - Start custom development server on port 3000
- `npm run serve` - Start http-server on port 8080 (alternative)
- `npm run serve-simple` - Start http-server on port 3000 (simple alternative)
- `npm run build` - No build process needed (static site)
- `./setup.sh` - Run setup and environment check

## Troubleshooting

### CORS Errors
If you see CORS errors when opening the HTML file directly in a browser, you need to serve the files through a web server. Use `npm start` to automatically set up a local server.

### Font Loading Issues
If fonts don't load properly, ensure you're accessing the site through a web server (not `file://` protocol). The npm development server resolves this automatically.

### JSON Loading Failures
The story data is loaded via fetch API which requires HTTP protocol. Always use `npm start` for development.

### Port Already in Use
If port 3000 is busy, you can:
- Stop other services using port 3000
- Use `npm run serve` to run on port 8080
- Set custom port: `PORT=3001 npm start`

### Setup Script Issues
If `./setup.sh` fails:
- Ensure you have Node.js v14+ installed
- Run `chmod +x setup.sh` to make it executable
- Try manual setup: `npm install`

## Browser Support

Modern browsers supporting ES6+, CSS Grid, and Flexbox. Tested on:
- Chrome/Chromium
- Firefox
- Safari
- Edge

## License

See LICENSE file for details.