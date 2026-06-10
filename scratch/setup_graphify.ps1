New-Item -ItemType Directory -Force -Path graphify-out | Out-Null
$GRAPHIFY_PYTHON = $null

function Find-GraphifyPython {
    # 1. uv tool install — 'uv tool dir' is authoritative
    if (Get-Command uv -ErrorAction SilentlyContinue) {
        $uvDir = (uv tool dir 2>$null)
        if ($uvDir) {
            $uvDir = $uvDir.Trim()
            $py = Join-Path $uvDir "graphifyy\Scripts\python.exe"
            if (Test-Path $py) {
                & $py -c "import graphify" 2>$null
                if ($LASTEXITCODE -eq 0) { return $py }
            }
        }
    }
    # 2. pipx install
    if (Get-Command pipx -ErrorAction SilentlyContinue) {
        $venvs = (pipx environment --value PIPX_LOCAL_VENVS 2>$null)
        if ($venvs) {
            $venvs = $venvs.Trim()
            $py = Join-Path $venvs "graphifyy\Scripts\python.exe"
            if (Test-Path $py) {
                & $py -c "import graphify" 2>$null
                if ($LASTEXITCODE -eq 0) { return $py }
            }
        }
    }
    # 3. Registry / Standard Local Path
    $userProfile = $env:USERPROFILE
    $localAppData = $env:LOCALAPPDATA
    $candidatePaths = @(
        "$localAppData\Programs\Python\Python312\python.exe",
        "$userProfile\AppData\Local\Programs\Python\Python312\python.exe",
        "C:\Users\Liam\AppData\Local\Programs\Python\Python312\python.exe"
    )
    foreach ($p in $candidatePaths) {
        if (Test-Path $p) {
            & $p -c "import graphify" 2>$null
            if ($LASTEXITCODE -eq 0) {
                return $p
            }
        }
    }

    # 4. Active venv / conda
    $pyCmd = Get-Command python -ErrorAction SilentlyContinue
    if ($pyCmd) {
        & $pyCmd.Source -c "import graphify" 2>$null
        if ($LASTEXITCODE -eq 0) {
            return (& $pyCmd.Source -c "import sys; print(sys.executable)").Trim()
        }
    }
    return $null
}

# Try to find Python with graphify already installed
$GRAPHIFY_PYTHON = Find-GraphifyPython

# If not found, find ANY python and install graphify into it
if (-not $GRAPHIFY_PYTHON) {
    Write-Host "Python with graphify not found. Searching for python to install..."
    $pyBin = $null
    
    $userProfile = $env:USERPROFILE
    $localAppData = $env:LOCALAPPDATA
    $candidatePaths = @(
        "$localAppData\Programs\Python\Python312\python.exe",
        "$userProfile\AppData\Local\Programs\Python\Python312\python.exe",
        "C:\Users\Liam\AppData\Local\Programs\Python\Python312\python.exe"
    )
    foreach ($p in $candidatePaths) {
        if (Test-Path $p) {
            $pyBin = $p
            break
        }
    }
    
    if (-not $pyBin) {
        $pyCmd = Get-Command python -ErrorAction SilentlyContinue
        if ($pyCmd) {
            $pyBin = (& $pyCmd.Source -c "import sys; print(sys.executable)").Trim()
        }
    }
    
    if ($pyBin) {
        Write-Host "Found Python at $pyBin. Installing graphifyy..."
        & $pyBin -m pip install graphifyy -q
        # Re-check
        & $pyBin -c "import graphify" 2>$null
        if ($LASTEXITCODE -eq 0) {
            $GRAPHIFY_PYTHON = $pyBin
        }
    }
}

# Save interpreter path — all subsequent steps read this
if ($GRAPHIFY_PYTHON) {
    $GRAPHIFY_PYTHON | Out-File -FilePath graphify-out\.graphify_python -Encoding utf8 -NoNewline
    # Save scan root so `graphify update` (no args) knows where to look next time
    (Resolve-Path .).Path | Out-File -FilePath graphify-out\.graphify_root -Encoding utf8 -NoNewline
    Write-Host "Graphify Python found at: $GRAPHIFY_PYTHON"
} else {
    Write-Error "Could not find or install graphifyy"
    exit 1
}
