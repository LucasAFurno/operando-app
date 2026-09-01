# Templates de Auth para operando.app

Usar estos textos en `Supabase > Authentication > Email Templates`.

## Recomendacion general

- Mantener correos cortos y directos.
- No meter marketing ni demasiados links.
- Usar siempre el mismo tono.
- En `From email` usar `no-reply@operando.app`.
- En `Sender name` usar `operando.app`.

## Confirm signup

### Subject

```text
Confirma tu cuenta de operando.app
```

### Body

```html
<div style="font-family:Arial,sans-serif;background:#0b0b0b;padding:32px;color:#f3f4f6;">
  <div style="max-width:560px;margin:0 auto;background:#111111;border:1px solid #222;border-radius:18px;padding:32px;">
    <img src="https://operando.app/operando-logo.png" alt="operando.app" style="width:72px;height:auto;border-radius:8px;display:block;margin-bottom:18px;">
    <p style="margin:0 0 8px;color:#9ca3af;letter-spacing:.14em;text-transform:uppercase;font-size:12px;">Alta de cuenta</p>
    <h2 style="margin:0 0 16px;font-size:32px;line-height:1.1;color:#ffffff;">Confirma tu cuenta</h2>
    <p style="margin:0 0 16px;color:#d1d5db;line-height:1.6;">Recibimos tu registro en operando.app. Para activar tu acceso, confirma tu correo desde el siguiente botón.</p>
    <p style="margin:24px 0;">
      <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#ff3b30;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:12px;font-weight:700;">Confirmar cuenta</a>
    </p>
    <p style="margin:0;color:#9ca3af;line-height:1.6;">Si no pediste esta cuenta, puedes ignorar este correo.</p>
  </div>
</div>
```

## Magic link / sign in

### Subject

```text
Acceso a operando.app
```

### Body

```html
<div style="font-family:Arial,sans-serif;background:#0b0b0b;padding:32px;color:#f3f4f6;">
  <div style="max-width:560px;margin:0 auto;background:#111111;border:1px solid #222;border-radius:18px;padding:32px;">
    <img src="https://operando.app/operando-logo.png" alt="operando.app" style="width:72px;height:auto;border-radius:8px;display:block;margin-bottom:18px;">
    <p style="margin:0 0 8px;color:#9ca3af;letter-spacing:.14em;text-transform:uppercase;font-size:12px;">Ingreso seguro</p>
    <h2 style="margin:0 0 16px;font-size:32px;line-height:1.1;color:#ffffff;">Tu enlace de acceso</h2>
    <p style="margin:0 0 16px;color:#d1d5db;line-height:1.6;">Haz clic en el botón para entrar a tu cuenta. Este enlace vence en poco tiempo y solo puede usarse una vez.</p>
    <p style="margin:24px 0;">
      <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#ff3b30;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:12px;font-weight:700;">Entrar ahora</a>
    </p>
    <p style="margin:0;color:#9ca3af;line-height:1.6;">Si no pediste este acceso, puedes ignorar este correo.</p>
  </div>
</div>
```

## Reset password

### Subject

```text
Recupera tu clave de operando.app
```

### Body

```html
<div style="font-family:Arial,sans-serif;background:#0b0b0b;padding:32px;color:#f3f4f6;">
  <div style="max-width:560px;margin:0 auto;background:#111111;border:1px solid #222;border-radius:18px;padding:32px;">
    <img src="https://operando.app/operando-logo.png" alt="operando.app" style="width:72px;height:auto;border-radius:8px;display:block;margin-bottom:18px;">
    <p style="margin:0 0 8px;color:#9ca3af;letter-spacing:.14em;text-transform:uppercase;font-size:12px;">Recuperacion de acceso</p>
    <h2 style="margin:0 0 16px;font-size:32px;line-height:1.1;color:#ffffff;">Cambia tu clave</h2>
    <p style="margin:0 0 16px;color:#d1d5db;line-height:1.6;">Recibimos una solicitud para recuperar tu acceso a operando.app. Usa el siguiente botón para definir una clave nueva.</p>
    <p style="margin:24px 0;">
      <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#ff3b30;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:12px;font-weight:700;">Cambiar clave</a>
    </p>
    <p style="margin:0;color:#9ca3af;line-height:1.6;">Si no pediste este cambio, puedes ignorar este correo.</p>
  </div>
</div>
```

## Password changed notification

### Subject

```text
Tu clave de operando.app fue actualizada
```

### Body

```html
<div style="font-family:Arial,sans-serif;background:#0b0b0b;padding:32px;color:#f3f4f6;">
  <div style="max-width:560px;margin:0 auto;background:#111111;border:1px solid #222;border-radius:18px;padding:32px;">
    <img src="https://operando.app/operando-logo.png" alt="operando.app" style="width:72px;height:auto;border-radius:8px;display:block;margin-bottom:18px;">
    <p style="margin:0 0 8px;color:#9ca3af;letter-spacing:.14em;text-transform:uppercase;font-size:12px;">Seguridad</p>
    <h2 style="margin:0 0 16px;font-size:32px;line-height:1.1;color:#ffffff;">Clave actualizada</h2>
    <p style="margin:0;color:#d1d5db;line-height:1.6;">Te avisamos que la clave de tu cuenta en operando.app fue cambiada correctamente. Si no reconoces este cambio, contáctanos de inmediato.</p>
  </div>
</div>
```

## Extra para bajar el spam

- En Resend, mantener `DKIM` y `SPF` verificados.
- Dejar el contenido simple, sin emojis ni demasiadas imagenes.
- No mezclar mails operativos con mensajes de marketing.
- Si sigue cayendo en spam, el siguiente paso es mejorar `DMARC` y sumar reputacion de envio con uso real.
