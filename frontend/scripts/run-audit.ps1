$env:PATH = "C:\Program Files\nodejs;C:\Users\alexc\AppData\Roaming\npm;" + $env:PATH
$output = & node.exe scripts/audit-build-dependencies.mjs 2>&1
$output | ForEach-Object { Write-Host $_ }
