[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$RunDirectory)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repository=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'));$run=[IO.Path]::GetFullPath($RunDirectory)
$private=Join-Path $repository '.archive-corrections-private'
if(-not $run.StartsWith($private+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -or (Split-Path $run -Leaf) -notmatch '^d8-integrated-[a-f0-9-]{36}$' -or (Test-Path -LiteralPath $run)){throw 'New exclusive D8 run required.'}
[IO.Directory]::CreateDirectory($run)|Out-Null
function HashFile([string]$p){(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant()}
function NewJson([string]$p,$v){$b=[Text.UTF8Encoding]::new($false).GetBytes(($v|ConvertTo-Json -Depth 40)+"`n");$s=[IO.File]::Open($p,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);try{$s.Write($b,0,$b.Length)}finally{$s.Dispose()}}
function RandomSecret{[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant()}
$d7=Join-Path $private 'd7-tls-01dceeb2-337d-4784-a51e-0a5b5ce77026'
$d7Inputs=Get-Content -LiteralPath (Join-Path $d7 'input-manifest.json') -Raw|ConvertFrom-Json
$oldPins=@(Get-Content -LiteralPath (Join-Path $d7 'frozen-before.json') -Raw|ConvertFrom-Json)
$oldPins+=@($d7Inputs.source_pins|Where-Object {$_.path -like 'scripts/archive-corrections/hosted/postgres-tls-pilot/*'}|ForEach-Object {[ordered]@{path=(Join-Path $repository $_.path);sha256=$_.sha256}})
foreach($pin in $oldPins){if((HashFile $pin.path) -ne $pin.sha256){throw 'Previously frozen D3/D4/D5/D6/D7/H06 source changed.'}}
NewJson (Join-Path $run 'frozen-before.json') $oldPins
$bundle=Join-Path $private 'binding-test-682005b0-687d-4d04-be85-35d1be72a012'
$bundlePins=[ordered]@{'export-candidate.json'='c037723e0a90b5b03f3e535d3781bb49ae6e99e99da5e719c2cf09d5af09226c';'research-package.json'='ce07b1bd18adb2b6739e0afa62b628c7fdbd42312908fd99a11d656569bf4faf';'source-input-manifest.json'='28acce7928f17b8c7a3b39f24933273730ae691107678b876b840ee8c04a3148';'preflight-report.json'='103d3e8fabd2d4574298905435023d4d5c49aa47b5d9063aa9aff0af25f30df2';'media-allowlist.json'='64c6406d1d88ff24e4268e75a8066a194decf999c75199d6caf9f836655edd59';'verification-final.json'='b3af3430348d20901018fc9b9f066313d163165243ffd27661122837cb9ef689'}
$derivatives=Join-Path $run 'derivatives';[IO.Directory]::CreateDirectory($derivatives)|Out-Null
foreach($name in $bundlePins.Keys){$p=Join-Path $bundle $name;if((HashFile $p) -ne $bundlePins[$name]){throw 'Closed D3 derivative hash mismatch.'};[IO.File]::Copy($p,(Join-Path $derivatives $name),$false)}
NewJson (Join-Path $run 'derivative-input-manifest.json') ([ordered]@{version='d8-one-derivative-intake/v1';text_id='text:atelier-494756c2009be577ad11a5eb0a662d38';files=$bundlePins;
  rights='authorized private local consultation only';review_scope='accepted digital-object association only; historical reading remains unreviewed';source_preflight='pinned D3 preflight-report, consumed by unchanged reader-binding';originals_read=$false;catalogue_scope='one witness; no H07 or E108';publication_approved=$false})
$paths=@('scripts/archive-corrections/contract.mjs','scripts/archive-corrections/fixture.mjs','scripts/archive-corrections/reader-binding.mjs','scripts/archive-corrections/snapshot-validation.mjs',
 'scripts/archive-corrections/hosted/drivers.mjs','scripts/archive-corrections/hosted/postgres-store.mjs','scripts/archive-corrections/hosted/migrations/001.sql',
 'scripts/archive-corrections/hosted/serverless/store.mjs','scripts/archive-corrections/hosted/serverless/sessions.mjs','scripts/archive-corrections/hosted/serverless/handler.mjs','scripts/archive-corrections/hosted/serverless/migrations/002.sql',
 'scripts/archive-corrections/hosted/package.json','scripts/archive-corrections/hosted/pnpm-lock.yaml')
$paths+=@(Get-ChildItem -LiteralPath $PSScriptRoot -File|ForEach-Object {[IO.Path]::GetRelativePath($repository,$_.FullName).Replace('\','/')})
$pins=@($paths|Sort-Object -Unique|ForEach-Object {[ordered]@{path=$_;sha256=(HashFile (Join-Path $repository $_))}})
foreach($pin in $pins){$target=Join-Path (Join-Path $run 'source-freeze') $pin.path;[IO.Directory]::CreateDirectory((Split-Path $target -Parent))|Out-Null;[IO.File]::Copy((Join-Path $repository $pin.path),$target,$false)}
$engine=Join-Path $repository 'scripts/archive-corrections/hosted/node_modules/@electric-sql/pglite'
$package=Get-Content -LiteralPath (Join-Path $engine 'package.json') -Raw|ConvertFrom-Json
if($package.version -ne '0.5.8'){throw 'Existing PGlite 0.5.8 required; no install.'}
$enginePins=@(Get-ChildItem -LiteralPath $engine -File -Recurse|ForEach-Object {[ordered]@{path=[IO.Path]::GetRelativePath($repository,$_.FullName).Replace('\','/');sha256=(HashFile $_.FullName)}})
NewJson (Join-Path $run 'engine-file-pins.json') $enginePins
$node='C:\Users\Val\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$input=[ordered]@{version='d8-integrated-inputs/v1';source_pins=$pins;engine_file_pins_sha256=(HashFile (Join-Path $run 'engine-file-pins.json'));node_sha256=(HashFile $node);
 derivative_manifest_sha256=(HashFile (Join-Path $run 'derivative-input-manifest.json'));derivative_files=$bundlePins;originals_read=$false;
 corpus_preflight='not-applicable to originals; only six hash-closed authorized D3 derivatives';scope='one real witness plus disjoint invented fixture';human_identity_verified=$false;
 git_metadata_policy='Inherited from closed D7 manifest only; no Git command or current-state assertion'}
NewJson (Join-Path $run 'input-manifest.json') $input
$listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Parse('127.0.0.1'),0);$listener.Start();$port=$listener.LocalEndpoint.Port;$listener.Stop()
$config=[ordered]@{version='d8-integrated-config/v1';repository=$repository;run_directory=$run;node_executable=$node;listen_host='127.0.0.1';listen_port=$port;public_origin='http://127.0.0.1:8810';
 simulation=$true;identity_verified=$false;human_validation_enabled=$false;fixture_owner_passphrase=(RandomSecret);session_hmac_key=(RandomSecret);control_secret=(RandomSecret);source_pins=$pins;
 input_manifest_sha256=(HashFile (Join-Path $run 'input-manifest.json'))}
NewJson (Join-Path $run 'config.private.json') $config
NewJson (Join-Path $run 'mount-contract.json') ([ordered]@{version='d8-same-origin-mount/v1';reader_origin=$config.public_origin;backend=('http://127.0.0.1:'+$port);
 prefixes=@('/api/archive/preview/','/api/archive/fixture/');preview_passage_id='text:atelier-494756c2009be577ad11a5eb0a662d38';
 host_header=(New-Object Uri($config.public_origin)).Authority;forward_origin_unchanged=$true;post_origin_required=$true;forward_cookie_csrf_idempotency_unchanged=$true;cors_headers_allowed=$false;
 proxy_must_not_forward='/__d8_control__/';historical_decisions_enabled=$false;fixture_decisions='private SQL test session only';browser_auth_qa='not attempted; previous auto-review refusals preserved';root_proxy_mounted=$false})
NewJson (Join-Path $run 'preflight.json') ([ordered]@{version='d8-integrated-preflight/v1';passed=$true;checked_at=[DateTime]::UtcNow.ToString('o');database_already_started=$false;
 input_manifest_sha256=$config.input_manifest_sha256;derivative_hashes_valid=$true;derivative_count=6;originals_read=$false;runtime='existing persistent PGlite 0.5.8';engine_pins=$enginePins.Count;
 public_origin=$config.public_origin;listen_host='127.0.0.1';listen_port=$port;fixture_and_real_namespaces_separate=$true;historical_decisions_disabled=$true;secrets_excluded=$true;
 no_git=$true;no_install=$true;no_remote_service=$true;no_browser=$true;protocol_sha256=(HashFile 'Z:\Codex\repos\PHD-Maine-paleography-harness\docs\agent-protocol.md')})
$d7Manifest=Get-Content -LiteralPath (Join-Path $d7 'run-manifest.json') -Raw|ConvertFrom-Json
$manifest=[ordered]@{schema_version='1.0.0';run_id=(Split-Path $run -Leaf);operation='review';started_at=[DateTime]::UtcNow.ToString('o');session_urls=@('codex://threads/01a1033e-ed6e-77f3-a716-9f5f599ba5e6');
 agent=[ordered]@{provider='OpenAI';model='GPT-6 (Codex; exact runtime identifier unavailable)';role='executor';method_version='d8-integrated/v1'};
 inputs=[ordered]@{manifest_version=$input.version;manifest_sha256=$config.input_manifest_sha256;corpus_root_reference='env:PHD_CORPUS_ROOT';manifest_uri=('checkout:archive-corrections/'+[IO.Path]::GetRelativePath($repository,(Join-Path $run 'input-manifest.json')).Replace('\','/'))};git=$d7Manifest.git;
 outputs=@([ordered]@{logical_id='d8:preflight';uri=('checkout:archive-corrections/'+[IO.Path]::GetRelativePath($repository,(Join-Path $run 'preflight.json')).Replace('\','/'));sha256=(HashFile (Join-Path $run 'preflight.json'));media_type='application/json';rights_status='restricted'});
 validation=[ordered]@{schema_valid=$true;output_hashes_verified=$true;provenance_complete=$true;rights_review='passed';human_review_status='pending';notes='PRE-EXECUTION. Six D3 derivative hashes closed; rights passed for private local consultation only, historical reading remains unreviewed. No originals, SQL/database or service executed. Git metadata inherited, no Git. No browser.'};publication=[ordered]@{status='private'}}
if(-not(Test-Json -Json ($manifest|ConvertTo-Json -Depth 40) -SchemaFile 'Z:\Codex\repos\PHD-Maine-paleography-harness\schema\operational\run-manifest.schema.json')){throw 'Pre-execution operational schema invalid.'}
NewJson (Join-Path $run 'run-manifest-before-execution.json') $manifest
[ordered]@{prepared=$true;run=$run;backend=('http://127.0.0.1:'+$port);reader_origin=$config.public_origin;source_pins=$pins.Count;engine_pins=$enginePins.Count;frozen_old_sources=$oldPins.Count;derivatives=6;originals_read=$false}|ConvertTo-Json
