[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$RunDirectory,[Parameter(Mandatory=$true)][string]$ResultPath)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repository=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'));$run=[IO.Path]::GetFullPath($RunDirectory)
if(-not $run.StartsWith((Join-Path $repository '.archive-corrections-private')+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -or (Split-Path $run -Leaf) -notmatch '^d8-integrated-[a-f0-9-]{36}$'){throw 'Assigned D8 run required.'}
function HashFile([string]$p){(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant()}
function NewJson([string]$p,$v){$b=[Text.UTF8Encoding]::new($false).GetBytes(($v|ConvertTo-Json -Depth 40)+"`n");$s=[IO.File]::Open($p,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);try{$s.Write($b,0,$b.Length)}finally{$s.Dispose()}}
$old=Get-Content -LiteralPath (Join-Path $run 'frozen-before.json') -Raw|ConvertFrom-Json
foreach($pin in $old){if((HashFile $pin.path) -ne $pin.sha256){throw 'Frozen old source changed.'}}
$input=Get-Content -LiteralPath (Join-Path $run 'input-manifest.json') -Raw|ConvertFrom-Json
foreach($pin in $input.source_pins){if((HashFile (Join-Path $repository $pin.path)) -ne $pin.sha256 -or (HashFile (Join-Path (Join-Path $run 'source-freeze') $pin.path)) -ne $pin.sha256){throw 'D8 execution source changed.'}}
foreach($name in $input.derivative_files.psobject.Properties.Name){if((HashFile (Join-Path (Join-Path $run 'derivatives') $name)) -ne $input.derivative_files.$name){throw 'D3 derivative copy changed.'}}
$gate=Get-Content -LiteralPath (Join-Path $run 'gate-proof.json') -Raw|ConvertFrom-Json
$gateStop=Get-Content -LiteralPath (Join-Path $run 'test-process-closeout.json') -Raw|ConvertFrom-Json
if(-not $gate.passed -or -not $gateStop.all_exited){throw 'Complete gate and stopped test processes required.'}
$mount=Get-Content -LiteralPath (Join-Path $run 'mount-ready.json') -Raw|ConvertFrom-Json
if(-not $mount.gate_passed -or -not $mount.test_store_released -or $mount.origin -ne 'http://127.0.0.1:8810'){throw 'Direct root mount handoff incomplete.'}
NewJson (Join-Path $run 'closeout-state.json') ([ordered]@{checked_at=[DateTime]::UtcNow.ToString('o');gate_passed=$true;old_sources_unchanged=$old.Count;execution_sources_verified=$input.source_pins.Count;
 derivative_files_unchanged=6;test_processes_exited=$true;test_store_released=$true;standalone_preview_left_live=$false;root_mount_verified=$false;human_identity_verified=$false;
 no_browser_replay=$true;secrets_and_database_excluded=$true;git_invoked=$false})
$manifest=Get-Content -LiteralPath (Join-Path $run 'run-manifest-before-execution.json') -Raw|ConvertFrom-Json
$files=@(Get-ChildItem -LiteralPath $run -File -Recurse|Where-Object {$_.FullName -notmatch '[\\/]data[\\/]' -and $_.Name -notlike '*.private.*'})
$outputs=@($files|ForEach-Object{$rel=[IO.Path]::GetRelativePath($run,$_.FullName).Replace('\','/');[ordered]@{logical_id=('d8:'+($rel.ToLowerInvariant() -replace '[^a-z0-9:_-]','-'));uri=('checkout:archive-corrections/'+[IO.Path]::GetRelativePath($repository,$_.FullName).Replace('\','/'));sha256=(HashFile $_.FullName);media_type=$(if($_.Extension -eq '.json'){'application/json'}elseif($_.Extension -eq '.md'){'text/markdown'}else{'text/plain'});rights_status='restricted'}})
if([IO.Path]::GetFullPath($ResultPath) -ne 'C:\Users\Val\Documents\ChatGPT\PERSO\atelier-tuce\planning\durable-database\resultat-d8-integration.md'){throw 'Assigned D8 result path required.'}
$outputs+=@([ordered]@{logical_id='d8:result';uri='workspace:atelier-tuce/planning/durable-database/resultat-d8-integration.md';sha256=(HashFile $ResultPath);media_type='text/markdown';rights_status='restricted'})
$manifest.outputs=$outputs;$manifest|Add-Member -NotePropertyName closed_at -NotePropertyValue ([DateTime]::UtcNow.ToString('o'))
$manifest.validation.notes='Private D8 integrated HTTP loopback handoff for direct Root origin http://127.0.0.1:8810. Existing PGlite plus frozen D5 SQL/store/session/validator and closed D3 binding. Synthetic test decision/history/export/restart distinct from one real unreviewed Monbezon pending proposal. Historical decisions/login disabled server-side; all outputs simulation:true identity_verified:false; no human memory/confirmation. All executor test processes stopped and store released; no standalone preview left live. Actual Root mount/browser integration not attested by this executor. Six derivative hashes and frozen source hashes verified. Local schema and output hashes only: generic closeout invokes prohibited Git and was not run. Git metadata inherited only. No browser retry, original, install, deployment, account, cost or shared-plan mutation. Restricted rights cleared only for this private local consultation.'
$schema='Z:\Codex\repos\PHD-Maine-paleography-harness\schema\operational\run-manifest.schema.json'
if(-not(Test-Json -Json ($manifest|ConvertTo-Json -Depth 40) -SchemaFile $schema)){throw 'Final operational schema invalid.'}
NewJson (Join-Path $run 'run-manifest.json') $manifest
$checks=@($outputs|ForEach-Object{$p=if($_.uri.StartsWith('checkout:archive-corrections/')){Join-Path $repository $_.uri.Substring('checkout:archive-corrections/'.Length)}else{$ResultPath};if((HashFile $p) -ne $_.sha256){throw 'Output hash mismatch.'};[ordered]@{logical_id=$_.logical_id;sha256=$_.sha256;passed=$true}})
NewJson (Join-Path $run 'schema-validation.json') ([ordered]@{schema_valid=$true;manifest_sha256=(HashFile (Join-Path $run 'run-manifest.json'));schema_sha256=(HashFile $schema);outputs_verified=$checks;git_invoked=$false;standalone_preview_left_live=$false;test_store_released=$true;root_mount_verified=$false;database_and_secrets_excluded=$true})
[ordered]@{closed=$true;schema_valid=$true;outputs_verified=$checks.Count;old_sources_unchanged=$old.Count;test_store_released=$true;root_mount_verified=$false;manifest_sha256=(HashFile (Join-Path $run 'run-manifest.json'))}|ConvertTo-Json
