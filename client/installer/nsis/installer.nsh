; Fresh install: remove previous user data before copying the new app (Windows).
; Electron also purges on first launch via install-identity.json — this covers reinstall of the same build.

!macro customInstall
  SetShellVarContext current
  RMDir /r "$APPDATA\${PRODUCT_NAME}"
  RMDir /r "$LOCALAPPDATA\${PRODUCT_NAME}"
  RMDir /r "$APPDATA\limsplus-connect"
  RMDir /r "$LOCALAPPDATA\limsplus-connect"
  RMDir /r "$APPDATA\LimsPlus Connect"
  RMDir /r "$LOCALAPPDATA\LimsPlus Connect"
  RMDir /r "$APPDATA\LIMSPLUS Connect"
  RMDir /r "$LOCALAPPDATA\LIMSPLUS Connect"
!macroend

!macro customUnInstall
  SetShellVarContext current
  RMDir /r "$APPDATA\${PRODUCT_NAME}"
  RMDir /r "$LOCALAPPDATA\${PRODUCT_NAME}"
  RMDir /r "$APPDATA\limsplus-connect"
  RMDir /r "$LOCALAPPDATA\limsplus-connect"
  RMDir /r "$APPDATA\LimsPlus Connect"
  RMDir /r "$LOCALAPPDATA\LimsPlus Connect"
  RMDir /r "$APPDATA\LIMSPLUS Connect"
  RMDir /r "$LOCALAPPDATA\LIMSPLUS Connect"
!macroend
