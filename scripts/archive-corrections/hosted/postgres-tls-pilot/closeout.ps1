[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$RunDirectory,[Parameter(Mandatory=$true)][string]$ResultPath)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repository=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..')); $run=[IO.Path]::GetFullPath($RunDirectory)
$private=Join-Path $repository '.archive-corrections-private'
if (-not $run.StartsWith($private+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -or (Split-Path $run -Leaf) -notmatch '^d7-tls-[a-f0-9-]{36}$') { throw 'Assigned D7 private run required.' }
function HashFile([string]$p) { (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant() }
function NewJson([string]$p,$v) { $b=[Text.UTF8Encoding]::new($false).GetBytes(($v|ConvertTo-Json -Depth 40)+"`n"); $s=[IO.File]::Open($p,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None); try {$s.Write($b,0,$b.Length)} finally {$s.Dispose()} }
$before=Get-Content -LiteralPath (Join-Path $run 'frozen-before.json') -Raw|ConvertFrom-Json
foreach($pin in $before) { if ((HashFile $pin.path) -ne $pin.sha256) { throw 'Old D4/D5/D6/H06 source changed.' } }
$input=Get-Content -LiteralPath (Join-Path $run 'input-manifest.json') -Raw|ConvertFrom-Json
foreach($pin in $input.source_pins) {
  if ((HashFile (Join-Path $repository $pin.path)) -ne $pin.sha256 -or (HashFile (Join-Path (Join-Path $run 'source-freeze') $pin.path)) -ne $pin.sha256) { throw 'Execution source/freeze changed.' }
}
$execution=Get-Content -LiteralPath (Join-Path $run 'execution-summary.json') -Raw|ConvertFrom-Json
$cleanup=Get-Content -LiteralPath (Join-Path $run 'owned-process-closeout.json') -Raw|ConvertFrom-Json
$gate=Get-Content -LiteralPath (Join-Path $run 'gate-proof.json') -Raw|ConvertFrom-Json
$proof=Get-Content -LiteralPath (Join-Path $run 'tls-pilot-proof.json') -Raw|ConvertFrom-Json
if (-not $execution.passed -or -not $cleanup.all_owned_pids_absent -or -not $gate.passed -or -not $proof.passed) { throw 'Successful strict gate, pilot and cleanup required.' }
foreach($owned in @($cleanup.owned_postgres_pids)+@($cleanup.owned_worker_pids)) { if (Get-Process -Id $owned -ErrorAction SilentlyContinue) { throw 'Owned PID still present.' } }
$cert=Get-Content -LiteralPath (Join-Path $run 'certificate-proof.json') -Raw|ConvertFrom-Json
foreach($pin in $cert.public_certificate_pins) { if ((HashFile (Join-Path $run $pin.file)) -ne $pin.sha256) { throw 'Public certificate changed.' } }
NewJson (Join-Path $run 'frozen-after.json') ([ordered]@{passed=$true;old_sources_verified=$before.Count;execution_sources_verified=$input.source_pins.Count;old_sources_mutated=$false})
$manifest=Get-Content -LiteralPath (Join-Path $run 'run-manifest-before-execution.json') -Raw|ConvertFrom-Json
$files=@(Get-ChildItem -LiteralPath $run -File -Recurse|Where-Object { $_.FullName -notmatch '[\\/]pgdata[\\/]' -and $_.Name -notlike '*.private.*' -and $_.Name -notlike 'postgres-password*' })
$outputs=@($files|ForEach-Object {
  $relative=[IO.Path]::GetRelativePath($run,$_.FullName).Replace('\','/')
  [ordered]@{logical_id=('d7:'+($relative.ToLowerInvariant() -replace '[^a-z0-9:_-]','-'));uri=('checkout:archive-corrections/'+[IO.Path]::GetRelativePath($repository,$_.FullName).Replace('\','/'));sha256=(HashFile $_.FullName);media_type=$(switch($_.Extension){'.json' {'application/json'} '.md' {'text/markdown'} '.pem' {'application/x-pem-file'} default {'text/plain'}});rights_status='not-applicable'}
})
$resultFile=[IO.Path]::GetFullPath($ResultPath)
if ($resultFile -ne 'C:\Users\Val\Documents\ChatGPT\PERSO\atelier-tuce\planning\durable-database\resultat-d7-tls.md') { throw 'Assigned result path required.' }
$outputs+=@([ordered]@{logical_id='d7:result';uri='workspace:atelier-tuce/planning/durable-database/resultat-d7-tls.md';sha256=(HashFile $resultFile);media_type='text/markdown';rights_status='not-applicable'})
$manifest.outputs=$outputs; $manifest|Add-Member -NotePropertyName closed_at -NotePropertyValue ([DateTime]::UtcNow.ToString('o'))
$manifest.validation.notes='Real D5 default createNetworkDriver, strict verification, ephemeral CA per owned Node launch. Four TLS probes pass (trusted CA, untrusted CA refusal, trusted wrong SAN refusal, trusted restored certificate). Minimal two-process edit/export/restore only; no D6 replay. Restore target is an isolated new schema in the fresh local cluster. No Git invocation: declared Git metadata inherited from D6. Canonical closeout not invoked because it calls Git; existing local schema and all output hashes verified directly. Invented fixtures; no human identity, HTTP TLS/Vercel/remote-provider/deployment/production qualification. Secrets, private keys and pgdata excluded.'
$schema='Z:\Codex\repos\PHD-Maine-paleography-harness\schema\operational\run-manifest.schema.json'
if (-not (Test-Json -Json ($manifest|ConvertTo-Json -Depth 40) -SchemaFile $schema)) { throw 'Final operational manifest schema failed.' }
NewJson (Join-Path $run 'run-manifest.json') $manifest
$checks=@($outputs|ForEach-Object {
  $path=if ($_.uri.StartsWith('checkout:archive-corrections/')) {Join-Path $repository $_.uri.Substring('checkout:archive-corrections/'.Length)} else {$resultFile}
  $actual=HashFile $path; if ($actual -ne $_.sha256) { throw 'Output hash mismatch.' }
  [ordered]@{logical_id=$_.logical_id;sha256=$actual;passed=$true}
})
NewJson (Join-Path $run 'schema-validation.json') ([ordered]@{passed=$true;schema_valid=$true;schema_sha256=(HashFile $schema);manifest_sha256=(HashFile (Join-Path $run 'run-manifest.json'));
  output_hashes_verified=$checks;git_invoked=$false;canonical_closeout_invoked=$false;canonical_closeout_reason='Calls Git; mandate prohibits Git.';secrets_and_pgdata_excluded=$true})
[ordered]@{closed=$true;passed=$true;schema_valid=$true;outputs_verified=$checks.Count;old_sources_unchanged=$before.Count;manifest_sha256=(HashFile (Join-Path $run 'run-manifest.json'))}|ConvertTo-Json
