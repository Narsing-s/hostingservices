import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile, readFile, access, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export type BuildRequest = { repo: string; ref?: string; image: string; deploymentId?: string };
const buildLogs = new Map<string, string>();
const maxLogSize = 2_000_000;

function appendLog(deploymentId: string | undefined, text: string) {
  if (!deploymentId) return;
  const current = buildLogs.get(deploymentId) ?? '';
  buildLogs.set(deploymentId, (current + text).slice(-maxLogSize));
}
export function getBuildLogs(deploymentId: string) { return buildLogs.get(deploymentId) ?? ''; }
export function clearBuildLogs(deploymentId: string) { buildLogs.delete(deploymentId); }

async function run(command: string, args: string[], options: { timeout: number; deploymentId?: string }) {
  return await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let settled = false;
    const finish = (error?: Error) => { if (settled) return; settled = true; clearTimeout(timer); error ? reject(error) : resolve(); };
    const timer = setTimeout(() => { child.kill(); finish(new Error(`${command} timed out after ${options.timeout}ms`)); }, options.timeout);
    child.stdout.on('data', (chunk) => appendLog(options.deploymentId, chunk.toString()));
    child.stderr.on('data', (chunk) => appendLog(options.deploymentId, chunk.toString()));
    child.on('error', (error) => finish(error));
    child.on('close', (code) => code === 0 ? finish() : finish(new Error(`${command} exited with code ${code}`)));
  });
}

