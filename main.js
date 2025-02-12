/***************************************
 * GLOBAL CONFIGURATION & VARIABLES
 ***************************************/
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const tileSize = 32;          // Each tile is 32×32 pixels
const gridWidth = 20;         // Number of columns
const gridHeight = 20;        // Number of rows

// --- Spawn Area Settings (5×5) ---
const spawnSize = 5;
const spawnHalf = Math.floor(spawnSize / 2);
const spawnCenterX = Math.floor(gridWidth / 2);
const spawnCenterY = Math.floor(gridHeight / 2);
const spawnXStart = spawnCenterX - spawnHalf;
const spawnXEnd   = spawnCenterX + spawnHalf;
const spawnYStart = spawnCenterY - spawnHalf;
const spawnYEnd   = spawnCenterY + spawnHalf;

const oreChance = 0.2;  // 20% chance for a tile to be an ore
const maxLevel = 10;
let currentLevel = 1;

// Global object to store level data so that level states (and portals) persist.
let levels = {};
let tiles;  // Reference to the current level’s grid

// Flag to track if the player has stepped off the portal (center) tile.
let playerHasLeftPortal = false;

// The player persists across levels.
let player = {
  x: 0,
  y: 0,
  direction: "up",
  materials: {}  // This object will hold counts for minerals.
};

/***************************************
 * MAPPING & SCALING DATA
 ***************************************/
const oreMapping = {
  1: { mineral: "Copper",   color: "#B87333", baseHP: 3 },
  2: { mineral: "Iron",     color: "#808080", baseHP: 5 },
  3: { mineral: "Gold",     color: "#FFD700", baseHP: 70 },
  4: { mineral: "Emerald",  color: "#50C878", baseHP: 100 },
  5: { mineral: "Sapphire", color: "#0F52BA", baseHP: 120 },
  6: { mineral: "Ruby",     color: "#E0115F", baseHP: 150 },
  7: { mineral: "Diamond",  color: "#B9F2FF", baseHP: 180 },
  8: { mineral: "Amethyst", color: "#9966CC", baseHP: 210 },
  9: { mineral: "Topaz",    color: "#FFC87C", baseHP: 250 },
  10: { mineral: "Obsidian", color: "#1C1C1C", baseHP: 300 },
};

const levelHpScaling = {
  1: 5,
  2: 6,
  3: 7,
  4: 85,
  5: 100,
  6: 120,
  7: 145,
  8: 175,
  9: 210,
  10: 250,
};

function getGroundColorForLevel(level) {
  let lightness;
  switch (level) {
    case 1: lightness = 70; break;
    case 2: lightness = 65; break;
    case 3: lightness = 60; break;
    case 4: lightness = 55; break;
    case 5: lightness = 50; break;
    case 6: lightness = 45; break;
    case 7: lightness = 40; break;
    case 8: lightness = 35; break;
    case 9: lightness = 30; break;
    case 10: lightness = 25; break;
    default: lightness = 70;
  }
  return `hsl(30,80%,${lightness}%)`;
}

/***************************************
 * LEVEL GENERATION & DOOR PLACEMENT
 ***************************************/
function generateLevel(level) {
  // Create a new grid (2D array) for the level.
  let grid = Array.from({ length: gridHeight }, (_, row) =>
    Array.from({ length: gridWidth }, (_, col) => {
      let tile = { revealed: true };
      // Outside the spawn area: randomly decide if the tile is "ground" or "ore."
      if (col < spawnXStart || col > spawnXEnd || row < spawnYStart || row > spawnYEnd) {
        if (Math.random() < oreChance) {
          tile.type = "ore";
          tile.resource = oreMapping[level].mineral;
          tile.hp = oreMapping[level].baseHP;
          tile.maxHp = tile.hp;
        } else {
          tile.type = "ground";
          tile.hp = levelHpScaling[level];
          tile.maxHp = tile.hp;
        }
      } else {
        // Inside the spawn area, tiles will be cleared.
        tile.type = "mined";
        tile.hp = 0;
        tile.maxHp = 0;
      }
      return tile;
    })
  );

  // Clear the spawn area (5×5) completely.
  for (let y = spawnYStart; y <= spawnYEnd; y++) {
    for (let x = spawnXStart; x <= spawnXEnd; x++) {
      grid[y][x] = {
        type: "mined",
        hp: 0,
        maxHp: 0,
        revealed: true,
        resource: null
      };
    }
  }

  // --- Place the "prev" door (portal) in the spawn area at the center ---
  // For levels greater than 1, create the portal door once and keep it immune.
  if (level > 1) {
    grid[spawnCenterY][spawnCenterX] = {
      type: "door",
      doorFor: "prev",
      doorState: "open",  // Always open.
      hp: 0,
      maxHp: 0,
      revealed: true,
      resource: null
    };
  }

  // --- Place the "next" door (locked) randomly outside the spawn area ---
  let possibleCoords = [];
  for (let row = 0; row < gridHeight; row++) {
    for (let col = 0; col < gridWidth; col++) {
      if (col < spawnXStart || col > spawnXEnd || row < spawnYStart || row > spawnYEnd) {
        if (grid[row][col].type !== "door") {
          possibleCoords.push({ x: col, y: row });
        }
      }
    }
  }
  if (possibleCoords.length > 0) {
    let randIndex = Math.floor(Math.random() * possibleCoords.length);
    let coord = possibleCoords[randIndex];
    grid[coord.y][coord.x] = {
      type: "door",
      doorFor: "next",
      doorState: "locked",
      hp: 50 + level * 20,
      maxHp: 50 + level * 20,
      revealed: true,
      resource: null
    };
  }

  // The spawn (and portal) is at the center of the spawn area.
  let spawn = { x: spawnCenterX, y: spawnCenterY };
  return { grid, spawn };
}

