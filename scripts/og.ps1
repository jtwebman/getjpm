# Renders public/og.png (1200x630) with .NET System.Drawing, on Windows:
#   powershell -File scripts/og.ps1 public/og.png
Add-Type -AssemblyName System.Drawing
$w = 1200; $h = 630
$bmp = New-Object System.Drawing.Bitmap $w, $h
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'AntiAliasGridFit'
$g.Clear([System.Drawing.ColorTranslator]::FromHtml('#0d0f12'))
$teal = [System.Drawing.ColorTranslator]::FromHtml('#12b886')
$white = [System.Drawing.Color]::White
# A soft glow behind the mark.
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddEllipse(-200, -360, 1000, 820)
$pgb = New-Object System.Drawing.Drawing2D.PathGradientBrush $path
$pgb.CenterColor = [System.Drawing.Color]::FromArgb(70, 18, 184, 134)
$pgb.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 13, 15, 18))
$g.FillPath($pgb, $path)
# The mark: a rounded square with a j, at 4.5x the 32px favicon.
$s = 4.5; $ox = 96; $oy = 120
function RR($x, $y, $ww, $hh, $r) { $p = New-Object System.Drawing.Drawing2D.GraphicsPath; $d = $r * 2; $p.AddArc($x, $y, $d, $d, 180, 90); $p.AddArc($x + $ww - $d, $y, $d, $d, 270, 90); $p.AddArc($x + $ww - $d, $y + $hh - $d, $d, $d, 0, 90); $p.AddArc($x, $y + $hh - $d, $d, $d, 90, 90); $p.CloseFigure(); return $p }
$g.FillPath((New-Object System.Drawing.SolidBrush $teal), (RR $ox $oy (32 * $s) (32 * $s) (8 * $s)))
$wb = New-Object System.Drawing.SolidBrush $white
$g.FillEllipse($wb, $ox + (18.5 - 2.25) * $s, $oy + (8.75 - 2.25) * $s, 4.5 * $s, 4.5 * $s)
$pen = New-Object System.Drawing.Pen $white, (3.5 * $s)
$pen.StartCap = 'Round'; $pen.EndCap = 'Round'
$jp = New-Object System.Drawing.Drawing2D.GraphicsPath
$jp.AddLine($ox + 18.5 * $s, $oy + 13.5 * $s, $ox + 18.5 * $s, $oy + 22.75 * $s)
$jp.AddArc($ox + (18.5 - 8.5) * $s, $oy + (22.75 - 4.25) * $s, 8.5 * $s, 8.5 * $s, 0, 90)
$jp.AddLine($ox + 14.25 * $s, $oy + 27 * $s, $ox + 11.5 * $s, $oy + 27 * $s)
$g.DrawPath($pen, $jp)
# Words.
$mono = New-Object System.Drawing.Font 'Cascadia Code', 120, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
$g.DrawString('jpm', $mono, $wb, 270, 110)
$sans = New-Object System.Drawing.Font 'Segoe UI Semibold', 50, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
$g.DrawString('A fast, small, secure-by-default', $sans, $wb, 92, 300)
$g.DrawString('package manager for JavaScript', $sans, $wb, 92, 364)
$small = New-Object System.Drawing.Font 'Segoe UI', 30, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
$grey = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#ced4da'))
$dot = [string][char]0x00B7; $g.DrawString("~2 MB binary  $dot  install scripts off until approved  $dot  new versions wait a day", $small, $grey, 96, 470)
$tb = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#38d9a9'))
$monoS = New-Object System.Drawing.Font 'Cascadia Code', 32, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
$g.DrawString('getjpm.sh', $monoS, $tb, 96, 540)
$bmp.Save($args[0], [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
