# Makes colour variants of one painted part of a picture (the rug, the curtains...) without redrawing it:
# picks the pixels inside -Box (x0,y0,x1,y1 in source pixels) whose hue is within -HueMin..-HueMax and that are
# colourful enough, then saves, per variant, a transparent PNG of just those pixels recoloured to that hue
# (lightness kept, so folds, pattern and shading stay). Prints where the crop sits, in % of the picture.
# Example: .\scripts\recolor-region.ps1 -Src room.png -Box 470,780,1300,941 -HueMin 250 -HueMax 330 -OutDir assets\room\rugs -Variants "red:0,teal:175,gold:42"
param([string]$Src, [string]$Box, [int]$HueMin = 250, [int]$HueMax = 330, [double]$SatMin = 0.18, [string]$OutDir, [string]$Variants, [double]$Boost = 1.0)
$code = @'
using System; using System.Drawing; using System.Drawing.Imaging;
public static class Recolor {
  static void ToHsl(double r, double g, double b, out double h, out double s, out double l) {
    double mx = Math.Max(r, Math.Max(g, b)), mn = Math.Min(r, Math.Min(g, b)); l = (mx + mn) / 2; double d = mx - mn;
    if (d < 1e-6) { h = 0; s = 0; return; }
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx == r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60; else if (mx == g) h = ((b - r) / d + 2) * 60; else h = ((r - g) / d + 4) * 60;
  }
  static double Hue2(double p, double q, double t) { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1.0/6) return p + (q - p) * 6 * t; if (t < 0.5) return q; if (t < 2.0/3) return p + (q - p) * (2.0/3 - t) * 6; return p; }
  static void ToRgb(double h, double s, double l, out double r, out double g, out double b) {
    if (s < 1e-6) { r = g = b = l; return; } double q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q, hk = h / 360;
    r = Hue2(p, q, hk + 1.0/3); g = Hue2(p, q, hk); b = Hue2(p, q, hk - 1.0/3);
  }
  public static void Make(string src, string dst, int x0, int y0, int x1, int y1, double hmin, double hmax, double smin, double hue, double boost) {
    using (var bmp = new Bitmap(src)) {
      int w = x1 - x0 + 1, h = y1 - y0 + 1;
      using (var o = new Bitmap(w, h, PixelFormat.Format32bppArgb)) {
        for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) {
          var c = bmp.GetPixel(x0 + x, y0 + y); double H, S, L; ToHsl(c.R / 255.0, c.G / 255.0, c.B / 255.0, out H, out S, out L);
          if (H < hmin || H > hmax || S < smin) continue;
          double r, g, b; ToRgb(hue, Math.Min(1, S * boost), L, out r, out g, out b);
          // soft edge: barely-coloured pixels blend in
          int a = (int)Math.Min(255, 255 * Math.Min(1, (S - smin) / 0.12));
          o.SetPixel(x, y, Color.FromArgb(a, (int)(r * 255), (int)(g * 255), (int)(b * 255)));
        }
        o.Save(dst, ImageFormat.Png);
      }
    }
  }
}
'@
Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing
$B = @($Box -split '[,\s]+' | Where-Object { $_ } | ForEach-Object { [int]$_ })  # "x0,y0,x1,y1"
$full = (Resolve-Path $Src).Path; New-Item -ItemType Directory -Force $OutDir | Out-Null
Add-Type -AssemblyName System.Drawing; $img = [System.Drawing.Image]::FromFile($full); $W = $img.Width; $H = $img.Height; $img.Dispose()
foreach ($v in ($Variants -split ',')) {
  $name, $hue = $v -split ':'
  [Recolor]::Make($full, [IO.Path]::GetFullPath("$OutDir\$name.png"), $B[0], $B[1], $B[2], $B[3], $HueMin, $HueMax, $SatMin, [double]$hue, $Boost)
  Write-Output "saved $name"
}
"{0:N2}% left, {1:N2}% top, {2:N2}% wide, {3:N2}% high" -f (100 * $B[0] / $W), (100 * $B[1] / $H), (100 * ($B[2] - $B[0] + 1) / $W), (100 * ($B[3] - $B[1] + 1) / $H)
