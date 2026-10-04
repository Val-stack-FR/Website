[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$RunDirectory)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'));$run=[IO.Path]::GetFullPath($RunDirectory)
if((Split-Path $run -Parent) -ne (Join-Path $repo '.archive-corrections-private') -or (Split-Path $run -Leaf) -notmatch '^d10-public-wip-[a-f0-9-]{36}$'){throw 'Assigned D10 run required'}
function HashFile([string]$p){(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant()}
function NewJson([string]$p,$value){$bytes=[Text.UTF8Encoding]::new($false).GetBytes(($value|ConvertTo-Json -Depth 60)+"`n");$out=[IO.File]::Open($p,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);try{$out.Write($bytes,0,$bytes.Length)}finally{$out.Dispose()}}
$input=Get-Content -Raw -LiteralPath (Join-Path $run 'input-manifest.json')|ConvertFrom-Json
$contextInput=Get-Content -Raw -LiteralPath (Join-Path $run 'context-input-manifest.json')|ConvertFrom-Json
foreach($pin in $contextInput.old_sources){if((HashFile $pin.path) -ne $pin.sha256){throw 'Older frozen source changed'}}
foreach($pin in $input.source_pins){if((HashFile (Join-Path $repo $pin.path)) -ne $pin.sha256 -or (HashFile (Join-Path (Join-Path $run 'source-freeze') $pin.path)) -ne $pin.sha256){throw 'Pinned source changed'}}
foreach($pin in (Get-Content -Raw -LiteralPath (Join-Path $run 'engine-file-pins.json')|ConvertFrom-Json)){if((HashFile (Join-Path $repo $pin.path)) -ne $pin.sha256){throw 'Engine changed'}}
foreach($p in $input.derivative_files.psobject.Properties){if((HashFile (Join-Path (Join-Path $run 'derivatives') $p.Name)) -ne $p.Value){throw 'Closed derivative changed'}}
$d9=Join-Path $repo '.archive-corrections-private/d9-public-candidate-abe625f5-930d-4700-ae9a-dca1472d84fd/run-manifest.json'
if((HashFile $d9) -ne $input.source_closed_manifest_sha256){throw 'D9 closed manifest changed'}
$gate=Get-Content -Raw -LiteralPath (Join-Path $run 'gate-proof.json')|ConvertFrom-Json
if(-not $gate.passed -or -not $gate.offline_engine_closed -or $gate.network_used -or $gate.d8_store_accessed -or $gate.process_env_credentials_read){throw 'Successful bounded closed offline gate required'}
$allow=Get-Content -Raw -LiteralPath (Join-Path $run 'runtime-allowlist.json')|ConvertFrom-Json
$allowItems=@($allow.runtime_files)+@($allow.generated_files)+@($allow.dependency_manifests)
foreach($pin in $allowItems){if((HashFile $pin.source_path) -ne $pin.sha256){throw 'Allowlist item changed'}}
NewJson (Join-Path $run 'closeout-state.json') ([ordered]@{checked_at=[DateTime]::UtcNow.ToString('o');gate_passed=$true;offline_engine_closed=$true;old_sources_unchanged=$contextInput.old_sources.Count;
 source_pins_verified=$input.source_pins.Count;derivatives_unchanged=6;runtime_allowlist_files=$allowItems.Count;closed_d9_unchanged=$true;source_context_unchanged=$true;user_wip_delivery_authorized=$true;
 rights_review='pending';historical_reading_validated=$false;owner_enabled=$false;decisions_enabled=$false;d8_store_accessed=$false;existing_secrets_read=$false;network_used=$false;git_invoked=$false;installed=$false;deployed=$false;author_vercel_modified=$false})
$manifest=Get-Content -Raw -LiteralPath (Join-Path $run 'run-manifest-before-execution.json')|ConvertFrom-Json
$files=@(Get-ChildItem -LiteralPath $run -File -Recurse|Where-Object {$_.FullName -notmatch '[\\/]historical-gate-data[\\/]'})
$outputs=@($files|ForEach-Object{$rel=[IO.Path]::GetRelativePath($run,$_.FullName).Replace('\','/');[ordered]@{logical_id=('public-wip:'+($rel.ToLowerInvariant() -replace '[^a-z0-9:_-]','-'));uri=('checkout:archive-corrections/'+[IO.Path]::GetRelativePath($repo,$_.FullName).Replace('\','/'));sha256=(HashFile $_.FullName);media_type=$(if($_.Extension -eq '.json'){'application/json'}elseif($_.Extension -eq '.md'){'text/markdown'}else{'text/plain'});rights_status='restricted'}})
$manifest.outputs=$outputs;$manifest|Add-Member -NotePropertyName closed_at -NotePropertyValue ([DateTime]::UtcNow.ToString('o'))
$manifest.validation.notes='D10 real Monbezon WIP candidate prepared, not deployed. Exact D3 context/r1 and all six closed derivatives unchanged; separate explicit human mandate authorizes WIP delivery and anonymous proposals without approving rights or historical reading. In-memory HTTPS/loopback requests plus one new offline PGlite database; exact operator seed, GET, one technical no-text-change proposal/idempotency, unchanged r1 and zero decisions, owner endpoints 403 before SQL. Configuration/artifacts refuse before pool. Default TLS driver and D5 primitives unchanged. No original, D8 store, existing secret, network, installation, Git or deployment; author config untouched. Future operator seed/grants/dependency provisioning and runtime values remain external. Git metadata inherited; schema/hashes checked directly, no Git-calling operational checker.'
$schema='Z:\Codex\repos\PHD-Maine-paleography-harness\schema\operational\run-manifest.schema.json'
if(-not(Test-Json -Json ($manifest|ConvertTo-Json -Depth 60) -SchemaFile $schema)){throw 'Final schema invalid'}
NewJson (Join-Path $run 'run-manifest.json') $manifest
foreach($item in $outputs){$p=Join-Path $repo ($item.uri -replace '^checkout:archive-corrections/','');if((HashFile $p) -ne $item.sha256){throw 'Output hash mismatch'}}
NewJson (Join-Path $run 'schema-validation.json') ([ordered]@{schema_valid=$true;manifest_sha256=(HashFile (Join-Path $run 'run-manifest.json'));schema_sha256=(HashFile $schema);outputs_verified=$outputs.Count;input_sha256=(HashFile (Join-Path $run 'input-manifest.json'));git_checker_invoked=$false;deployed=$false})
[ordered]@{closed=$true;schema_valid=$true;outputs_verified=$outputs.Count;old_sources_unchanged=$contextInput.old_sources.Count;manifest_sha256=(HashFile (Join-Path $run 'run-manifest.json'));network_used=$false;d8_store_accessed=$false;deployed=$false}|ConvertTo-Json
