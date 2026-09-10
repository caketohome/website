$ErrorActionPreference = "SilentlyContinue"

Write-Host "=================================================="
Write-Host "NEXT.JS DEVELOPMENT COMPILATION & HOT RELOAD BENCHMARK"
Write-Host "=================================================="

$env:PATH = "C:\Program Files\nodejs;" + $env:PATH

$port = 3005
$baseUrl = "http://localhost:$port"
$nextCmd = (Join-Path (Get-Location).Path "node_modules\.bin\next.cmd")

Write-Host "Using Next CLI: $nextCmd"
Write-Host "Starting Next.js Dev Server on port $port..."

$procInfo = New-Object System.Diagnostics.ProcessStartInfo
$procInfo.FileName = "cmd.exe"
$procInfo.Arguments = "/c `"$nextCmd`" dev -p $port"
$procInfo.WorkingDirectory = (Get-Location).Path
$procInfo.UseShellExecute = $false
$procInfo.EnvironmentVariables["PATH"] = "C:\Program Files\nodejs;" + $env:PATH

$devStart = Get-Date
$swDev = [System.Diagnostics.Stopwatch]::StartNew()
$proc = [System.Diagnostics.Process]::Start($procInfo)

# Wait for server to become ready
$ready = $false
$startupDurationMs = 0
$timeoutSec = 60
$startWait = Get-Date

while (-not $ready -and ((Get-Date) - $startWait).TotalSeconds -lt $timeoutSec) {
    Start-Sleep -Milliseconds 1000
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $iar = $tcp.BeginConnect("127.0.0.1", $port, $null, $null)
        $success = $iar.AsyncWaitHandle.WaitOne(1000)
        if ($success -and $tcp.Connected) {
            $tcp.EndConnect($iar)
            $tcp.Close()
            $ready = $true
            $swDev.Stop()
            $startupDurationMs = $swDev.ElapsedMilliseconds
            break
        }
        $tcp.Close()
    } catch {}
}

if (-not $ready) {
    Write-Host "Failed to start dev server within $timeoutSec seconds."
    if ($proc -and -not $proc.HasExited) { Stop-Process -Id $proc.Id -Force }
    exit 1
}

Write-Host "Dev Server Port Listening in: $($swDev.Elapsed.TotalSeconds.ToString('F2'))s ($startupDurationMs ms)"

function Measure-DevRoute([string]$Name, [string]$Url) {
    Write-Host "`nFetching route: $Name ($Url)..."
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $req = [System.Net.HttpWebRequest]::Create($Url)
        $req.Timeout = 120000
        $resp = $req.GetResponse()
        $sw.Stop()
        $code = [int]$resp.StatusCode
        $resp.Close()
        Write-Host "  -> Time: $($sw.Elapsed.TotalSeconds.ToString('F2'))s ($($sw.ElapsedMilliseconds) ms) [HTTP $code]"
        return [PSCustomObject]@{ Name = $Name; DurationSec = $sw.Elapsed.TotalSeconds; DurationMs = $sw.ElapsedMilliseconds; Status = $code }
    } catch {
        $sw.Stop()
        Write-Host "  -> Error: $_ [Time: $($sw.Elapsed.TotalSeconds.ToString('F2'))s]"
        return [PSCustomObject]@{ Name = $Name; DurationSec = $sw.Elapsed.TotalSeconds; DurationMs = $sw.ElapsedMilliseconds; Status = "ERR" }
    }
}

$routes = @(
    @{ Name = "Initial App / Root (/)" ; Url = "$baseUrl/" },
    @{ Name = "Products Catalog (/products)" ; Url = "$baseUrl/products" },
    @{ Name = "Product PDP (/products/classic-chocolate-truffle-cake)" ; Url = "$baseUrl/products/classic-chocolate-truffle-cake" },
    @{ Name = "Dashboard (/dashboard)" ; Url = "$baseUrl/dashboard" },
    @{ Name = "PIM / Shop (/dashboard/shop)" ; Url = "$baseUrl/dashboard/shop" },
    @{ Name = "Menu Manager (/dashboard/shop/menu)" ; Url = "$baseUrl/dashboard/shop/menu" },
    @{ Name = "Checkout (/checkout)" ; Url = "$baseUrl/checkout" },
    @{ Name = "API Products (/api/v1/products)" ; Url = "$baseUrl/api/v1/products" }
)

$results = @()
foreach ($r in $routes) {
    $res = Measure-DevRoute $r.Name $r.Url
    $results += $res
}

# Measure Hot Reload / Incremental Compilation
Write-Host "`n--- Measuring Hot Reload / Fast Refresh ---"
$targetComponent = "src/components/ui/Button.tsx"
if (Test-Path $targetComponent) {
    $orig = [System.IO.File]::ReadAllText($targetComponent)
    $modified = $orig + "`n// benchmark touch " + (Get-Date).Ticks
    
    $swHmr = [System.Diagnostics.Stopwatch]::StartNew()
    [System.IO.File]::WriteAllText($targetComponent, $modified)
    
    # Re-fetch catalog to measure incremental re-compilation
    $hmrRes = Measure-DevRoute "Catalog (Post-HMR Recompile)" "$baseUrl/products"
    $swHmr.Stop()
    
    # Restore file
    [System.IO.File]::WriteAllText($targetComponent, $orig)
    
    Write-Host "Hot Reload / Incremental Compilation Cycle: $($swHmr.Elapsed.TotalSeconds.ToString('F2'))s ($($swHmr.ElapsedMilliseconds) ms)"
}

Write-Host "`n=================================================="
Write-Host "DEVELOPMENT COMPILATION BENCHMARK SUMMARY"
Write-Host "=================================================="
Write-Host ("{0,-50} : {1,8} ms ({2,5:F2}s)" -f "Initial Dev Server Startup", $startupDurationMs, ($startupDurationMs / 1000))
foreach ($res in $results) {
    Write-Host ("{0,-50} : {1,8} ms ({2,5:F2}s) [Status: {3}]" -f $res.Name, $res.DurationMs, $res.DurationSec, $res.Status)
}
if ($hmrRes) {
    Write-Host ("{0,-50} : {1,8} ms ({2,5:F2}s)" -f "Hot Reload Incremental Recompile", $hmrRes.DurationMs, $hmrRes.DurationSec)
}
Write-Host "=================================================="

# Cleanup
if ($proc -and -not $proc.HasExited) {
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
}
Get-Process | Where-Object { $_.ProcessName -match "node" } | Stop-Process -Force -ErrorAction SilentlyContinue
