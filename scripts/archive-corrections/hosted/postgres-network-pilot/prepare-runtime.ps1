[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$RunDirectory)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repository = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$run = [IO.Path]::GetFullPath($RunDirectory)
$privateRoot = [IO.Path]::GetFullPath((Join-Path $repository '.archive-corrections-private'))
if (-not $run.StartsWith($privateRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -or (Split-Path $run -Leaf) -notlike 'd6-network-*') { throw 'New assigned private D6 directory required.' }
$version = '18.6-5'
$uri = 'https://get.enterprisedb.com/postgresql/postgresql-18.6-5-windows-x64-binaries.zip'
$archive = Join-Path $run ('postgresql-' + $version + '-windows-x64-binaries.zip')
$runtime = Join-Path $run 'runtime'
if ((Test-Path -LiteralPath $archive) -or (Test-Path -LiteralPath $runtime)) { throw 'Runtime preparation never overwrites a previous download or extraction.' }
$html = Get-Content -LiteralPath (Join-Path $run 'edb-download-page-v2.html') -Raw
if ($html -notmatch 'Version <!-- -->18\.6' -or $html -notmatch 'getfile\.jsp\?fileid=1260609') { throw 'Saved official version/platform source missing.' }
$head = Get-Content -LiteralPath (Join-Path $run 'official-archive-head.json') -Raw | ConvertFrom-Json
if ($head.final_host -ne 'get.enterprisedb.com' -or $head.final_path -ne '/postgresql/postgresql-18.6-5-windows-x64-binaries.zip' -or $head.content_type -ne 'application/zip') { throw 'Official archive metadata mismatch.' }
$client = [Net.Http.HttpClient]::new()
$client.Timeout = [TimeSpan]::FromMinutes(10)
$response = $client.GetAsync($uri,[Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
try {
    $response.EnsureSuccessStatusCode() | Out-Null
    if ($response.RequestMessage.RequestUri.Host -ne 'get.enterprisedb.com' -or $response.Content.Headers.ContentLength -ne 384620317) { throw 'Unexpected download source or byte length.' }
    $inputStream = $response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
    $fileStream = [IO.File]::Open($archive,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    try { $inputStream.CopyTo($fileStream) } finally { $fileStream.Dispose(); $inputStream.Dispose() }
} finally { $response.Dispose(); $client.Dispose() }
if ((Get-Item -LiteralPath $archive).Length -ne 384620317) { throw 'Archive length differs from official metadata.' }
$archiveHash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
New-Item -ItemType Directory -Path $runtime | Out-Null
$zip = [IO.Compression.ZipFile]::OpenRead($archive)
$extracted = @()
try {
    foreach ($entry in $zip.Entries) {
        $name = $entry.FullName.Replace('\','/')
        if ($name -notmatch '^pgsql/(bin|lib|share)/' -and $name -notmatch '^pgsql/(COPYRIGHT|LICENSE|README[^/]*)$') { continue }
        if ($name -match '(^|/)\.\.(/|$)' -or [IO.Path]::IsPathRooted($name)) { throw 'Archive path outside runtime.' }
        $destination = [IO.Path]::GetFullPath((Join-Path $runtime $name))
        if (-not $destination.StartsWith($runtime + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Resolved archive path outside runtime.' }
        if ($name.EndsWith('/')) { [IO.Directory]::CreateDirectory($destination) | Out-Null; continue }
        [IO.Directory]::CreateDirectory((Split-Path $destination -Parent)) | Out-Null
        [IO.Compression.ZipFileExtensions]::ExtractToFile($entry,$destination,$false)
        $extracted += $name
    }
} finally { $zip.Dispose() }
$executables = @('postgres.exe','initdb.exe','pg_ctl.exe','psql.exe') | ForEach-Object {
    $path = Join-Path $runtime ('pgsql/bin/' + $_)
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw 'Required PostgreSQL executable missing.' }
    $signature = Get-AuthenticodeSignature -LiteralPath $path
    [ordered]@{name=$_; relative_path=('runtime/pgsql/bin/' + $_); sha256=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant(); authenticode_status=[string]$signature.Status}
}
$record = [ordered]@{version='d6-runtime/v1'; postgres_version='18.6'; distribution_version=$version;
    source_page='https://www.postgresql.org/download/windows/'; distribution_page='https://www.enterprisedb.com/download-postgresql-binaries';
    official_file_id=1260609; archive_uri=$uri; archive_sha256=$archiveHash; archive_bytes=384620317;
    checksum_kind='locally computed SHA-256 pin; no publisher SHA-256 was present in the official page or response';
    official_metadata_etag=$head.etag; source_page_sha256=(Get-FileHash -LiteralPath (Join-Path $run 'edb-download-page-v2.html') -Algorithm SHA256).Hash.ToLowerInvariant();
    extracted_files=$extracted.Count; executables=$executables; no_program_executed=$true; no_installer_or_service=$true;
    scope='private-local-synthetic'; prepared_at=[DateTime]::UtcNow.ToString('o')}
$json = ($record | ConvertTo-Json -Depth 10) + "`n"
$recordPath = Join-Path $run 'runtime-provenance.json'
$stream = [IO.File]::Open($recordPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
try { $bytes = [Text.UTF8Encoding]::new($false).GetBytes($json); $stream.Write($bytes,0,$bytes.Length) } finally { $stream.Dispose() }
[ordered]@{prepared=$true; distribution_version=$version; archive_sha256=$archiveHash; extracted_files=$extracted.Count; record=$recordPath; executed=$false} | ConvertTo-Json
