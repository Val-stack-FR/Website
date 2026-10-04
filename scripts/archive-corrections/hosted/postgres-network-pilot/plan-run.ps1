[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$RunDirectory,
  [Parameter(Mandatory=$true)][string]$NodeExecutable,
  [Parameter(Mandatory=$true)][string]$ProtocolRepository,
  [string]$RuntimeRunDirectory
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repository=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$run=[IO.Path]::GetFullPath($RunDirectory)
$private=[IO.Path]::GetFullPath((Join-Path $repository '.archive-corrections-private'))
if (-not $run.StartsWith($private+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -or (Split-Path $run -Leaf) -notlike 'd6-network-*') { throw 'Assigned private D6 run required.' }
if (-not $RuntimeRunDirectory) { $RuntimeRunDirectory=$run }
$runtimeRun=[IO.Path]::GetFullPath($RuntimeRunDirectory)
if (-not $runtimeRun.StartsWith($private+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Read-only private runtime required.' }
[IO.Directory]::CreateDirectory($run) | Out-Null
function HashFile([string]$Path) { (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
function NewJson([string]$Path,$Value) {
  $bytes=[Text.UTF8Encoding]::new($false).GetBytes(($Value | ConvertTo-Json -Depth 40)+"`n")
  $stream=[IO.File]::Open($Path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  try { $stream.Write($bytes,0,$bytes.Length) } finally { $stream.Dispose() }
}
function PrivateText([string]$Path,[string]$Value) {
  $bytes=[Text.UTF8Encoding]::new($false).GetBytes($Value+"`n")
  $stream=[IO.File]::Open($Path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  try { $stream.Write($bytes,0,$bytes.Length) } finally { $stream.Dispose() }
}
function RandomSecret { [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant() }
$runtime=Get-Content -LiteralPath (Join-Path $runtimeRun 'runtime-provenance.json') -Raw | ConvertFrom-Json
if ($runtime.distribution_version -ne '18.6-5' -or $runtime.archive_uri -ne 'https://get.enterprisedb.com/postgresql/postgresql-18.6-5-windows-x64-binaries.zip') { throw 'Verified official version required.' }
$archive=Join-Path $runtimeRun 'postgresql-18.6-5-windows-x64-binaries.zip'
if ((HashFile $archive) -ne $runtime.archive_sha256) { throw 'Downloaded archive checksum changed.' }
$runtimeDirectory=Join-Path $runtimeRun 'runtime'
foreach ($exe in $runtime.executables) {
  if ((HashFile (Join-Path $runtimeRun $exe.relative_path)) -ne $exe.sha256) { throw 'Runtime executable checksum changed.' }
}
$runtimePins=@(Get-ChildItem -LiteralPath $runtimeDirectory -File -Recurse | ForEach-Object {
  [ordered]@{path=[IO.Path]::GetRelativePath($repository,$_.FullName).Replace('\','/'); sha256=(HashFile $_.FullName)}
})
NewJson (Join-Path $run 'runtime-file-pins.json') $runtimePins
$paths=@(
  'scripts/archive-corrections/contract.mjs','scripts/archive-corrections/fixture.mjs','scripts/archive-corrections/snapshot-validation.mjs',
  'scripts/archive-corrections/hosted/postgres-store.mjs','scripts/archive-corrections/hosted/migrations/001.sql',
  'scripts/archive-corrections/hosted/serverless/store.mjs','scripts/archive-corrections/hosted/serverless/sessions.mjs',
  'scripts/archive-corrections/hosted/serverless/handler.mjs','scripts/archive-corrections/hosted/serverless/network.mjs',
  'scripts/archive-corrections/hosted/serverless/migrations/002.sql','scripts/archive-corrections/hosted/serverless/migrations/runtime-grants.sql',
  'scripts/archive-corrections/hosted/serverless/package.json','scripts/archive-corrections/hosted/serverless/pnpm-lock.yaml',
  'scripts/archive-corrections/hosted/serverless/node_modules/pg/package.json','scripts/archive-corrections/hosted/serverless/node_modules/pg/lib/index.js'
)
$paths+=@(Get-ChildItem -LiteralPath $PSScriptRoot -File | ForEach-Object {[IO.Path]::GetRelativePath($repository,$_.FullName).Replace('\','/')})
$paths+=@(Get-ChildItem -LiteralPath (Join-Path $repository 'tests/archive-corrections/postgres-network-pilot') -File | ForEach-Object {[IO.Path]::GetRelativePath($repository,$_.FullName).Replace('\','/')})
$pins=@($paths | Sort-Object -Unique | ForEach-Object {[ordered]@{path=$_; sha256=(HashFile (Join-Path $repository $_))}})
foreach($pin in $pins) {
  $copy=Join-Path (Join-Path $run 'source-freeze') $pin.path
  [IO.Directory]::CreateDirectory((Split-Path $copy -Parent)) | Out-Null
  [IO.File]::Copy((Join-Path $repository $pin.path),$copy,$false)
  if ((HashFile $copy) -ne $pin.sha256) { throw 'Immutable source copy mismatch.' }
}
$handler=($pins | Where-Object path -eq 'scripts/archive-corrections/hosted/serverless/handler.mjs').sha256
if ($handler -ne '1a2235125ab644bfe3b031750ef4c9c650bd334d18d7bf37076a1e30bfa1ba33') { throw 'Root-reviewed corrected D5 handler pin required.' }
$pgPackage=Get-Content -LiteralPath (Join-Path $repository 'scripts/archive-corrections/hosted/serverless/node_modules/pg/package.json') -Raw | ConvertFrom-Json
if ($pgPackage.version -ne '8.23.1') { throw 'Existing locked pg 8.23.1 required; no install.' }
$inputPath=Join-Path $run 'input-manifest.json'
NewJson $inputPath ([ordered]@{version='d6-network-inputs/v1'; scope='fixture'; simulation=$true; identity_verified=$false;
  source_pins=$pins; postgres_distribution=$runtime; runtime_file_pins_sha256=(HashFile (Join-Path $run 'runtime-file-pins.json'));
  corpus_accessed=$false; corpus_preflight='not-applicable: wholly invented fixture; PHD_CORPUS_ROOT not read or changed';
  protocol_uri='checkout:paleography-harness/docs/agent-protocol.md'; protocol_sha256=(HashFile (Join-Path $ProtocolRepository 'docs/agent-protocol.md'))})
$inputHash=HashFile $inputPath
$listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Parse('127.0.0.1'),0)
$listener.Start(); $port=$listener.LocalEndpoint.Port; $listener.Stop()
$suffix=[Guid]::NewGuid().ToString('N').Substring(0,8)
$configPath=Join-Path $run 'config.private.json'
$configuration=[ordered]@{version='d6-network-config/v1'; repository=$repository; run_directory=$run;
  protocol_repository=[IO.Path]::GetFullPath($ProtocolRepository); node_executable=[IO.Path]::GetFullPath($NodeExecutable);
  runtime_directory=$runtimeDirectory; host='127.0.0.1'; port=$port; simulation=$true; identity_verified=$false;
  origin='https://d6-fixture.example.test'; schema=('archive_corrections_d5_d6_'+$suffix);
  gate_database=('d6_gate_'+$suffix); main_database=('d6_main_'+$suffix); restore_database=('d6_restore_'+$suffix);
  operator_user=('d6_operator_'+$suffix); operator_password=(RandomSecret); runtime_password=(RandomSecret);
  owner_passphrase=(RandomSecret); hmac_key=(RandomSecret); source_pins=$pins; source_manifest_sha256=$inputHash}
NewJson $configPath $configuration
PrivateText (Join-Path $run 'postgres-password.private.txt') $configuration.operator_password
$frozenPath=Join-Path $run 'frozen-before.json'
if (-not (Test-Path -LiteralPath $frozenPath)) {
  $roots=@((Join-Path $repository 'scripts/archive-corrections'),(Join-Path $repository 'tests/archive-corrections'),(Join-Path $ProtocolRepository 'paleography/decision-bridge'))
  $baseline=@(foreach($root in $roots) { Get-ChildItem -LiteralPath $root -File -Recurse | Where-Object {$_.FullName -notmatch '[\\/](node_modules|__pycache__|postgres-network-pilot)[\\/]'} | ForEach-Object {[ordered]@{path=$_.FullName;sha256=(HashFile $_.FullName)}} })
  NewJson $frozenPath $baseline
}
$frozen=Get-Content -LiteralPath $frozenPath -Raw | ConvertFrom-Json
if (@($frozen | Where-Object {(HashFile $_.path) -ne $_.sha256}).Count -ne 0) { throw 'An earlier D4/D5/H06 source changed.' }
NewJson (Join-Path $run 'preflight.json') ([ordered]@{version='d6-network-preflight/v1'; passed=$true; checked_at=[DateTime]::UtcNow.ToString('o');
  host='127.0.0.1'; port=$port; port_allocated_by_loopback_bind=$true; database_already_started=$false;
  source_sha256=$inputHash; handler_sha256=$handler; archive_sha256=$runtime.archive_sha256; runtime_pinned_files=$runtimePins.Count;
  test_data='synthetic only'; transport='TCP loopback, SSL disabled only for this test'; credentials='fresh random fixture values in private files, excluded from logs/manifests';
  privileges='new cluster and SQL test roles only; no OS account or service'; no_remote_database=$true; no_system_configuration_change=$true;
  protocol_read=$true; corpus_preflight='not-applicable'; initial_gate='empty DB migration + two distinct TCP backends + rollback, before workers A/B'})
$gitArgs=@('-c',('safe.directory='+$repository.Replace('\','/')),'-C',$repository)
$head=(& git @gitArgs rev-parse HEAD).Trim()
$branch=(& git @gitArgs symbolic-ref --short HEAD).Trim()
$upstream=(& git @gitArgs for-each-ref '--format=%(upstream:short)' ('refs/heads/'+$branch))
$upstream=($upstream -join '').Trim()
$baseRef=if ($upstream) {$upstream} else {'origin/main'}
$baseHead=(& git @gitArgs rev-parse $baseRef).Trim()
if (-not $upstream) {$upstream='none (no configured branch upstream)'}
$manifest=[ordered]@{schema_version='1.0.0'; run_id=(Split-Path $run -Leaf); operation='review'; started_at=[DateTime]::UtcNow.ToString('o');
  session_urls=@('codex://threads/01a1033e-ed6e-77f3-a716-9f5f599ba5e6');
  agent=[ordered]@{provider='OpenAI';model='GPT-6 (Codex; exact runtime identifier unavailable)';role='executor';method_version='d6-network/v1'};
  inputs=[ordered]@{manifest_version='d6-network-inputs/v1';manifest_sha256=$inputHash;corpus_root_reference='env:PHD_CORPUS_ROOT';manifest_uri=('checkout:archive-corrections/'+[IO.Path]::GetRelativePath($repository,$inputPath).Replace('\','/'))};
  git=[ordered]@{head=$head;base_ref=$baseRef;base_head=$baseHead;upstream=$upstream;published=$false};
  outputs=@([ordered]@{logical_id='d6:preflight';uri=('checkout:archive-corrections/'+[IO.Path]::GetRelativePath($repository,(Join-Path $run 'preflight.json')).Replace('\','/'));sha256=(HashFile (Join-Path $run 'preflight.json'));media_type='application/json';rights_status='not-applicable'});
  validation=[ordered]@{schema_valid=$true;output_hashes_verified=$true;provenance_complete=$true;rights_review='not-required';human_review_status='pending';notes=('PRE-EXECUTION manifest. No PostgreSQL program/test executed. Branch '+$branch+' inspected read-only; no Git mutation. Corpus preflight not applicable.')};
  publication=[ordered]@{status='private'}}
$json=$manifest | ConvertTo-Json -Depth 40
if (-not (Test-Json -Json $json -SchemaFile (Join-Path $ProtocolRepository 'schema/operational/run-manifest.schema.json'))) { throw 'Pre-execution operational schema refused.' }
NewJson (Join-Path $run 'run-manifest-before-execution.json') $manifest
[ordered]@{prepared=$true;preflight_passed=$true;postgres_started=$false;source_manifest_sha256=$inputHash;handler_sha256=$handler;port=$port;config_file=$configPath} | ConvertTo-Json
