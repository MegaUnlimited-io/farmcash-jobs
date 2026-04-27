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
            -Uri    "$baseUrl/rest/v1/jobs?select=id,status,enriched_at" `
            -Method GET `
            -Headers $headers

        if ($jobs.Count -eq 0) {
            Write-Host "  No rows found — has the sync run yet?" -ForegroundColor Yellow
            return
        }

        $enriched   = ($jobs | Where-Object { $_.enriched_at }).Count
        $unenriched = $jobs.Count - $enriched

        Write-Host "  Total jobs:  $($jobs.Count)" -ForegroundColor Green
        Write-Host "  Enriched:    $enriched" -ForegroundColor Green
        Write-Host "  Unenriched:  $unenriched" -ForegroundColor Yellow
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

function Invoke-Enrich {
    param(
        [string]$ExtraFlags = ""
    )
    Write-Host ""
    Write-Host "  Starting enrichment..." -ForegroundColor Cyan
    Write-Host "  (Ctrl+C to cancel)" -ForegroundColor DarkGray
    Write-Host ""

    $nodeArgs = "--env-file=.env.local scripts/enrich-jobs.mjs $ExtraFlags"
    try {
        $repoRoot = Split-Path $PSScriptRoot -Parent
        Push-Location $repoRoot
        Invoke-Expression "node $nodeArgs"
        Pop-Location
    }
    catch {
        Write-Host "  Error: $_" -ForegroundColor Red
        Pop-Location
    }
}

function Show-Menu {
    Write-Host ""
    Write-Host "  ╔════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "  ║   FarmCash Jobs  ·  Admin Tools        ║" -ForegroundColor Cyan
    Write-Host "  ╠════════════════════════════════════════╣" -ForegroundColor Cyan
    Write-Host "  ║  1  Trigger manual sync                ║"
    Write-Host "  ║  2  Jobs table stats                   ║"
    Write-Host "  ║  3  Enrich unenriched jobs (limit 20)  ║"
    Write-Host "  ║  4  Enrich specific job (by UUID)      ║"
    Write-Host "  ║  5  Enrich specific job (by package)   ║"
    Write-Host "  ║  6  Dry-run enrichment (no DB writes)  ║"
    Write-Host "  ║  7  Exit                               ║"
    Write-Host "  ╚════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

while ($true) {
    Show-Menu
    $choice = Read-Host "  Select"

    switch ($choice.Trim()) {
        "1" { Invoke-Sync }
        "2" { Show-Stats }
        "3" { Invoke-Enrich }
        "4" {
            $id = Read-Host "  Job UUID"
            Invoke-Enrich "--job $id --force"
        }
        "5" {
            $pkg = Read-Host "  app_package_id (e.g. com.example.app)"
            Invoke-Enrich "--package $pkg --force"
        }
        "6" { Invoke-Enrich "--dry-run --limit 3" }
        "7" { exit 0 }
        default { Write-Host "  Invalid option." -ForegroundColor Yellow }
    }

    Write-Host ""
    Read-Host "  Press Enter to return to menu"
}
