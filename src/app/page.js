"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

// IMPORTANT: this must match where your firebase.js exports auth + db
import { auth, db } from "@/lib/firebase";

export default function Home() {
  const router = useRouter();
  const canvasRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    let spawnTimeoutId = null;
    let droneTimeoutId = null;
    let autoSaveIntervalId = null;
    let rafId = null;

    let handleCanvasClick = null;
    let handleUpgradeClick = null;
    let handleBuyDrone = null;
    let handleUpgradeDroneDamage = null;
    let handleUpgradeDroneFireRate = null;
    let handleNextSector = null;

    let removeResize = null;

    async function ensureSaveExists(uid) {
      const userRef = doc(db, "users", uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        await setDoc(userRef, {
          ore: 0,
          clickPower: 1,
          clickLevel: 1,
          drones: 0,
          droneDamage: 1,
          droneDamageLevel: 1,
          droneFireRate: 1000,
          droneFireRateLevel: 1,
          currentSector: 1,
          createdAt: Date.now(),
          lastSave: Date.now()
        });
      }
    }

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (cancelled) return;

      if (!user) {
        router.replace("/login");
        return;
      }

      const userId = user.uid;

      // Ensure doc exists before we try to load
      await ensureSaveExists(userId);
      if (cancelled) return;

      // ===== CANVAS SETUP =====
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");

      function resizeCanvas() {
        canvas.width = window.innerWidth - 250;
        canvas.height = window.innerHeight;
      }

      resizeCanvas();
      window.addEventListener("resize", resizeCanvas);
      removeResize = () => window.removeEventListener("resize", resizeCanvas);

      // ===== GAME STATE =====
      let ore = 0;
      let clickPower = 1;
      let drones = 0;
      let droneDamage = 1;
      let currentSector = 1;

      let asteroids = [];
      let lasers = [];
      let explosions = [];
      let droneUnits = [];

      // ===== CLICK UPGRADE STATE =====
      let clickLevel = 1;
      const clickBaseCost = 10;
      const clickCostGrowth = 1.7;

      // ===== DRONE PURCHASE STATE =====
      const droneBaseCost = 100;
      const droneCostMultiplier = 10;

      // ===== DRONE DAMAGE UPGRADE =====
      let droneDamageLevel = 1;
      const droneDamageBaseCost = 250;
      const droneDamageGrowth = 2;

      // ===== DRONE FIRE RATE UPGRADE =====
      let droneFireRate = 1000;
      let droneFireRateLevel = 1;
      const droneFireRateBaseCost = 500;
      const droneFireRateGrowth = 2;

      async function saveGame() {
        if (!userId) return;

        // merge:true prevents wiping fields if you later add more
        await setDoc(
          doc(db, "users", userId),
          {
            ore,
            clickPower,
            clickLevel,
            drones,
            droneDamage,
            droneDamageLevel,
            droneFireRate,
            droneFireRateLevel,
            currentSector,
            lastSave: Date.now()
          },
          { merge: true }
        );
      }

      async function loadGame() {
        const snap = await getDoc(doc(db, "users", userId));
        if (!snap.exists()) return;

        const data = snap.data();

        ore = data.ore ?? ore;
        clickPower = data.clickPower ?? clickPower;
        drones = data.drones ?? drones;

        // rebuild drone visuals
        droneUnits = [];
        for (let i = 0; i < drones; i++) {
          droneUnits.push({
            x: canvas.width / 2 + (Math.random() * 100 - 50),
            y: canvas.height - 120 - i * 25,
            hoverOffset: Math.random() * Math.PI * 2
          });
        }

        droneDamage = data.droneDamage ?? droneDamage;
        droneFireRate = data.droneFireRate ?? droneFireRate;
        currentSector = data.currentSector ?? currentSector;

        clickLevel = data.clickLevel ?? clickLevel;
        droneDamageLevel = data.droneDamageLevel ?? droneDamageLevel;
        droneFireRateLevel = data.droneFireRateLevel ?? droneFireRateLevel;

        updateUI();
      }

      // ===== COST CALCULATION FUNCTIONS =====
      function getClickUpgradeCost() {
        return Math.floor(clickBaseCost * Math.pow(clickCostGrowth, clickLevel - 1));
      }
      function getDroneCost() {
        return droneBaseCost * Math.pow(droneCostMultiplier, drones);
      }
      function getDroneDamageUpgradeCost() {
        return Math.floor(droneDamageBaseCost * Math.pow(droneDamageGrowth, droneDamageLevel - 1));
      }
      function getDroneFireRateUpgradeCost() {
        return Math.floor(droneFireRateBaseCost * Math.pow(droneFireRateGrowth, droneFireRateLevel - 1));
      }

      // ===== ASTEROID TYPES =====
      const ASTEROID_TYPES = [
        { type: "iron", color: "#888", hpMultiplier: 2, rewardMultiplier: 1, spawnWeight: 70 },
        { type: "titanium", color: "#5dade2", hpMultiplier: 5, rewardMultiplier: 2.5, spawnWeight: 25 },
        { type: "platinum", color: "#e5e4e2", hpMultiplier: 10, rewardMultiplier: 6, spawnWeight: 5 }
      ];

      // ===== SECTOR DEFINITIONS =====
      const SECTORS = {
        1: {
          name: "Outer Belt",
          background: "#000000",
          starColor: "#666",
          asteroidSpeedMultiplier: 1,
          spawnDelayMin: 700,
          spawnDelayMax: 1500,
          asteroidTypes: [{ ...ASTEROID_TYPES[0] }, { ...ASTEROID_TYPES[1] }]
        },
        2: {
          name: "Inner Belt",
          background: "#050014",
          starColor: "#9b59b6",
          asteroidSpeedMultiplier: 1.4,
          spawnDelayMin: 900,
          spawnDelayMax: 2000,
          asteroidTypes: [
            { ...ASTEROID_TYPES[0], spawnWeight: 40 },
            { ...ASTEROID_TYPES[1], spawnWeight: 40 },
            { ...ASTEROID_TYPES[2], spawnWeight: 20 }
          ]
        }
      };

      function getRandomAsteroidType() {
        const types = SECTORS[currentSector].asteroidTypes;
        const totalWeight = types.reduce((sum, t) => sum + t.spawnWeight, 0);
        let roll = Math.random() * totalWeight;

        for (let t of types) {
          roll -= t.spawnWeight;
          if (roll <= 0) return t;
        }
        return types[0];
      }

      function generateAsteroidShape(size) {
        const points = [];
        const vertexCount = Math.floor(Math.random() * 5) + 7; // 7–11

        for (let i = 0; i < vertexCount; i++) {
          const angle = (Math.PI * 2 / vertexCount) * i;
          const radius = size * (0.7 + Math.random() * 0.4);
          points.push({ angle, radius });
        }
        return points;
      }

      function generateCracks(size) {
        const cracks = [];
        const crackCount = Math.floor(Math.random() * 3) + 2; // 2–4

        for (let i = 0; i < crackCount; i++) {
          cracks.push({
            angle: Math.random() * Math.PI * 2,
            length: size * (0.4 + Math.random() * 0.4)
          });
        }
        return cracks;
      }

      function spawnExplosion(x, y, color) {
        const particleCount = 12;
        for (let i = 0; i < particleCount; i++) {
          explosions.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            life: 1,
            color
          });
        }
      }

      // ===== SPACE STATION =====
      const station = {
        x: () => canvas.width / 2,
        y: () => canvas.height,
        baseWidth: () => canvas.width,
        baseHeight: 30,
        armWidth: 12,
        armLength: 60
      };

      // ===== ASTEROID SPAWNING =====
      function spawnAsteroid() {
        const size = Math.random() * 25 + 20;
        const typeData = getRandomAsteroidType();
        const baseHp = Math.floor(size * 1.5);

        const asteroid = {
          x: Math.random() * canvas.width,
          y: -size,
          size,
          type: typeData.type,
          color: typeData.color,
          hp: Math.floor(baseHp * typeData.hpMultiplier),
          maxHp: Math.floor(baseHp * typeData.hpMultiplier),
          speed: (0.8 + Math.random() * 1.2) * SECTORS[currentSector].asteroidSpeedMultiplier,
          reward: Math.floor(size * 0.5 * typeData.rewardMultiplier),
          points: generateAsteroidShape(size),
          cracks: generateCracks(size),
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.01
        };

        asteroids.push(asteroid);
      }

      function startSpawning() {
        if (cancelled) return;

        spawnAsteroid();

        const sector = SECTORS[currentSector];
        const nextSpawn = sector.spawnDelayMin + Math.random() * (sector.spawnDelayMax - sector.spawnDelayMin);

        spawnTimeoutId = window.setTimeout(startSpawning, nextSpawn);
      }

      // ===== DRONE MINING =====
      function getClosestAsteroid() {
        if (asteroids.length === 0) return null;
        return asteroids.reduce((closest, a) => (a.y > closest.y ? a : closest));
      }

      function droneAttack() {
        if (cancelled) return;

        if (drones > 0) {
          const target = getClosestAsteroid();

          if (target) {
            // Laser effect
            for (let d of droneUnits) {
              lasers.push({ x1: d.x, y1: d.y, x2: target.x, y2: target.y, alpha: 1 });
            }

            // Damage
            const automationBonus = currentSector >= 2 ? 1.5 : 1;
            const damage = droneDamage * droneUnits.length * automationBonus;

            ore += damage;
            target.hp -= damage;

            if (target.hp <= 0) {
              spawnExplosion(target.x, target.y, target.color);
              ore += target.reward;
              asteroids = asteroids.filter((a) => a !== target);
            }

            updateUI();
          }
        }

        droneTimeoutId = window.setTimeout(droneAttack, droneFireRate);
      }

      // ===== DRAWING =====
      function draw() {
        // background
        ctx.fillStyle = SECTORS[currentSector].background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // station base
        ctx.fillStyle = "#444";
        ctx.fillRect(0, station.y() - station.baseHeight, station.baseWidth(), station.baseHeight);

        // base supports
        ctx.strokeStyle = "#555";
        ctx.lineWidth = 1;
        for (let x = 0; x < canvas.width; x += 80) {
          ctx.beginPath();
          ctx.moveTo(x, station.y() - station.baseHeight);
          ctx.lineTo(x, station.y());
          ctx.stroke();
        }

        // drones
        for (let d of droneUnits) {
          const hoverY = d.y + Math.sin(Date.now() / 500 + d.hoverOffset) * 5;

          ctx.fillStyle = "#0ff";
          ctx.beginPath();
          ctx.arc(d.x, hoverY, 6, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = "#0aa";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(d.x - 10, hoverY);
          ctx.lineTo(d.x + 10, hoverY);
          ctx.stroke();
        }

        // asteroids
        for (let a of asteroids) {
          ctx.save();
          ctx.translate(a.x, a.y);
          ctx.rotate(a.rotation);

          ctx.fillStyle = a.color;
          ctx.beginPath();
          a.points.forEach((p, index) => {
            const px = Math.cos(p.angle) * p.radius;
            const py = Math.sin(p.angle) * p.radius;
            if (index === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          });
          ctx.closePath();
          ctx.fill();

          // cracks
          const damageRatio = 1 - a.hp / a.maxHp;
          if (damageRatio > 0.1) {
            ctx.strokeStyle = `rgba(255, 255, 255, ${damageRatio})`;
            ctx.lineWidth = 1.5;
            for (let c of a.cracks) {
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.lineTo(
                Math.cos(c.angle) * c.length * damageRatio,
                Math.sin(c.angle) * c.length * damageRatio
              );
              ctx.stroke();
            }
          }

          ctx.restore();
        }

        // explosions
        for (let p of explosions) {
          ctx.fillStyle = `rgba(255, 180, 100, ${p.life})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
          ctx.fill();
        }

        // lasers
        for (let l of lasers) {
          ctx.strokeStyle = `rgba(0, 255, 255, ${l.alpha})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(l.x1, l.y1);
          ctx.lineTo(l.x2, l.y2);
          ctx.stroke();
          l.alpha -= 0.05;
        }

        lasers = lasers.filter((l) => l.alpha > 0);
      }

      function update() {
        if (cancelled) return;

        for (let a of asteroids) {
          a.y += a.speed;
          a.rotation += a.rotationSpeed;
        }

        for (let p of explosions) {
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 0.03;
        }

        explosions = explosions.filter((p) => p.life > 0);
        asteroids = asteroids.filter((a) => a.y < canvas.height + 50);

        draw();
        rafId = requestAnimationFrame(update);
      }

      // ===== UI UPDATES =====
      function updateUI() {
        const oreEl = document.getElementById("oreDisplay");
        const clickEl = document.getElementById("clickPowerDisplay");
        const dronesEl = document.getElementById("droneCountDisplay");
        const upClickEl = document.getElementById("upgradeClick");
        const buyDroneEl = document.getElementById("buyDrone");
        const upDmgEl = document.getElementById("upgradeDroneDamage");
        const upRateEl = document.getElementById("upgradeDroneFireRate");
        const sectorEl = document.getElementById("sectorDisplay");
        const nextSectorEl = document.getElementById("nextSector");

        if (!oreEl) return; // if UI not mounted yet

        oreEl.textContent = Math.floor(ore);
        clickEl.textContent = clickPower;
        dronesEl.textContent = drones;

        upClickEl.textContent = `Upgrade Click (${getClickUpgradeCost()} ore)`;
        buyDroneEl.textContent = `Buy Drone (${getDroneCost()} ore)`;
        upDmgEl.textContent = `Upgrade Drone Damage (${getDroneDamageUpgradeCost()} ore)`;
        upRateEl.textContent = `Upgrade Drone Speed (${getDroneFireRateUpgradeCost()} ore)`;

        sectorEl.textContent = `${currentSector} (${SECTORS[currentSector].name})`;

        nextSectorEl.textContent =
          currentSector === 1 ? "Travel to Inner Belt (5000 ore)" : "Max Sector Reached";

        if (currentSector >= 2) {
          clickEl.textContent = "Disabled";
          upClickEl.disabled = true;
          upClickEl.textContent = "Manual Mining Offline";
        } else {
          upClickEl.disabled = false;
        }
      }

      // ===== CLICKING =====
      handleCanvasClick = (e) => {
        if (currentSector >= 2) return;

        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        for (let a of asteroids) {
          const dx = mx - a.x;
          const dy = my - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < a.size) {
            const damage = clickPower;
            ore += damage;
            a.hp -= damage;

            if (a.hp <= 0) {
              spawnExplosion(a.x, a.y, a.color);
              ore += a.reward;
              asteroids = asteroids.filter((x) => x !== a);
            }

            updateUI();
            return;
          }
        }
      };
      canvas.addEventListener("click", handleCanvasClick);

      // ===== BUTTONS =====
      const upgradeClickBtn = document.getElementById("upgradeClick");
      const buyDroneBtn = document.getElementById("buyDrone");
      const upgradeDroneDamageBtn = document.getElementById("upgradeDroneDamage");
      const upgradeDroneFireRateBtn = document.getElementById("upgradeDroneFireRate");
      const nextSectorBtn = document.getElementById("nextSector");

      handleUpgradeClick = () => {
        if (currentSector >= 2) return;

        const cost = getClickUpgradeCost();
        if (ore >= cost) {
          ore -= cost;
          clickLevel++;
          clickPower++;
          updateUI();
          saveGame();
        }
      };

      handleBuyDrone = () => {
        const cost = getDroneCost();
        if (ore >= cost) {
          ore -= cost;
          drones++;

          droneUnits.push({
            x: canvas.width / 2 + (Math.random() * 100 - 50),
            y: canvas.height - 120 - droneUnits.length * 25,
            hoverOffset: Math.random() * Math.PI * 2
          });

          updateUI();
          saveGame();
        }
      };

      handleUpgradeDroneDamage = () => {
        const cost = getDroneDamageUpgradeCost();
        if (ore >= cost) {
          ore -= cost;
          droneDamage++;
          droneDamageLevel++;
          updateUI();
          saveGame();
        }
      };

      handleUpgradeDroneFireRate = () => {
        const cost = getDroneFireRateUpgradeCost();
        if (ore >= cost && droneFireRate > 200) {
          ore -= cost;
          droneFireRate -= 150;
          droneFireRateLevel++;
          updateUI();
          saveGame();
        }
      };

      handleNextSector = () => {
        if (currentSector === 1 && ore >= 5000) {
          ore -= 5000;
          currentSector = 2;

          asteroids = [];
          lasers = [];
          explosions = [];

          updateUI();
          saveGame();
        }
      };

      upgradeClickBtn?.addEventListener("click", handleUpgradeClick);
      buyDroneBtn?.addEventListener("click", handleBuyDrone);
      upgradeDroneDamageBtn?.addEventListener("click", handleUpgradeDroneDamage);
      upgradeDroneFireRateBtn?.addEventListener("click", handleUpgradeDroneFireRate);
      nextSectorBtn?.addEventListener("click", handleNextSector);

      // ===== START EVERYTHING (after load) =====
      await loadGame();
      if (cancelled) return;

      updateUI();
      startSpawning();
      droneAttack();
      update();

      // ===== OPTIONAL: autosave every 10 seconds =====
      autoSaveIntervalId = window.setInterval(() => {
        if (!cancelled) saveGame();
      }, 10_000);
    });

    return () => {
      cancelled = true;

      unsub?.();

      if (spawnTimeoutId) clearTimeout(spawnTimeoutId);
      if (droneTimeoutId) clearTimeout(droneTimeoutId);
      if (autoSaveIntervalId) clearInterval(autoSaveIntervalId);
      if (rafId) cancelAnimationFrame(rafId);

      removeResize?.();

      const canvas = canvasRef.current;
      if (canvas && handleCanvasClick) {
        canvas.removeEventListener("click", handleCanvasClick);
      }

      const upgradeClickBtn = document.getElementById("upgradeClick");
      const buyDroneBtn = document.getElementById("buyDrone");
      const upgradeDroneDamageBtn = document.getElementById("upgradeDroneDamage");
      const upgradeDroneFireRateBtn = document.getElementById("upgradeDroneFireRate");
      const nextSectorBtn = document.getElementById("nextSector");

      if (upgradeClickBtn && handleUpgradeClick) upgradeClickBtn.removeEventListener("click", handleUpgradeClick);
      if (buyDroneBtn && handleBuyDrone) buyDroneBtn.removeEventListener("click", handleBuyDrone);
      if (upgradeDroneDamageBtn && handleUpgradeDroneDamage)
        upgradeDroneDamageBtn.removeEventListener("click", handleUpgradeDroneDamage);
      if (upgradeDroneFireRateBtn && handleUpgradeDroneFireRate)
        upgradeDroneFireRateBtn.removeEventListener("click", handleUpgradeDroneFireRate);
      if (nextSectorBtn && handleNextSector) nextSectorBtn.removeEventListener("click", handleNextSector);
    };
  }, [router]);

  return (
    <div style={{ display: "flex" }}>
      <div
        style={{
          width: "250px",
          background: "#111",
          color: "white",
          padding: "20px"
        }}
      >
        <h1>Stellar Extractor</h1>

        <p>
          Ore: <span id="oreDisplay">0</span>
        </p>

        <button id="upgradeClick">Upgrade Click Power</button>
        <button id="buyDrone">Buy Drone</button>
        <button id="upgradeDroneDamage">Upgrade Drone Damage</button>
        <button id="upgradeDroneFireRate">Upgrade Drone Speed</button>

        <p>
          Click Power: <span id="clickPowerDisplay">1</span>
        </p>
        <p>
          Drones: <span id="droneCountDisplay">0</span>
        </p>

        <button id="nextSector">Travel to Next Sector</button>
        <p>
          Current Sector: <span id="sectorDisplay">1</span>
        </p>
      </div>

      <canvas ref={canvasRef} id="gameCanvas" style={{ background: "black" }} />
    </div>
  );
}