// Generate Level 1 and store it.
levels[1] = generateLevel(1);
tiles = levels[1].grid;
player.x = levels[1].spawn.x;
player.y = levels[1].spawn.y;
playerHasLeftPortal = false;

/***************************************
 * LEVEL TRANSITION FUNCTIONS
 ***************************************/
function transitionToLevel(newLevel) {
  if (newLevel < 1) return;
  if (newLevel > maxLevel) {
    alert("Congratulations! You have completed the game!");
    return;
  }
  currentLevel = newLevel;
  if (!levels[newLevel]) {
    levels[newLevel] = generateLevel(newLevel);
  }
  tiles = levels[newLevel].grid;
  // Always spawn the player at the center (portal) of the spawn area.
  player.x = spawnCenterX;
  player.y = spawnCenterY;
  playerHasLeftPortal = false;
  console.log(`Transitioned to Level ${newLevel}`);
}

/***************************************
 * CLICK-BASED DAMAGE & RATE LIMITING
 ***************************************/
let lastDamageTimes = { up: 0, down: 0, left: 0, right: 0 };

function getDirectionFromKey(key) {
  if (key === "ArrowUp" || key === "w" || key === "W") return "up";
  if (key === "ArrowDown" || key === "s" || key === "S") return "down";
  if (key === "ArrowLeft" || key === "a" || key === "A") return "left";
  if (key === "ArrowRight" || key === "d" || key === "D") return "right";
  return null;
}

document.addEventListener("keydown", (event) => {
  const direction = getDirectionFromKey(event.key);
  if (!direction) return;

  let cooldown = event.repeat ? 500 : 200; // milliseconds
  let currentTime = Date.now();
  if (currentTime - lastDamageTimes[direction] < cooldown) return;
  lastDamageTimes[direction] = currentTime;

  // Update player's facing direction.
  player.direction = direction;

  // Determine target tile coordinates.
  let dx = 0, dy = 0;
  if (direction === "up") dy = -1;
  if (direction === "down") dy = 1;
  if (direction === "left") dx = -1;
  if (direction === "right") dx = 1;
  let targetX = player.x + dx;
  let targetY = player.y + dy;
  if (targetX < 0 || targetX >= gridWidth || targetY < 0 || targetY >= gridHeight) return;
  let targetTile = tiles[targetY][targetX];

  // --- Door Handling ---
  if (targetTile.type === "door") {
    if (targetTile.doorFor === "next") {
      if (targetTile.doorState === "locked") {
        targetTile.hp -= 1;
        console.log(`Damaging NEXT door at (${targetX},${targetY}). Remaining HP: ${targetTile.hp}/${targetTile.maxHp}`);
        if (targetTile.hp <= 0) {
          targetTile.hp = 0;
          targetTile.doorState = "open";
          console.log("Next door is now open!");
        }
      } else if (targetTile.doorState === "open") {
        transitionToLevel(currentLevel + 1);
        return;
      }
    } else if (targetTile.doorFor === "prev") {
      // Always move the player onto the portal tile.
      player.x = targetX;
      player.y = targetY;
      // If the player has left the portal (center) tile previously, trigger the level transition.
      if (playerHasLeftPortal) {
        transitionToLevel(currentLevel - 1);
        return;
      }
      return;
    }
  }
  // --- Mineable Tile Handling ---
  else if (targetTile.type === "ground" || targetTile.type === "ore") {
    targetTile.hp -= 1;
    console.log(`Damaging tile at (${targetX},${targetY}). Remaining HP: ${targetTile.hp}/${targetTile.maxHp}`);
    if (targetTile.hp <= 0) {
      targetTile.hp = 0;
      targetTile.type = "mined";
      if (targetTile.resource) {
        let res = targetTile.resource;
        player.materials[res] = (player.materials[res] || 0) + 1;
        console.log(`Collected 1 ${res}. Total ${res}: ${player.materials[res]}`);
        targetTile.resource = null;
      }
    }
  }
  // --- Movement into an Empty (mined) Tile ---
  else if (targetTile.type === "mined") {
    player.x = targetX;
    player.y = targetY;
    // If the player moves off the portal (center) tile, mark that they've left.
    if (player.x !== spawnCenterX || player.y !== spawnCenterY) {
      playerHasLeftPortal = true;
    }
  }
});

