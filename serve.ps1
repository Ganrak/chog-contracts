param([string]$Root = $PSScriptRoot, [int]$Port = 8791)
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://localhost:$Port/")
$l.Start()
$types = @{ '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8';
            '.png'='image/png'; '.jpg'='image/jpeg'; '.svg'='image/svg+xml'; '.json'='application/json'; '.webp'='image/webp'; '.glb'='model/gltf-binary' }
while ($l.IsListening) {
  $c = $l.GetContext()
  try {
    $p = [Uri]::UnescapeDataString($c.Request.Url.AbsolutePath.TrimStart('/'))
    # dev helper: POST /__snap?name=x.png stores a canvas capture in $env:SNAP_DIR (if set)
    if ($c.Request.HttpMethod -eq 'POST' -and $p -eq '__snap' -and $env:SNAP_DIR) {
      $name = [IO.Path]::GetFileName($c.Request.QueryString['name'])
      if ($name -match '^[\w.-]+\.png$') {
        $fs = [IO.File]::Create((Join-Path $env:SNAP_DIR $name)); $c.Request.InputStream.CopyTo($fs); $fs.Close()
      } else { $c.Response.StatusCode = 403 }
      continue
    }
    if ($p -eq '') { $p = 'index.html' }
    $f = Join-Path $Root $p
    if ((Test-Path -LiteralPath $f -PathType Leaf) -and ([IO.Path]::GetFullPath($f).StartsWith([IO.Path]::GetFullPath($Root)))) {
      $c.Response.ContentType = $types[[IO.Path]::GetExtension($f)]
      $c.Response.Headers.Add('Cache-Control', 'no-store')
      $bytes = [IO.File]::ReadAllBytes($f)
      $c.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else { $c.Response.StatusCode = 404 }
  } catch {} finally { $c.Response.Close() }
}
