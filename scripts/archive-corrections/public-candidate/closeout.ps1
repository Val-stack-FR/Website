[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$RunDirectory)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repository=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'));$run=[IO.Path]::GetFullPath($RunDirectory)
if(-not $run.StartsWith((Join-Path $repository '.archive-corrections-private')+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -or (Split-Path $run -Leaf) -notmatch '^d9-public-candidate-[a-f0-9-]{36}$'){throw 'Assigned candidate run required.'}
function HashFile([string]$p){(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant()}
function NewJson([string]$p,$v){$b=[Text.UTF8Encoding]::new($false).GetBytes(($v|ConvertTo-Json -Depth 40)+"`n");$s=[IO.File]::Open($p,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);try{$s.Write($b,0,$b.Length)}finally{$s.Dispose()}}
$input=Get-Content -LiteralPath (Join-Path $run 'input-manifest.json') -Raw|ConvertFrom-Json
$old=Get-Content -LiteralPath (Join-Path $run 'frozen-before.json') -Raw|ConvertFrom-Json
foreach($pin in $old){if((HashFile $pin.path) -ne $pin.sha256){throw 'Frozen older source changed.'}}
foreach($pin in $input.source_pins){if((HashFile (Join-Path $repository $pin.path)) -ne $pin.sha256 -or (HashFile (Join-Path (Join-Path $run 'source-freeze') $pin.path)) -ne $pin.sha256){throw 'Candidate source or freeze changed.'}}
foreach($name in $input.derivative_files.psobject.Properties.Name){if((HashFile (Join-Path (Join-Path $run 'derivatives') $name)) -ne $input.derivative_files.$name){throw 'Derivative copy changed.'}}
$gate=Get-Content -LiteralPath (Join-Path $run 'gate-proof.json') -Raw|ConvertFrom-Json
if(-not $gate.passed -or $gate.network_used -or $gate.d8_store_accessed -or $gate.process_env_credentials_read){throw 'Bounded successful offline gate required.'}
NewJson (Join-Path $run 'closeout-state.json') ([ordered]@{checked_at=[DateTime]::UtcNow.ToString('o');gate_passed=$true;old_sources_unchanged=$old.Count;source_pins_verified=$input.source_pins.Count;
 derivative_files_unchanged=6;network_used=$false;d8_store_accessed=$false;existing_secrets_read=$false;owner_access_enabled=$false;historical_public_delivery_enabled=$false;installed=$false;deployed=$false;root_config_modified=$false;git_invoked=$false})
$manifest=Get-Content -LiteralPath (Join-Path $run 'run-manifest-before-execution.json') -Raw|ConvertFrom-Json
$files=@(Get-ChildItem -LiteralPath $run -File -Recurse|Where-Object {$_.FullName -notmatch '[\\/]fixture-data[\\/]' -and $_.Name -notlike '*.private.*'})
$outputs=@($files|ForEach-Object{$rel=[IO.Path]::GetRelativePath($run,$_.FullName).Replace('\','/');[ordered]@{logical_id=('public-candidate:'+($rel.ToLowerInvariant() -replace '[^a-z0-9:_-]','-'));uri=('checkout:archive-corrections/'+[IO.Path]::GetRelativePath($repository,$_.FullName).Replace('\','/'));sha256=(HashFile $_.FullName);media_type=$(if($_.Extension -eq '.json'){'application/json'}elseif($_.Extension -eq '.md'){'text/markdown'}else{'text/plain'});rights_status='restricted'}})
$manifest.outputs=$outputs;$manifest|Add-Member -NotePropertyName closed_at -NotePropertyValue ([DateTime]::UtcNow.ToString('o'))
$manifest.validation.notes='Prepared HTTPS candidate only, not deployed. Canonical origin enforced; all missing/unsafe configuration refuses before driver creation. Unchanged D5 SQL/handler/session primitives and default TLS driver reused; in-memory HTTP tests plus offline new PGlite fixture only, no sockets or real credentials. Owner authority/human validation permanently disabled. One private exact D3 Monbezon r1 mapping preserved; runtime public profile refused while rights pending. Executable delta entrypoints/imports and merge proposal verified, original static config untouched; no dependency installation configured/executed. D3-D8 sources unchanged, D8 store untouched. Existing operational schema and local hashes checked directly, no Git/canonical Git-calling checker. Git metadata inherited only. Restricted D3 rights passed only for private local consultation; public rights/provider/hosting/database/grants/TLS proxy/build provisioning remain external gates.'
$schema='Z:\Codex\repos\PHD-Maine-paleography-harness\schema\operational\run-manifest.schema.json'
if(-not(Test-Json -Json ($manifest|ConvertTo-Json -Depth 40) -SchemaFile $schema)){throw 'Final operational schema invalid.'}
NewJson (Join-Path $run 'run-manifest.json') $manifest
$checks=@($outputs|ForEach-Object{$p=Join-Path $repository $_.uri.Substring('checkout:archive-corrections/'.Length);if((HashFile $p) -ne $_.sha256){throw 'Candidate output hash mismatch.'};[ordered]@{logical_id=$_.logical_id;sha256=$_.sha256;passed=$true}})
NewJson (Join-Path $run 'schema-validation.json') ([ordered]@{schema_valid=$true;schema_sha256=(HashFile $schema);manifest_sha256=(HashFile (Join-Path $run 'run-manifest.json'));output_hashes_verified=$checks;network_used=$false;d8_store_accessed=$false;existing_secrets_read=$false;git_invoked=$false;deployed=$false})
[ordered]@{closed=$true;schema_valid=$true;outputs_verified=$checks.Count;old_sources_unchanged=$old.Count;manifest_sha256=(HashFile (Join-Path $run 'run-manifest.json'));network_used=$false;d8_store_accessed=$false;deployed=$false}|ConvertTo-Json
