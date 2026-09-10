$ErrorActionPreference = "SilentlyContinue"

Write-Host "=================================================="
Write-Host "ROUTE, DB, CLIENT COMPONENT & BUNDLE AUDIT"
Write-Host "=================================================="

$appDir = "src/app"
$files = Get-ChildItem -Path $appDir -Recurse -File | Where-Object { $_.Extension -match "\.(tsx|ts|js|jsx)$" }

$routes = @()

foreach ($f in $files) {
    $relPath = $f.FullName.Substring((Get-Location).Path.Length + 1).Replace("\", "/")
    $content = [System.IO.File]::ReadAllText($f.FullName)
    
    $type = "page"
    if ($f.Name -like "layout*") { $type = "layout" }
    elseif ($f.Name -like "route*") { $type = "route_handler" }
    elseif ($f.Name -like "sitemap*") { $type = "sitemap" }
    elseif ($f.Name -like "robots*") { $type = "robots" }
    elseif ($f.Name -like "loading*") { $type = "loading" }
    elseif ($f.Name -like "error*") { $type = "error" }
    elseif ($f.Name -like "not-found*") { $type = "not_found" }

    $isClient = ($content.Substring(0, [math]::Min(150, $content.Length)) -match "use client")
    $hasStaticParams = ($content -match "generateStaticParams")
    $hasMetadata = ($content -match "generateMetadata")
    $hasForceDynamic = ($content -match "force-dynamic")
    $hasRevalidate = ($content -match "revalidate")
    $importsDb = ($content -match "dbQuery|/db|repositories/")
    $importsApiEngine = ($content -match "ApiEngine|api-engine")

    $heavyDeps = @("exceljs", "leaflet", "react-leaflet", "lucide-react", "@medusajs/ui", "sharp", "jose", "@dotlottie/react-player", "framer-motion", "three")
    $matchedHeavy = @()
    foreach ($d in $heavyDeps) {
        if ($content -match "from ['`"]$d['`"]") {
            $matchedHeavy += $d
        }
    }

    $routes += [PSCustomObject]@{
        FilePath = $relPath
        Name = $f.Name
        Type = $type
        IsClient = $isClient
        HasStaticParams = $hasStaticParams
        HasMetadata = $hasMetadata
        HasForceDynamic = $hasForceDynamic
        HasRevalidate = $hasRevalidate
        ImportsDb = $importsDb
        ImportsApiEngine = $importsApiEngine
        HeavyImports = ($matchedHeavy -join ", ")
    }
}

$pages = $routes | Where-Object { $_.Type -eq "page" }
$apiRoutes = $routes | Where-Object { $_.Type -eq "route_handler" }
$layouts = $routes | Where-Object { $_.Type -eq "layout" }
$sitemaps = $routes | Where-Object { $_.Type -eq "sitemap" -or $_.Type -eq "robots" }

Write-Host "`n--- 1. Route Breakdown ---"
Write-Host "Total App Files Scanned: $($routes.Count)"
Write-Host "Page Routes (page.tsx):  $($pages.Count)"
Write-Host "API Route Handlers:      $($apiRoutes.Count)"
Write-Host "Layouts:                 $($layouts.Count)"
Write-Host "Sitemaps & Robots:       $($sitemaps.Count)"

Write-Host "`n--- 2. Build-Time Database / API Engine Access in Routes ---"
$dbRoutes = $routes | Where-Object { $_.ImportsDb -or $_.ImportsApiEngine }
Write-Host "Routes importing DB or ApiEngine: $($dbRoutes.Count)"
foreach ($r in $dbRoutes) {
    Write-Host "  - [$($r.Type)] $($r.FilePath) -> DB: $($r.ImportsDb), ApiEngine: $($r.ImportsApiEngine)"
}

Write-Host "`n--- 3. Static vs Dynamic Route Markers ---"
$forceDyn = $routes | Where-Object { $_.HasForceDynamic }
$statParams = $routes | Where-Object { $_.HasStaticParams }
$reval = $routes | Where-Object { $_.HasRevalidate }
Write-Host "Routes with 'force-dynamic':       $($forceDyn.Count)"
foreach ($r in $forceDyn) { Write-Host "  - $($r.FilePath)" }
Write-Host "Routes with 'generateStaticParams': $($statParams.Count)"
foreach ($r in $statParams) { Write-Host "  - $($r.FilePath)" }
Write-Host "Routes with 'revalidate':          $($reval.Count)"
foreach ($r in $reval) { Write-Host "  - $($r.FilePath)" }

Write-Host "`n--- 4. Client Component ('use client') Analysis ---"
$allSrcFiles = Get-ChildItem -Path "src" -Recurse -File | Where-Object { $_.Extension -match "\.(tsx|ts|jsx|js)$" }
$useClientFiles = @()
foreach ($f in $allSrcFiles) {
    $c = [System.IO.File]::ReadAllText($f.FullName)
    if ($c.Substring(0, [math]::Min(150, $c.Length)) -match "use client") {
        $useClientFiles += $f.FullName.Substring((Get-Location).Path.Length + 1).Replace("\", "/")
    }
}
Write-Host "Total 'use client' files across entire src: $($useClientFiles.Count) out of $($allSrcFiles.Count) total TS/TSX files ($([math]::Round(($useClientFiles.Count / $allSrcFiles.Count) * 100, 1))%)"

Write-Host "`n--- 5. Heavy Library Client Imports ---"
$heavyClient = $routes | Where-Object { $_.IsClient -and $_.HeavyImports.Length -gt 0 }
Write-Host "Client route files importing heavy dependencies: $($heavyClient.Count)"
foreach ($r in $heavyClient) {
    Write-Host "  - $($r.FilePath) imports [$($r.HeavyImports)]"
}

Write-Host "`n--- 6. Largest Client Chunks (.next/static) ---"
if (Test-Path ".next/static") {
    $chunks = Get-ChildItem -Path ".next/static" -Recurse -File | Where-Object { $_.Extension -eq ".js" } | Sort-Object Length -Descending
    Write-Host "Top 15 Largest Client Chunks:"
    $i = 1
    foreach ($c in ($chunks | Select-Object -First 15)) {
        $rel = $c.FullName.Substring((Get-Location).Path.Length + 1).Replace("\", "/")
        $sizeKB = [math]::Round($c.Length / 1KB, 1)
        Write-Host "  $i. $rel : $sizeKB KB ($($c.Length.ToString('N0')) bytes)"
        $i++
    }
}
