# CrowdPulse - setup otomatis Tahap 2 (Windows PowerShell)
# Jalankan dari folder root:  powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function New-Secret {
  $b = New-Object byte[] 48
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  return (($b | ForEach-Object { $_.ToString('x2') }) -join '')
}
function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Check($what) { if ($LASTEXITCODE -ne 0) { throw "Gagal: $what (exit code $LASTEXITCODE)" } }

Step 'Cek prasyarat'
foreach ($cmd in @('node', 'npm', 'docker')) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { throw "'$cmd' belum terpasang atau tidak ada di PATH." }
}
node -v

Step 'Menyiapkan .env root'
if (-not (Test-Path '.env')) { Copy-Item '.env.example' '.env' }

Step 'Menjalankan PostgreSQL (Docker)'
docker compose up -d
Check 'docker compose up'
$status = ''
for ($i = 0; $i -lt 30; $i++) {
  $status = (docker inspect --format '{{.State.Health.Status}}' crowdpulse-db 2>$null)
  if ($status -eq 'healthy') { break }
  Start-Sleep -Seconds 2
}
if ($status -ne 'healthy') { throw 'Container database tidak healthy. Cek: docker compose logs db' }

# Pastikan database test ada (init script hanya jalan pada volume baru). Error diabaikan jika sudah ada.
cmd /c "docker exec crowdpulse-db psql -U crowdpulse -d crowdpulse -c ""CREATE DATABASE crowdpulse_test;"" >nul 2>&1"

Step 'Menyiapkan .env backend'
$backend = Join-Path $root 'apps\backend'
Set-Location $backend
if (-not (Test-Path '.env')) {
  $content = Get-Content '.env.example' -Raw
  $content = $content -replace 'JWT_SECRET=CHANGE_ME\S*', ('JWT_SECRET=' + (New-Secret))
  $content = $content -replace 'QR_SECRET=CHANGE_ME\S*', ('QR_SECRET=' + (New-Secret))
  [System.IO.File]::WriteAllText((Join-Path $backend '.env'), $content)
  Write-Host '.env dibuat dengan secret acak.'
}
if (-not (Test-Path '.env.test')) { Copy-Item '.env.test.example' '.env.test' }

Step 'Instal dependensi backend (npm install)'
npm install
Check 'npm install'

Step 'Prisma generate, migrate, seed'
npx prisma generate
Check 'prisma generate'
npx prisma migrate deploy
Check 'prisma migrate deploy'
npx prisma db seed
Check 'prisma db seed'
npm run test:db:migrate
Check 'migrate database test'

Step 'Selesai'
Write-Host 'Langkah berikut (di apps\backend):  npm run build ; npm test ; npm run test:e2e ; npm run start:dev' -ForegroundColor Green
