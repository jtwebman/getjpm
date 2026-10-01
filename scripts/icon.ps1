# Renders public/apple-touch-icon.png (180x180) from favicon.svg's shapes with .NET System.Drawing,
# on Windows:
#   powershell -File scripts/icon.ps1 public/apple-touch-icon.png
# A full square: iOS and the chat apps that use it round the corners themselves.
param([string]$Out = 'public/apple-touch-icon.png')
Add-Type -AssemblyName System.Drawing
$n = 180; $s = $n / 32
$bmp = New-Object System.Drawing.Bitmap $n, $n
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.Clear([System.Drawing.ColorTranslator]::FromHtml('#099268'))
$white = [System.Drawing.Color]::White
$g.FillEllipse((New-Object System.Drawing.SolidBrush $white), (18.5 - 2.25) * $s, (8.75 - 2.25) * $s, 4.5 * $s, 4.5 * $s)
$pen = New-Object System.Drawing.Pen $white, (3.5 * $s)
$pen.StartCap = 'Round'; $pen.EndCap = 'Round'; $pen.LineJoin = 'Round'
$jp = New-Object System.Drawing.Drawing2D.GraphicsPath
$jp.AddLine(18.5 * $s, 13.5 * $s, 18.5 * $s, 22.75 * $s)
$jp.AddArc((18.5 - 8.5) * $s, (22.75 - 4.25) * $s, 8.5 * $s, 8.5 * $s, 0, 90)
$jp.AddLine(14.25 * $s, 27 * $s, 11.5 * $s, 27 * $s)
$g.DrawPath($pen, $jp)
$bmp.Save((Join-Path (Get-Location) $Out), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
