[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateNotNullOrEmpty()]
    [string]$Version,

    [Parameter()]
    [ValidateNotNullOrEmpty()]
    [string]$Image = "whuanle/maomi-docs"
)

$ErrorActionPreference = "Stop"

$latestTag = "${Image}:latest"
$versionTag = "${Image}:${Version}"

function Invoke-DockerCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    $commandText = "docker " + ($Arguments -join " ")
    Write-Host ">> $commandText" -ForegroundColor Cyan

    & docker @Arguments

    if ($LASTEXITCODE -ne 0) {
        throw "Command failed: $commandText"
    }
}

Get-Command docker -ErrorAction Stop | Out-Null

Invoke-DockerCommand -Arguments @("build", "-t", $latestTag, ".")
Invoke-DockerCommand -Arguments @("tag", $latestTag, $versionTag)
Invoke-DockerCommand -Arguments @("push", $versionTag)
Invoke-DockerCommand -Arguments @("push", $latestTag)

Write-Host "Published tags: $versionTag, $latestTag" -ForegroundColor Green