/***************************************
 * Inventory State Management
 ***************************************/
let inventoryOpen = false;  // Tracks if inventory is open/closed

/***************************************
 * DRAW INVENTORY FUNCTION (DRODOWN STYLE)
 ***************************************/
function drawInventory() {
  if (!inventoryOpen) return;  // Only draw if inventory is open
  
  const invWidth = 200;    // Width of the inventory dropdown
  const invHeight = 300;   // Height of the inventory dropdown
  const invPosX = canvas.width/2 - invWidth/2;  // Centered horizontally
  const invPosY = canvas.height/2 - invHeight/2;  // Centered vertically
  
  // Draw semi-transparent background
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(invPosX, invPosY, invWidth, invHeight);
  
  // Set font properties
  ctx.fillStyle = "white";
  ctx.font = "16px Arial";
  
  // Mineral color mapping
  const mineralColors = {
    "Copper": "#B87333",
    "Iron": "#808080",
    "Gold": "#FFD700",
    "Emerald": "#50C878",
    "Sapphire": "#0F52BA",
    "Ruby": "#E0115F",
    "Diamond": "#B9F2FF",
    "Amethyst": "#9966CC",
    "Topaz": "#FFC87C",
    "Obsidian": "#1C1C1C"
  };

  // Draw title with shadow effect
  ctx.shadowColor = "black";
  ctx.shadowBlur = 5;
  ctx.fillStyle = "white";
  ctx.font = "20px Arial";
  ctx.fillText("Inventory", invPosX + 20, invPosY + 40);
  ctx.shadowBlur = 0;

  // Draw each mineral with its color
  const yOffset = invPosY + 70;  // Start below the title
  const spacing = 25;           // Vertical spacing between items
  const minerals = ["Copper", "Iron", "Gold", "Emerald", "Sapphire", "Ruby", "Diamond", "Amethyst", "Topaz", "Obsidian"];
  
  for (let i = 0; i < minerals.length; i++) {
    const mineral = minerals[i];
    const count = player.materials[mineral] || 0;
    
    // Draw mineral name with its color
    ctx.fillStyle = mineralColors[mineral];
    ctx.fillText(mineral, invPosX + 20, yOffset + i * spacing);
    
    // Draw count number in white
    ctx.fillStyle = "white";
    ctx.fillText(`: ${count}`, invPosX + 100, yOffset + i * spacing);
  }
}

// Add event listener for toggling inventory with "E" key
document.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "e") {
    inventoryOpen = !inventoryOpen;
  }
});

/***************************************
 * RENDERING & HEALTH BARS
 ***************************************/
function tileToPixel(coord) {
  return coord * tileSize;
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  for (let row = 0; row < gridHeight; row++) {
    for (let col = 0; col < gridWidth; col++) {
      const tile = tiles[row][col];
      let color = "black";
      if (tile.type === "mined") {
        color = "gray";
      } else if (tile.type === "door") {
        if (tile.doorFor === "next") {
          color = (tile.doorState === "locked") ? "darkred" : "gold";
        } else if (tile.doorFor === "prev") {
          color = "cyan"; // Portal back door color.
        }
      } else if (tile.type === "ore") {
        for (let lvl = 1; lvl <= maxLevel; lvl++) {
          if (oreMapping[lvl].mineral === tile.resource) {
            color = oreMapping[lvl].color;
            break;
          }
        }
        if (!color) color = "white";
      } else if (tile.type === "ground") {
        color = getGroundColorForLevel(currentLevel);
      }
      
      ctx.fillStyle = color;
      ctx.fillRect(tileToPixel(col), tileToPixel(row), tileSize, tileSize);
      ctx.strokeStyle = "#333";
      ctx.strokeRect(tileToPixel(col), tileToPixel(row), tileSize, tileSize);

      // Draw health bars for mineable tiles and locked next doors.
      if ((tile.type === "ground" || tile.type === "ore" ||
           (tile.type === "door" && tile.doorFor === "next" && tile.doorState === "locked"))
          && tile.maxHp > 0) {
        const barMargin = 2;
        const barWidth = tileSize - 2 * barMargin;
        const barHeight = 4;
        const barX = tileToPixel(col) + barMargin;
        const barY = tileToPixel(row) + barMargin;
        ctx.fillStyle = "red";
        ctx.fillRect(barX, barY, barWidth, barHeight);
        let hpRatio = tile.hp / tile.maxHp;
        let filledWidth = barWidth * hpRatio;
        ctx.fillStyle = "limegreen";
        ctx.fillRect(barX, barY, filledWidth, barHeight);
        ctx.strokeStyle = "black";
        ctx.strokeRect(barX, barY, barWidth, barHeight);
      }
    }
  }
  
  // Draw the player as a white square.
  ctx.fillStyle = "white";
  ctx.fillRect(tileToPixel(player.x), tileToPixel(player.y), tileSize, tileSize);
  
  // Draw the inventory at the bottom of the screen.
  drawInventory();
  
  requestAnimationFrame(render);
}

/***************************************
 * START THE GAME (RENDER LOOP)
 ***************************************/
render();
