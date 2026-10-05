[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$RunDirectory,
  [Parameter(Mandatory=$true)][string]$ResultMarkdown
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repository=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$run=[IO.Path]::GetFullPath($RunDirectory)
$private=[IO.Path]::GetFullPath((Join-Path $repository '.archive-corrections-private'))
if (-not $run.StartsWith($private+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -or (Split-Path $run -Leaf) -notlike 'd6-network-*') { throw 'Assigned private D6 run required.' }
function HashFile([string]$Path) { (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
function NewJson([string]$Path,$Value) {
  $bytes=[Text.UTF8Encoding]::new($false).GetBytes(($Value | ConvertTo-Json -Depth 50)+"`n")
  $stream=[IO.File]::Open($Path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  try {$stream.Write($bytes,0,$bytes.Length)} finally {$stream.Dispose()}
}
$configuration=Get-Content -LiteralPath (Join-Path $run 'config.private.json') -Raw | ConvertFrom-Json
$execution=Get-Content -LiteralPath (Join-Path $run 'execution-summary.json') -Raw | ConvertFrom-Json
$proof=Get-Content -LiteralPath (Join-Path $run 'network-proof.json') -Raw | ConvertFrom-Json
if (-not $execution.passed -or -not $execution.postgres_stopped -or -not $proof.passed -or $proof.stages_passed -ne 8) { throw 'Full successful real network run and cleanup required.' }
$testLog=Get-Content -LiteralPath (Join-Path $run 'network-tests.stdout.log') -Raw
foreach($metric in @('tests 7','pass 7','fail 0','cancelled 0','skipped 0')) {
  if ($testLog -notmatch ('(?m)^.\s+'+[regex]::Escape($metric)+'\s*$')) { throw 'Seven successful tests with no skip/cancellation required.' }
}
foreach($file in (Get-ChildItem -LiteralPath $run -File -Filter '*.log')) {
  $text=Get-Content -LiteralPath $file.FullName -Raw
  if (-not $text) {continue}
  foreach($secret in @($configuration.operator_password,$configuration.runtime_password,$configuration.owner_passphrase,$configuration.hmac_key)) {
    if ($text.Contains($secret)) { throw ('Private fixture secret leaked into log: '+$file.Name) }
  }
}
$frozen=Get-Content -LiteralPath (Join-Path $run 'frozen-before.json') -Raw | ConvertFrom-Json
$checks=@($frozen | ForEach-Object {[ordered]@{path=$_.path;sha256=$_.sha256;unchanged=((HashFile $_.path) -eq $_.sha256)}})
if (@($checks | Where-Object {-not $_.unchanged}).Count -ne 0) {throw 'Frozen D4/D5/H06 changed.'}
foreach($pin in $configuration.source_pins) {
  if ((HashFile (Join-Path $repository $pin.path)) -ne $pin.sha256 -or (HashFile (Join-Path (Join-Path $run 'source-freeze') $pin.path)) -ne $pin.sha256) { throw 'Executed source or immutable source copy changed.' }
}
$runtimePins=Get-Content -LiteralPath (Join-Path $run 'runtime-file-pins.json') -Raw | ConvertFrom-Json
foreach($pin in $runtimePins) { if ((HashFile (Join-Path $repository $pin.path)) -ne $pin.sha256) { throw 'Frozen runtime changed.' } }
NewJson (Join-Path $run 'frozen-verification.json') ([ordered]@{passed=$true;frozen_files=$checks.Count;checks=$checks;executed_source_files=$configuration.source_pins.Count;runtime_files=$runtimePins.Count;all_unchanged=$true})
$workers=$proof.stages | Where-Object stage -eq 'independent-workers'
$ownedPids=@([int]$execution.postgres_pid,[int]$workers.A.node_pid,[int]$workers.B.node_pid)
$alive=@(Get-Process -Id $ownedPids -ErrorAction SilentlyContinue)
if ($alive.Count -ne 0) { throw 'An owned process still exists; do not mark closeout complete.' }
if (Test-Path -LiteralPath (Join-Path $run 'pgdata/postmaster.pid')) { throw 'Owned PostgreSQL PID file still exists.' }
NewJson (Join-Path $run 'owned-process-closeout.json') ([ordered]@{passed=$true;pids_checked=$ownedPids;all_absent=$true;postmaster_pid_file_absent=$true;no_existing_service_targeted=$true})
$outputs=@();$verified=@();$index=0
$files=@(Get-ChildItem -LiteralPath $run -File | Where-Object {$_.Name -notlike '*.private.*' -and $_.Name -ne 'postgres-password.private.txt'})
$files+=@(Get-ChildItem -LiteralPath (Join-Path $run 'source-freeze') -File -Recurse)
$files+=@(Get-ChildItem -LiteralPath $PSScriptRoot -File)
$files+=@(Get-ChildItem -LiteralPath (Join-Path $repository 'tests/archive-corrections/postgres-network-pilot') -File)
foreach($file in $files) {
  $index++;$uri='checkout:archive-corrections/'+[IO.Path]::GetRelativePath($repository,$file.FullName).Replace('\','/')
  $media=switch($file.Extension){'.json'{'application/json'};'.mjs'{'text/javascript'};'.md'{'text/markdown'};default{'text/plain'}}
  $hash=HashFile $file.FullName
  $outputs+=[ordered]@{logical_id=('d6:output:'+ $index);uri=$uri;sha256=$hash;media_type=$media;rights_status='not-applicable'}
  $verified+=[ordered]@{uri=$uri;local_path=$file.FullName;sha256=$hash;verified=$true}
}
$resultHash=HashFile $ResultMarkdown
$resultUri='workspace:atelier-tuce/planning/durable-database/resultat-d6-network.md'
$outputs+=[ordered]@{logical_id='d6:result';uri=$resultUri;sha256=$resultHash;media_type='text/markdown';rights_status='not-applicable'}
$verified+=[ordered]@{uri=$resultUri;local_path=$ResultMarkdown;sha256=$resultHash;verified=$true}
NewJson (Join-Path $run 'output-hash-verification.json') ([ordered]@{passed=$true;outputs=$verified;credentials_and_pgdata_excluded=$true})
$hashCheckPath=Join-Path $run 'output-hash-verification.json'
$outputs+=[ordered]@{logical_id='d6:output-hash-check';uri=('checkout:archive-corrections/'+[IO.Path]::GetRelativePath($repository,$hashCheckPath).Replace('\','/'));sha256=(HashFile $hashCheckPath);media_type='application/json';rights_status='not-applicable'}
$manifest=Get-Content -LiteralPath (Join-Path $run 'run-manifest-before-execution.json') -Raw | ConvertFrom-Json -AsHashtable
$manifest.closed_at=[DateTime]::UtcNow.ToString('o')
$manifest.outputs=$outputs
$manifest.validation=[ordered]@{schema_valid=$true;output_hashes_verified=$true;provenance_complete=$true;rights_review='not-required';human_review_status='pending';
  notes='Real PostgreSQL 18.6 TCP loopback, 7/7 tests and 8 evidence stages, no skip. Two independent Node processes/four runtime TCP clients. No TLS/Vercel/HTTPS/human qualification. All checkout/workspace URI hashes reread locally, credentials/pgdata excluded. Only owned PostgreSQL/workers stopped; D4/D5/H06 unchanged.'}
$manifestPath=Join-Path $run 'run-manifest.json'
$schema=Join-Path $configuration.protocol_repository 'schema/operational/run-manifest.schema.json'
if (-not (Test-Json -Json ($manifest | ConvertTo-Json -Depth 50) -SchemaFile $schema)) {throw 'Operational JSON Schema refused.'}
NewJson $manifestPath $manifest
NewJson (Join-Path $run 'schema-validation.json') ([ordered]@{passed=$true;validator='PowerShell Test-Json, existing bundled runtime';schema_sha256=(HashFile $schema);manifest_sha256=(HashFile $manifestPath)})
$oldCount=[Environment]::GetEnvironmentVariable('GIT_CONFIG_COUNT','Process')
$slot=if($oldCount){[int]$oldCount}else{0}
$key='GIT_CONFIG_KEY_'+$slot;$value='GIT_CONFIG_VALUE_'+$slot
$oldKey=[Environment]::GetEnvironmentVariable($key,'Process');$oldValue=[Environment]::GetEnvironmentVariable($value,'Process')
try {
  [Environment]::SetEnvironmentVariable('GIT_CONFIG_COUNT',($slot+1).ToString(),'Process')
  [Environment]::SetEnvironmentVariable($key,'safe.directory','Process')
  [Environment]::SetEnvironmentVariable($value,$configuration.protocol_repository.Replace('\','/'),'Process')
  $text=& (Get-Command pwsh).Source -NoProfile -NonInteractive -File (Join-Path $configuration.protocol_repository 'ops/Test-PhdCloseout.ps1') -RunManifest $manifestPath
  if ($LASTEXITCODE -ne 0) {throw 'Canonical operational closeout checker failed.'}
  $check=($text -join "`n") | ConvertFrom-Json
} finally {
  [Environment]::SetEnvironmentVariable('GIT_CONFIG_COUNT',$oldCount,'Process');[Environment]::SetEnvironmentVariable($key,$oldKey,'Process');[Environment]::SetEnvironmentVariable($value,$oldValue,'Process')
}
if (-not $check.passed -or (HashFile $ResultMarkdown) -ne $resultHash) {throw 'Final closeout/hash failed.'}
NewJson (Join-Path $run 'closeout-check.json') $check
[ordered]@{passed=$true;tests=7;evidence_stages=8;frozen_files_unchanged=$checks.Count;outputs_verified=$outputs.Count;
  owned_processes_absent=$true;manifest=$manifestPath;manifest_sha256=(HashFile $manifestPath);publication='private';identity_verified=$false} | ConvertTo-Json
