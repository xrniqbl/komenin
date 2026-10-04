// scripts/pack-deploy.mjs
// Membuat arsip siap-upload ke VPS (tanpa node_modules, .next, .env, arsip lama).
// Image Docker dibangun di VPS. Memakai `tar` (tersedia di Windows 10+ & Linux)
// agar path di dalam arsip benar saat diekstrak di Linux.
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";

const OUT = "komenin-upload.tar.gz";

const include = [
  "Dockerfile",
  "docker-compose.yml",
  ".dockerignore",
  ".env.docker.example",
  "deploy",
  "prisma",
  "scripts",
  "src",
  "public",
  "package.json",
  "package-lock.json",
  "next.config.mjs",
  "tsconfig.json",
  "postcss.config.mjs",
  "components.json",
  "eslint.config.mjs",
  "vitest.config.ts",
  "vitest.setup.ts",
  "README.md",
];

const present = include.filter((p) => existsSync(p));

if (existsSync(OUT)) rmSync(OUT);

// tar menyimpan path dengan forward-slash -> aman diekstrak di VPS Linux.
execSync(`tar -czf ${OUT} ${present.map((p) => `"${p}"`).join(" ")}`, {
  stdio: "inherit",
});

console.log(`\n[OK] ${OUT} dibuat. Isi: ${present.join(", ")}`);
console.log("Upload ke VPS, lalu: tar -xzf " + OUT);
console.log("Selanjutnya ikuti deploy/README-DEPLOY.md");