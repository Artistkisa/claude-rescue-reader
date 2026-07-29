$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$viewerPath = Join-Path $repoRoot 'viewer.html'
$workerPath = Join-Path $repoRoot 'src\analytics-worker.js'
$viewer = Get-Content -LiteralPath $viewerPath -Raw -Encoding UTF8
$worker = (Get-Content -LiteralPath $workerPath -Raw -Encoding UTF8).Trim()
if ($worker -match '// BEGIN GENERATED ANALYTICS WORKER|// END GENERATED ANALYTICS WORKER') {
  throw 'analytics-worker.js contains generated-section marker strings.'
}
$pattern = '(?s)(// BEGIN GENERATED ANALYTICS WORKER[^\r\n]*\r?\n).*?(\r?\n// END GENERATED ANALYTICS WORKER)'
$match = [regex]::Match($viewer, $pattern)
if (-not $match.Success) {
  throw 'Analytics Worker markers were not found in viewer.html.'
}
$built = $viewer.Substring(0, $match.Index) + $match.Groups[1].Value + $worker +
  $match.Groups[2].Value + $viewer.Substring($match.Index + $match.Length)
if ($built -eq $viewer) {
  Write-Output 'viewer.html is already up to date.'
  exit 0
}
[System.IO.File]::WriteAllText($viewerPath, $built, [System.Text.UTF8Encoding]::new($false))
Write-Output 'Embedded src/analytics-worker.js into viewer.html.'
