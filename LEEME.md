# ZONEMIL GANADERO · App Android (APK)

Misma lógica que el programa de escritorio: clasificación automática, reproducción (FPP = servicio + 283 días),
alerta de días abiertos > 110, ordeño, sanidad, salidas/bajas anulables, termo de pajillas, récord histórico,
usuarios y roles, historial, PDF (imprimir / guardar como PDF) y Excel (CSV).

- Pide el código de instalación la primera vez (misma URL / hoja de Google que `instalador.iss`).
- Los datos quedan en el teléfono (almacenamiento interno de la app), con copia automática diaria (10 últimas).
- Respaldo: «Más → Exportar respaldo» (.json). «Importar respaldo» también acepta los respaldos de la versión web.
- Primer inicio: admin / admin123.

## Compilar con GitHub Actions
1. Cree un repositorio **privado** en GitHub y suba todo el contenido de esta carpeta (incluida `.github`).
2. En la pestaña **Actions** se ejecuta «Compilar APK» (o pulse *Run workflow*).
3. Al terminar, descargue el artefacto **ZonemilGanadero-apk** (zip con `ZonemilGanadero.apk`).

## Firma
`app/zonemil.keystore` (clave `zonemil2026`, alias `zonemil`) firma todas las versiones, para que las
actualizaciones se instalen encima sin perder datos. Guarde una copia: si se pierde, las nuevas versiones
no se podrán instalar sobre la anterior. Opcional: definir los secretos KEYSTORE_PASSWORD y KEY_PASSWORD.