async function exists(file: string) { try { await access(file); return true; } catch { return false; } }
async function packageJson(dir: string): Promise<any | undefined> { try { return JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8')); } catch { return undefined; } }

function nodeDockerfile(pkg: any, outputDir?: 'dist' | 'build') {
  const manager = pkg?.packageManager?.startsWith('pnpm') ? 'pnpm' : pkg?.packageManager?.startsWith('yarn') ? 'yarn' : 'npm';
  const install = manager === 'pnpm' ? 'corepack enable && pnpm install --frozen-lockfile' : manager === 'yarn' ? 'corepack enable && yarn install --frozen-lockfile' : 'npm ci --omit=dev || npm install --omit=dev';
  const build = manager === 'pnpm' ? 'pnpm run build' : manager === 'yarn' ? 'yarn build' : 'npm run build';
  if (outputDir) return `FROM node:22-bookworm-slim AS build\nWORKDIR /app\nCOPY package*.json ./\nCOPY pnpm-lock.yaml* yarn.lock* package-lock.json* ./\nRUN ${install}\nCOPY . .\nRUN ${build}\nFROM nginx:1.27-alpine\nCOPY --from=build /app/${outputDir} /usr/share/nginx/html\nEXPOSE 80\nCMD ["nginx", "-g", "daemon off;"]\n`;
  const start = pkg?.scripts?.start ? (manager === 'pnpm' ? 'pnpm start' : manager === 'yarn' ? 'yarn start' : 'npm start') : 'node server.js';
  return `FROM node:22-bookworm-slim\nWORKDIR /app\nCOPY package*.json ./\nCOPY pnpm-lock.yaml* yarn.lock* package-lock.json* ./\nRUN ${install}\nCOPY . .\n${pkg?.scripts?.build ? `RUN ${build}\n` : ''}ENV NODE_ENV=production\nENV PORT=3000\nEXPOSE 3000\nCMD ["sh", "-c", "${start}"]\n`;
}

async function detectDockerfile(dir: string) {
  if (await exists(path.join(dir, 'Dockerfile'))) return { generated: false, kind: 'dockerfile' };
  const pkg = await packageJson(dir);
  if (pkg) {
    const scripts = pkg.scripts ?? {};
    const vite = await exists(path.join(dir, 'vite.config.ts')) || await exists(path.join(dir, 'vite.config.js'));
    const astro = await exists(path.join(dir, 'astro.config.mjs'));
    const angular = await exists(path.join(dir, 'angular.json'));
    const staticSite = vite || astro || angular || (!scripts.start && Boolean(scripts.build));
    const outputDir = angular ? 'dist' : vite || astro ? 'dist' : 'build';
    await writeFile(path.join(dir, 'Dockerfile'), nodeDockerfile(pkg, staticSite ? outputDir : undefined));
    return { generated: true, kind: staticSite ? 'node-static' : 'node' };
  }
  if (await exists(path.join(dir, 'requirements.txt')) || await exists(path.join(dir, 'pyproject.toml'))) {
    const hasManage = await exists(path.join(dir, 'manage.py'));
    const pythonCmd = hasManage ? 'gunicorn ${DJANGO_WSGI_MODULE:-app.wsgi}:application --bind 0.0.0.0:8000' : 'gunicorn ${PYTHON_APP_MODULE:-app}:app --bind 0.0.0.0:8000';
    await writeFile(path.join(dir, 'Dockerfile'), `FROM python:3.12-slim\nWORKDIR /app\nCOPY requirements.txt* pyproject.toml* poetry.lock* ./\nRUN pip install --no-cache-dir --upgrade pip && if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; else pip install --no-cache-dir .; fi && pip install --no-cache-dir gunicorn\nCOPY . .\nENV PORT=8000\nEXPOSE 8000\nCMD ["sh", "-c", "${pythonCmd}"]\n`);
    return { generated: true, kind: 'python' };
  }
  if (await exists(path.join(dir, 'go.mod'))) {
    await writeFile(path.join(dir, 'Dockerfile'), `FROM golang:1.24-alpine AS build\nWORKDIR /src\nCOPY go.mod go.sum* ./\nRUN go mod download\nCOPY . .\nRUN CGO_ENABLED=0 go build -o /out/app .\nFROM alpine:3.22\nRUN adduser -D app\nUSER app\nCOPY --from=build /out/app /app\nENV PORT=8080\nEXPOSE 8080\nCMD ["/app"]\n`); return { generated: true, kind: 'go' };
  }
  if (await exists(path.join(dir, 'pom.xml'))) {
    await writeFile(path.join(dir, 'Dockerfile'), `FROM maven:3.9-eclipse-temurin-21 AS build\nWORKDIR /src\nCOPY pom.xml .\nRUN mvn -B -DskipTests dependency:go-offline\nCOPY . .\nRUN mvn -B -DskipTests package\nFROM eclipse-temurin:21-jre\nWORKDIR /app\nCOPY --from=build /src/target/*.jar /app/app.jar\nENV PORT=8080\nEXPOSE 8080\nCMD ["java", "-jar", "/app/app.jar"]\n`); return { generated: true, kind: 'java-maven' };
  }
  if (await exists(path.join(dir, 'build.gradle')) || await exists(path.join(dir, 'build.gradle.kts'))) {
    await writeFile(path.join(dir, 'Dockerfile'), `FROM gradle:8-jdk21 AS build\nWORKDIR /src\nCOPY . .\nRUN gradle build -x test --no-daemon\nFROM eclipse-temurin:21-jre\nWORKDIR /app\nCOPY --from=build /src/build/libs/*.jar /app/app.jar\nENV PORT=8080\nEXPOSE 8080\nCMD ["java", "-jar", "/app/app.jar"]\n`); return { generated: true, kind: 'java-gradle' };
  }
  if (await exists(path.join(dir, 'Cargo.toml'))) {
    await writeFile(path.join(dir, 'Dockerfile'), `FROM rust:1.89-alpine AS build\nRUN apk add --no-cache musl-dev\nWORKDIR /src\nCOPY . .\nRUN cargo build --release\nFROM alpine:3.22\nWORKDIR /app\nCOPY --from=build /src/target/release/ /app/\nENV PORT=8080\nEXPOSE 8080\nCMD ["sh", "-c", "\${RUST_BINARY:-app}"]\n`); return { generated: true, kind: 'rust' };
  }
  const entries = await readdir(dir);
  const csproj = entries.find((entry) => entry.endsWith('.csproj'));
  if (csproj) {
    await writeFile(path.join(dir, 'Dockerfile'), `FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build\nWORKDIR /src\nCOPY . .\nRUN dotnet publish ${csproj} -c Release -o /out\nFROM mcr.microsoft.com/dotnet/aspnet:9.0\nWORKDIR /app\nCOPY --from=build /out .\nENV ASPNETCORE_URLS=http://+:8080\nEXPOSE 8080\nENTRYPOINT ["dotnet", "${csproj.replace(/\.csproj$/i, '.dll')}"]\n`); return { generated: true, kind: 'dotnet' };
  }
  if (await exists(path.join(dir, 'composer.json'))) {
    await writeFile(path.join(dir, 'Dockerfile'), `FROM composer:2 AS deps\nWORKDIR /app\nCOPY composer.* ./\nRUN composer install --no-dev --prefer-dist --no-interaction --no-progress\nFROM php:8.3-apache\nWORKDIR /var/www/html\nCOPY --from=deps /app/vendor ./vendor\nCOPY . .\nRUN a2enmod rewrite\nEXPOSE 80\n`); return { generated: true, kind: 'php' };
  }
  if (await exists(path.join(dir, 'Gemfile'))) {
    await writeFile(path.join(dir, 'Dockerfile'), `FROM ruby:3.4-slim\nWORKDIR /app\nCOPY Gemfile Gemfile.lock* ./\nRUN bundle install\nCOPY . .\nENV PORT=3000\nEXPOSE 3000\nCMD ["sh", "-c", "\${RUBY_START_COMMAND:-bundle exec rails server -b 0.0.0.0 -p 3000}"]\n`); return { generated: true, kind: 'ruby' };
  }
  throw new Error('No supported application detected. Add a Dockerfile or use a supported Node.js, Python, Go, Java, Rust, .NET, PHP or Ruby project.');
}

export async function buildFromGit(request: BuildRequest) {
  const dir = await mkdtemp(path.join(tmpdir(), 'nexus-build-'));
  clearBuildLogs(request.deploymentId ?? '');
  appendLog(request.deploymentId, `$ nexus build ${request.repo} @ ${request.ref ?? 'default'}\n`);
  try {
    const cloneArgs = ['clone', '--depth', '1']; if (request.ref) cloneArgs.push('--branch', request.ref); cloneArgs.push(request.repo, dir);
    appendLog(request.deploymentId, '$ git clone ' + request.repo + '\n');
    await run('git', cloneArgs, { timeout: 120000, deploymentId: request.deploymentId });
    appendLog(request.deploymentId, '\n✓ Source downloaded\n');
    const detected = await detectDockerfile(dir);
    appendLog(request.deploymentId, `✓ Runtime detected: ${detected.kind}${detected.generated ? ' (Dockerfile generated)' : ''}\n\n$ docker build --pull -t ${request.image} .\n`);
    await run('docker', ['build', '--pull', '-t', request.image, dir], { timeout: 900000, deploymentId: request.deploymentId });
    appendLog(request.deploymentId, `\n✓ Build completed: ${request.image}\n`);
    return { image: request.image, repository: request.repo, ref: request.ref ?? 'default', status: 'built', runtime: detected.kind, dockerfileGenerated: detected.generated };
  } catch (error) {
    appendLog(request.deploymentId, `\n✗ BUILD FAILED: ${error instanceof Error ? error.message : String(error)}\n`);
    throw error;
  } finally { await rm(dir, { recursive: true, force: true }); }
}
