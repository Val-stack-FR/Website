[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$RunDirectory)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repository=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$run=[IO.Path]::GetFullPath($RunDirectory)
$private=[IO.Path]::GetFullPath((Join-Path $repository '.archive-corrections-private'))
if (-not $run.StartsWith($private+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -or (Split-Path $run -Leaf) -notlike 'd6-network-*') { throw 'Assigned private D6 run required.' }
$configuration=Get-Content -LiteralPath (Join-Path $run 'config.private.json') -Raw | ConvertFrom-Json
$preflight=Get-Content -LiteralPath (Join-Path $run 'preflight.json') -Raw | ConvertFrom-Json
if (-not $preflight.passed -or $preflight.database_already_started -or $configuration.host -ne '127.0.0.1') { throw 'Loopback-only successful preflight required.' }
if ((Get-FileHash -LiteralPath (Join-Path $run 'input-manifest.json') -Algorithm SHA256).Hash.ToLowerInvariant() -ne $configuration.source_manifest_sha256) { throw 'Input manifest changed before execution.' }
foreach($pin in $configuration.source_pins) {
  if ((Get-FileHash -LiteralPath (Join-Path $repository $pin.path) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $pin.sha256) { throw 'Frozen source changed before execution.' }
}
$runtimePins=Get-Content -LiteralPath (Join-Path $run 'runtime-file-pins.json') -Raw | ConvertFrom-Json
foreach($pin in $runtimePins) {
  if ((Get-FileHash -LiteralPath (Join-Path $repository $pin.path) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $pin.sha256) { throw 'Frozen runtime changed before execution.' }
}
function NewJson([string]$Path,$Value) {
  $bytes=[Text.UTF8Encoding]::new($false).GetBytes(($Value | ConvertTo-Json -Depth 20)+"`n")
  $stream=[IO.File]::Open($Path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  try {$stream.Write($bytes,0,$bytes.Length)} finally {$stream.Dispose()}
}
function Native([string]$Exe,[string[]]$Arguments,[string]$Label) {
  $quoted=@($Arguments | ForEach-Object { if ($_ -match '[\s"]') {'"'+$_.Replace('"','\"')+'"'} else {$_} })
  # Wait for this helper only. Start-Process -Wait on Windows also waits for
  # descendants, which would wait forever for PostgreSQL started by pg_ctl.
  $process=Start-Process -FilePath $Exe -ArgumentList $quoted -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $run ($Label+'.stdout.log')) -RedirectStandardError (Join-Path $run ($Label+'.stderr.log'))
  if (-not $process.WaitForExit(60000)) { throw ('Owned native helper timeout: '+$Label) }
  return $process.ExitCode
}
$bin=Join-Path $configuration.runtime_directory 'pgsql/bin'
$data=Join-Path $run 'pgdata'
if (Test-Path -LiteralPath $data) { throw 'Execution requires a new cluster; use a new run for resume.' }
$stage='version-probe'; $passed=$false; $started=$false; $stopped=$false; $postgresPid=$null; $errorCode=$null
try {
  if ((Native (Join-Path $bin 'postgres.exe') @('--version') 'postgres-version') -ne 0) { throw 'version-probe-native-failure' }
  $version=Get-Content -LiteralPath (Join-Path $run 'postgres-version.stdout.log') -Raw
  if ($version.Trim() -ne 'postgres (PostgreSQL) 18.6') { throw 'runtime-version-mismatch' }
  $stage='initdb'
  $initArgs=@('-D',$data,'--username',$configuration.operator_user,'--pwfile',(Join-Path $run 'postgres-password.private.txt'),'--auth=scram-sha-256','--encoding=UTF8','--locale=C','--no-instructions')
  if ((Native (Join-Path $bin 'initdb.exe') $initArgs 'initdb') -ne 0) { throw 'initdb-native-failure' }
  @"
listen_addresses = '127.0.0.1'
port = $($configuration.port)
max_connections = 24
shared_buffers = '16MB'
ssl = off
fsync = on
log_statement = 'none'
log_min_error_statement = 'panic'
log_connections = off
log_disconnections = off
lc_messages = 'C'
"@ | Add-Content -LiteralPath (Join-Path $data 'postgresql.conf') -Encoding utf8
  @"
host all all 127.0.0.1/32 scram-sha-256
host all all 0.0.0.0/0 reject
host all all ::/0 reject
"@ | Set-Content -LiteralPath (Join-Path $data 'pg_hba.conf') -Encoding utf8
  $stage='postgres-start'
  if ((Native (Join-Path $bin 'pg_ctl.exe') @('start','-D',$data,'-l',(Join-Path $run 'postgres-server.log'),'-w','-t','20') 'pg-start') -ne 0) { throw 'postgres-start-native-failure' }
  $started=$true
  $postgresPid=[int](Get-Content -LiteralPath (Join-Path $data 'postmaster.pid') -TotalCount 1)
  NewJson (Join-Path $run 'owned-postgres-process.json') ([ordered]@{pid=$postgresPid;data_directory=$data;listen_address='127.0.0.1';port=$configuration.port;no_windows_service=$true})
  $stage='network-tests'
  $oldConfig=[Environment]::GetEnvironmentVariable('D6_PILOT_CONFIG_FILE','Process')
  try {
    [Environment]::SetEnvironmentVariable('D6_PILOT_CONFIG_FILE',(Join-Path $run 'config.private.json'),'Process')
    $code=Native $configuration.node_executable @('--test','--test-concurrency=1','--test-timeout=60000',(Join-Path $repository 'tests/archive-corrections/postgres-network-pilot/network.test.mjs')) 'network-tests'
    if ($code -ne 0) { throw 'network-tests-native-failure' }
  } finally { [Environment]::SetEnvironmentVariable('D6_PILOT_CONFIG_FILE',$oldConfig,'Process') }
  $passed=$true
} catch { $errorCode=[string]$_.Exception.Message }
finally {
  # No process search/kill. pg_ctl is pointed only at this newly-created cluster.
  $ownedPidPath=Join-Path $data 'postmaster.pid'
  if (-not $started -and (Test-Path -LiteralPath $ownedPidPath)) {
    $postgresPid=[int](Get-Content -LiteralPath $ownedPidPath -TotalCount 1)
    $started=$true
  }
  if ($started) {
    $pidPath=Join-Path $data 'postmaster.pid'
    if ((Test-Path -LiteralPath $pidPath) -and [int](Get-Content -LiteralPath $pidPath -TotalCount 1) -eq $postgresPid) {
      $stopCode=Native (Join-Path $bin 'pg_ctl.exe') @('stop','-D',$data,'-m','fast','-w','-t','20') 'pg-stop'
      $stopped=($stopCode -eq 0 -and -not (Test-Path -LiteralPath $pidPath))
    }
  } else { $stopped=$true }
  NewJson (Join-Path $run 'execution-summary.json') ([ordered]@{version='d6-execution/v1';passed=($passed -and $stopped);stage=$stage;error_code=$errorCode;
    postgres_started=$started;postgres_stopped=$stopped;postgres_pid=$postgresPid;host='127.0.0.1';port=$configuration.port;
    simulation=$true;identity_verified=$false;no_existing_process_stopped=$true;finished_at=[DateTime]::UtcNow.ToString('o')})
}
[ordered]@{passed=($passed -and $stopped);stage=$stage;error_code=$errorCode;postgres_stopped=$stopped;private_output=$run} | ConvertTo-Json
if (-not $passed -or -not $stopped) { exit 1 }
