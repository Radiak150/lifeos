param([switch]$SemAbrir)

$ErrorActionPreference = 'Stop'
$lifeosRoot = $PSScriptRoot
$lifeosUrl = 'http://127.0.0.1:5181'
$lifeosPort = Get-NetTCPConnection -LocalPort 5181 -State Listen -ErrorAction SilentlyContinue
if ($lifeosPort) {
    $lifeosPage = Invoke-WebRequest -Uri $lifeosUrl -UseBasicParsing -TimeoutSec 5
    if ($lifeosPage.Content -notmatch 'LifeOS') {
        throw 'A porta 5181 esta em uso por outro programa. Feche esse programa antes de iniciar o LifeOS.'
    }
} else {
    if (!(Test-Path -LiteralPath (Join-Path $lifeosRoot 'dist\index.html'))) {
        throw 'A versao compilada nao foi encontrada. Execute npm ci e npm run build nesta pasta.'
    }
    $lifeosNodeCommand = Get-Command node -ErrorAction SilentlyContinue
    $lifeosBundledNode = Join-Path $lifeosRoot 'runtime\node.exe'
    $lifeosNode = if (Test-Path -LiteralPath $lifeosBundledNode) { $lifeosBundledNode } elseif ($lifeosNodeCommand) { $lifeosNodeCommand.Source } else {
        Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
    }
    if (!(Test-Path -LiteralPath $lifeosNode)) {
        throw 'Instale o Node.js antes de abrir o LifeOS.'
    }
    $lifeosServer = Join-Path $lifeosRoot 'scripts\serve.mjs'
    if (!(Test-Path -LiteralPath $lifeosServer)) { throw 'O pacote esta incompleto. Extraia o ZIP inteiro novamente.' }
    $lifeosLog = Join-Path $lifeosRoot 'tmp'
    New-Item -ItemType Directory -Force -Path $lifeosLog | Out-Null
    Start-Process -FilePath $lifeosNode -ArgumentList @(('"' + $lifeosServer + '"')) -WorkingDirectory $lifeosRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $lifeosLog 'lifeos-preview.log') -RedirectStandardError (Join-Path $lifeosLog 'lifeos-preview-error.log') | Out-Null
    $lifeosReady = $false
    for ($lifeosAttempt = 0; $lifeosAttempt -lt 20; $lifeosAttempt++) {
        try {
            $lifeosResponse = Invoke-WebRequest -Uri $lifeosUrl -UseBasicParsing -TimeoutSec 1
            if ($lifeosResponse.StatusCode -eq 200) { $lifeosReady = $true; break }
        } catch { Start-Sleep -Milliseconds 250 }
    }
    if (!$lifeosReady) { throw 'O LifeOS nao iniciou. Confira tmp\lifeos-preview-error.log.' }
}

Write-Host "LifeOS disponivel em $lifeosUrl"
Write-Host 'Use sempre este endereco e o mesmo navegador para acessar seus registros locais.'
if (!$SemAbrir) { Start-Process $lifeosUrl }
