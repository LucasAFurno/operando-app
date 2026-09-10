(() => {
  const host = document.getElementById('op-index-chrome-host')
  const template = document.getElementById('op-index-chrome-template')
  if (host && template && !host.shadowRoot) host.attachShadow({ mode: 'open' }).innerHTML = template.innerHTML

  const supportBand = document.querySelector('.support-band')
  if (!supportBand || supportBand.querySelector('.support-live-phone')) return

  supportBand.classList.add('has-live-chat')
  const phone = document.createElement('aside')
  phone.className = 'support-live-phone'
  phone.setAttribute('aria-label', 'Conversación de soporte en vivo por WhatsApp')
  phone.innerHTML = '<div class="support-live-header"><img src="/operando-logo.png" alt=""/><div><strong>operando.app</strong><small><i></i>en línea</small></div></div><div class="support-live-chat" aria-live="polite"></div>'
  supportBand.append(phone)

  const chat = phone.querySelector('.support-live-chat')
  const conversation = [
    ['client', 'Hola, ¿me ayudan? Tengo una venta que necesito revisar.', '10:24'],
    ['support', '¡Hola, Lucas! Sí, ya estamos con vos. ¿La cobraste desde Caja?', '10:25'],
    ['client', 'Sí, fue con tarjeta y no la veo en el historial.', '10:25'],
    ['support', 'Perfecto. Revisamos tu operación y te indicamos el paso exacto.', '10:26'],
    ['support', 'Listo: entrá en Ventas > Hoy. Ya quedó registrada correctamente.', '10:27'],
    ['client', '¡Ahí apareció! Gracias 🙌', '10:27'],
    ['support', '¡Genial! Si necesitás algo más, escribinos cuando quieras.', '10:28']
  ]
  let started = false
  const typeMessage = (index) => {
    if (index >= conversation.length) return
    const [author, text, time] = conversation[index]
    const bubble = document.createElement('p')
    bubble.className = 'support-live-message ' + (author === 'client' ? 'is-client' : 'is-support')
    const content = document.createElement('span')
    const stamp = document.createElement('small')
    stamp.textContent = time
    bubble.append(content, stamp)
    chat.append(bubble)
    let character = 0
    const write = () => {
      content.textContent = text.slice(0, character)
      chat.scrollTop = chat.scrollHeight
      character += 1
      if (character <= text.length) window.setTimeout(write, 17)
      else window.setTimeout(() => typeMessage(index + 1), 430)
    }
    write()
  }
  const start = () => {
    if (started) return
    started = true
    window.setTimeout(() => typeMessage(0), 360)
  }
  if ('IntersectionObserver' in window) new IntersectionObserver((entries, observer) => {
    if (entries[0].isIntersecting) { start(); observer.disconnect() }
  }, { threshold: 0.35 }).observe(phone)
  else start()
})()
