# Cuts a sheet painted on flat magenta (#FF00FF) into equal grid cells, turns the magenta into transparency and
# saves one trimmed PNG per cell. Edge pixels are un-mixed from the magenta, so no pink fringe is left.
#   powershell -ExecutionPolicy Bypass -File scripts\key-sheet.ps1 -Sheet capsule-sheet.webp -Cols 4 -Rows 3 -Names a,b,c -Out assets\capsule
param([Parameter(Mandatory)][string]$Sheet, [int]$Cols = 4, [int]$Rows = 3, [Parameter(Mandatory)][string[]]$Names, [string]$Out = 'assets\capsule', [int]$Max = 256, [int]$Pad = 6)
$ErrorActionPreference = 'Stop'
$Names = @($Names | ForEach-Object { $_ -split ',' } | Where-Object { $_ })
Add-Type -AssemblyName PresentationCore, System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System; using System.Drawing; using System.Drawing.Imaging; using System.Runtime.InteropServices;
public static class MagentaKey {
  // BGRA pixels in place: alpha from the distance to the sheet's magenta, colour un-mixed from it at the edges
  public static void Key(byte[] px, double bgR, double bgG, double bgB, double lo, double hi) {
    for (int i = 0; i < px.Length; i += 4) {
      double b = px[i], g = px[i + 1], r = px[i + 2];
      double d = Math.Sqrt((bgR - r) * (bgR - r) + (bgG - g) * (bgG - g) + (bgB - b) * (bgB - b));
      double a = Math.Min(1, Math.Max(0, (d - lo) / (hi - lo)));
      if (a <= 0) { px[i] = px[i + 1] = px[i + 2] = px[i + 3] = 0; continue; }
      if (a < 1) {
        r = (r - (1 - a) * bgR) / a; g = (g - (1 - a) * bgG) / a; b = (b - (1 - a) * bgB) / a;
        px[i] = (byte)Math.Min(255, Math.Max(0, b)); px[i + 1] = (byte)Math.Min(255, Math.Max(0, g)); px[i + 2] = (byte)Math.Min(255, Math.Max(0, r));
      }
      px[i + 3] = (byte)Math.Round(a * 255);
    }
  }
  // one cell: trim to what is visible (+pad), scale so the longer side is at most max, save as PNG; returns "w x h" or null
  public static string Cell(byte[] px, int W, int x0, int y0, int cw, int ch, int pad, int max, string file) {
    int minX = cw, minY = ch, maxX = -1, maxY = -1;
    for (int y = 0; y < ch; y++) for (int x = 0; x < cw; x++) if (px[((y0 + y) * W + x0 + x) * 4 + 3] > 24) {
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    if (maxX < 0) return null;
    minX = Math.Max(0, minX - pad); minY = Math.Max(0, minY - pad); maxX = Math.Min(cw - 1, maxX + pad); maxY = Math.Min(ch - 1, maxY + pad);
    int w = maxX - minX + 1, h = maxY - minY + 1;
    using (var bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb)) {
      var bd = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
      for (int y = 0; y < h; y++) Marshal.Copy(px, ((y0 + minY + y) * W + x0 + minX) * 4, bd.Scan0 + y * bd.Stride, w * 4);
      bmp.UnlockBits(bd);
      double k = Math.Min(1.0, (double)max / Math.Max(w, h)); int tw = (int)Math.Round(w * k), th = (int)Math.Round(h * k);
      using (var o = new Bitmap(tw, th, PixelFormat.Format32bppArgb)) using (var gr = Graphics.FromImage(o)) {
        gr.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic; gr.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;
        gr.DrawImage(bmp, 0, 0, tw, th); o.Save(file, ImageFormat.Png); return tw + "x" + th;
      }
    }
  }
}
'@
$root = (Resolve-Path "$PSScriptRoot\..").Path
$fs = [IO.File]::OpenRead((Join-Path $root $Sheet))
$frame = [Windows.Media.Imaging.BitmapDecoder]::Create($fs, 'None', 'OnLoad').Frames[0]
$conv = New-Object Windows.Media.Imaging.FormatConvertedBitmap($frame, [Windows.Media.PixelFormats]::Bgra32, $null, 0)
$W = $conv.PixelWidth; $H = $conv.PixelHeight
$px = New-Object byte[] ($W * 4 * $H); $conv.CopyPixels($px, $W * 4, 0); $fs.Close()
# the sheet's own magenta, read from its top-left corner (generators rarely hit #FF00FF exactly)
[MagentaKey]::Key($px, [double]$px[2], [double]$px[1], [double]$px[0], 45, 120)
New-Item -ItemType Directory -Force (Join-Path $root $Out) | Out-Null
$cw = [int][math]::Floor($W / $Cols); $ch = [int][math]::Floor($H / $Rows); $n = 0
for ($ry = 0; $ry -lt $Rows; $ry++) { for ($cx = 0; $cx -lt $Cols; $cx++) {
  if ($n -lt $Names.Count) {
    $file = Join-Path $root "$Out\$($Names[$n]).png"
    $size = [MagentaKey]::Cell($px, $W, $cx * $cw, $ry * $ch, $cw, $ch, $Pad, $Max, $file)
    "{0,-14} {1}" -f $Names[$n], $(if ($size) { "$size  $([math]::Round((Get-Item $file).Length / 1KB)) KB" } else { 'empty cell' })
  }
  $n++
} }
