# ================================================================
#  sync-jobs Test Tool
#  Manually trigger and inspect the sync-jobs Edge Function.
#
#  Setup: copy sync-config.example.json -> sync-config.json
#         and fill in your Supabase URL + service role key.
# ================================================================

$ErrorActionPreference = "Stop"

# ── Load config ─────────────────────────────────────────────────
$configPath  = Join-Path $PSScriptRoot "sync-config.json"
$examplePath = Join-Path $PSScriptRoot "sync-config.example.json"

if (-not (Test-Path $configPath)) {
    Write-Host ""
    Write-Host "  Config file not found: sync-config.json" -ForegroundColor Yellow
    Write-Host "  Copy sync-config.example.json, rename it to sync-config.json,"
    Write-Host "  and fill in your Supabase URL and service role key."
    Write-Host ""
    Read-Host "  Press Enter to exit"
    exit 1
}

$config  = Get-Content $configPath -Raw | ConvertFrom-Json
$baseUrl = $config.supabaseUrl.TrimEnd("/")
$key     = $config.serviceRoleKey

$headers = @{
    "Authorization" = "Bearer $key"
    "apikey"        = $key
    "Content-Type"  = "application/json"
}

# ── Actions ─────────────────────────────────────────────────────

function Invoke-Sync {
    Write-Host ""
    Write-Host "  Triggering sync-jobs..." -ForegroundColor Cyan

    try {
        $res = Invoke-RestMethod `
            -Uri    "$baseUrl/functions/v1/sync-jobs" `
            -Method POST `
            -Headers $headers `
            -Body   "{}"

        Write-Host "  Success!" -ForegroundColor Green
        Write-Host ""
        $res | ConvertTo-Json -Depth 6
    }
    catch {
        Write-Host "  Error: $_" -ForegroundColor Red
    }
}

function Show-Stats {
    Write-Host ""
    Write-Host "  Querying jobs table..." -ForegroundColor Cyan

    try {
        $jobs = Invoke-RestMethod `
            -Uri    "$baseUrl/rest/v1/jobs?select=id,status,partner_id" `
            -Method GET `
            -Headers $headers

        if ($jobs.Count -eq 0) {
            Write-Host "  No rows found — has the sync run yet?" -ForegroundColor Yellow
            return
        }

        Write-Host "  Total rows: $($jobs.Count)" -ForegroundColor Green
        Write-Host ""

        Write-Host "  By partner:" -ForegroundColor White
        $jobs | Group-Object partner_id | Sort-Object Count -Descending | ForEach-Object {
            Write-Host "    $($_.Name): $($_.Count)"
        }

        Write-Host ""
        Write-Host "  By status:" -ForegroundColor White
        $jobs | Group-Object status | Sort-Object Count -Descending | ForEach-Object {
            $color = switch ($_.Name) {
                "active"          { "Green"  }
                "partner_removed" { "Yellow" }
                "blacklisted"     { "Red"    }
                "seasonal"        { "DarkYellow" }
                "under_review"    { "Gray"   }
                default           { "White"  }
            }
            Write-Host "    $($_.Name): $($_.Count)" -ForegroundColor $color
        }
    }
    catch {
        Write-Host "  Error: $_" -ForegroundColor Red
    }
}

# ── Menu ─────────────────────────────────────────────────────────

function Show-Menu {
    Write-Host ""
    Write-Host "  ╔════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "  ║   sync-jobs  ·  Test Tool      ║" -ForegroundColor Cyan
    Write-Host "  ╠════════════════════════════════╣" -ForegroundColor Cyan
    Write-Host "  ║  1  Trigger manual sync        ║"
    Write-Host "  ║  2  Jobs table stats           ║"
    Write-Host "  ║  3  Exit                       ║"
    Write-Host "  ╚════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

while ($true) {
    Show-Menu
    $choice = Read-Host "  Select"

    switch ($choice.Trim()) {
        "1" { Invoke-Sync  }
        "2" { Show-Stats   }
        "3" { exit 0       }
        default { Write-Host "  Invalid option — enter 1, 2, or 3." -ForegroundColor Yellow }
    }

    Write-Host ""
    Read-Host "  Press Enter to return to menu"
}
