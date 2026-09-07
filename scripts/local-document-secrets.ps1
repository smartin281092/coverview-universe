#Requires -Version 5.1
<# Local development only. Windows DPAPI binds the encrypted files to this Windows account.
   Secret values are never written to disk, command arguments or logs in plaintext.
   Read operations are for the API's private child-process pipe, not an operator terminal. #>
[CmdletBinding()]
param([Parameter(Mandatory = $true)][ValidateSet('ensure-storage', 'read-openai', 'set-openai')][string] $Operation)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$taskSecretDirectory = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'CoverView\secrets'
$taskEntropy = [Text.Encoding]::UTF8.GetBytes('CoverView.local.documents.v1')
$taskScope = [Security.Cryptography.DataProtectionScope]::CurrentUser
if (-not (Test-Path -LiteralPath $taskSecretDirectory)) { [IO.Directory]::CreateDirectory($taskSecretDirectory) | Out-Null }
$taskName = if ($Operation -eq 'ensure-storage') { 'storage-v1.dpapi' } else { 'openai.dpapi' }
$taskSecretFile = Join-Path $taskSecretDirectory $taskName
if ($Operation -eq 'set-openai') { $taskSecure = Read-Host 'Cle API OpenAI (saisie masquee)' -AsSecureString }
function Publish-TaskSecret([byte[]] $Bytes, [bool] $Replace) {
    $taskTemporary = Join-Path $taskSecretDirectory ([Guid]::NewGuid().ToString('N') + '.dpapi.tmp')
    try {
        [IO.File]::WriteAllBytes($taskTemporary, $Bytes)
        if ($Replace -and [IO.File]::Exists($taskSecretFile)) { [IO.File]::Replace($taskTemporary, $taskSecretFile, $null) }
        else {
            try { [IO.File]::Move($taskTemporary, $taskSecretFile) }
            catch [IO.IOException] {
                # A different Windows session may have won first creation. Never overwrite its storage key.
                if ($Replace -or -not [IO.File]::Exists($taskSecretFile)) { throw }
            }
        }
    } finally { if ([IO.File]::Exists($taskTemporary)) { [IO.File]::Delete($taskTemporary) } }
}
$taskMutex = [Threading.Mutex]::new($false, 'Local\CoverViewDocumentSecrets')
if (-not $taskMutex.WaitOne(10000)) { throw 'Local secret store is busy.' }
try {
    if ($Operation -eq 'set-openai') {
        $taskPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($taskSecure)
        try {
            $taskValue = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($taskPointer).Trim()
            if ($taskValue.Length -lt 20 -or $taskValue -match '\s') { throw 'Cle invalide.' }
            $taskClear = [Text.Encoding]::UTF8.GetBytes($taskValue)
            Publish-TaskSecret ([Security.Cryptography.ProtectedData]::Protect($taskClear, $taskEntropy, $taskScope)) $true
            [Array]::Clear($taskClear, 0, $taskClear.Length)
            $taskValue = $null
            Write-Host 'Cle OpenAI protegee pour CoverView. Reprendre la lecture du document dans Wallet.'
        } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskPointer); $taskSecure.Dispose() }
    } elseif ($Operation -eq 'read-openai' -and -not (Test-Path -LiteralPath $taskSecretFile)) {
        # Missing provider configuration is a normal unavailable state.
    } else {
        if (-not (Test-Path -LiteralPath $taskSecretFile)) {
            $taskGenerated = New-Object byte[] 32
            $taskRng = [Security.Cryptography.RandomNumberGenerator]::Create()
            try { $taskRng.GetBytes($taskGenerated) } finally { $taskRng.Dispose() }
            Publish-TaskSecret ([Security.Cryptography.ProtectedData]::Protect($taskGenerated, $taskEntropy, $taskScope)) $false
            [Array]::Clear($taskGenerated, 0, $taskGenerated.Length)
        }
        $taskClear = [Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($taskSecretFile), $taskEntropy, $taskScope)
        try {
            if ($Operation -eq 'ensure-storage') { [Console]::Out.Write([Convert]::ToBase64String($taskClear)) }
            else { [Console]::Out.Write([Text.Encoding]::UTF8.GetString($taskClear)) }
        } finally { [Array]::Clear($taskClear, 0, $taskClear.Length) }
    }
} finally { $taskMutex.ReleaseMutex(); $taskMutex.Dispose() }
