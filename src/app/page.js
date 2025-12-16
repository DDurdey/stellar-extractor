"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

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

    let handleGoSector1 = null;
    let handleGoSector2 = null;

    let handleBuyTruckSmall = null;
    let handleBuyTruckMedium = null;
    let handleBuyTruckLarge = null;

    let handleUpTruckGather = null;
    let handleUpTruckUnload = null;
    let handleUpTruckTravel = null;

    let removeResize = null;

    async function ensureSaveExists(uid) {
      const userRef = doc(db, "users", uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        await setDoc(userRef, {
          // shared
          ore: 0,
          currentSector: 1,
          unlockedSectors: [1],

          // sector 1
          clickPower: 1,
          clickLevel: 1,
          drones: 0,
          droneDamage: 1,
          droneDamageLevel: 1,
          droneFireRate: 1000,
          droneFireRateLevel: 1,

          // sector 2
          truckCounts: { small: 0, medium: 0, large: 0 },
          truckGatherLevel: 0,
          truckUnloadLevel: 0,
          truckTravelLevel: 0,

          createdAt: Date.now(),
          lastSave: Date.now(),
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

      // =========================
      // SHARED GAME STATE
      // =========================
      let ore = 0;

      let currentSector = 1;
      let unlockedSectors = [1];

      // =========================
      // SECTOR 1 STATE
      // =========================
      let clickPower = 1;
      let clickLevel = 1;

      let drones = 0;
      let droneDamage = 1;
      let droneDamageLevel = 1;

      let droneFireRate = 1000;
      let droneFireRateLevel = 1;

      let asteroids = [];
      let lasers = [];
      let explosions = [];
      let droneUnits = [];

      // =========================
      // SECTOR 2 STATE (TRUCKS)
      // =========================
      const TRUCK_TYPES = {
        small: {
          id: "small",
          label: "Small Truck",
          cost: 500,
          capacity: 60,
          gatherMs: 8000,
          unloadMs: 3000,
          travelPxPerFrame: 4,
          drawW: 34,
          drawH: 16,
        },
        medium: {
          id: "medium",
          label: "Medium Truck",
          cost: 2000,
          capacity: 250,
          gatherMs: 12000,
          unloadMs: 3500,
          travelPxPerFrame: 5,
          drawW: 44,
          drawH: 18,
        },
        large: {
          id: "large",
          label: "Large Truck",
          cost: 10000,
          capacity: 900,
          gatherMs: 20000,
          unloadMs: 4500,
          travelPxPerFrame: 6,
          drawW: 56,
          drawH: 20,
        },
      };

      let truckCounts = { small: 0, medium: 0, large: 0 };

      let truckGatherLevel = 0;
      let truckUnloadLevel = 0;
      let truckTravelLevel = 0;

      let trucks = [];

      function rebuildTrucksFromCounts() {
        trucks = [];
        const makeTruck = (typeId, index) => ({
          typeId,
          state: "idleLeft",
          x: 0,
          timerMs: 1500 + index * 250,
        });

        for (let i = 0; i < (truckCounts.small || 0); i++) trucks.push(makeTruck("small", i));
        for (let i = 0; i < (truckCounts.medium || 0); i++) trucks.push(makeTruck("medium", i));
        for (let i = 0; i < (truckCounts.large || 0); i++) trucks.push(makeTruck("large", i));
      }

      function getTruckGatherMs(typeId) {
        const base = TRUCK_TYPES[typeId].gatherMs;
        const mult = 1 / (1 + truckGatherLevel * 0.25);
        return Math.max(1500, Math.floor(base * mult));
      }

      function getTruckUnloadMs(typeId) {
        const base = TRUCK_TYPES[typeId].unloadMs;
        const mult = 1 / (1 + truckUnloadLevel * 0.35);
        return Math.max(500, Math.floor(base * mult));
      }

      function getTruckTravelSpeed(typeId) {
        const base = TRUCK_TYPES[typeId].travelPxPerFrame;
        return base + truckTravelLevel * 1.2;
      }

      function getTruckYield(typeId) {
        const base = TRUCK_TYPES[typeId].capacity;
        return Math.floor(base * (1 + truckGatherLevel * 0.5));
      }

      // =========================
      // FIRESTORE SAVE / LOAD
      // =========================
      async function saveGame() {
        await setDoc(
          doc(db, "users", userId),
          {
            ore,
            currentSector,
            unlockedSectors,

            // sector 1
            clickPower,
            clickLevel,
            drones,
            droneDamage,
            droneDamageLevel,
            droneFireRate,
            droneFireRateLevel,

            // sector 2
            truckCounts,
            truckGatherLevel,
            truckUnloadLevel,
            truckTravelLevel,

            lastSave: Date.now(),
          },
          { merge: true }
        );
      }

      async function loadGame() {
        const snap = await getDoc(doc(db, "users", userId));
        if (!snap.exists()) return;

        const data = snap.data();

        ore = data.ore ?? ore;

        currentSector = data.currentSector ?? 1;
        unlockedSectors = data.unlockedSectors ?? [1];

        // sector 1
        clickPower = data.clickPower ?? clickPower;
        clickLevel = data.clickLevel ?? clickLevel;

        drones = data.drones ?? drones;
        droneDamage = data.droneDamage ?? droneDamage;
        droneDamageLevel = data.droneDamageLevel ?? droneDamageLevel;

        droneFireRate = data.droneFireRate ?? droneFireRate;
        droneFireRateLevel = data.droneFireRateLevel ?? droneFireRateLevel;

        // sector 2
        truckCounts = data.truckCounts ?? truckCounts;
        truckGatherLevel = data.truckGatherLevel ?? truckGatherLevel;
        truckUnloadLevel = data.truckUnloadLevel ?? truckUnloadLevel;
        truckTravelLevel = data.truckTravelLevel ?? truckTravelLevel;

        rebuildTrucksFromCounts();
        rebuildDroneUnits();

        updateUI();
      }

      // =========================
      // SECTOR 1: ASTEROIDS + DRONES
      // =========================
      const clickBaseCost = 10;
      const clickCostGrowth = 1.7;

      const droneBaseCost = 100;
      const droneCostMultiplier = 5;

      const droneDamageBaseCost = 250;
      const droneDamageGrowth = 2;

      const droneFireRateBaseCost = 500;
      const droneFireRateGrowth = 2;

      function getClickUpgradeCost() {
        return Math.floor(clickBaseCost * Math.pow(clickCostGrowth, clickLevel - 1));
      }
      function getDroneCost() {
        return Math.floor(droneBaseCost * Math.pow(droneCostMultiplier, drones));
      }
      function getDroneDamageUpgradeCost() {
        return Math.floor(droneDamageBaseCost * Math.pow(droneDamageGrowth, droneDamageLevel - 1));
      }
      function getDroneFireRateUpgradeCost() {
        return Math.floor(droneFireRateBaseCost * Math.pow(droneFireRateGrowth, droneFireRateLevel - 1));
      }

      const ASTEROID_TYPES = [
        { type: "iron", color: "#888", hpMultiplier: 2, rewardMultiplier: 1, spawnWeight: 70 },
        { type: "titanium", color: "#5dade2", hpMultiplier: 5, rewardMultiplier: 2.5, spawnWeight: 25 },
        { type: "platinum", color: "#e5e4e2", hpMultiplier: 10, rewardMultiplier: 6, spawnWeight: 5 },
      ];

      const SECTORS = {
        1: {
          name: "Outer Belt",
          background: "#000000",
          asteroidSpeedMultiplier: 1,
          spawnDelayMin: 700,
          spawnDelayMax: 1500,
          asteroidTypes: [{ ...ASTEROID_TYPES[0] }, { ...ASTEROID_TYPES[1] }],
        },
        2: {
          name: "Inner Belt",
          background: "#050014",
        },
      };

      function generateAsteroidShape(size) {
        const points = [];
        const vertexCount = Math.floor(Math.random() * 5) + 7;
        for (let i = 0; i < vertexCount; i++) {
          const angle = (Math.PI * 2) / vertexCount * i;
          const radius = size * (0.7 + Math.random() * 0.4);
          points.push({ angle, radius });
        }
        return points;
      }

      function generateCracks(size) {
        const cracks = [];
        const crackCount = Math.floor(Math.random() * 3) + 2;
        for (let i = 0; i < crackCount; i++) {
          cracks.push({
            angle: Math.random() * Math.PI * 2,
            length: size * (0.4 + Math.random() * 0.4),
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
            color,
          });
        }
      }

      function getRandomAsteroidType() {
        const types = SECTORS[1].asteroidTypes;
        const totalWeight = types.reduce((sum, t) => sum + t.spawnWeight, 0);
        let roll = Math.random() * totalWeight;

        for (let t of types) {
          roll -= t.spawnWeight;
          if (roll <= 0) return t;
        }
        return types[0];
      }

      function spawnAsteroid() {
        if (currentSector !== 1) return;

        const size = Math.random() * 25 + 20;
        const typeData = getRandomAsteroidType();
        const baseHp = Math.floor(size * 1.5);

        const asteroid = {
          x: Math.random() * canvas.width,
          y: -size,
          size,
          color: typeData.color,
          hp: Math.floor(baseHp * typeData.hpMultiplier),
          maxHp: Math.floor(baseHp * typeData.hpMultiplier),
          speed: (0.8 + Math.random() * 1.2) * SECTORS[1].asteroidSpeedMultiplier,
          reward: Math.floor(size * 0.5 * typeData.rewardMultiplier),
          points: generateAsteroidShape(size),
          cracks: generateCracks(size),
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.01,
        };

        asteroids.push(asteroid);
      }

      function startSpawning() {
        if (cancelled) return;
        if (currentSector !== 1) return;

        spawnAsteroid();
        const sector = SECTORS[1];
        const nextSpawn =
          sector.spawnDelayMin + Math.random() * (sector.spawnDelayMax - sector.spawnDelayMin);

        spawnTimeoutId = window.setTimeout(startSpawning, nextSpawn);
      }

      function rebuildDroneUnits() {
        droneUnits = [];
        for (let i = 0; i < drones; i++) {
          droneUnits.push({
            x: canvas.width / 2 + (Math.random() * 100 - 50),
            y: canvas.height - 120 - i * 25,
            hoverOffset: Math.random() * Math.PI * 2,
          });
        }
      }

      function getClosestAsteroid() {
        if (asteroids.length === 0) return null;
        return asteroids.reduce((closest, a) => (a.y > closest.y ? a : closest));
      }

      function droneAttack() {
        if (cancelled) return;

        if (currentSector === 1 && drones > 0) {
          const target = getClosestAsteroid();

          if (target) {
            for (let d of droneUnits) {
              lasers.push({ x1: d.x, y1: d.y, x2: target.x, y2: target.y, alpha: 1 });
            }

            const damage = droneDamage * droneUnits.length;
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

      // =========================
      // SECTOR SWITCHING
      // =========================
      function stopSectorLoops() {
        if (spawnTimeoutId) clearTimeout(spawnTimeoutId);
        spawnTimeoutId = null;

        if (droneTimeoutId) clearTimeout(droneTimeoutId);
        droneTimeoutId = null;

        asteroids = [];
        lasers = [];
        explosions = [];
      }

      function switchSector(newSector) {
        if (newSector === currentSector) return;

        stopSectorLoops();

        currentSector = newSector;

        if (currentSector === 1) {
          rebuildDroneUnits();
          startSpawning();
          droneAttack();
        } else if (currentSector === 2) {

        }

        updateUI();
        saveGame();
      }

      // =========================
      // TRUCK UPGRADES + COSTS
      // =========================
      function getTruckBuyCost(typeId) {
        const base = TRUCK_TYPES[typeId].cost;
        const owned = truckCounts[typeId] || 0;
        return Math.floor(base * Math.pow(1.35, owned));
      }

      function getTruckUpgradeCost(kind) {
        const base = kind === "gather" ? 1500 : kind === "unload" ? 1200 : 1000;
        const lvl =
          kind === "gather" ? truckGatherLevel : kind === "unload" ? truckUnloadLevel : truckTravelLevel;
        return Math.floor(base * Math.pow(1.6, lvl));
      }

      // =========================
      // UI UPDATES
      // =========================
      function updateUI() {
        const oreEl = document.getElementById("oreDisplay");
        const clickEl = document.getElementById("clickPowerDisplay");
        const dronesEl = document.getElementById("droneCountDisplay");
        const sectorEl = document.getElementById("sectorDisplay");

        const sector1Controls = document.getElementById("sector1Controls");
        const sector2Controls = document.getElementById("sector2Controls");

        const upClickEl = document.getElementById("upgradeClick");
        const buyDroneEl = document.getElementById("buyDrone");
        const upDmgEl = document.getElementById("upgradeDroneDamage");
        const upRateEl = document.getElementById("upgradeDroneFireRate");

        const goSector2Btn = document.getElementById("goSector2");

        const buyTruckSmallEl = document.getElementById("buyTruckSmall");
        const buyTruckMediumEl = document.getElementById("buyTruckMedium");
        const buyTruckLargeEl = document.getElementById("buyTruckLarge");

        const upTruckGatherEl = document.getElementById("upgradeTruckGather");
        const upTruckUnloadEl = document.getElementById("upgradeTruckUnload");
        const upTruckTravelEl = document.getElementById("upgradeTruckTravel");

        const truckCountsEl = document.getElementById("truckCountsDisplay");

        if (!oreEl) return;

        oreEl.textContent = Math.floor(ore);
        sectorEl.textContent = `${currentSector} (${SECTORS[currentSector].name})`;

        if (goSector2Btn) {
          goSector2Btn.textContent = unlockedSectors.includes(2)
            ? "Inner Belt"
            : "Unlock Inner Belt (5000 ore)";
        }

        if (sector1Controls) sector1Controls.style.display = currentSector === 1 ? "block" : "none";
        if (sector2Controls) sector2Controls.style.display = currentSector === 2 ? "block" : "none";

        // Sector 1 UI
        if (clickEl) clickEl.textContent = currentSector === 1 ? clickPower : "Disabled";
        if (dronesEl) dronesEl.textContent = drones;

        if (upClickEl) upClickEl.textContent = `Upgrade Click (${getClickUpgradeCost()} ore)`;
        if (buyDroneEl) buyDroneEl.textContent = `Buy Drone (${getDroneCost()} ore)`;
        if (upDmgEl) upDmgEl.textContent = `Upgrade Drone Damage (${getDroneDamageUpgradeCost()} ore)`;
        if (upRateEl) upRateEl.textContent = `Upgrade Drone Speed (${getDroneFireRateUpgradeCost()} ore)`;

        if (currentSector !== 1 && upClickEl) {
          upClickEl.disabled = true;
          upClickEl.textContent = "Manual Mining Offline";
        } else if (upClickEl) {
          upClickEl.disabled = false;
        }

        // Sector 2 UI
        if (buyTruckSmallEl) buyTruckSmallEl.textContent = `Buy Small Truck (${getTruckBuyCost("small")} ore)`;
        if (buyTruckMediumEl)
          buyTruckMediumEl.textContent = `Buy Medium Truck (${getTruckBuyCost("medium")} ore)`;
        if (buyTruckLargeEl) buyTruckLargeEl.textContent = `Buy Large Truck (${getTruckBuyCost("large")} ore)`;

        if (upTruckGatherEl)
          upTruckGatherEl.textContent = `Upgrade Gather (${getTruckUpgradeCost("gather")} ore) Lv ${truckGatherLevel}`;
        if (upTruckUnloadEl)
          upTruckUnloadEl.textContent = `Upgrade Unload (${getTruckUpgradeCost("unload")} ore) Lv ${truckUnloadLevel}`;
        if (upTruckTravelEl)
          upTruckTravelEl.textContent = `Upgrade Travel (${getTruckUpgradeCost("travel")} ore) Lv ${truckTravelLevel}`;

        if (truckCountsEl) {
          truckCountsEl.textContent = `Small: ${truckCounts.small || 0}  |  Medium: ${truckCounts.medium || 0
            }  |  Large: ${truckCounts.large || 0}`;
        }
      }

      // =========================
      // INPUT: SECTOR 1 CLICKING
      // =========================
      handleCanvasClick = (e) => {
        if (currentSector !== 1) return;

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

      // =========================
      // BUTTON WIRING
      // =========================
      const upgradeClickBtn = document.getElementById("upgradeClick");
      const buyDroneBtn = document.getElementById("buyDrone");
      const upgradeDroneDamageBtn = document.getElementById("upgradeDroneDamage");
      const upgradeDroneFireRateBtn = document.getElementById("upgradeDroneFireRate");

      const goSector1Btn = document.getElementById("goSector1");
      const goSector2Btn = document.getElementById("goSector2");

      const buyTruckSmallBtn = document.getElementById("buyTruckSmall");
      const buyTruckMediumBtn = document.getElementById("buyTruckMedium");
      const buyTruckLargeBtn = document.getElementById("buyTruckLarge");

      const upgradeTruckGatherBtn = document.getElementById("upgradeTruckGather");
      const upgradeTruckUnloadBtn = document.getElementById("upgradeTruckUnload");
      const upgradeTruckTravelBtn = document.getElementById("upgradeTruckTravel");

      // Sector 1 buttons
      handleUpgradeClick = () => {
        if (currentSector !== 1) return;

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
        if (currentSector !== 1) return;

        const cost = getDroneCost();
        if (ore >= cost) {
          ore -= cost;
          drones++;

          rebuildDroneUnits();
          updateUI();
          saveGame();
        }
      };

      handleUpgradeDroneDamage = () => {
        if (currentSector !== 1) return;

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
        if (currentSector !== 1) return;

        const cost = getDroneFireRateUpgradeCost();
        if (ore >= cost && droneFireRate > 200) {
          ore -= cost;
          droneFireRate -= 150;
          droneFireRateLevel++;
          updateUI();
          saveGame();
        }
      };

      upgradeClickBtn?.addEventListener("click", handleUpgradeClick);
      buyDroneBtn?.addEventListener("click", handleBuyDrone);
      upgradeDroneDamageBtn?.addEventListener("click", handleUpgradeDroneDamage);
      upgradeDroneFireRateBtn?.addEventListener("click", handleUpgradeDroneFireRate);

      handleGoSector1 = () => switchSector(1);

      handleGoSector2 = () => {
        if (unlockedSectors.includes(2)) {
          switchSector(2);
          return;
        }
        if (ore >= 5000) {
          ore -= 5000;
          unlockedSectors.push(2);
          switchSector(2);
          saveGame();
          updateUI();
        }
      };

      goSector1Btn?.addEventListener("click", handleGoSector1);
      goSector2Btn?.addEventListener("click", handleGoSector2);

      function buyTruck(typeId) {
        if (currentSector !== 2) return;

        const cost = getTruckBuyCost(typeId);
        if (ore < cost) return;

        ore -= cost;
        truckCounts[typeId] = (truckCounts[typeId] || 0) + 1;
        rebuildTrucksFromCounts();
        updateUI();
        saveGame();
      }

      handleBuyTruckSmall = () => buyTruck("small");
      handleBuyTruckMedium = () => buyTruck("medium");
      handleBuyTruckLarge = () => buyTruck("large");

      buyTruckSmallBtn?.addEventListener("click", handleBuyTruckSmall);
      buyTruckMediumBtn?.addEventListener("click", handleBuyTruckMedium);
      buyTruckLargeBtn?.addEventListener("click", handleBuyTruckLarge);

      function upgradeTruck(kind) {
        if (currentSector !== 2) return;

        const cost = getTruckUpgradeCost(kind);
        if (ore < cost) return;

        ore -= cost;
        if (kind === "gather") truckGatherLevel++;
        if (kind === "unload") truckUnloadLevel++;
        if (kind === "travel") truckTravelLevel++;

        updateUI();
        saveGame();
      }

      handleUpTruckGather = () => upgradeTruck("gather");
      handleUpTruckUnload = () => upgradeTruck("unload");
      handleUpTruckTravel = () => upgradeTruck("travel");

      upgradeTruckGatherBtn?.addEventListener("click", handleUpTruckGather);
      upgradeTruckUnloadBtn?.addEventListener("click", handleUpTruckUnload);
      upgradeTruckTravelBtn?.addEventListener("click", handleUpTruckTravel);

      // =========================
      // UPDATE LOOP (BOTH SECTORS)
      // =========================
      let lastFrameMs = performance.now();

      function updateSector1(dtMs) {
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
      }

      function updateSector2(dtMs) {
        for (let t of trucks) {
          const type = TRUCK_TYPES[t.typeId];

          if (t.state === "idleLeft") {
            t.timerMs -= dtMs;
            t.x = 0;
            if (t.timerMs <= 0) {
              t.state = "movingOut";
            }
          } else if (t.state === "movingOut") {
            t.x += getTruckTravelSpeed(t.typeId);
            if (t.x > canvas.width + type.drawW + 20) {
              t.state = "offscreenGather";
              t.timerMs = getTruckGatherMs(t.typeId);
            }
          } else if (t.state === "offscreenGather") {
            t.timerMs -= dtMs;
            if (t.timerMs <= 0) {
              t.state = "movingIn";
              t.x = canvas.width + type.drawW + 20;
            }
          } else if (t.state === "movingIn") {
            t.x -= getTruckTravelSpeed(t.typeId);
            if (t.x <= 0) {
              t.x = 0;
              t.state = "unloading";
              t.timerMs = getTruckUnloadMs(t.typeId);
            }
          } else if (t.state === "unloading") {
            t.timerMs -= dtMs;
            t.x = 0;
            if (t.timerMs <= 0) {
              ore += getTruckYield(t.typeId);
              t.state = "idleLeft";
              t.timerMs = 2000;
              updateUI();
            }
          }
        }
      }

      // =========================
      // DRAWING
      // =========================
      const station = {
        y: () => canvas.height,
        baseHeight: 30,
      };

      function drawSector1() {
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

        for (let p of explosions) {
          ctx.fillStyle = `rgba(255, 180, 100, ${p.life})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
          ctx.fill();
        }

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

      function drawSector2() {
        const baseY = canvas.height - 60;

        for (let i = 0; i < trucks.length; i++) {
          const t = trucks[i];
          const type = TRUCK_TYPES[t.typeId];

          const lane = i % 6;
          const y = baseY - lane * 22;

          ctx.fillStyle = t.typeId === "small" ? "#f1c40f" : t.typeId === "medium" ? "#e67e22" : "#c0392b";
          ctx.fillRect(t.x, y, type.drawW, type.drawH);

          ctx.fillStyle = "rgba(255,255,255,0.25)";
          ctx.fillRect(t.x + type.drawW - 10, y + 3, 7, type.drawH - 6);
        }

        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(0, baseY + 8, 120, 18);
      }

      function draw() {
        ctx.fillStyle = SECTORS[currentSector].background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "#444";
        ctx.fillRect(0, station.y() - station.baseHeight, canvas.width, station.baseHeight);

        ctx.strokeStyle = "#555";
        ctx.lineWidth = 1;
        for (let x = 0; x < canvas.width; x += 80) {
          ctx.beginPath();
          ctx.moveTo(x, station.y() - station.baseHeight);
          ctx.lineTo(x, station.y());
          ctx.stroke();
        }

        if (currentSector === 1) drawSector1();
        if (currentSector === 2) drawSector2();
      }

      function update() {
        if (cancelled) return;

        const now = performance.now();
        const dtMs = Math.min(50, now - lastFrameMs);
        lastFrameMs = now;

        if (currentSector === 1) updateSector1(dtMs);
        if (currentSector === 2) updateSector2(dtMs);

        draw();
        rafId = requestAnimationFrame(update);
      }

      // =========================
      // START EVERYTHING
      // =========================
      await loadGame();
      if (cancelled) return;

      updateUI();

      if (currentSector === 1) {
        startSpawning();
        droneAttack();
      } else {
        stopSectorLoops();
      }

      update();

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
      if (canvas && handleCanvasClick) canvas.removeEventListener("click", handleCanvasClick);

      const upgradeClickBtn = document.getElementById("upgradeClick");
      const buyDroneBtn = document.getElementById("buyDrone");
      const upgradeDroneDamageBtn = document.getElementById("upgradeDroneDamage");
      const upgradeDroneFireRateBtn = document.getElementById("upgradeDroneFireRate");

      if (upgradeClickBtn && handleUpgradeClick) upgradeClickBtn.removeEventListener("click", handleUpgradeClick);
      if (buyDroneBtn && handleBuyDrone) buyDroneBtn.removeEventListener("click", handleBuyDrone);
      if (upgradeDroneDamageBtn && handleUpgradeDroneDamage)
        upgradeDroneDamageBtn.removeEventListener("click", handleUpgradeDroneDamage);
      if (upgradeDroneFireRateBtn && handleUpgradeDroneFireRate)
        upgradeDroneFireRateBtn.removeEventListener("click", handleUpgradeDroneFireRate);

      const goSector1Btn = document.getElementById("goSector1");
      const goSector2Btn = document.getElementById("goSector2");
      if (goSector1Btn && handleGoSector1) goSector1Btn.removeEventListener("click", handleGoSector1);
      if (goSector2Btn && handleGoSector2) goSector2Btn.removeEventListener("click", handleGoSector2);

      const buyTruckSmallBtn = document.getElementById("buyTruckSmall");
      const buyTruckMediumBtn = document.getElementById("buyTruckMedium");
      const buyTruckLargeBtn = document.getElementById("buyTruckLarge");

      if (buyTruckSmallBtn && handleBuyTruckSmall) buyTruckSmallBtn.removeEventListener("click", handleBuyTruckSmall);
      if (buyTruckMediumBtn && handleBuyTruckMedium)
        buyTruckMediumBtn.removeEventListener("click", handleBuyTruckMedium);
      if (buyTruckLargeBtn && handleBuyTruckLarge) buyTruckLargeBtn.removeEventListener("click", handleBuyTruckLarge);

      const upgradeTruckGatherBtn = document.getElementById("upgradeTruckGather");
      const upgradeTruckUnloadBtn = document.getElementById("upgradeTruckUnload");
      const upgradeTruckTravelBtn = document.getElementById("upgradeTruckTravel");

      if (upgradeTruckGatherBtn && handleUpTruckGather)
        upgradeTruckGatherBtn.removeEventListener("click", handleUpTruckGather);
      if (upgradeTruckUnloadBtn && handleUpTruckUnload)
        upgradeTruckUnloadBtn.removeEventListener("click", handleUpTruckUnload);
      if (upgradeTruckTravelBtn && handleUpTruckTravel)
        upgradeTruckTravelBtn.removeEventListener("click", handleUpTruckTravel);
    };
  }, [router]);

  return (
    <div style={{ display: "flex" }}>
      <div
        style={{
          width: "250px",
          background: "#111",
          color: "white",
          padding: "20px",
        }}
      >
        <h1>Stellar Extractor</h1>

        <p>
          Ore: <span id="oreDisplay">0</span>
        </p>

        {/* Sector 1 Controls */}
        <div id="sector1Controls">
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
        </div>

        {/* Sector 2 Controls */}
        <div id="sector2Controls" style={{ display: "none" }}>
          <h3>Space Trucks</h3>

          <button id="buyTruckSmall">Buy Small Truck (500 ore)</button>
          <button id="buyTruckMedium">Buy Medium Truck (2000 ore)</button>
          <button id="buyTruckLarge">Buy Large Truck (10000 ore)</button>

          <p id="truckCountsDisplay">Small: 0 | Medium: 0 | Large: 0</p>

          <h4>Truck Upgrades</h4>
          <button id="upgradeTruckGather">Upgrade Gather</button>
          <button id="upgradeTruckUnload">Upgrade Unload</button>
          <button id="upgradeTruckTravel">Upgrade Travel</button>
        </div>

        <hr style={{ margin: "16px 0", opacity: 0.3 }} />

        <h3>Sectors</h3>
        <button id="goSector1">Outer Belt</button>
        <button id="goSector2">Unlock Inner Belt (5000 ore)</button>

        <p>
          Current Sector: <span id="sectorDisplay">1</span>
        </p>

        <hr style={{ margin: "16px 0", opacity: 0.3 }} />

        <button
          onClick={async () => {
            await signOut(auth);
            router.replace("/login");
          }}
          style={{
            width: "100%",
            padding: "8px",
            background: "#c0392b",
            color: "white",
            border: "none",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          Logout
        </button>
      </div>

      <canvas ref={canvasRef} id="gameCanvas" style={{ background: "black" }} />
    </div>
  );
}