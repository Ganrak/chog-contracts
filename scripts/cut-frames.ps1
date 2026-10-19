# Cuts an animation sheet (one row per character, one column per frame, transparent PNG) into one
# horizontal strip per character, with every frame aligned on the character's feet and body so the
# animation doesn't jitter even when the drawing drifts inside its cell.
#   powershell -ExecutionPolicy Bypass -File scripts\cut-frames.ps1 -Sheet attacks.png -Names ghoul,troll,thief,golem,harpy,wyrm,wraith -Frames 4
param([Parameter(Mandatory)][string]$Sheet, [Parameter(Mandatory)][string[]]$Names, [int]$Frames = 4,
      [string]$Out = "assets\monsters\attack", [int]$SlotW = 300)
$ErrorActionPreference = 'Stop'
$Names = @($Names | ForEach-Object { $_ -split ',' } | Where-Object { $_ })
Add-Type -AssemblyName System.Drawing
$root = (Resolve-Path "$PSScriptRoot\..").Path
$src = New-Object System.Drawing.Bitmap (Resolve-Path (Join-Path $root $Sheet)).Path
$W = $src.Width; $H = $src.Height; $rows = $Names.Count
$d = $src.LockBits((New-Object System.Drawing.Rectangle 0, 0, $W, $H), [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$stride = $d.Stride; $px = New-Object byte[] ($stride * $H)
[System.Runtime.InteropServices.Marshal]::Copy($d.Scan0, $px, 0, $px.Length); $src.UnlockBits($d)
$alpha = { param($x, $y) $px[$y * $stride + $x * 4 + 3] }

# cut where the sheet is emptiest, near each grid line
$rowSum = New-Object int[] $H; $colSum = New-Object int[] $W
for ($y = 0; $y -lt $H; $y++) { $o = $y * $stride; for ($x = 0; $x -lt $W; $x++) { if ($px[$o + $x * 4 + 3] -gt 40) { $rowSum[$y]++; $colSum[$x]++ } } }
function Find-Cut($sum, $center, $reach) { $best = $center; for ($i = [math]::Max(0, $center - $reach); $i -le [math]::Min($sum.Length - 1, $center + $reach); $i++) { if ($sum[$i] -lt $sum[$best]) { $best = $i } }; $best }
$ys = @(0) + (1..($rows - 1) | ForEach-Object { Find-Cut $rowSum ([int]($_ * $H / $rows)) ([int]($H / $rows / 3)) }) + @($H)
Write-Host ("row cuts: " + ($ys -join ', '))
# column cuts per row: a wide pose in one row (a sword swing) must not decide where another row is cut
function Col-Cuts($y0, $y1) {
  $sum = New-Object int[] $W
  for ($y = $y0; $y -lt $y1; $y++) { $o = $y * $stride; for ($x = 0; $x -lt $W; $x++) { if ($px[$o + $x * 4 + 3] -gt 40) { $sum[$x]++ } } }
  @(0) + (1..($Frames - 1) | ForEach-Object { Find-Cut $sum ([int]($_ * $W / $Frames)) ([int]($W / $Frames / 4)) }) + @($W)
}

$outDir = Join-Path $root $Out; New-Item -ItemType Directory -Force $outDir | Out-Null
for ($r = 0; $r -lt $rows; $r++) {
  $y0 = $ys[$r]; $y1 = $ys[$r + 1]; $rowH = $y1 - $y0
  $xs = Col-Cuts $y0 $y1; Write-Host ("row $r col cuts: " + ($xs -join ', '))
  # per frame: content box, and the body's centre (opaque mass of the lower half, so a side effect like fire doesn't pull it)
  $info = for ($f = 0; $f -lt $Frames; $f++) {
    $x0 = $xs[$f]; $x1 = $xs[$f + 1]; $minX = $x1; $maxX = $x0; $minY = $y1; $maxY = $y0
    for ($y = $y0; $y -lt $y1; $y++) { $o = $y * $stride; for ($x = $x0; $x -lt $x1; $x++) { if ($px[$o + $x * 4 + 3] -gt 40) { if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }; if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y } } } }
    $mid = $minY + ($maxY - $minY) * 0.5; $sx = 0; $n = 0
    for ($y = [int]$mid; $y -le $maxY; $y++) { $o = $y * $stride; for ($x = $x0; $x -lt $x1; $x++) { if ($px[$o + $x * 4 + 3] -gt 40) { $sx += $x; $n++ } } }
    [pscustomobject]@{ x0 = $x0; x1 = $x1; bottom = $maxY; cx = $(if ($n) { $sx / $n } else { ($x0 + $x1) / 2 }) }
  }
  $strip = New-Object System.Drawing.Bitmap ($SlotW * $Frames), $rowH, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($strip); $g.Clear([System.Drawing.Color]::Transparent)
  $baseline = $rowH - 6
  for ($f = 0; $f -lt $Frames; $f++) {
    $i = $info[$f]
    $dx = [int]($f * $SlotW + $SlotW / 2 - ($i.cx - $i.x0)); $dy = [int]($baseline - ($i.bottom - $y0))
    $g.SetClip((New-Object System.Drawing.Rectangle ($f * $SlotW), 0, $SlotW, $rowH))
    $g.DrawImage($src, (New-Object System.Drawing.Rectangle $dx, $dy, ($i.x1 - $i.x0), $rowH), (New-Object System.Drawing.Rectangle $i.x0, $y0, ($i.x1 - $i.x0), $rowH), [System.Drawing.GraphicsUnit]::Pixel)
  }
  $g.Dispose()
  $file = Join-Path $outDir "$($Names[$r]).png"; $strip.Save($file, [System.Drawing.Imaging.ImageFormat]::Png); $strip.Dispose()
  Write-Host ("{0,-8} strip {1}x{2}" -f $Names[$r], ($SlotW * $Frames), $rowH)
}
$src.Dispose()
