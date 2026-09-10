# Benchmark runner for Next.js 3-Build Suite (Cold + 2 Warm)
param(
  [string]$Mode = "all"
)

function Measure-SingleBuild([string]$BuildName, [bool]$CleanCache) {
  Write-Host "=================================================="
  Write-Host "RUNNING $BuildName (CleanCache: $CleanCache)"
  Write-Host "=================================================="

  if ($CleanCache) {
    if (Test-Path ".next") {
      Write-Host "Cleaning .next directory for cold build..."
      Remove-Item -Path ".next" -Recurse -Force -ErrorAction SilentlyContinue
    }
  }

  $start = Get-Date
  Write-Host "BUILD STARTED: $($start.ToString('o'))"

  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  
  # Run next build with detailed output
  $buildOutput = & npx.cmd next build 2>&1
  $exitCode = $LASTEXITCODE

  $sw.Stop()
  $end = Get-Date

  Write-Host "BUILD FINISHED: $($end.ToString('o'))"
  Write-Host "EXIT CODE:      $exitCode"
  Write-Host "TOTAL DURATION: $($sw.Elapsed.TotalSeconds.ToString('F3'))s ($($sw.ElapsedMilliseconds) ms)"

  $outputStr = $buildOutput -join "`n"
  
  # Extract route information and stats if present
  Write-Host "--- BUILD LOG PREVIEW ---"
  $buildOutput | Select-Object -First 30 | ForEach-Object { Write-Host $_ }
  Write-Host "..."
  $buildOutput | Select-Object -Last 35 | ForEach-Object { Write-Host $_ }

  return [PSCustomObject]@{
    Name = $BuildName
    StartTime = $start
    EndTime = $end
    DurationSec = $sw.Elapsed.TotalSeconds
    DurationMs = $sw.ElapsedMilliseconds
    ExitCode = $exitCode
    Output = $outputStr
  }
}

$results = @()

# 1. Cold Build
$b1 = Measure-SingleBuild "Build #1 (Cold Build)" $true
$results += $b1

# 2. Warm Build 1
$b2 = Measure-SingleBuild "Build #2 (Warm Build 1)" $false
$results += $b2

# 3. Warm Build 2
$b3 = Measure-SingleBuild "Build #3 (Warm Build 2)" $false
$results += $b3

Write-Host "`n=================================================="
Write-Host "3-BUILD SUITE SUMMARY AND CALCULATIONS"
Write-Host "=================================================="
Write-Host "Build #1 (Cold): $($b1.DurationSec.ToString('F2'))s ($($b1.DurationMs) ms) [Exit: $($b1.ExitCode)]"
Write-Host "Build #2 (Warm): $($b2.DurationSec.ToString('F2'))s ($($b2.DurationMs) ms) [Exit: $($b2.ExitCode)]"
Write-Host "Build #3 (Warm): $($b3.DurationSec.ToString('F2'))s ($($b3.DurationMs) ms) [Exit: $($b3.ExitCode)]"

$warmAvg = ($b2.DurationSec + $b3.DurationSec) / 2
$allDurations = @($b1.DurationSec, $b2.DurationSec, $b3.DurationSec)
$best = ($allDurations | Measure-Object -Minimum).Minimum
$worst = ($allDurations | Measure-Object -Maximum).Maximum

Write-Host "--------------------------------------------------"
Write-Host "Cold Build:   $($b1.DurationSec.ToString('F2'))s"
Write-Host "Warm Average: $($warmAvg.ToString('F2'))s"
Write-Host "Best Build:   $($best.ToString('F2'))s"
Write-Host "Worst Build:  $($worst.ToString('F2'))s"
Write-Host "=================================================="
