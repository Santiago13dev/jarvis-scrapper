# test-scraper.ps1
# Prueba basica del Google Maps Scraper

$ErrorActionPreference = "Stop"

$projectRoot = Join-Path $PSScriptRoot ".."
$scraperBinary = Join-Path $projectRoot "integrations" "google-maps-scraper" "google-maps-scraper.exe"
$resultsDir = Join-Path $projectRoot "integrations" "google-maps-scraper" "results"
$queryFile = Join-Path $resultsDir "test-query.txt"
$outputFile = Join-Path $resultsDir "test-results.csv"

Write-Host "=== Prueba del Google Maps Scraper ===" -ForegroundColor Cyan

# Verificar que el binario existe
if (-not (Test-Path $scraperBinary)) {
    Write-Host "El binario del scraper no existe. Ejecuta primero:" -ForegroundColor Yellow
    Write-Host "  .\scripts\build-scraper.ps1" -ForegroundColor White
    exit 1
}

Write-Host "Binario encontrado: $scraperBinary" -ForegroundColor Green

# Crear directorio de resultados
if (-not (Test-Path $resultsDir)) {
    New-Item -ItemType Directory -Path $resultsDir -Force | Out-Null
}

# Crear archivo de prueba
Write-Host "Creando archivo de consulta de prueba..." -ForegroundColor Yellow
Set-Content -Path $queryFile -Value "restaurantes Santiago Chile" -Encoding UTF8

# Ejecutar scraper
Write-Host "Ejecutando scraper..." -ForegroundColor Yellow
Write-Host "Esto puede tardar varios minutos..." -ForegroundColor Gray

$env:DISABLE_TELEMETRY = "1"

& $scraperBinary `
    -input $queryFile `
    -results $outputFile `
    -depth 1 `
    -lang es `
    -c 1

if ($LASTEXITCODE -ne 0) {
    Write-Error "El scraper fallo con codigo de salida: $LASTEXITCODE"
    exit 1
}

# Verificar resultados
if (Test-Path $outputFile) {
    $content = Get-Content $outputFile -Raw
    $lines = ($content -split "`n").Count - 1
    
    Write-Host "=== Resultados ===" -ForegroundColor Green
    Write-Host "Archivo de salida: $outputFile" -ForegroundColor Cyan
    Write-Host "Numero de resultados: $lines" -ForegroundColor Cyan
    
    if ($lines -gt 1) {
        Write-Host "Primeras 5 lineas:" -ForegroundColor Yellow
        Get-Content $outputFile | Select-Object -First 6 | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
    } else {
        Write-Host "No se encontraron resultados" -ForegroundColor Yellow
    }
} else {
    Write-Error "No se genero el archivo de resultados"
    exit 1
}

Write-Host "=== Prueba completada ===" -ForegroundColor Green
