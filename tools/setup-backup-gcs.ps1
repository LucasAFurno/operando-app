[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)] [string] $ProjectId,
  [Parameter(Mandatory = $true)] [string] $BucketName,
  [string] $Location = 'us-east1',
  [string] $ServiceAccount,
  [ValidateRange(1, 3650)] [int] $RetentionDays = 30
)

$ErrorActionPreference = 'Stop'

function Invoke-Gcloud {
  param([string[]] $Arguments)
  Write-Host ('gcloud ' + ($Arguments -join ' '))
  & gcloud @Arguments
  if ($LASTEXITCODE -ne 0) { throw "gcloud failed with exit code $LASTEXITCODE" }
}

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
  throw 'gcloud no esta instalado. Instale Google Cloud CLI y vuelva a ejecutar el script.'
}

$activeAccount = & gcloud auth list --filter='status:ACTIVE' --format='value(account)'
if ($LASTEXITCODE -ne 0 -or -not $activeAccount) {
  throw 'No hay una cuenta gcloud autenticada. Ejecute: gcloud auth login'
}

Invoke-Gcloud @('config', 'set', 'project', $ProjectId)
$bucketUri = "gs://$BucketName"
& gcloud storage buckets describe $bucketUri --project=$ProjectId 2>$null
if ($LASTEXITCODE -ne 0) {
  Invoke-Gcloud @('storage', 'buckets', 'create', $bucketUri, "--location=$Location", '--uniform-bucket-level-access', "--project=$ProjectId")
} else {
  Invoke-Gcloud @('storage', 'buckets', 'update', $bucketUri, '--uniform-bucket-level-access', "--project=$ProjectId")
}

if ($ServiceAccount) {
  $roleId = 'pclafBackupObjectOperator'
  $roleResource = "projects/$ProjectId/roles/$roleId"
  $requiredPermissions = @('storage.objects.create', 'storage.objects.delete', 'storage.objects.get', 'storage.objects.list')
  $roleJson = & gcloud iam roles describe $roleId "--project=$ProjectId" --format=json 2>$null
  if ($LASTEXITCODE -ne 0) {
    Invoke-Gcloud @('iam', 'roles', 'create', $roleId, "--project=$ProjectId", '--title=Operando backup object operator', '--description=Only creates, gets, lists and deletes Operando backup objects', "--permissions=$($requiredPermissions -join ',')")
  } else {
    $existingPermissions = @((($roleJson | ConvertFrom-Json).includedPermissions) | Sort-Object)
    if (Compare-Object $existingPermissions ($requiredPermissions | Sort-Object)) {
      throw "El rol existente $roleResource no tiene exactamente los permisos requeridos; no fue modificado."
    }
  }
  Invoke-Gcloud @('storage', 'buckets', 'add-iam-policy-binding', $bucketUri, "--member=serviceAccount:$ServiceAccount", "--role=$roleResource", "--project=$ProjectId")
}

# GCS lifecycle rules cannot safely preserve last-success.json while deleting all
# dumps under the same configurable prefix. Retention is therefore enforced by
# backup-postgres.mjs after a successful upload, scoped to its own prefix.
Write-Host "No se aplico lifecycle rule: la limpieza segura de dumps mayores a $RetentionDays dias queda a cargo de backup-postgres.mjs y preserva last-success.json."
