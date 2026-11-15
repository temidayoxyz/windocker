# Puts the Windows taskbar back if Windocker was closed while it was hidden.
# Restarting Explorer restores the taskbar. Open windows stay open.

Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
Start-Process explorer
Write-Host "Explorer restarted. The taskbar should be visible again."
