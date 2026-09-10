(() => {
  const host = document.getElementById('op-index-chrome-host')
  const template = document.getElementById('op-index-chrome-template')
  if (!host || !template || host.shadowRoot) return
  host.attachShadow({ mode: 'open' }).innerHTML = template.innerHTML
})()
