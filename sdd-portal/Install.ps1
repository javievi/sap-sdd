param(
    [string]$OutputPath = (Join-Path $env:TEMP 'sdd-studio-0.4.1.vsix'),
    [string]$NodePath,
    [switch]$OpenPortal,
    [switch]$SignInRuntime,
    [string]$RuntimeHome
)

$ErrorActionPreference = 'Stop'
$code = Get-Command code -ErrorAction Stop
if (-not $NodePath) {
    $ordinaryNode = Get-Command node -ErrorAction SilentlyContinue
    if ($ordinaryNode) { $NodePath = $ordinaryNode.Source }
    else { $NodePath = [System.IO.Path]::GetFullPath((Join-Path (Split-Path $code.Source) '..\Code.exe')) }
}
if (-not [System.IO.File]::Exists($NodePath)) { throw 'Provide -NodePath with the known Node or VS Code Code.exe path.' }
$priorElectron = $env:ELECTRON_RUN_AS_NODE
$priorSystemCa = $env:NODE_USE_SYSTEM_CA
$priorAutoUpdate = $env:COPILOT_AUTO_UPDATE
if ([System.IO.Path]::GetFileName($NodePath) -ieq 'Code.exe') { $env:ELECTRON_RUN_AS_NODE = '1' }
$env:NODE_USE_SYSTEM_CA = '1'
$env:COPILOT_AUTO_UPDATE = 'false'
function Invoke-Node {
    param([string[]]$NodeArguments)
    & $NodePath @NodeArguments 2>&1 | Out-String | Write-Host
    if ($LASTEXITCODE -ne 0) { throw "Node operation failed (exit $LASTEXITCODE). Installation stopped." }
}
try {
    $exe = Join-Path $PSScriptRoot 'vendor\copilot\copilot.exe'
    if ($SignInRuntime) {
        if (-not $RuntimeHome -or -not [System.IO.Path]::IsPathRooted($RuntimeHome)) { throw 'Supply the exact absolute -RuntimeHome shown by SDD Studio: Runtime Sign-in Instructions.' }
        if (-not [System.IO.File]::Exists($exe)) { throw 'Run Install.ps1 without -SignInRuntime first.' }
        $priorHome = $env:COPILOT_HOME
        try {
            $env:COPILOT_HOME = $RuntimeHome
            $env:ELECTRON_RUN_AS_NODE = $priorElectron
            [System.IO.Directory]::CreateDirectory($RuntimeHome) | Out-Null
            Push-Location $RuntimeHome
            try {
                Write-Host 'Human sign-in only: enter /login, complete the browser flow, then /exit. Do not submit an analysis prompt here.'
                & $exe --no-auto-update
                if ($LASTEXITCODE -ne 0) { throw 'Runtime sign-in command failed.' }
            } finally { Pop-Location }
        } finally { $env:COPILOT_HOME = $priorHome }
        return
    }
    Push-Location $PSScriptRoot
    try {
        Invoke-Node -NodeArguments @('--use-system-ca', 'install-runtime.js')
        foreach ($file in @('extension.js', 'architect-runtime.js', 'canonical.js', 'app.js', 'preview.js')) {
            Invoke-Node -NodeArguments @('--check', $file)
        }
        Invoke-Node -NodeArguments @('--test', '--test-isolation=none', '--test-reporter=tap', 'bridge.test.js', 'extension.test.js', 'mcp.test.js', 'alm.test.js', 'oauth.test.js', 'runtime.test.js', 'preview.test.js')
    } finally { Pop-Location }

    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $files = @('package.json', 'extension.js', 'architect-runtime.js', 'canonical.js', 'bridge.js', 'mcp.js', 'alm.js', 'oauth.js', 'index.html', 'styles.css', 'app.js', 'preview.js', 'bootstrap.js', 'README.md')
    foreach ($file in [System.IO.Directory]::EnumerateFiles((Join-Path $PSScriptRoot 'vendor'), '*', [System.IO.SearchOption]::AllDirectories)) {
        $files += $file.Substring($PSScriptRoot.Length + 1)
    }
    $stream = [System.IO.File]::Open($OutputPath, [System.IO.FileMode]::Create)
    $zip = New-Object System.IO.Compression.ZipArchive($stream, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($file in $files) {
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, (Join-Path $PSScriptRoot $file), "extension/$($file.Replace('\', '/'))") | Out-Null
        }
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, (Join-Path $PSScriptRoot 'extension.vsixmanifest'), 'extension.vsixmanifest') | Out-Null
        $extensions = @('vsixmanifest') + @($files | ForEach-Object { [System.IO.Path]::GetExtension($_).TrimStart('.') } | Where-Object { $_ } | Sort-Object -Unique)
        $types = '<?xml version="1.0" encoding="utf-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        foreach ($extension in $extensions) {
            $mime = if ($extension -eq 'json') { 'application/json' } elseif ($extension -eq 'vsixmanifest') { 'text/xml' } else { 'application/octet-stream' }
            $types += "<Default Extension=`"$([System.Security.SecurityElement]::Escape($extension))`" ContentType=`"$mime`"/>"
        }
        $types += '</Types>'
        $writer = New-Object System.IO.StreamWriter(($zip.CreateEntry('[Content_Types].xml')).Open())
        try { $writer.Write($types) } finally { $writer.Dispose() }
    } finally { $zip.Dispose(); $stream.Dispose() }
    $verify = [System.IO.Compression.ZipFile]::OpenRead($OutputPath)
    try {
        foreach ($entry in @('extension/package.json', 'extension/canonical.js', 'extension/architect-runtime.js', 'extension/vendor/copilot/sdk/index.js', 'extension/vendor/copilot/copilot.exe', 'extension.vsixmanifest', '[Content_Types].xml')) {
            if (-not $verify.GetEntry($entry)) { throw "Required VSIX entry missing: $entry" }
        }
    } finally { $verify.Dispose() }
    $env:ELECTRON_RUN_AS_NODE = $priorElectron
    & $code.Source --install-extension $OutputPath --force
    if ($LASTEXITCODE -ne 0) { throw 'VS Code did not install the 0.4.1 extension.' }
    Write-Host "Installed SDD Studio 0.4.1. Reload VS Code. Package: $OutputPath"
    Write-Host 'Run SDD Studio: Runtime Sign-in Instructions if needed, then Open Live Portal and select a model. Fixture tests are not live agent validation.'
    if ($OpenPortal) {
        & $code.Source --open-url 'vscode://local-sdd-tools.sdd-studio/open'
        if ($LASTEXITCODE -ne 0) { throw 'VS Code could not request the portal command.' }
    }
} finally {
    $env:ELECTRON_RUN_AS_NODE = $priorElectron
    $env:NODE_USE_SYSTEM_CA = $priorSystemCa
    $env:COPILOT_AUTO_UPDATE = $priorAutoUpdate
}
