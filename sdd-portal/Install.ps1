param(
    [string]$OutputPath = (Join-Path $env:TEMP 'sdd-studio-0.4.0.vsix'),
    [string]$NodePath,
    [string]$NpmCli,
    [switch]$OpenPortal,
    [switch]$SignInRuntime,
    [string]$RuntimeHome
)

# User-run installer, not an agent tool. No SAP/ALM requests or repository
# customization discovery. Existing source/specs and credentials are untouched.
$ErrorActionPreference = 'Stop'
$code = Get-Command code -ErrorAction Stop
if (-not $NodePath) {
    $ordinaryNode = Get-Command node -ErrorAction SilentlyContinue
    if ($ordinaryNode) { $NodePath = $ordinaryNode.Source }
    else { $NodePath = [System.IO.Path]::GetFullPath((Join-Path (Split-Path $code.Source) '..\Code.exe')) }
}
if (-not [System.IO.File]::Exists($NodePath)) { throw 'Provide -NodePath with the known Node or VS Code Code.exe path. No filesystem discovery is performed.' }
$priorElectron = $env:ELECTRON_RUN_AS_NODE
if ([System.IO.Path]::GetFileName($NodePath) -ieq 'Code.exe') { $env:ELECTRON_RUN_AS_NODE = '1' }
function Invoke-Node {
    param([string[]]$NodeArguments)
    if ($NodeArguments[0] -eq '-e') {
        $NodeArguments[1] | & $NodePath - 2>&1 | Out-String | Write-Host
    } else {
        & $NodePath @NodeArguments 2>&1 | Out-String | Write-Host
    }
    if ($LASTEXITCODE -ne 0) { throw "Node operation failed (exit $LASTEXITCODE). Installation stopped." }
}
try {
    Invoke-Node -NodeArguments @('-e', 'const [a,b]=process.versions.node.split(".").map(Number);if(!((a===20&&b>=19)||(a===22&&b>=12)||a>22))process.exit(1);console.log("Node "+process.versions.node);')
    $cliPackage = Join-Path $PSScriptRoot 'node_modules\@github\copilot\package.json'
    if ($SignInRuntime) {
        if (-not $RuntimeHome -or -not [System.IO.Path]::IsPathRooted($RuntimeHome)) { throw 'Supply the exact absolute -RuntimeHome shown by SDD Studio: Runtime Sign-in Instructions.' }
        if (-not [System.IO.File]::Exists($cliPackage)) { throw 'Install dependencies first by running Install.ps1 without -SignInRuntime.' }
        $priorHome = $env:COPILOT_HOME
        try {
            $env:COPILOT_HOME = $RuntimeHome
            [System.IO.Directory]::CreateDirectory($RuntimeHome) | Out-Null
            Push-Location $RuntimeHome
            try {
                Write-Host 'Human sign-in only: enter /login, complete the browser flow, then /exit. Do not submit an analysis prompt here.'
                Invoke-Node -NodeArguments @((Join-Path $PSScriptRoot 'node_modules\@github\copilot\npm-loader.js'))
            } finally { Pop-Location }
        } finally { $env:COPILOT_HOME = $priorHome }
        return
    }
    if (-not $NpmCli) {
        # Bootstrap a pinned npm CLI when ordinary node/npm are not on PATH.
        # Download only public vendor artifacts. Never send private files/data.
        $bootstrap = Join-Path $env:LOCALAPPDATA 'sdd-studio-build\npm-10.9.2'
        $NpmCli = Join-Path $bootstrap 'package\bin\npm-cli.js'
        if (-not [System.IO.File]::Exists($NpmCli)) {
            [System.IO.Directory]::CreateDirectory($bootstrap) | Out-Null
            $metadataJson = & curl.exe --fail --silent --show-error --max-time 60 'https://registry.npmjs.org/npm/10.9.2'
            if ($LASTEXITCODE -ne 0) { throw 'Could not download pinned npm metadata.' }
            $metadata = $metadataJson | ConvertFrom-Json
            $archive = Join-Path $bootstrap 'npm-10.9.2.tgz'
            & curl.exe --fail --silent --show-error --max-time 120 --output $archive 'https://registry.npmjs.org/npm/-/npm-10.9.2.tgz'
            if ($LASTEXITCODE -ne 0) { throw 'Could not download pinned npm archive.' }
            $sha = (Get-FileHash -Path $archive -Algorithm SHA512).Hash
            $bytes = New-Object byte[] ($sha.Length / 2)
            for ($index = 0; $index -lt $bytes.Length; $index++) { $bytes[$index] = [Convert]::ToByte($sha.Substring($index * 2, 2), 16) }
            if ("sha512-$([Convert]::ToBase64String($bytes))" -cne $metadata.dist.integrity) { throw 'npm bootstrap integrity mismatch.' }
            & tar.exe -xzf $archive -C $bootstrap
            if ($LASTEXITCODE -ne 0) { throw 'Could not extract the pinned npm archive. Supply an approved -NpmCli instead.' }
        }
    }
    Push-Location $PSScriptRoot
    try {
        $lock = Join-Path $PSScriptRoot 'package-lock.json'
        if (-not [System.IO.File]::Exists($lock)) {
            Invoke-Node -NodeArguments @($NpmCli, 'install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund')
        }
        # Do not suppress optional dependencies: they contain the native runtime.
        Invoke-Node -NodeArguments @($NpmCli, 'ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund')
        foreach ($file in @('extension.js', 'architect-runtime.js', 'canonical.js', 'app.js')) {
            Invoke-Node -NodeArguments @('--check', $file)
        }
        Invoke-Node -NodeArguments @('--test', '--test-isolation=none', '--test-reporter=tap', 'bridge.test.js', 'extension.test.js', 'mcp.test.js', 'alm.test.js', 'oauth.test.js', 'runtime.test.js')
        # Load SDK + verify its Windows native runtime is present; not a live run.
        Invoke-Node -NodeArguments @('-e', 'const fs=require("fs"),p=require("path");require("@github/copilot-sdk");const s=require("./node_modules/@github/copilot-sdk/package.json");if(s.version!=="1.0.25"||s.copilotCliVersion!=="1.0.102")throw Error("SDK version mismatch");const platform=process.platform+"-"+process.arch;for(const f of ["copilot-runtime.exe","runtime.node"])fs.accessSync(p.join("node_modules","@github","copilot-sdk-"+platform,"prebuilds",platform,f));console.log("SDK and native runtime files verified; authenticated invocation NOT tested.");')
    } finally { Pop-Location }

    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $files = @('package.json', 'package-lock.json', 'extension.js', 'architect-runtime.js', 'canonical.js', 'bridge.js', 'mcp.js', 'alm.js', 'oauth.js', 'index.html', 'styles.css', 'app.js', 'bootstrap.js', 'README.md')
    # Include production dependencies and their licenses/native binaries intact.
    # Packaging is host-side, never exposed to sdd-architect.
    $modules = Join-Path $PSScriptRoot 'node_modules'
    foreach ($file in [System.IO.Directory]::EnumerateFiles($modules, '*', [System.IO.SearchOption]::AllDirectories)) {
        $files += $file.Substring($PSScriptRoot.Length + 1)
    }
    $stream = [System.IO.File]::Open($OutputPath, [System.IO.FileMode]::Create)
    $zip = New-Object System.IO.Compression.ZipArchive($stream, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($file in $files) {
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, (Join-Path $PSScriptRoot $file), "extension/$($file.Replace('\', '/'))") | Out-Null
        }
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, (Join-Path $PSScriptRoot 'extension.vsixmanifest'), 'extension.vsixmanifest') | Out-Null
        # Dynamic content types cover all bundled dependency/native asset types.
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
        foreach ($entry in @('extension/package.json', 'extension/canonical.js', 'extension/architect-runtime.js', 'extension/node_modules/@github/copilot-sdk/package.json', 'extension.vsixmanifest', '[Content_Types].xml')) {
            if (-not $verify.GetEntry($entry)) { throw "Required VSIX entry missing: $entry" }
        }
    } finally { $verify.Dispose() }
    # ELECTRON_RUN_AS_NODE must not leak into the VS Code CLI install/open step.
    $env:ELECTRON_RUN_AS_NODE = $priorElectron
    & $code.Source --install-extension $OutputPath --force
    if ($LASTEXITCODE -ne 0) { throw 'VS Code did not install the 0.4.0 extension.' }
    Write-Host "Installed SDD Studio 0.4.0. Reload the VS Code window. Package: $OutputPath"
    Write-Host 'After reload, run SDD Studio: Runtime Sign-in Instructions if needed, then Open Live Portal and explicitly select a model. Fixture success is NOT live agent validation.'
    if ($OpenPortal) {
        & $code.Source --open-url 'vscode://local-sdd-tools.sdd-studio/open'
        if ($LASTEXITCODE -ne 0) { throw 'VS Code could not request the portal command.' }
    }
} finally { $env:ELECTRON_RUN_AS_NODE = $priorElectron }
