[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$RunDirectory)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repository=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$run=[IO.Path]::GetFullPath($RunDirectory)
$private=Join-Path $repository '.archive-corrections-private'
if (-not $run.StartsWith($private+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -or (Split-Path $run -Leaf) -notmatch '^d7-tls-[a-f0-9-]{36}$') { throw 'Assigned D7 private run required.' }
function HashFile([string]$p) { (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant() }
function NewJson([string]$p,$v) { $b=[Text.UTF8Encoding]::new($false).GetBytes(($v|ConvertTo-Json -Depth 40)+"`n"); $s=[IO.File]::Open($p,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None); try {$s.Write($b,0,$b.Length)} finally {$s.Dispose()} }
function NewText([string]$p,[string]$v) { $b=[Text.UTF8Encoding]::new($false).GetBytes($v); $s=[IO.File]::Open($p,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None); try {$s.Write($b,0,$b.Length)} finally {$s.Dispose()} }
$value=Get-Content -LiteralPath (Join-Path $run 'config.private.json') -Raw|ConvertFrom-Json
$preflight=Get-Content -LiteralPath (Join-Path $run 'preflight.json') -Raw|ConvertFrom-Json
if (-not $preflight.passed -or $preflight.database_already_started -or $value.host -ne '127.0.0.1') { throw 'Successful pinned loopback preflight required.' }
if ((HashFile (Join-Path $run 'input-manifest.json')) -ne $value.source_manifest_sha256) { throw 'Input manifest changed.' }
foreach($pin in $value.source_pins) { if ((HashFile (Join-Path $repository $pin.path)) -ne $pin.sha256) { throw 'Frozen source changed.' } }
foreach($pin in (Get-Content -LiteralPath (Join-Path $run 'runtime-file-pins.json') -Raw|ConvertFrom-Json)) { if ((HashFile (Join-Path $repository $pin.path)) -ne $pin.sha256) { throw 'Runtime pin changed.' } }
foreach($pin in (Get-Content -LiteralPath (Join-Path $run 'tool-file-pins.json') -Raw|ConvertFrom-Json)) { if ((HashFile $pin.path) -ne $pin.sha256) { throw 'Tool pin changed.' } }
if (Test-Path Env:NODE_TLS_REJECT_UNAUTHORIZED) { throw 'TLS override refused.' }
function Native([string]$exe,[string[]]$arguments,[string]$label,[string]$ca='') {
  # File redirection avoids a PostgreSQL child retaining a pipe after pg_ctl exits.
  # WaitForExit waits for this helper only; Start-Process -Wait waits descendants.
  $quoted=@($arguments|ForEach-Object {if ($_ -match '[\s"]') {'"'+$_.Replace('"','\"')+'"'} else {$_}})
  $launch=@{FilePath=$exe;ArgumentList=$quoted;WindowStyle='Hidden';PassThru=$true;
    RedirectStandardOutput=(Join-Path $run ($label+'.stdout.log'));RedirectStandardError=(Join-Path $run ($label+'.stderr.log'))}
  if ($exe -eq $value.node_executable) {
    $childEnvironment=@{D7_PILOT_CONFIG_FILE=(Join-Path $run 'config.private.json')}
    if ($ca) {$childEnvironment['NODE_EXTRA_CA_CERTS']=$ca}
    $launch['Environment']=$childEnvironment
  }
  $process=Start-Process @launch
  if (-not $process.WaitForExit(60000)) { $process.Kill(); throw ('Owned helper timeout: '+$label) }
  $exitCode=$process.ExitCode; $process.Dispose(); return $exitCode
}
$bin=Join-Path $value.runtime_directory 'pgsql/bin'; $data=Join-Path $run 'pgdata'
if (Test-Path -LiteralPath $data) { throw 'Fresh cluster required; no resume in an executed run.' }
$ownedPids=[Collections.Generic.List[int]]::new(); $activePid=$null; $stopSequence=0
function StopOwned {
  $pidFile=Join-Path $data 'postmaster.pid'
  if (-not (Test-Path -LiteralPath $pidFile)) { return }
  $actual=[int](Get-Content -LiteralPath $pidFile -TotalCount 1)
  if ($null -eq $script:activePid) { $script:activePid=$actual; $ownedPids.Add($actual) }
  if ($actual -ne $script:activePid) { throw 'New cluster owned PID mismatch; stop refused.' }
  $script:stopSequence++
  if ((Native (Join-Path $bin 'pg_ctl.exe') @('stop','-D',$data,'-m','fast','-w','-t','20') ('pg-stop-'+$script:stopSequence)) -ne 0) { throw 'Owned cluster stop failed.' }
  if (Test-Path -LiteralPath $pidFile) { throw 'Owned cluster PID file remains.' }
  $script:activePid=$null
}
function StartOwned([string]$certificate,[string]$label) {
  $certificatePath=(Join-Path $run $certificate).Replace('\','/')
  Add-Content -LiteralPath (Join-Path $data 'postgresql.conf') -Value ("ssl_cert_file = '"+$certificatePath+"'") -Encoding utf8
  if ((Native (Join-Path $bin 'pg_ctl.exe') @('start','-D',$data,'-l',(Join-Path $run 'postgres-server.log'),'-w','-t','20') $label) -ne 0) { throw 'Owned cluster start failed.' }
  $script:activePid=[int](Get-Content -LiteralPath (Join-Path $data 'postmaster.pid') -TotalCount 1); $ownedPids.Add($script:activePid)
}
function Probe([string]$mode,[string]$caFile) {
  if ((Native $value.node_executable @((Join-Path $PSScriptRoot 'probe.mjs'),(Join-Path $run 'config.private.json'),$mode) ('tls-'+$mode) (Join-Path $run $caFile)) -ne 0) { throw ('Strict TLS probe failed: '+$mode) }
}
$stage='certificates'; $passed=$false; $stopped=$false; $errorCode=$null
try {
  if ((Native $value.python_executable @('-B',(Join-Path $PSScriptRoot 'certificates.py'),$run) 'certificates') -ne 0) { throw 'Certificate generation failed.' }
  $stage='runtime-version'
  if ((Native (Join-Path $bin 'postgres.exe') @('--version') 'postgres-version') -ne 0 -or (Get-Content -LiteralPath (Join-Path $run 'postgres-version.stdout.log') -Raw).Trim() -ne 'postgres (PostgreSQL) 18.6') { throw 'Runtime version mismatch.' }
  $stage='initdb'
  if ((Native (Join-Path $bin 'initdb.exe') @('-D',$data,'--username',$value.operator_user,'--pwfile',(Join-Path $run 'postgres-password.private.txt'),'--auth=scram-sha-256','--encoding=UTF8','--locale=C','--no-instructions') 'initdb') -ne 0) { throw 'Fresh initdb failed.' }
  $keyPath=(Join-Path $run 'server-key.private.pem').Replace('\','/')
  @"
listen_addresses = '127.0.0.1'
port = $($value.port)
max_connections = 24
shared_buffers = '16MB'
ssl = on
ssl_key_file = '$keyPath'
ssl_min_protocol_version = 'TLSv1.2'
fsync = on
log_statement = 'none'
log_min_error_statement = 'panic'
log_connections = off
log_disconnections = off
lc_messages = 'C'
"@ | Add-Content -LiteralPath (Join-Path $data 'postgresql.conf') -Encoding utf8
  @"
hostssl all all 127.0.0.1/32 scram-sha-256
hostnossl all all 0.0.0.0/0 reject
host all all 0.0.0.0/0 reject
host all all ::/0 reject
"@ | Set-Content -LiteralPath (Join-Path $data 'pg_hba.conf') -Encoding utf8
  $stage='strict-tls-gate'
  StartOwned 'server.pem' 'pg-start-good'
  Probe 'correct-ca' 'ca.pem'; Probe 'wrong-ca' 'wrong-ca.pem'
  StopOwned
  StartOwned 'wrong-name.pem' 'pg-start-wrong-name'
  Probe 'wrong-name' 'ca.pem'
  StopOwned
  StartOwned 'server.pem' 'pg-start-restored'
  Probe 'correct-ca-restored' 'ca.pem'
  $probes=@(@('correct-ca','wrong-ca','wrong-name','correct-ca-restored')|ForEach-Object {$name='probe-'+$_+'.json'; [ordered]@{file=$name;sha256=(HashFile (Join-Path $run $name));proof=(Get-Content -LiteralPath (Join-Path $run $name) -Raw|ConvertFrom-Json)}})
  if (@($probes|Where-Object {-not $_.proof.passed}).Count -ne 0) { throw 'Strict gate proof incomplete.' }
  NewJson (Join-Path $run 'gate-proof.json') ([ordered]@{version='d7-tls-gate/v1';passed=$true;checked_at=[DateTime]::UtcNow.ToString('o');
    no_application_worker_started_before_gate=$true;driver='unchanged D5 createNetworkDriver, default Pool and attach helper';probes=$probes;
    hostname_refusal_method='same trusted CA, replacement server certificate with SAN wrong-name.invalid, unchanged target 127.0.0.1';verification_disabled=$false})
  $stage='minimal-application-tests'
  if ((Native $value.node_executable @('--test','--test-concurrency=1','--test-timeout=60000',(Join-Path $PSScriptRoot 'pilot.mjs')) 'tls-pilot-tests' (Join-Path $run 'ca.pem')) -ne 0) { throw 'Minimal TLS pilot tests failed.' }
  $passed=$true
} catch { $errorCode=$stage+'-failed' }
finally {
  try { StopOwned; $stopped=(-not (Test-Path -LiteralPath (Join-Path $data 'postmaster.pid'))) } catch { $stopped=$false; $errorCode='owned-cluster-stop-failed' }
  $workerPids=@(); $workersPath=Join-Path $run 'owned-workers.json'
  if (Test-Path -LiteralPath $workersPath) { $workerPids=@((Get-Content -LiteralPath $workersPath -Raw|ConvertFrom-Json).workers.node_pid) }
  $allPids=@($ownedPids.ToArray()+$workerPids|Sort-Object -Unique)
  $present=@($allPids|Where-Object {Get-Process -Id $_ -ErrorAction SilentlyContinue})
  NewJson (Join-Path $run 'owned-process-closeout.json') ([ordered]@{checked_at=[DateTime]::UtcNow.ToString('o');owned_postgres_pids=$ownedPids.ToArray();owned_worker_pids=$workerPids;
    all_owned_pids_absent=($present.Count -eq 0);postmaster_pid_file_absent=$stopped;existing_services_targeted=$false})
  NewJson (Join-Path $run 'execution-summary.json') ([ordered]@{version='d7-tls-execution/v1';passed=($passed -and $stopped -and $present.Count -eq 0);stage=$stage;error_code=$errorCode;
    postgres_stopped=$stopped;host='127.0.0.1';port=$value.port;simulation=$true;identity_verified=$false;finished_at=[DateTime]::UtcNow.ToString('o')})
}
[ordered]@{passed=($passed -and $stopped -and $present.Count -eq 0);stage=$stage;error_code=$errorCode;postgres_stopped=$stopped;run=$run}|ConvertTo-Json
if (-not $passed -or -not $stopped -or $present.Count -ne 0) { exit 1 }
