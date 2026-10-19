# Turns a phone photo of a paper drawing into a clean "paper note" PNG for the site:
# crops it, evens out the lighting (each spot divided by the local paper colour), makes the paper warm white,
# deepens the pencil/crayon strokes, and scales it to -Width.
# Example: .\scripts\clean-drawing.ps1 -Src "photo.jpeg" -Dst assets\fanart\chog.png -X 0 -Y 250 -W 738 -H 830 -Width 500
param([string]$Src, [string]$Dst, [int]$X, [int]$Y, [int]$W, [int]$H, [int]$Width = 500)
$code = @'
using System; using System.Drawing; using System.Drawing.Imaging; using System.Collections.Generic;
public static class PaperNote {
  public static void Cut(string src, string dst, int x, int y, int w, int h, int outW) {
    using (var img = new Bitmap(src)) {
      var crop = img.Clone(new Rectangle(x, y, w, h), PixelFormat.Format32bppArgb);
      var d = crop.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
      var px = new byte[d.Stride * h]; System.Runtime.InteropServices.Marshal.Copy(d.Scan0, px, 0, px.Length);
      int S = d.Stride, C = 28, gw = (w + C - 1) / C, gh = (h + C - 1) / C;
      // paper colour per grid cell: the brightest 20% of its pixels
      var bg = new double[gw, gh, 3];
      for (int gy = 0; gy < gh; gy++) for (int gx = 0; gx < gw; gx++) {
        var list = new List<int>();
        for (int yy = gy * C; yy < Math.Min(h, gy * C + C); yy++) for (int xx = gx * C; xx < Math.Min(w, gx * C + C); xx++) list.Add(yy * S + xx * 4);
        list.Sort((a, b) => (px[b] + px[b + 1] + px[b + 2]).CompareTo(px[a] + px[a + 1] + px[a + 2]));
        int n = Math.Max(1, list.Count / 5); double sb = 0, sg = 0, sr = 0;
        for (int i = 0; i < n; i++) { sb += px[list[i]]; sg += px[list[i] + 1]; sr += px[list[i] + 2]; }
        bg[gx, gy, 0] = sb / n; bg[gx, gy, 1] = sg / n; bg[gx, gy, 2] = sr / n;
      }
      // cells covered by drawing borrow the paper colour of their neighbours
      for (int pass = 0; pass < 2; pass++) {
        var nb = (double[,,])bg.Clone();
        for (int gy = 0; gy < gh; gy++) for (int gx = 0; gx < gw; gx++) for (int c = 0; c < 3; c++) {
          double m = bg[gx, gy, c];
          for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) { int ax = gx + dx, ay = gy + dy; if (ax >= 0 && ay >= 0 && ax < gw && ay < gh) m = Math.Max(m, bg[ax, ay, c]); }
          nb[gx, gy, c] = m;
        }
        bg = nb;
      }
      for (int yy = 0; yy < h; yy++) for (int xx = 0; xx < w; xx++) {
        double fx = Math.Max(0, Math.Min(gw - 1.001, (xx - C / 2.0) / C)), fy = Math.Max(0, Math.Min(gh - 1.001, (yy - C / 2.0) / C));
        int x0 = (int)fx, y0 = (int)fy, x1 = Math.Min(gw - 1, x0 + 1), y1 = Math.Min(gh - 1, y0 + 1); double tx = fx - x0, ty = fy - y0;
        int i = yy * S + xx * 4;
        for (int c = 0; c < 3; c++) {
          double b = (bg[x0, y0, c] * (1 - tx) + bg[x1, y0, c] * tx) * (1 - ty) + (bg[x0, y1, c] * (1 - tx) + bg[x1, y1, c] * tx) * ty;
          double v = Math.Pow(Math.Min(1, px[i + c] / Math.Max(40, b) * 1.04), 1.6); // 1 = paper; strokes get deeper
          double paper = c == 0 ? 236 : c == 1 ? 245 : 250;                           // warm paper (BGR)
          px[i + c] = (byte)Math.Max(0, Math.Min(255, v * paper));
        }
      }
      System.Runtime.InteropServices.Marshal.Copy(px, 0, d.Scan0, px.Length); crop.UnlockBits(d);
      int outH = (int)Math.Round(h * (double)outW / w);
      using (var o = new Bitmap(outW, outH)) using (var g = Graphics.FromImage(o)) {
        g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic; g.DrawImage(crop, 0, 0, outW, outH); o.Save(dst, ImageFormat.Png);
      }
    }
  }
}
'@
Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing
[PaperNote]::Cut((Resolve-Path $Src).Path, [IO.Path]::GetFullPath($Dst), $X, $Y, $W, $H, $Width)
Write-Output "saved $Dst"
