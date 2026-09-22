/** Link a wa.me: abre WhatsApp (Web o la app) con un chat y, opcionalmente, un mensaje ya escrito.
 *  No envía nada solo: la persona revisa el mensaje y aprieta enviar. */
export function whatsappLink(phone: string, message?: string): string {
  const digits = phone.replace(/\D/g, '') // wa.me sólo acepta dígitos, sin '+' ni espacios/guiones
  const base = `https://wa.me/${digits}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}

/** Primer nombre, para saludos ("Juan Pérez" → "Juan"). */
export const firstName = (fullName: string) => fullName.trim().split(/\s+/)[0] ?? fullName
