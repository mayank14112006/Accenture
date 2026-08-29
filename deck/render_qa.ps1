# Render every slide of the deck to PNG via PowerPoint COM (true fidelity),
# and export the PDF deliverable. Usage: powershell -File render_qa.ps1
$ErrorActionPreference = "Stop"
$deck = Join-Path $PSScriptRoot "ControlPlane_Round2.pptx"
$outDir = Join-Path $PSScriptRoot "qa"
if (Test-Path $outDir) { Remove-Item -Recurse -Force $outDir }
New-Item -ItemType Directory -Force $outDir | Out-Null

$pp = New-Object -ComObject PowerPoint.Application
try {
  $pres = $pp.Presentations.Open($deck, $true, $false, $false)  # readonly, no window
  $i = 0
  foreach ($slide in $pres.Slides) {
    $i++
    $slide.Export((Join-Path $outDir ("slide-{0:d2}.png" -f $i)), "PNG", 1600, 900)
  }
  $pdf = Join-Path $PSScriptRoot "ControlPlane_Round2.pdf"
  if (Test-Path $pdf) { Remove-Item -Force $pdf }
  $pres.SaveAs($pdf, 32)  # ppSaveAsPDF
  $pres.Close()
  Write-Output "exported $i slides to $outDir and PDF to $pdf"
} finally {
  $pp.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($pp) | Out-Null
}
