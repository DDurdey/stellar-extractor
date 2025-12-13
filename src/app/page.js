"use client";

import { useEffect, useRef } from "react";

export default function Home() {
  const canvasRef = useRef(null);

  useEffect(() => {
    // ===== CANVAS SETUP =====
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    function resizeCanvas() {
      canvas.width = window.innerWidth - 250;
      canvas.height = window.innerHeight;
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // ===== GAME STATE =====
    let ore = 0;
    let clickPower = 1;
    let drones = 0;
    let droneDamage = 1;

    let asteroids = [];
    let lasers = [];

    // ===== ASTEROID CREATION =====
    function spawnAsteroid() {
      const size = Math.random() * 25 + 20;

      const asteroid = {
        x: Math.random() * canvas.width,
        y: -size,
        size: size,
        hp: Math.floor(size * 1.5),
        maxHp: Math.floor(size * 1.5),
        speed: 0.8 + Math.random() * 1.2,
        reward: Math.floor(size * 0.5)
      };

      asteroids.push(asteroid);
    }

    function startSpawning() {
      spawnAsteroid();
      const nextSpawn = 700 + Math.random() * 1500;
      setTimeout(startSpawning, nextSpawn);
    }

    startSpawning();

    // ===== DRONE MINING =====

    function getClosestAsteroid() {
      if (asteroids.length === 0) return null;
      return asteroids.reduce((closest, a) =>
        a.y > closest.y ? a : closest
      );
    }

    function droneAttack() {
      if (drones > 0) {
        const target = getClosestAsteroid();

        if (target) {
          // LASER EFFECT
          lasers.push({
            x1: canvas.width / 2,
            y1: canvas.height - 50,
            x2: target.x,
            y2: target.y,
            alpha: 1
          });

          // DAMAGE
          target.hp -= droneDamage * drones;

          if (target.hp <= 0) {
            ore += target.reward;
            asteroids = asteroids.filter(a => a !== target);
          }

          updateUI();
        }
      }

      setTimeout(droneAttack, 1000);
    }

    droneAttack();

    // ===== GAME LOOP =====
    function update() {
      for (let a of asteroids) {
        a.y += a.speed;
      }

      asteroids = asteroids.filter(a => a.y < canvas.height + 50);

      draw();
      requestAnimationFrame(update);
    }

    // ===== DRAWING =====
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // ASTEROIDS
      for (let a of asteroids) {
        ctx.fillStyle = "gray";
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.size, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "white";
        ctx.font = "16px Arial";
        ctx.fillText(Math.floor(a.hp), a.x - 10, a.y + 5);
      }

      // LASERS
      for (let l of lasers) {
        ctx.strokeStyle = `rgba(0, 255, 255, ${l.alpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(l.x1, l.y1);
        ctx.lineTo(l.x2, l.y2);
        ctx.stroke();

        l.alpha -= 0.05;
      }

      lasers = lasers.filter(l => l.alpha > 0);
    }

    update();

    // ===== CLICKING =====
    canvas.addEventListener("click", (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      for (let a of asteroids) {
        const dx = mx - a.x;
        const dy = my - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < a.size) {
          a.hp -= clickPower;
          ore += 1;

          if (a.hp <= 0) {
            ore += a.reward;
            asteroids = asteroids.filter(x => x !== a);
          }

          updateUI();
          return;
        }
      }
    });

    // ===== UI UPDATES =====
    function updateUI() {
      document.getElementById("oreDisplay").textContent = ore;
      document.getElementById("clickPowerDisplay").textContent = clickPower;
      document.getElementById("droneCountDisplay").textContent = drones;
    }

    document.getElementById("upgradeClick").addEventListener("click", () => {
      if (ore >= 20) {
        ore -= 20;
        clickPower++;
        updateUI();
      }
    });

    document.getElementById("buyDrone").addEventListener("click", () => {
      if (ore >= 50) {
        ore -= 50;
        drones++;
        updateUI();
      }
    });

  }, []);

  return (
    <div style={{ display: "flex" }}>
      <div style={{
        width: "250px",
        background: "#111",
        color: "white",
        padding: "20px"
      }}>
        <h1>Stellar Extractor</h1>

        <p>Ore: <span id="oreDisplay">0</span></p>

        <button id="upgradeClick">Upgrade Click Power</button>
        <button id="buyDrone">Buy Drone</button>

        <p>Click Power: <span id="clickPowerDisplay">1</span></p>
        <p>Drones: <span id="droneCountDisplay">0</span></p>
      </div>

      <canvas
        ref={canvasRef}
        id="gameCanvas"
        style={{ background: "black" }}
      />
    </div>
  );
}