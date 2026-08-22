# build-scraper.ps1
# Compila el binario del Google Maps Scraper para uso local

$ErrorActionPreference = "Stop"

$scraperDir = Join-Path $PSScriptRoot ".." "integrations" "google-maps-scraper"

Write-Host "Compilando Google Maps Scraper..." -ForegroundColor Cyan

if (-not (Test-Path $scraperDir)) {
    Write-Error "No se encontro el directorio del scraper en: $scraperDir"
    exit 1
}

# Verificar que Go esta instalado
try {
    $goVersion = go version 2>$null
    Write-Host "Go encontrado: $goVersion" -ForegroundColor Green
} catch {
    Write-Error "Go no esta instalado. Instala Go desde https://go.dev/dl/"
    exit 1
}

# Compilar
Push-Location $scraperDir
try {
    Write-Host "Compilando..." -ForegroundColor Yellow
    go build -ldflags="-w -s" -o "google-maps-scraper.exe" .
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Error al compilar el scraper"
        exit 1
    }
    
    Write-Host "Scraper compilado exitosamente!" -ForegroundColor Green
    Write-Host "Binario: $scraperDir\google-maps-scraper.exe" -ForegroundColor Cyan
} finally {
    Pop-Location
}
