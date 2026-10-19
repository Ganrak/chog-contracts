# Cuts a transparent PNG sheet (ChatGPT item / bed sheets) into one PNG per object: finds the solid blobs
# (alpha above -Alpha), drops specks smaller than -MinPx, sorts them in reading order (rows, then left to right)
# and saves each trimmed blob as <OutDir>\<name>.png using -Names in that order.
# Example: .\scripts\cut-sprites.ps1 -Src items.png -OutDir assets\room\items -Names plant,cup,figurine
param([string]$Src, [string]$OutDir, [string[]]$Names, [int]$Alpha = 100, [int]$MinPx = 2500, [int]$Pad = 4, [int]$MaxW = 360)
$code = @'
using System; using System.Drawing; using System.Drawing.Imaging; using System.Collections.Generic; using System.Linq;
public static class Sprites {
  public static List<int[]> Find(string src, int alphaMin, int minPx) {
    using (var bmp = new Bitmap(src)) {
      int w = bmp.Width, h = bmp.Height;
      var d = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
      var px = new byte[d.Stride * h]; System.Runtime.InteropServices.Marshal.Copy(d.Scan0, px, 0, px.Length); bmp.UnlockBits(d);
      var seen = new bool[w * h]; var boxes = new List<int[]>(); var q = new Stack<int>();
      for (int i = 0; i < w * h; i++) {
        if (seen[i] || px[(i / w) * d.Stride + (i % w) * 4 + 3] < alphaMin) continue;
        int x0 = w, y0 = h, x1 = 0, y1 = 0, n = 0; q.Push(i); seen[i] = true;
        while (q.Count > 0) {
          int k = q.Pop(), x = k % w, y = k / w; n++;
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
          foreach (int nb in new[] { k - 1, k + 1, k - w, k + w }) {
            if (nb < 0 || nb >= w * h || seen[nb]) continue;
            if (Math.Abs(nb % w - x) > 1) continue;
            if (px[(nb / w) * d.Stride + (nb % w) * 4 + 3] < alphaMin) continue;
            seen[nb] = true; q.Push(nb);
          }
        }
        if (n >= minPx) boxes.Add(new[] { x0, y0, x1, y1, n });
      }
      return boxes;
    }
  }
  public static void Save(string src, string dst, int x0, int y0, int x1, int y1, int pad, int maxW) {
    using (var bmp = new Bitmap(src)) {
      x0 = Math.Max(0, x0 - pad); y0 = Math.Max(0, y0 - pad); x1 = Math.Min(bmp.Width - 1, x1 + pad); y1 = Math.Min(bmp.Height - 1, y1 + pad);
      int w = x1 - x0 + 1, h = y1 - y0 + 1; double s = Math.Min(1.0, (double)maxW / Math.Max(w, h));
      int ow = (int)Math.Round(w * s), oh = (int)Math.Round(h * s);
      using (var o = new Bitmap(ow, oh, PixelFormat.Format32bppArgb)) using (var g = Graphics.FromImage(o)) {
        g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
        g.DrawImage(bmp, new Rectangle(0, 0, ow, oh), new Rectangle(x0, y0, w, h), GraphicsUnit.Pixel);
        o.Save(dst, ImageFormat.Png);
      }
    }
  }
}
'@
Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing
$Names = @($Names | ForEach-Object { $_ -split ',' } | Where-Object { $_ })  # "a,b,c" from powershell -File arrives as one string
$full = (Resolve-Path $Src).Path
New-Item -ItemType Directory -Force $OutDir | Out-Null
$boxes = [Sprites]::Find($full, $Alpha, $MinPx)
# reading order: group into rows by vertical centre, then left to right
$rows = @(); foreach ($b in ($boxes | Sort-Object { ($_[1] + $_[3]) / 2 })) {
  $cy = ($b[1] + $b[3]) / 2; $row = $rows | Where-Object { [math]::Abs($_.cy - $cy) -lt 120 } | Select-Object -First 1
  if ($row) { $row.items += , $b } else { $rows += [pscustomobject]@{ cy = $cy; items = @(, $b) } }
}
$ordered = foreach ($r in ($rows | Sort-Object cy)) { $r.items | Sort-Object { $_[0] } }
Write-Output "found $(@($ordered).Count) objects"
$i = 0
foreach ($b in $ordered) {
  $name = if ($i -lt $Names.Count) { $Names[$i] } else { "extra-$i" }
  [Sprites]::Save($full, [IO.Path]::GetFullPath("$OutDir\$name.png"), $b[0], $b[1], $b[2], $b[3], $Pad, $MaxW)
  Write-Output ("{0,-10} box {1},{2} - {3},{4}  ({5} px)" -f $name, $b[0], $b[1], $b[2], $b[3], $b[4]); $i++
}
