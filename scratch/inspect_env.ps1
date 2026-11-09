param()

function Inspect-EnvFile ($filePath) {
    if (-not (Test-Path $filePath)) { 
        Write-Output "File does not exist: $filePath"
        return 
    }
    $lines = Get-Content $filePath
    $results = @()
    foreach ($line in $lines) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith('#')) { continue }
        $parts = $trimmed.Split('=', 2)
        $key = $parts[0].Trim()
        $val = if ($parts.Length -gt 1) { $parts[1].Trim() } else { '' }
        $hasVal = -not [string]::IsNullOrEmpty($val)
        $isDev = $val -match 'uubwhsnnrnicyczwqlbq'
        $isSupabase = $val -match 'supabase\.co'
        $projectRef = 'N/A'
        if ($val -match 'postgres\.([a-zA-Z0-9]+):') { 
            $projectRef = $Matches[1] 
        } elseif ($val -match '@([a-zA-Z0-9\-]+)\.pooler\.supabase\.com') { 
            $projectRef = $Matches[1] 
        } elseif ($val -match 'https://([a-zA-Z0-9]+)\.supabase\.co') {
            $projectRef = $Matches[1]
        }
        $results += [PSCustomObject]@{
            Key = $key
            Status = if ($hasVal) { 'PRESENT' } else { 'EMPTY' }
            ValueLength = $val.Length
            IsDevSupabase = $isDev
            IsSupabase = $isSupabase
            ProjectRef = $projectRef
        }
    }
    Write-Output "=== FILE: $filePath ==="
    $results | Format-Table Key, Status, ValueLength, IsDevSupabase, IsSupabase, ProjectRef
}

Inspect-EnvFile '.env'
Inspect-EnvFile 'frontend\.env'
Inspect-EnvFile 'backend\.env'
