$start = Get-Date
Write-Host "START TIME: $($start.ToString('o'))"
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$proc = Start-Process -FilePath "npx.cmd" -ArgumentList "tsc --noEmit" -NoNewWindow -PassThru -Wait
$sw.Stop()
$end = Get-Date
Write-Host "END TIME:   $($end.ToString('o'))"
Write-Host "EXIT CODE:  $($proc.ExitCode)"
Write-Host "TOTAL DURATION: $($sw.Elapsed.TotalSeconds.ToString('F3')) seconds ($($sw.ElapsedMilliseconds) ms)"
