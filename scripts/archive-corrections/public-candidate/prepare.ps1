[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$RunDirectory)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repository=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'));$run=[IO.Path]::GetFullPath($RunDirectory)
$private=Join-Path $repository '.archive-corrections-private'
if(-not $run.StartsWith($private+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -or (Split-Path $run -Leaf) -notmatch '^d9-public-candidate-[a-f0-9-]{36}$' -or (Test-Path -LiteralPath $run)){throw 'New exclusive D9 candidate run required.'}
[IO.Directory]::CreateDirectory($run)|Out-Null
function HashFile([string]$p){(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant()}
function NewJson([string]$p,$v){$b=[Text.UTF8Encoding]::new($false).GetBytes(($v|ConvertTo-Json -Depth 40)+"`n");$s=[IO.File]::Open($p,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);try{$s.Write($b,0,$b.Length)}finally{$s.Dispose()}}
$d7=Join-Path $private 'd7-tls-01dceeb2-337d-4784-a51e-0a5b5ce77026'
$d7Input=Get-Content -LiteralPath (Join-Path $d7 'input-manifest.json') -Raw|ConvertFrom-Json
$old=@(Get-Content -LiteralPath (Join-Path $d7 'frozen-before.json') -Raw|ConvertFrom-Json)
$old+=@($d7Input.source_pins|Where-Object {$_.path -like 'scripts/archive-corrections/hosted/postgres-tls-pilot/*'}|ForEach-Object {[ordered]@{path=(Join-Path $repository $_.path);sha256=$_.sha256}})
foreach($pin in $old){if((HashFile $pin.path) -ne $pin.sha256){throw 'Previously frozen old source changed.'}}
$d8Source=Join-Path $repository 'scripts/archive-corrections/integrated-loopback'
$old+=@(Get-ChildItem -LiteralPath $d8Source -File|ForEach-Object {[ordered]@{path=$_.FullName;sha256=(HashFile $_.FullName)}})
NewJson (Join-Path $run 'frozen-before.json') $old
# No D8 run, configuration, database, lock or endpoint is accessed.
$bundle=Join-Path $private 'binding-test-682005b0-687d-4d04-be85-35d1be72a012'
$bundlePins=[ordered]@{'export-candidate.json'='c037723e0a90b5b03f3e535d3781bb49ae6e99e99da5e719c2cf09d5af09226c';'research-package.json'='ce07b1bd18adb2b6739e0afa62b628c7fdbd42312908fd99a11d656569bf4faf';'source-input-manifest.json'='28acce7928f17b8c7a3b39f24933273730ae691107678b876b840ee8c04a3148';'preflight-report.json'='103d3e8fabd2d4574298905435023d4d5c49aa47b5d9063aa9aff0af25f30df2';'media-allowlist.json'='64c6406d1d88ff24e4268e75a8066a194decf999c75199d6caf9f836655edd59';'verification-final.json'='b3af3430348d20901018fc9b9f066313d163165243ffd27661122837cb9ef689'}
$derivatives=Join-Path $run 'derivatives';[IO.Directory]::CreateDirectory($derivatives)|Out-Null
foreach($name in $bundlePins.Keys){$p=Join-Path $bundle $name;if((HashFile $p) -ne $bundlePins[$name]){throw 'Closed D3 derivative pin mismatch.'};[IO.File]::Copy($p,(Join-Path $derivatives $name),$false)}
[IO.File]::Copy((Join-Path $repository 'vercel.json'),(Join-Path $run 'site-config-reference.json'),$false)
$paths=@('scripts/archive-corrections/contract.mjs','scripts/archive-corrections/fixture.mjs','scripts/archive-corrections/snapshot-validation.mjs','scripts/archive-corrections/reader-binding.mjs',
 'scripts/archive-corrections/hosted/drivers.mjs','scripts/archive-corrections/hosted/postgres-store.mjs','scripts/archive-corrections/hosted/migrations/001.sql',
 'scripts/archive-corrections/hosted/serverless/store.mjs','scripts/archive-corrections/hosted/serverless/sessions.mjs','scripts/archive-corrections/hosted/serverless/handler.mjs','scripts/archive-corrections/hosted/serverless/network.mjs',
 'scripts/archive-corrections/hosted/serverless/migrations/002.sql','scripts/archive-corrections/hosted/serverless/migrations/runtime-grants.sql','scripts/archive-corrections/hosted/serverless/package.json','scripts/archive-corrections/hosted/serverless/pnpm-lock.yaml')
$paths+=@(Get-ChildItem -LiteralPath $PSScriptRoot -File|ForEach-Object {[IO.Path]::GetRelativePath($repository,$_.FullName).Replace('\','/')})
$pins=@($paths|Sort-Object -Unique|ForEach-Object {[ordered]@{path=$_;sha256=(HashFile (Join-Path $repository $_))}})
foreach($pin in $pins){$target=Join-Path (Join-Path $run 'source-freeze') $pin.path;[IO.Directory]::CreateDirectory((Split-Path $target -Parent))|Out-Null;[IO.File]::Copy((Join-Path $repository $pin.path),$target,$false)}
$engine=Join-Path $repository 'scripts/archive-corrections/hosted/node_modules/@electric-sql/pglite'
if((Get-Content -LiteralPath (Join-Path $engine 'package.json') -Raw|ConvertFrom-Json).version -ne '0.5.8'){throw 'Existing PGlite required; no install.'}
$enginePins=@(Get-ChildItem -LiteralPath $engine -File -Recurse|ForEach-Object {[ordered]@{path=[IO.Path]::GetRelativePath($repository,$_.FullName).Replace('\','/');sha256=(HashFile $_.FullName)}})
NewJson (Join-Path $run 'engine-file-pins.json') $enginePins
$node='C:\Users\Val\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$input=[ordered]@{version='public-candidate-inputs/v1';source_pins=$pins;engine_pins_sha256=(HashFile (Join-Path $run 'engine-file-pins.json'));node_sha256=(HashFile $node);
 derivative_files=$bundlePins;site_config_reference_sha256=(HashFile (Join-Path $run 'site-config-reference.json'));scope='fixture HTTPS routing in memory plus exact private Monbezon mapping';
 rights='D3 derivatives authorized for private local consultation only, public rights pending';originals_read=$false;d8_store_accessed=$false;existing_secrets_read=$false;network_allowed=$false;
 git_metadata_policy='Inherited from closed D7 run only; no Git invocation or current-state assertion';protocol_sha256=(HashFile 'Z:\Codex\repos\PHD-Maine-paleography-harness\docs\agent-protocol.md')}
NewJson (Join-Path $run 'input-manifest.json') $input
NewJson (Join-Path $run 'preflight.json') ([ordered]@{version='public-candidate-preflight/v1';passed=$true;checked_at=[DateTime]::UtcNow.ToString('o');database_or_network_started=$false;
 input_manifest_sha256=(HashFile (Join-Path $run 'input-manifest.json'));source_pins=$pins.Count;engine_pins=$enginePins.Count;derivative_pins=6;canonical_origin='https://valerianteissier.com';
 endpoint_tests='in-memory request/response only; invented configuration; offline new PGlite fixture directory';runtime_env_credentials_read=$false;d8_store_accessed=$false;owner_access_disabled=$true;
 publication_rights_pending=$true;corpus_preflight='not-applicable to originals: six closed authorized D3 derivatives only';no_git=$true;no_install=$true;no_network=$true;no_deployment=$true})
$previous=Get-Content -LiteralPath (Join-Path $d7 'run-manifest.json') -Raw|ConvertFrom-Json
$manifest=[ordered]@{schema_version='1.0.0';run_id=(Split-Path $run -Leaf);operation='review';started_at=[DateTime]::UtcNow.ToString('o');session_urls=@('codex://threads/01a1033e-ed6e-77f3-a716-9f5f599ba5e6');
 agent=[ordered]@{provider='OpenAI';model='GPT-6 (Codex; exact runtime identifier unavailable)';role='executor';method_version='public-candidate/v1'};
 inputs=[ordered]@{manifest_version=$input.version;manifest_sha256=(HashFile (Join-Path $run 'input-manifest.json'));corpus_root_reference='env:PHD_CORPUS_ROOT';manifest_uri=('checkout:archive-corrections/'+[IO.Path]::GetRelativePath($repository,(Join-Path $run 'input-manifest.json')).Replace('\','/'))};git=$previous.git;
 outputs=@([ordered]@{logical_id='public-candidate:preflight';uri=('checkout:archive-corrections/'+[IO.Path]::GetRelativePath($repository,(Join-Path $run 'preflight.json')).Replace('\','/'));sha256=(HashFile (Join-Path $run 'preflight.json'));media_type='application/json';rights_status='restricted'});
 validation=[ordered]@{schema_valid=$true;output_hashes_verified=$true;provenance_complete=$true;rights_review='passed';human_review_status='pending';notes='PRE-EXECUTION. Restricted rights approved only for private local D3 derivative consultation. No original, D8 store, credential, SQL, network, installation or deployment accessed. Git metadata inherited from D7, not refreshed.'};publication=[ordered]@{status='private'}}
if(-not(Test-Json -Json ($manifest|ConvertTo-Json -Depth 40) -SchemaFile 'Z:\Codex\repos\PHD-Maine-paleography-harness\schema\operational\run-manifest.schema.json')){throw 'Pre-execution schema invalid.'}
NewJson (Join-Path $run 'run-manifest-before-execution.json') $manifest
[ordered]@{prepared=$true;run=$run;source_pins=$pins.Count;engine_pins=$enginePins.Count;old_sources=$old.Count;derivatives=6;network_allowed=$false;d8_store_accessed=$false;secrets_read=$false}|ConvertTo-Json
