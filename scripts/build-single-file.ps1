$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$viewerPath = Join-Path $repoRoot 'viewer.html'
$workerPath = Join-Path (Join-Path $repoRoot 'src') 'analytics-worker.js'
$dataWorkerPath = Join-Path (Join-Path $repoRoot 'src') 'data-worker.js'
$viewer = Get-Content -LiteralPath $viewerPath -Raw -Encoding UTF8
$originalViewer = $viewer
$worker = (Get-Content -LiteralPath $workerPath -Raw -Encoding UTF8).Trim()
$dataWorker = (Get-Content -LiteralPath $dataWorkerPath -Raw -Encoding UTF8).Trim()
if ($worker -match '// BEGIN GENERATED ANALYTICS WORKER|// END GENERATED ANALYTICS WORKER') {
  throw 'analytics-worker.js contains generated-section marker strings.'
}
$dataPattern = '(?s)(// BEGIN GENERATED DATA WORKER[^\r\n]*\r?\n).*?(\r?\n// END GENERATED DATA WORKER)'
$dataMatch = [regex]::Match($viewer, $dataPattern)
if (-not $dataMatch.Success) {
  throw 'Data Worker markers were not found in viewer.html.'
}
$viewer = $viewer.Substring(0, $dataMatch.Index) + $dataMatch.Groups[1].Value + $dataWorker +
  $dataMatch.Groups[2].Value + $viewer.Substring($dataMatch.Index + $dataMatch.Length)
$pattern = '(?s)(// BEGIN GENERATED ANALYTICS WORKER[^\r\n]*\r?\n).*?(\r?\n// END GENERATED ANALYTICS WORKER)'
$match = [regex]::Match($viewer, $pattern)
if (-not $match.Success) {
  throw 'Analytics Worker markers were not found in viewer.html.'
}
$built = $viewer.Substring(0, $match.Index) + $match.Groups[1].Value + $worker +
  $match.Groups[2].Value + $viewer.Substring($match.Index + $match.Length)
if ($built -eq $originalViewer) {
  Write-Output 'viewer.html is already up to date.'
  exit 0
}
[System.IO.File]::WriteAllText($viewerPath, $built, [System.Text.UTF8Encoding]::new($false))
Write-Output 'Embedded Worker sources into viewer.html.'
