# Editor, automatización y asistente del portafolio

El frontend Angular y este repositorio contienen los componentes activos. El repositorio `LynxPardelle/portfolioLynxPardelle` conserva el backend histórico de Dokploy y su historial. La API pública activa es la Lambda detrás de API Gateway.

## Despliegue y alta del editor

1. Ejecutar las pruebas de Node y Python, empaquetar con `python scripts/package-assistant.py` y sintetizar CDK. En Windows se puede pasar la ruta de `uv.exe` al script para usar los certificados del sistema. Promover por `dev`, `tst` y `prod` con el artefacto Angular del mismo entorno.
2. Usar el `EditorialUserPoolId` de cada stack API para crear la cuenta del propietario con `admin-create-user` y añadirla al grupo `admin`. Abrir `/admin` en el navegador, iniciar sesión con el correo y la contraseña temporal de la invitación, elegir una contraseña definitiva y registrar el QR de Cognito en una aplicación TOTP. Las cuentas que solo gestionan el blog pertenecen al grupo `editor`.
3. En Windows, ejecutar `pwsh -File scripts/editorial/Set-IngestCredential.ps1 -Environment prod`. La credencial se cifra para el usuario local mediante DPAPI. Ejecutar el mismo comando rota la credencial y revoca la anterior.
4. Probar un envío privado con `pwsh -File scripts/editorial/Send-Draft.ps1 -Environment dev -Path <draft.json>`. Volver a enviarlo y comprobar que aparece un solo borrador en `/admin/blog`. Publicar una revisión manual de prueba y retirarla después de confirmar que el enlace público funciona.

## Sesión compartida y próximos módulos administrativos

- `/admin/blog` y `/admin/settings` comparten el cliente Cognito, el flujo OAuth con PKCE y la sesión Angular en memoria. `/admin/blog` también recibe el retorno de Cognito. El enlace antiguo `/auth` abre la misma área. Cada entorno mantiene su propio pool.
- `editor` gestiona borradores, publicaciones y la beta del asistente. `admin` hereda ese acceso y configura la publicación automática. API Gateway valida el token y cada Lambda comprueba el grupo para las operaciones que atiende.
- Al incorporar edición para otra colección del portafolio, añadir su pantalla bajo `/admin` y su API de escritura autenticada con el mismo autorizador. Definir permisos por colección, validar el contenido y probar que una cuenta `editor` recibe 403 al escribir fuera del blog. El CV y los casos se mantienen versionados en el frontend. La API pública de obras, sitios y música sirve lecturas.

## Automatización de Desktop

Configurar una tarea local los lunes, miércoles y viernes a las 09:00, hora de Ciudad de México. Usar un directorio de trabajo para el buzón fuera de Git. Mantener la app abierta y el equipo despierto en esa ventana.

El borrador JSON contiene `slug`, `category`, `eventDate`, `sources`, `es` y `en`. Cada idioma contiene `title` y `markdown`. Usar `technology`, una fecha ISO y al menos dos enlaces primarios HTTPS. El slug representa el tema estable. Reutilizar el mismo archivo en un reintento. El comando de envío confirma el identificador sin mostrar la credencial.

La opción de publicación automática aparece después de seis aprobaciones consecutivas. El publicador aplica un máximo de tres artículos de origen Desktop por semana y solo considera artículos con fecha del hecho en los últimos siete días. Las revisiones manuales pueden guardarse y publicarse desde el editor.

## Beta y apertura pública

1. Desplegar con `ASSISTANT_ENABLED=1` y crear un valor aleatorio de 32 bytes en el parámetro `SecureString` `/portfolio/<entorno>/assistant/ip-salt`. Mantenerlo fuera de Git. Actualizar `/portfolio/<entorno>/assistant/status` a `beta` y probar desde el editor autenticado. El valor inicial es `paused`.
2. Invocar `portfolio-<entorno>-assistant-indexer` en `dev` y `tst` después de publicar un artículo de prueba. Esperar a que termine la ingesta de Knowledge Bases. Producción actualiza el índice cada 30 minutos.
3. Desplegar `AssistantEdge` en producción con `ASSISTANT_EDGE=1`. Verificar suscripción `ACTIVE` de tier `FREE`, bloqueo de acceso directo a Lambda, CORS, protección por IP y el límite atómico. Publicar el frontend con `ASSISTANT_PUBLIC=1` y poner el estado en `public` después de esas comprobaciones.
4. Para pausar, establecer `/portfolio/prod/assistant/status` en `paused`. Para volver a la beta, usar `beta`. El blog sigue sirviendo sus artículos.

## Control de costos

Mantener la distribución en CloudFront Free. CloudWatch registra una alarma a USD 5 estimados y la aplicación reserva capacidad con un límite de USD 8 estimados y 900 consultas mensuales. El modelo en uso es Amazon Nova Micro porque la cuenta no tiene acceso a Claude Haiku 5.5. Las cifras de referencia son USD 1.11 a 3.26 incrementales al mes para editor y asistente a ese volumen, antes de impuestos.
