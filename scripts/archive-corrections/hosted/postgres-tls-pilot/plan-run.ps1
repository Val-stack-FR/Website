[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$RunDirectory)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repository=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$run=[IO.Path]::GetFullPath($RunDirectory)
$private=Join-Path $repository '.archive-corrections-private'
if (-not $run.StartsWith($private+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -or (Split-Path $run -Leaf) -notmatch '^d7-tls-[a-f0-9-]{36}$') { throw 'Exclusive new D7 run required.' }
if (Test-Path -LiteralPath $run) { throw 'Run directory must not exist.' }
[IO.Directory]::CreateDirectory($run) | Out-Null
function HashFile([string]$p) { (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant() }
function NewJson([string]$p,$v) { $b=[Text.UTF8Encoding]::new($false).GetBytes(($v|ConvertTo-Json -Depth 40)+"`n"); $s=[IO.File]::Open($p,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None); try {$s.Write($b,0,$b.Length)} finally {$s.Dispose()} }
function RandomSecret { [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant() }
$runtimeRun=Join-Path $private 'd6-network-585f1ba2-9954-4ee9-9e44-4512602f2e5c'
$auditedRun=Join-Path $private 'd6-network-83dbf9eb-778d-4253-8484-fb33ad8a5421'
$protocol='Z:\Codex\repos\PHD-Maine-paleography-harness'
$python='C:\Users\Val\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$node='C:\Users\Val\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$crypto=Join-Path (Split-Path $python -Parent) 'Lib/site-packages/cryptography'
if (-not (Test-Path -LiteralPath (Join-Path $crypto '__init__.py'))) { throw 'Existing cryptography required; no installation allowed.' }
if (Test-Path Env:NODE_TLS_REJECT_UNAUTHORIZED) { throw 'TLS override environment refused.' }
$runtimePins=Get-Content -LiteralPath (Join-Path $auditedRun 'runtime-file-pins.json') -Raw|ConvertFrom-Json
foreach($pin in $runtimePins) { if ((HashFile (Join-Path $repository $pin.path)) -ne $pin.sha256) { throw 'Previously verified portable runtime changed.' } }
$archive=Join-Path $runtimeRun 'postgresql-18.6-5-windows-x64-binaries.zip'
if ((HashFile $archive) -ne 'e2246ba91d22345bc3d017586c09ede52d9df180b1eeb480f050445f1cad84e2') { throw 'Official D6 runtime archive pin changed.' }
NewJson (Join-Path $run 'runtime-file-pins.json') $runtimePins
$toolPins=@(@($python,$node) + @(Get-ChildItem -LiteralPath $crypto -File -Recurse|Where-Object {$_.FullName -notmatch '[\\/]__pycache__[\\/]'}|ForEach-Object {$_.FullName}) | ForEach-Object {[ordered]@{path=$_;sha256=(HashFile $_)}})
NewJson (Join-Path $run 'tool-file-pins.json') $toolPins
$d6Input=Get-Content -LiteralPath (Join-Path $auditedRun 'input-manifest.json') -Raw|ConvertFrom-Json
$paths=@($d6Input.source_pins.path|Where-Object {$_ -notmatch 'postgres-network-pilot'})
$paths+=@('scripts/archive-corrections/hosted/serverless/node_modules/pg/lib/connection.js','scripts/archive-corrections/hosted/serverless/node_modules/pg/lib/client.js')
$paths+=@(Get-ChildItem -LiteralPath $PSScriptRoot -File|ForEach-Object {[IO.Path]::GetRelativePath($repository,$_.FullName).Replace('\','/')})
$pins=@($paths|Sort-Object -Unique|ForEach-Object {[ordered]@{path=$_;sha256=(HashFile (Join-Path $repository $_))}})
foreach($pin in $pins) { $copy=Join-Path (Join-Path $run 'source-freeze') $pin.path; [IO.Directory]::CreateDirectory((Split-Path $copy -Parent))|Out-Null; [IO.File]::Copy((Join-Path $repository $pin.path),$copy,$false) }
$roots=@((Join-Path $repository 'scripts/archive-corrections'),(Join-Path $repository 'tests/archive-corrections'),(Join-Path $protocol 'paleography/decision-bridge'))
$baseline=@(foreach($root in $roots) { Get-ChildItem -LiteralPath $root -File -Recurse|Where-Object {$_.FullName -notmatch '[\\/](node_modules|__pycache__|postgres-tls-pilot)[\\/]'}|ForEach-Object {[ordered]@{path=$_.FullName;sha256=(HashFile $_.FullName)}} })
NewJson (Join-Path $run 'frozen-before.json') $baseline
$input=[ordered]@{version='d7-tls-inputs/v1';simulation=$true;identity_verified=$false;scope='invented-private-local-tls';source_pins=$pins;
  runtime_file_pins_sha256=(HashFile (Join-Path $run 'runtime-file-pins.json'));tool_file_pins_sha256=(HashFile (Join-Path $run 'tool-file-pins.json'));
  postgres_archive_sha256=(HashFile $archive);protocol_sha256=(HashFile (Join-Path $protocol 'docs/agent-protocol.md'));
  corpus_preflight='not-applicable: wholly invented fixtures; no historical corpus or originals';
  git_metadata_policy='Inherited from audited D6 run only; no Git invocation or claim about current state.'}
NewJson (Join-Path $run 'input-manifest.json') $input
$inputHash=HashFile (Join-Path $run 'input-manifest.json')
$listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Parse('127.0.0.1'),0); $listener.Start(); $port=$listener.LocalEndpoint.Port; $listener.Stop()
$suffix=[Guid]::NewGuid().ToString('N').Substring(0,8)
$configuration=[ordered]@{version='d7-tls-config/v1';repository=$repository;run_directory=$run;protocol_repository=$protocol;node_executable=$node;python_executable=$python;
  runtime_directory=(Join-Path $runtimeRun 'runtime');host='127.0.0.1';port=$port;simulation=$true;identity_verified=$false;origin='https://d7-fixture.example.test';
  main_database='postgres';schema=('archive_corrections_d5_d7_'+$suffix);restore_schema=('archive_corrections_d5_d7restore_'+$suffix);
  operator_user=('d7_operator_'+$suffix);operator_password=(RandomSecret);runtime_password=(RandomSecret);owner_passphrase=(RandomSecret);hmac_key=(RandomSecret);
  source_pins=$pins;source_manifest_sha256=$inputHash}
NewJson (Join-Path $run 'config.private.json') $configuration
$passwordBytes=[Text.UTF8Encoding]::new($false).GetBytes($configuration.operator_password+"`n")
$passwordStream=[IO.File]::Open((Join-Path $run 'postgres-password.private.txt'),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
try {$passwordStream.Write($passwordBytes,0,$passwordBytes.Length)} finally {$passwordStream.Dispose()}
NewJson (Join-Path $run 'preflight.json') ([ordered]@{version='d7-tls-preflight/v1';passed=$true;checked_at=[DateTime]::UtcNow.ToString('o');database_already_started=$false;
  certificates_already_generated=$false;host='127.0.0.1';port=$port;source_manifest_sha256=$inputHash;runtime_pinned_files=$runtimePins.Count;tool_pinned_files=$toolPins.Count;
  certificate_tool='existing Python cryptography 50.0.1; no download';trust='CA only in NODE_EXTRA_CA_CERTS at launch of owned Node processes';
  gate='D5 default createNetworkDriver: correct CA pg_stat_ssl; wrong CA refused; trusted wrong SAN refused';
  secrets_excluded_from_evidence=$true;corpus_preflight='not-applicable';no_git=$true;no_system_trust_store=$true;no_remote_service=$true})
$d6Run=Get-Content -LiteralPath (Join-Path $auditedRun 'run-manifest.json') -Raw|ConvertFrom-Json
$manifest=[ordered]@{schema_version='1.0.0';run_id=(Split-Path $run -Leaf);operation='review';started_at=[DateTime]::UtcNow.ToString('o');
  session_urls=@('codex://threads/01a1033e-ed6e-77f3-a716-9f5f599ba5e6');agent=[ordered]@{provider='OpenAI';model='GPT-6 (Codex; exact runtime identifier unavailable)';role='executor';method_version='d7-tls/v1'};
  inputs=[ordered]@{manifest_version='d7-tls-inputs/v1';manifest_sha256=$inputHash;corpus_root_reference='env:PHD_CORPUS_ROOT';manifest_uri=('checkout:archive-corrections/'+[IO.Path]::GetRelativePath($repository,(Join-Path $run 'input-manifest.json')).Replace('\','/'))};
  git=$d6Run.git;outputs=@([ordered]@{logical_id='d7:preflight';uri=('checkout:archive-corrections/'+[IO.Path]::GetRelativePath($repository,(Join-Path $run 'preflight.json')).Replace('\','/'));sha256=(HashFile (Join-Path $run 'preflight.json'));media_type='application/json';rights_status='not-applicable'});
  validation=[ordered]@{schema_valid=$true;output_hashes_verified=$true;provenance_complete=$true;rights_review='not-required';human_review_status='pending';notes='PRE-OPERATION. No certificate generation or PostgreSQL execution. Git metadata inherited from D6 and not refreshed; no Git. Invented fixture, no corpus.'};publication=[ordered]@{status='private'}}
if (-not (Test-Json -Json ($manifest|ConvertTo-Json -Depth 40) -SchemaFile (Join-Path $protocol 'schema/operational/run-manifest.schema.json'))) { throw 'Pre-operation schema failed.' }
NewJson (Join-Path $run 'run-manifest-before-execution.json') $manifest
[ordered]@{prepared=$true;run=$run;source_pins=$pins.Count;runtime_pins=$runtimePins.Count;tool_pins=$toolPins.Count;port=$port;no_git=$true;no_postgres_started=$true;no_certificates_generated=$true}|ConvertTo-Json
