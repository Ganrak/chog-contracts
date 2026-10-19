# Builds data/chogs.json: owner, name, image and traits for every Chog Genesis token.
# The game reads this snapshot to find a wallet's Chogs instantly, then confirms ownership on-chain.
# Run again whenever you want fresh owners:  powershell -ExecutionPolicy Bypass -File scripts\snapshot.ps1
# Metadata never changes, so later runs only re-read owners and reuse the traits already saved.
# -OwnersOnly refreshes owners in ~3 minutes and skips the slow IPFS part.
param([switch]$OwnersOnly)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path "$PSScriptRoot\..").Path
$out = "$root\data\chogs.json"
$rpc = 'https://rpc.monad.xyz'
$contract = '0xc96d31f8626c6d03fae5dcd3d61e3fb9f4a73763'
$gateways = @('https://ipfs.filebase.io/ipfs/', 'https://ipfs.filebase.io/ipfs/', 'https://4everland.io/ipfs/')
$supply = 1969
Add-Type -AssemblyName System.Net.Http

function Invoke-Batch($datas) {
  $items = for ($i = 0; $i -lt $datas.Count; $i++) { '{"jsonrpc":"2.0","id":' + $i + ',"method":"eth_call","params":[{"to":"' + $contract + '","data":"' + $datas[$i] + '"},"latest"]}' }
  for ($try = 0; $try -lt 9; $try++) {
    try {
      # PowerShell 5.1 hands back a JSON array as one wrapped object: unroll it so each call is its own item
      $r = @(Invoke-RestMethod -Uri $rpc -Method Post -ContentType 'application/json' -Body ('[' + ($items -join ',') + ']') -TimeoutSec 40 | ForEach-Object { $_ })
      # the RPC sometimes rate-limits single calls inside a batch: retry the whole batch until every call answered
      if (@($r | Where-Object { $_.result }).Count -eq $datas.Count) { return $r }
    } catch {}
    Start-Sleep -Milliseconds ([math]::Min(30000, 700 * [math]::Pow(2, $try)))
  }
  throw 'Monad RPC kept refusing the batch'
}
function Decode-String($hex) {
  $h = $hex.Substring(2); $len = [Convert]::ToInt32($h.Substring(64, 64), 16)
  $bytes = for ($i = 0; $i -lt $len; $i++) { [Convert]::ToByte($h.Substring(128 + $i * 2, 2), 16) }
  [Text.Encoding]::UTF8.GetString([byte[]]$bytes)
}

# reuse traits from an earlier snapshot
$old = @{}
if (Test-Path $out) { foreach ($c in (Get-Content $out -Raw -Encoding UTF8 | ConvertFrom-Json).chogs) { if ($c.traits) { $old[[int]$c.id] = $c } } }

# 1) owners + metadata location, straight from the contract
$chogs = @{}
for ($start = 1; $start -le $supply; $start += 20) {
  $ids = $start..([math]::Min($supply, $start + 19))
  $datas = foreach ($id in $ids) { '0x6352211e' + ('{0:x64}' -f $id); '0xc87b56dd' + ('{0:x64}' -f $id) }
  $replies = Invoke-Batch $datas
  for ($k = 0; $k -lt $ids.Count; $k++) {
    $own = $replies | Where-Object { $_.id -eq (2 * $k) }; $uri = $replies | Where-Object { $_.id -eq (2 * $k + 1) }
    $chogs[$ids[$k]] = [ordered]@{ id = $ids[$k]; owner = ('0x' + $own.result.Substring(26)).ToLower(); uri = (Decode-String $uri.result) }
  }
  if ($start % 200 -eq 1) { Write-Host ("owners {0}/{1}" -f [math]::Min($supply, $start + 24), $supply) }
  Start-Sleep -Milliseconds 200
}
foreach ($id in $old.Keys) { if ($chogs[$id].uri -eq $old[$id].uri) { $chogs[$id].name = $old[$id].name; $chogs[$id].image = $old[$id].image; $chogs[$id].traits = $old[$id].traits } }

# saved early and often: owners are what the wallet lookup needs, traits fill in over the next hours
function Save-Snapshot {
  New-Item -ItemType Directory -Force "$root\data" | Out-Null
  $list = foreach ($id in 1..$supply) { $chogs[$id] }
  $json = [ordered]@{ takenAt = (Get-Date).ToUniversalTime().ToString('o'); contract = $contract; chogs = @($list) } | ConvertTo-Json -Depth 6 -Compress
  [IO.File]::WriteAllText($out, $json, (New-Object Text.UTF8Encoding $false))
}
Save-Snapshot
Write-Host "owners saved"
if ($OwnersOnly) { exit 0 }

# 2) metadata JSON from IPFS, 20 at a time, rotating gateways, several passes for the stragglers
$http = New-Object System.Net.Http.HttpClient
$http.Timeout = [TimeSpan]::FromSeconds(25)
$http.DefaultRequestHeaders.UserAgent.ParseAdd('Mozilla/5.0 chog-contracts-snapshot')
for ($pass = 0; $pass -lt 6; $pass++) {
  $todo = @(1..$supply | Where-Object { -not $chogs[$_].traits })
  if ($todo.Count -eq 0) { break }
  Write-Host "metadata pass $($pass + 1): $($todo.Count) to fetch"
  for ($i = 0; $i -lt $todo.Count; $i += 20) {
    $chunk = $todo[$i..([math]::Min($todo.Count - 1, $i + 19))]
    $tasks = @{}
    $n = 0
    foreach ($id in $chunk) {
      $gw = $gateways[($id + $pass + $n) % $gateways.Count]; $n++
      $tasks[$id] = $http.GetStringAsync(($chogs[$id].uri -replace '^ipfs://', $gw))
    }
    try { [void][System.Threading.Tasks.Task]::WaitAll([System.Threading.Tasks.Task[]]@($tasks.Values), 30000) } catch {}
    foreach ($id in $chunk) {
      $t = $tasks[$id]
      if ($t.Status -ne 'RanToCompletion') { continue }
      try {
        $m = $t.Result | ConvertFrom-Json
        $traits = [ordered]@{}; foreach ($a in $m.attributes) { $traits[$a.trait_type] = [string]$a.value }
        $chogs[$id].name = $m.name; $chogs[$id].image = $m.image; $chogs[$id].traits = $traits
      } catch {}
    }
    $done = @(1..$supply | Where-Object { $chogs[$_].traits }).Count
    if (($i / 20) % 3 -eq 0) { Save-Snapshot; Write-Host "  have $done/$supply (saved)" }
  }
}

Save-Snapshot
$missing = @(1..$supply | Where-Object { -not $chogs[$_].traits }).Count
Write-Host "saved $out ($missing without metadata; run again to fill them)"
