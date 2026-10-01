# Renders public/favicon.ico (16, 32 and 48 px, PNG-encoded entries) from favicon.svg's shapes with
# .NET System.Drawing, on Windows, for the browsers and tools that only look for /favicon.ico:
#   powershell -File scripts/favicon.ps1 public/favicon.ico
param([string]$Out = 'public/favicon.ico')
Add-Type -AssemblyName System.Drawing

function Render([int]$n) {
  $s = $n / 32
  $bmp = New-Object System.Drawing.Bitmap $n, $n
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::Transparent)
  # The rounded square, as in favicon.svg (rx 8 of 32).
  $r = 8 * $s; $d = $r * 2; $w = 32 * $s
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $p.AddArc(0, 0, $d, $d, 180, 90); $p.AddArc($w - $d, 0, $d, $d, 270, 90)
  $p.AddArc($w - $d, $w - $d, $d, $d, 0, 90); $p.AddArc(0, $w - $d, $d, $d, 90, 90); $p.CloseFigure()
  $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#b8682f'))), $p)
  $white = [System.Drawing.Color]::White
  $g.FillEllipse((New-Object System.Drawing.SolidBrush $white), (18.5 - 2.25) * $s, (8.75 - 2.25) * $s, 4.5 * $s, 4.5 * $s)
  $pen = New-Object System.Drawing.Pen $white, (3.5 * $s)
  $pen.StartCap = 'Round'; $pen.EndCap = 'Round'; $pen.LineJoin = 'Round'
  $jp = New-Object System.Drawing.Drawing2D.GraphicsPath
  $jp.AddLine(18.5 * $s, 13.5 * $s, 18.5 * $s, 22.75 * $s)
  $jp.AddArc((18.5 - 8.5) * $s, (22.75 - 4.25) * $s, 8.5 * $s, 8.5 * $s, 0, 90)
  $jp.AddLine(14.25 * $s, 27 * $s, 11.5 * $s, 27 * $s)
  $g.DrawPath($pen, $jp)
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  return ,$ms.ToArray()
}

# ICO: a 6-byte header, a 16-byte directory entry per image, then the images (PNG data).
$sizes = 16, 32, 48
$images = $sizes | ForEach-Object { ,(Render $_) }
$ico = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter -ArgumentList $ico
$bw.Write([UInt16]0); $bw.Write([UInt16]1); $bw.Write([UInt16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
for ($i = 0; $i -lt $sizes.Count; $i++) {
  $bw.Write([byte]$sizes[$i]); $bw.Write([byte]$sizes[$i]); $bw.Write([byte]0); $bw.Write([byte]0)
  $bw.Write([UInt16]1); $bw.Write([UInt16]32)
  $bw.Write([UInt32]$images[$i].Length); $bw.Write([UInt32]$offset)
  $offset += $images[$i].Length
}
foreach ($img in $images) { $bw.Write($img) }
$bw.Flush()
[System.IO.File]::WriteAllBytes((Join-Path (Get-Location) $Out), $ico.ToArray())
