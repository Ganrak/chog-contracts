# Collects the playable site into .\site, ready to drag onto https://app.netlify.com/drop
#   powershell -ExecutionPolicy Bypass -File scripts\build.ps1            (as is)
#   powershell -ExecutionPolicy Bypass -File scripts\build.ps1 -Refresh   (refresh who owns which Chog first, ~3 min)
#   -SiteUrl https://name.netlify.app   (the live address; link previews on X/Discord need full image URLs)
param([switch]$Refresh, [string]$SiteUrl = 'https://chog-contracts.netlify.app')
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path "$PSScriptRoot\..").Path
# a fresh owner list means "Bring your Chog" finds recent buyers instantly instead of sweeping all 1,969 ids
if ($Refresh) { & powershell -NoProfile -ExecutionPolicy Bypass -File "$PSScriptRoot\snapshot.ps1" -OwnersOnly }
$out = "$root\site"
if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Force "$out\src", "$out\assets\chogs", "$out\assets\monsters\attack", "$out\assets\brand", "$out\assets\room", "$out\assets\room\items", "$out\assets\room\curtains", "$out\assets\map", "$out\assets\arcade", "$out\assets\arena", "$out\assets\fx", "$out\data" | Out-Null

# only what players need: no dev pages (lab.html, potion-lab.html, banner.html) on the live site
Copy-Item "$root\demo.html" "$out\index.html"
Copy-Item "$root\src\*.js" "$out\src\"
Copy-Item "$root\vendor" "$out\vendor" -Recurse              # three.js served from our own site, not a CDN
Copy-Item "$root\assets\potions-glb.json" "$out\assets\"
Copy-Item "$root\assets\monsters\*.png" "$out\assets\monsters\"
Copy-Item "$root\assets\monsters\attack\*.png" "$out\assets\monsters\attack\"
Copy-Item "$root\assets\chogs\*.webp", "$root\assets\chogs\apprentice*.png" "$out\assets\chogs\"  # NFT art + the Apprentice cut-outs and strips
Copy-Item "$root\assets\brand\*.png", "$root\assets\brand\*.jpg" "$out\assets\brand\"  # official Chog logo from chog.xyz/brand + the link-preview picture
Copy-Item "$root\assets\room\*.jpg" "$out\assets\room\"      # the painted Wannabe's Room
Copy-Item "$root\assets\map\*.webp" "$out\assets\map\"       # the painted expedition map
Copy-Item "$root\assets\arcade\*.webp" "$out\assets\arcade\" # the painted arcade room
'ghoul', 'troll', 'thief', 'golem', 'harpy', 'wraith', 'boss' | ForEach-Object { Copy-Item "$root\assets\arena\$_.webp" "$out\assets\arena\" }  # painted arenas (not the source sheet or PNG)
Copy-Item "$root\assets\fx\*.webp" "$out\assets\fx\"  # painted icons sheet + effect stickers (the source PNGs stay out)
Copy-Item "$root\assets\room\items\*.png" "$out\assets\room\items\"  # things to decorate it with
Copy-Item "$root\assets\room\curtains\*.png" "$out\assets\room\curtains\"  # recoloured curtains
if (Test-Path "$root\data\chogs.json") { Copy-Item "$root\data\chogs.json" "$out\data\" }

# Content-Security-Policy: the browser runs only our own scripts plus the one inline import map (allowed by its
# hash), and talks only to Monad RPC and the IPFS gateway. Injected or third-party scripts are refused.
$html = [IO.File]::ReadAllText("$out\index.html", [Text.Encoding]::UTF8)
# link previews: full address for the picture, plus og:url
$SiteUrl = $SiteUrl.TrimEnd('/')
$html = $html.Replace('content="assets/brand/og.jpg"', "content=`"$SiteUrl/assets/brand/og.jpg`"").Replace('<meta property="og:type" content="website">', "<meta property=`"og:type`" content=`"website`">`n<meta property=`"og:url`" content=`"$SiteUrl/`">")
[IO.File]::WriteAllText("$out\index.html", $html, (New-Object Text.UTF8Encoding $false))
$map = [regex]::Match($html, '(?s)<script type="importmap">(.*?)</script>').Groups[1].Value
$sha = [Security.Cryptography.SHA256]::Create()
$hashes = @($map, $map.Replace("`r`n", "`n")) | Select-Object -Unique | ForEach-Object { "'sha256-" + [Convert]::ToBase64String($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($_))) + "'" }
$csp = @(
  "default-src 'self'",
  "script-src 'self' $($hashes -join ' ')",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' data: blob: https://rpc.monad.xyz https://ipfs.filebase.io",
  "media-src 'self'",
  "worker-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests"
) -join '; '

@"
/*
  Content-Security-Policy: $csp
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), hid=(), bluetooth=()
  Cross-Origin-Opener-Policy: same-origin
  Strict-Transport-Security: max-age=31536000
/assets/*
  Cache-Control: public, max-age=86400
/vendor/*
  Cache-Control: public, max-age=604800, immutable
/data/*
  Cache-Control: public, max-age=300
"@ | Set-Content -Path "$out\_headers" -Encoding ascii

$size = (Get-ChildItem $out -Recurse -File | Measure-Object Length -Sum).Sum
Write-Host ("site ready: {0} files, {1:N1} MB in {2}" -f (Get-ChildItem $out -Recurse -File).Count, ($size / 1MB), $out)
