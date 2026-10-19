# Cuts a transparent character sheet into one PNG per character.
# Finds the opaque blobs (on a coarse grid, so a creature's loose bits stay together), drops specks,
# orders them row by row, left to right, and saves them under the given names.
#   powershell -ExecutionPolicy Bypass -File scripts\cut-sheet.ps1 -Sheet monsters.png -Names ghoul,troll,thief,golem,harpy,wyrm,wraith -Out assets\monsters
param([Parameter(Mandatory)][string]$Sheet, [Parameter(Mandatory)][string[]]$Names, [string]$Out = "assets\monsters", [int]$Cell = 8, [int]$Pad = 12)
$ErrorActionPreference = 'Stop'
$Names = @($Names | ForEach-Object { $_ -split ',' } | Where-Object { $_ }) # "-File" passes a,b,c as one string
Add-Type -AssemblyName System.Drawing
$root = (Resolve-Path "$PSScriptRoot\..").Path
$src = New-Object System.Drawing.Bitmap (Resolve-Path (Join-Path $root $Sheet)).Path
$W = $src.Width; $H = $src.Height
$rect = New-Object System.Drawing.Rectangle 0, 0, $W, $H
$data = $src.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$bytes = New-Object byte[] ($data.Stride * $H)
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
$src.UnlockBits($data)

# coarse occupancy grid: a cell is "on" when enough of its pixels are opaque
$gw = [math]::Ceiling($W / $Cell); $gh = [math]::Ceiling($H / $Cell)
$grid = New-Object 'int[,]' $gw, $gh
for ($y = 0; $y -lt $H; $y++) { $row = $y * $data.Stride
  for ($x = 0; $x -lt $W; $x++) { if ($bytes[$row + $x * 4 + 3] -gt 40) { $grid[[int][math]::Floor($x / $Cell), [int][math]::Floor($y / $Cell)]++ } } }

# connected components on the grid (8-neighbours, plus a 1-cell bridge so wisps stay attached)
$label = New-Object 'int[,]' $gw, $gh; $blobs = @(); $id = 0
for ($gy = 0; $gy -lt $gh; $gy++) { for ($gx = 0; $gx -lt $gw; $gx++) {
  if ($grid[$gx, $gy] -lt 3 -or $label[$gx, $gy]) { continue }
  $id++; $stack = New-Object System.Collections.Stack; $stack.Push(@($gx, $gy)); $label[$gx, $gy] = $id
  $minX = $gx; $maxX = $gx; $minY = $gy; $maxY = $gy; $count = 0
  while ($stack.Count) { $p = $stack.Pop(); $count++
    if ($p[0] -lt $minX) { $minX = $p[0] }; if ($p[0] -gt $maxX) { $maxX = $p[0] }; if ($p[1] -lt $minY) { $minY = $p[1] }; if ($p[1] -gt $maxY) { $maxY = $p[1] }
    for ($dy = -2; $dy -le 2; $dy++) { for ($dx = -2; $dx -le 2; $dx++) { $nx = $p[0] + $dx; $ny = $p[1] + $dy
      if ($nx -ge 0 -and $ny -ge 0 -and $nx -lt $gw -and $ny -lt $gh -and $grid[$nx, $ny] -ge 3 -and -not $label[$nx, $ny]) { $label[$nx, $ny] = $id; $stack.Push(@($nx, $ny)) } } } }
  $blobs += [pscustomobject]@{ id = $id; x0 = $minX * $Cell; y0 = $minY * $Cell; x1 = [math]::Min($W, ($maxX + 1) * $Cell); y1 = [math]::Min($H, ($maxY + 1) * $Cell); size = $count }
} }
$biggest = ($blobs | Measure-Object size -Maximum).Maximum
$blobs = @($blobs | Where-Object { $_.size -gt $biggest * 0.08 }) # drop specks and stray marks
Write-Host "found $($blobs.Count) characters"
if ($blobs.Count -ne $Names.Count) { Write-Warning "expected $($Names.Count); check the sheet or the names" }

# reading order: group into rows by vertical centre, then left to right
$rowH = $H / 2
$ordered = $blobs | Sort-Object @{ e = { [math]::Floor((($_.y0 + $_.y1) / 2) / $rowH) } }, @{ e = { $_.x0 } }
$outDir = Join-Path $root $Out; New-Item -ItemType Directory -Force $outDir | Out-Null
$i = 0
foreach ($b in $ordered) {
  if ($i -ge $Names.Count) { break }
  $x0 = [math]::Max(0, $b.x0 - $Pad); $y0 = [math]::Max(0, $b.y0 - $Pad); $x1 = [math]::Min($W, $b.x1 + $Pad); $y1 = [math]::Min($H, $b.y1 + $Pad)
  $crop = $src.Clone((New-Object System.Drawing.Rectangle $x0, $y0, ($x1 - $x0), ($y1 - $y0)), [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  # keep only this character's pixels: anything from a neighbour or a stray mark becomes transparent
  $cr = New-Object System.Drawing.Rectangle 0, 0, $crop.Width, $crop.Height
  $cd = $crop.LockBits($cr, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $cb = New-Object byte[] ($cd.Stride * $crop.Height)
  [System.Runtime.InteropServices.Marshal]::Copy($cd.Scan0, $cb, 0, $cb.Length)
  for ($yy = 0; $yy -lt $crop.Height; $yy++) { $gyy = [int][math]::Floor(($yy + $y0) / $Cell)
    for ($xx = 0; $xx -lt $crop.Width; $xx++) { $gxx = [int][math]::Floor(($xx + $x0) / $Cell)
      $own = $false
      for ($d = -2; $d -le 2 -and -not $own; $d++) { for ($e = -2; $e -le 2 -and -not $own; $e++) { $nx = $gxx + $d; $ny = $gyy + $e
        if ($nx -ge 0 -and $ny -ge 0 -and $nx -lt $gw -and $ny -lt $gh -and $label[$nx, $ny] -eq $b.id) { $own = $true } } }
      if (-not $own) { $cb[$yy * $cd.Stride + $xx * 4 + 3] = 0 } } }
  [System.Runtime.InteropServices.Marshal]::Copy($cb, 0, $cd.Scan0, $cb.Length); $crop.UnlockBits($cd)
  $file = Join-Path $outDir "$($Names[$i]).png"; $crop.Save($file, [System.Drawing.Imaging.ImageFormat]::Png); $crop.Dispose()
  Write-Host ("{0,-8} {1}x{2} at {3},{4}" -f $Names[$i], ($x1 - $x0), ($y1 - $y0), $x0, $y0)
  $i++
}
$src.Dispose()
