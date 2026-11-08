[CmdletBinding()]
param([ValidateSet('dev', 'tst', 'prod')] [string] $Environment = 'prod')

$ErrorActionPreference = 'Stop'
$random = [System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
$token = [Convert]::ToHexString($random).ToLowerInvariant()
$hash = [Convert]::ToHexString([System.Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($token))).ToLowerInvariant()
$directory = Join-Path $env:LOCALAPPDATA 'LynxPortfolio'
$null = New-Item -ItemType Directory -Path $directory -Force
$secure = ConvertTo-SecureString -String $token -AsPlainText -Force
try {
  aws ssm put-parameter --region us-east-1 --name "/portfolio/$Environment/editorial/ingest-token-sha256" `
    --type String --value $hash --overwrite --no-cli-pager | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'AWS did not store the ingestion credential verifier.' }
  $secure | ConvertFrom-SecureString | Set-Content -LiteralPath (Join-Path $directory "editorial-$Environment.dpapi") -NoNewline
} finally {
  [Array]::Clear($random)
  $token = $null
  $secure.Dispose()
}
