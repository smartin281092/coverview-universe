#Requires -Version 7.0
<#
Lancement local interactif. La clé reste dans la mémoire des processus de démarrage et de l'API.
Aucun secret n'est placé dans un argument, un fichier ou l'environnement du shell.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^client_[A-Za-z0-9]+$')]
    [string] $ClientId,
    [string] $NodeExecutable = 'node',
    [string] $Issuer = 'https://api.workos.com/'
)

$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskPreview = Join-Path $PSScriptRoot 'preview.mjs'
$taskNode = (Get-Command $NodeExecutable -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
if (-not (Test-Path -LiteralPath (Join-Path $taskRoot 'node_modules') -PathType Container)) {
    throw 'Dépendances absentes : exécuter pnpm install avant ce lancement.'
}
& $taskNode -e 'const [major,minor]=process.versions.node.split(".").map(Number);if(major!==24||minor<20){console.error("Node LTS du projet requis : >=24.20.0 <25.");process.exitCode=1;}'
if ($LASTEXITCODE -ne 0) { throw 'Version Node incompatible.' }

$taskKey = $null
$taskSessionSecret = $null
$taskSecureKey = $null
$taskRandomBytes = New-Object byte[] 32

function Invoke-PreviewCommand {
    param([string[]] $PreviewArguments, [switch] $WithAuthentication)
    $taskStart = [System.Diagnostics.ProcessStartInfo]::new()
    $taskStart.FileName = $taskNode
    $taskStart.UseShellExecute = $false
    $taskStart.WorkingDirectory = $taskRoot
    $taskStart.ArgumentList.Add($taskPreview)
    foreach ($taskArgument in $PreviewArguments) { $taskStart.ArgumentList.Add($taskArgument) }
    # Retirer aussi d'éventuelles valeurs héritées avant de sélectionner le contexte.
    foreach ($taskName in @('WORKOS_API_KEY', 'AUTH_SESSION_SECRET')) {
        [void] $taskStart.Environment.Remove($taskName)
    }
    if ($WithAuthentication) {
        $taskStart.Environment['AUTH_ENABLED'] = 'true'
        $taskStart.Environment['FIXTURE_MODE'] = 'false'
        $taskStart.Environment['WORKOS_CLIENT_ID'] = $ClientId
        $taskStart.Environment['WORKOS_ISSUER'] = $Issuer
        $taskStart.Environment['WORKOS_API_KEY'] = $taskKey
        $taskStart.Environment['AUTH_SESSION_SECRET'] = $taskSessionSecret
    }
    $taskProcess = $null
    try {
        $taskProcess = [System.Diagnostics.Process]::Start($taskStart)
        $taskProcess.WaitForExit()
        if ($taskProcess.ExitCode -ne 0) {
            throw 'La commande preview a échoué. Consulter le message précédent ; aucun secret enregistré.'
        }
    } finally {
        $taskStart.Environment.Remove('WORKOS_API_KEY') | Out-Null
        $taskStart.Environment.Remove('AUTH_SESSION_SECRET') | Out-Null
        if ($null -ne $taskProcess) { $taskProcess.Dispose() }
    }
}

try {
    Write-Host "Clé API WorkOS : coller dans la saisie masquée ci-dessous."
    $taskSecureKey = Read-Host 'Clé WorkOS (masquée)' -AsSecureString
    $taskPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($taskSecureKey)
    try {
        $taskKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($taskPointer).Trim()
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskPointer)
    }
    if ([string]::IsNullOrWhiteSpace($taskKey) -or $taskKey -match '\s') {
        throw 'Clé vide ou contenant des espaces : aucun service redémarré.'
    }
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($taskRandomBytes)
    $taskSessionSecret = [Convert]::ToBase64String($taskRandomBytes)

    # La validation et la résolution des outils précèdent l'arrêt de la preview.
    Invoke-PreviewCommand -PreviewArguments @('check-auth') -WithAuthentication
    Invoke-PreviewCommand -PreviewArguments @('stop')
    Invoke-PreviewCommand -PreviewArguments @('start', '--require-auth') -WithAuthentication
    Write-Host 'Ouvrir http://127.0.0.1:4101/account pour effectuer la connexion WorkOS réelle.'
} finally {
    $taskKey = $null
    $taskSessionSecret = $null
    [Array]::Clear($taskRandomBytes, 0, $taskRandomBytes.Length)
    if ($null -ne $taskSecureKey) { $taskSecureKey.Dispose() }
}
