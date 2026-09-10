$ErrorActionPreference = "SilentlyContinue"

Write-Host "=================================================="
Write-Host "DEVELOPMENT SERVER ROUTE COMPILATION BENCHMARK"
Write-Host "=================================================="

$routes = @(
    @{ Name = "Root / Home"; Url = "http://localhost:3000/" },
    @{ Name = "Products Catalog /products"; Url = "http://localhost:3000/products" },
    @{ Name = "Product PDP /products/classic-chocolate-truffle-cake"; Url = "http://localhost:3000/products/classic-chocolate-truffle-cake" },
    @{ Name = "Dashboard /dashboard"; Url = "http://localhost:3000/dashboard" },
    @{ Name = "Shop / PIM /dashboard/shop"; Url = "http://localhost:3000/dashboard/shop" },
    @{ Name = "Menu Manager /dashboard/shop/menu"; Url = "http://localhost:3000/dashboard/shop/menu" },
    @{ Name = "Checkout /checkout"; Url = "http://localhost:3000/checkout" },
    @{ Name = "API Products /api/v1/products"; Url = "http://localhost:3000/api/v1/products" }
)

$results = @()

foreach ($r in $routes) {
    Write-Host "Fetching $($r.Name) ($($r.Url))..."
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $resp = Invoke-WebRequest -Uri $r.Url -UseBasicParsing -TimeoutSec 120
        $sw.Stop()
        $statusCode = $resp.StatusCode
        $durationMs = $sw.ElapsedMilliseconds
        Write-Host "  -> Status: $statusCode | Time: $($sw.Elapsed.TotalSeconds.ToString('F2'))s ($durationMs ms)"
        $results += [PSCustomObject]@{
            Name = $r.Name
            Url = $r.Url
            Status = $statusCode
            DurationSec = $sw.Elapsed.TotalSeconds
            DurationMs = $durationMs
        }
    } catch {
        $sw.Stop()
        Write-Host "  -> ERROR: $_ | Time: $($sw.Elapsed.TotalSeconds.ToString('F2'))s"
        $results += [PSCustomObject]@{
            Name = $r.Name
            Url = $r.Url
            Status = "ERR"
            DurationSec = $sw.Elapsed.TotalSeconds
            DurationMs = $sw.ElapsedMilliseconds
        }
    }
}

Write-Host "`n=================================================="
Write-Host "DEV ROUTE TIMING SUMMARY"
Write-Host "=================================================="
foreach ($res in $results) {
    Write-Host ("{0,-45} : {1,8} ms ({2,5:F2}s) [Status: {3}]" -f $res.Name, $res.DurationMs, $res.DurationSec, $res.Status)
}
