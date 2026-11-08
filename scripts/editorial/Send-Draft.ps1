[CmdletBinding()]
param(
  [Parameter(Mandatory)] [string] $Path,
  [ValidateSet('dev', 'tst', 'prod')] [string] $Environment = 'prod'
)

$ErrorActionPreference = 'Stop'
$endpoints = @{
  dev = 'https://6rz4b6ydmh.execute-api.us-east-1.amazonaws.com'
  tst = 'https://nnpwkjfa56.execute-api.us-east-1.amazonaws.com'
  prod = 'https://api.lynxpardelle.com'
}
$credential = Join-Path $env:LOCALAPPDATA "LynxPortfolio/editorial-$Environment.dpapi"
if (-not (Test-Path -LiteralPath $credential)) { throw 'The editorial ingestion credential has not been installed.' }
$secure = Get-Content -LiteralPath $credential -Raw | ConvertTo-SecureString
$plain = [System.Net.NetworkCredential]::new('', $secure).Password
try {
  $file = Get-Item -LiteralPath $Path
  if ($file.Length -gt 65536) { throw 'The draft exceeds the ingestion size limit.' }
  $result = Invoke-RestMethod -Method Post -Uri "$($endpoints[$Environment])/api/editorial/ingest" `
    -ContentType 'application/json' -InFile $file.FullName -Headers @{ Authorization = "Bearer $plain" } `
    -MaximumRedirection 0 -TimeoutSec 20
  if (-not $result.slug) { throw 'The ingestion endpoint did not acknowledge the draft.' }
  "Draft acknowledged: $($result.slug)"
} finally {
  $plain = $null
  $secure.Dispose()
}
