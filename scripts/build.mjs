import { mkdir, readFile, readdir, rm, writeFile, copyFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const dist = path.join(root, 'dist')
const serverDir = path.join(dist, 'server')
const buildTarget = (process.argv[2] || process.env.OPERANDO_ENV || 'prod').toLowerCase()
const isDevBuild = buildTarget === 'dev'
const selectedCloudConfigFile = isDevBuild ? 'cloud-config.dev.json' : 'cloud-config.prod.json'
const siteOrigin = 'https://operando.app'
const panelPath = '/panel/'
const legacyAppPath = '/app/'
const loginPath = '/ingresar/'
const signupPath = '/crear-cuenta/'
const recoveryPath = '/recuperar-clave/'
const resetPasswordPath = '/restablecer-clave/'
const supportUrl = 'https://wa.me/5491135708345?text=Hola%20operando.app%2C%20quiero%20informacion%20de%20operando.app.'
const gtmContainerId = String(process.env.OPERANDO_GTM_ID || '').trim()
const gtmHeadSnippet = gtmContainerId ? `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${JSON.stringify(gtmContainerId)});</script>` : ''
const gtmBodySnippet = gtmContainerId ? `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(gtmContainerId)}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>` : ''

const clientJs = await readFile(path.join(root, 'site', 'client.js'), 'utf8')
const dataStoreJs = await readFile(path.join(root, 'site', 'data-store.js'), 'utf8')
const cloudSyncJs = await readFile(path.join(root, 'site', 'cloud-sync.js'), 'utf8')
const cloudAuthJs = await readFile(path.join(root, 'site', 'cloud-auth.js'), 'utf8')
const cloudCoreJs = await readFile(path.join(root, 'site', 'cloud-core.js'), 'utf8')
const stylesCss = await readFile(path.join(root, 'site', 'styles.css'), 'utf8')
const cloudConfigJson = await readFile(path.join(root, 'site', selectedCloudConfigFile), 'utf8')
const marketingMetrics = JSON.parse(await readFile(path.join(root, 'site', 'marketing-metrics.json'), 'utf8'))
const assetVersion = createHash('sha256').update(`${clientJs}${dataStoreJs}${cloudSyncJs}${cloudAuthJs}${cloudCoreJs}${stylesCss}${cloudConfigJson}`).digest('hex').slice(0, 12)
const releaseRevision = String(process.env.GITHUB_SHA || process.env.OPERANDO_RELEASE_VERSION || assetVersion).trim().slice(0, 12)
const releaseVersion = `v${releaseRevision}`
const builtClientJs = clientJs
  .replaceAll('__OPERANDO_RELEASE_VERSION__', releaseVersion)
  .replaceAll('__OPERANDO_ASSET_VERSION__', assetVersion)
const builtDataStoreJs = dataStoreJs.replaceAll('__OPERANDO_ASSET_VERSION__', assetVersion)
const faviconSvg = await readFile(path.join(root, 'public', 'favicon.svg'), 'utf8')
const cnameFile = await readFile(path.join(root, 'public', 'CNAME'), 'utf8')

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;')

const pageUrl = (slug = '') => slug ? `${siteOrigin}/${slug}/` : `${siteOrigin}/`

const buildBreadcrumbJsonLd = (page) => {
  if (!page.slug) return null
  const segments = page.slug.split('/').filter(Boolean)
  const items = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Inicio',
      item: siteOrigin,
    },
  ]
  let current = ''
  segments.forEach((segment, index) => {
    current = current ? `${current}/${segment}` : segment
    items.push({
      '@type': 'ListItem',
      position: index + 2,
      name: segment.replaceAll('-', ' '),
      item: pageUrl(current),
    })
  })
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  }
}

const buildArticleJsonLd = (page) => {
  if (!page.slug.startsWith('blog/')) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: page.h1,
    description: page.description,
    image: `${siteOrigin}${page.image}`,
    mainEntityOfPage: pageUrl(page.slug),
    publisher: {
      '@type': 'Organization',
      name: 'operando.app',
      logo: {
        '@type': 'ImageObject',
        url: `${siteOrigin}/favicon.svg`,
      },
    },
    author: {
      '@type': 'Organization',
      name: 'operando.app',
    },
    datePublished: '2026-07-21',
    dateModified: '2026-07-21',
  }
}

const topLinks = [
  { href: '/funciones/', label: 'Funciones' },
  { href: '/precios/', label: 'Precios' },
]

const footerLinks = [
  { href: '/sistema-de-ventas/', label: 'Sistema de ventas' },
  { href: '/control-de-stock/', label: 'Control de stock' },
  { href: '/sistema-de-caja/', label: 'Sistema de caja' },
  { href: '/gestion-de-clientes/', label: 'Gestion de clientes' },
  { href: '/software-para-servicio-tecnico/', label: 'Servicio tecnico' },
  { href: '/pos-por-rubro/', label: 'POS por rubro' },
  { href: '/comparar-sistemas-de-gestion/', label: 'Comparar sistemas' },
  { href: '/como-funciona/', label: 'Como funciona' },
  { href: '/blog/', label: 'Blog' },
  { href: '/privacidad/', label: 'Privacidad' },
  { href: '/terminos/', label: 'Terminos' },
]

const marketingCards = [
  {
    title: 'Ventas y cobros',
    body: 'Registra ventas, cobros y comprobantes sin cambiar de sistema.',
    href: '/sistema-de-ventas/',
  },
  {
    title: 'Control de stock',
    body: 'Actualiza inventario, controla faltantes y migra tu catalogo con asistencia.',
    href: '/control-de-stock/',
  },
  {
    title: 'Caja y cierre diario',
    body: 'Abre y cierra caja con movimientos claros y menos errores de control.',
    href: '/sistema-de-caja/',
  },
]

const homeFeatureRows = [
  {
    eyebrow: 'Velocidad en mostrador',
    title: 'Cobrá rápido. Sabé exactamente qué pasó.',
    body: 'Registrá ventas y medios de pago sin salir de la pantalla de venta. Cada operación queda asociada a la caja y al puesto que la realizó.',
    image: '/operando-punto-venta-real.png',
    alt: 'Punto de venta de operando.app',
  },
  {
    eyebrow: 'Stock entre locales',
    title: 'Mové mercadería con trazabilidad',
    body: 'Consultá el stock por sucursal, registrá ajustes y transferencias, y mantené visible el origen y destino de cada movimiento.',
    image: '/operando-stock-real.png',
    alt: 'Catálogo y stock de operando.app',
    reverse: true,
  },
  {
    eyebrow: 'Operación conectada',
    title: 'Compras, caja y sucursales en la misma operación',
    body: 'Registrá recepciones de proveedores, costos y movimientos de caja desde una sola base, disponible desde PC o celular.',
    image: '/operando-panel-real.png',
    alt: 'Panel operativo de operando.app',
  },
]

const sectorPages = [
  { slug: 'kiosco', title: 'Kiosco', summary: 'Ventas de alta rotacion, caja diaria, productos y cuenta corriente sin depender de anotaciones separadas.', focus: 'Atende ventas rapidas, registra cobros, controla productos y revisa la caja del turno desde una misma operacion.' },
  { slug: 'almacen', title: 'Almacen', summary: 'Productos, clientes, cuentas corrientes, compras y reposicion para el comercio de todos los dias.', focus: 'Centraliza ventas, clientes, cobros pendientes y mercaderia para que el movimiento diario no quede repartido en planillas.' },
  { slug: 'farmacia', title: 'Farmacia', summary: 'Catalogo, lector, stock minimo, clientes, cajeros y reportes para ordenar la operacion comercial.', focus: 'Organiza productos, ventas, caja y usuarios con trazabilidad operativa. La gestion por lote o vencimiento requiere una validacion adicional.' },
  { slug: 'ferreteria', title: 'Ferreteria', summary: 'Catalogo amplio, importacion CSV, lectores, stock, clientes y proveedores para el mostrador.', focus: 'Carga productos, usa codigos de barras y mantiene compras, ventas y existencias relacionadas desde una misma base.' },
  { slug: 'indumentaria', title: 'Indumentaria', summary: 'Productos, precios, stock, clientes, compras y reportes para ordenar un local de ropa.', focus: 'Mantene el catalogo, las ventas y la reposicion en orden. Las variantes de talle y color requieren una validacion adicional antes de ofrecerlas.' },
  { slug: 'panaderia', title: 'Panaderia', summary: 'Ventas, caja, productos, compras y control de existencias para el ritmo diario del mostrador.', focus: 'Registra ventas, cobros y movimientos de caja mientras seguis productos, precios y recepciones de mercaderia.' },
  { slug: 'carniceria', title: 'Carniceria', summary: 'Ventas de mostrador, stock, caja, clientes y compras en una operacion comercial trazable.', focus: 'Controla productos, cobros y stock por sucursal. La integracion con balanzas debe validarse antes de contratarla.' },
  { slug: 'verduleria', title: 'Verduleria', summary: 'Productos, ventas, caja, clientes y proveedores para mantener visible la operacion cotidiana.', focus: 'Registra ventas y compras, revisa existencias y conserva un historial de caja sin separar la informacion del comercio.' },
  { slug: 'electronica', title: 'Electronica', summary: 'Stock de equipos y accesorios, ventas, clientes, repuestos y tickets de servicio tecnico.', focus: 'Relaciona el mostrador con la postventa: ventas, stock, clientes y tickets para equipos o reparaciones.' },
  { slug: 'pet-shop', title: 'Pet Shop', summary: 'Productos, clientes, stock, proveedores y ventas para alimentos, accesorios y servicios.', focus: 'Ordena el catalogo, las compras y el historial comercial de clientes desde una misma operacion.' },
  { slug: 'zapateria', title: 'Zapateria', summary: 'Catalogo, ventas, clientes, stock y reportes para el comercio de calzado.', focus: 'Controla productos, cobros y reposicion con trazabilidad. Las variantes por talle y color requieren una validacion adicional.' },
  { slug: 'libreria', title: 'Libreria', summary: 'Catalogo amplio, lectores, importacion CSV, stock y caja para fechas de alta demanda.', focus: 'Carga productos en forma asistida, agiliza ventas con lector y consulta stock y movimientos cuando cambia la temporada.' },
  { slug: 'gimnasio', title: 'Gimnasio', summary: 'Clientes, cobros, productos, caja y reportes para la operacion comercial del gimnasio.', focus: 'Registra pagos, ventas de productos y movimientos de caja. La gestion especifica de membresias requiere una validacion adicional.' },
  { slug: 'veterinaria', title: 'Veterinaria', summary: 'Productos, clientes, stock, compras y ventas para ordenar la gestion comercial del local.', focus: 'Centraliza el catalogo, proveedores, cobros y clientes. La historia clinica veterinaria no forma parte del alcance comercial actual.' },
  { slug: 'peluqueria', title: 'Peluqueria', summary: 'Servicios, productos, clientes, cobros y caja para ordenar la actividad diaria.', focus: 'Registra productos o servicios como items de venta y conserva cobros, clientes y movimientos de caja relacionados.' },
  { slug: 'bar-cerveceria', title: 'Bar y cerveceria', summary: 'Productos, ventas, caja, compras y stock para el control comercial del local.', focus: 'Controla ventas y medios de pago, stock de bebidas y movimientos de caja. La gestion de mesas requiere una validacion adicional.' },
  { slug: 'heladeria', title: 'Heladeria', summary: 'Productos, ventas, caja, stock y compras para seguir la operacion del local.', focus: 'Centraliza el catalogo, los cobros y los movimientos de mercaderia. La gestion de sabores o balanzas requiere una validacion adicional.' },
]

const marketingSectors = sectorPages.map((sector) => ({
  title: sector.title,
  body: sector.summary,
  href: `/pos-por-rubro/${sector.slug}/`,
}))

const sectorLandingPages = sectorPages.map((sector) => ({
  slug: `pos-por-rubro/${sector.slug}`,
  seoTitle: `Sistema POS para ${sector.title} | Operando`,
  description: `Sistema de gestion para ${sector.title.toLowerCase()} con ventas, caja, stock, clientes y compras en operando.app.`,
  kicker: 'POS por rubro',
  h1: `Sistema POS para ${sector.title}: ventas, caja y stock en una sola operacion`,
  lead: sector.focus,
  image: '/operando-panel-real.png',
  imageAlt: `Gestion comercial para ${sector.title} con operando.app`,
  whatsAppPrompt: `Hola operando.app, quiero conocer el sistema para mi ${sector.title.toLowerCase()}.`,
  sections: [
    { title: 'Ventas y cobros', body: 'Registra operaciones, descuentos, clientes y medios de pago con una caja asignada cuando corresponde.' },
    { title: 'Productos y stock', body: 'Mantene catalogo, precios, costos, codigo de barras, stock minimo, compras y movimientos por sucursal.' },
    { title: 'Control del negocio', body: 'Consulta ventas, caja, clientes, proveedores y reportes con permisos y trazabilidad por usuario.' },
  ],
  faq: [[`¿operando.app se adapta a un ${sector.title.toLowerCase()}?`, `operando.app cubre la operacion comercial de ventas, caja, stock, clientes y compras. Consulta con el equipo si necesitas una integracion especifica de este rubro.`]],
  featureList: ['Ventas', 'Caja', 'Stock', 'Clientes', 'Compras'],
}))

const blogGuides = [
  {
    title: 'Como controlar el stock de tu negocio',
    body: 'Una guia practica para ordenar productos, registrar movimientos y detectar faltantes a tiempo.',
    href: '/blog/como-controlar-stock/',
  },
  {
    title: 'Como hacer un cierre de caja correcto',
    body: 'Los pasos para comparar lo esperado, lo contado y las diferencias de una jornada.',
    href: '/blog/cierre-de-caja-correcto/',
  },
  {
    title: 'Como importar productos desde Excel',
    body: 'Que revisar antes de migrar una planilla para evitar duplicados, precios incorrectos o stock incompleto.',
    href: '/blog/importar-productos-desde-excel/',
  },
]

const comparisonPages = [
  {
    slug: 'operando-vs-dux-software',
    seoTitle: 'Operando vs Dux Software | Comparacion para comercios',
    description: 'Compara operando.app y Dux Software para elegir un sistema de gestion segun ventas, stock, sucursales, tickets y canales de venta.',
    kicker: 'Comparacion',
    h1: 'operando.app vs Dux Software: que sistema se adapta mejor a tu operacion',
    lead: 'Los dos cubren ventas, stock y sucursales. La diferencia esta en si tu prioridad es la operacion comercial con tickets o una plataforma ERP con e-commerce e integraciones.',
    image: '/operando-panel-real.png',
    imageAlt: 'Panel de gestion comercial de operando.app',
    whatsAppPrompt: 'Hola operando.app, quiero comparar operando.app con Dux Software.',
    comparison: { alternative: 'Dux Software', rows: [
      ['Ventas, caja y stock', 'Gestion comercial y POS', 'Ventas, caja, stock y trazabilidad por sucursal'],
      ['Tickets de servicio tecnico', 'No se presenta como flujo central', 'Recepcion, estados, cliente, equipo y vinculo con ventas'],
      ['E-commerce e integraciones', 'Integra marketplaces, tiendas online y API', 'No se ofrece como integracion publica'],
      ['Contabilidad y tesoreria', 'Incluye funciones de ERP, contabilidad y tesoreria', 'Foco en la operacion comercial diaria'],
      ['Facturacion ARCA', 'La publica como integrada', 'Integracion fiscal en proceso de validacion operativa'],
    ] },
    sections: [
      { title: 'Cuando Dux puede convenir mas', body: 'Si tu operacion depende de Mercado Libre, Tienda Nube, picking, contabilidad o tesoreria integrada, Dux presenta hoy una cobertura mas amplia.' },
      { title: 'Cuando operando.app puede convenir mas', body: 'Si necesitas unir ventas, caja, stock, clientes y tickets de servicio tecnico en una misma operacion, sin sumar una capa ERP orientada a e-commerce.' },
    ],
    featureList: ['Ventas', 'Stock', 'Sucursales', 'Tickets', 'Roles'],
  },
  {
    slug: 'operando-vs-alegra',
    seoTitle: 'Operando vs Alegra | Comparacion para comercios',
    description: 'Compara operando.app y Alegra para evaluar ventas, stock, caja, usuarios, tickets y necesidades administrativas.',
    kicker: 'Comparacion',
    h1: 'operando.app vs Alegra: operacion comercial o gestion administrativa',
    lead: 'Alegra concentra facturacion y administracion. operando.app se orienta a la operacion diaria de comercios y suma tickets para trabajos o servicios.',
    image: '/operando-punto-venta-real.png',
    imageAlt: 'Punto de venta de operando.app',
    whatsAppPrompt: 'Hola operando.app, quiero comparar operando.app con Alegra.',
    comparison: { alternative: 'Alegra', rows: [
      ['Ventas, caja y stock', 'POS, inventario, terminales y reportes', 'Ventas, caja, stock y reportes por caja o sucursal'],
      ['Tickets de servicio tecnico', 'No se presenta como flujo central', 'Recepcion, seguimiento y estados de equipos o servicios'],
      ['Contabilidad e impuestos', 'Incluye una propuesta administrativa y fiscal amplia', 'No se ofrece como sistema contable'],
      ['Balanzas', 'Publica integracion con balanzas', 'No se ofrece como integracion publica'],
      ['Facturacion ARCA', 'La publica como disponible para Argentina', 'Integracion fiscal en proceso de validacion operativa'],
    ] },
    sections: [
      { title: 'Cuando Alegra puede convenir mas', body: 'Si la necesidad principal es facturacion electronica, contabilidad, impuestos o balanzas, Alegra tiene esas capacidades publicadas.' },
      { title: 'Cuando operando.app puede convenir mas', body: 'Si el comercio necesita un flujo operativo con caja, stock, cuentas, sucursales, permisos y tickets de servicio tecnico relacionados con clientes y ventas.' },
    ],
    featureList: ['Ventas', 'Caja', 'Stock', 'Tickets', 'Auditoria'],
  },
  {
    slug: 'operando-vs-treinta',
    seoTitle: 'Operando vs Treinta | Comparacion para comercios',
    description: 'Compara operando.app y Treinta para evaluar operaciones de mostrador, stock, clientes, sucursales y control por roles.',
    kicker: 'Comparacion',
    h1: 'operando.app vs Treinta: control operativo para comercios en crecimiento',
    lead: 'Treinta se posiciona como una app simple para celular. operando.app cubre una operacion de comercio con cajas, sucursales, permisos y seguimiento auditable.',
    image: '/operando-mobile-devices.png',
    imageAlt: 'operando.app en dispositivos de trabajo',
    whatsAppPrompt: 'Hola operando.app, quiero comparar operando.app con Treinta.',
    comparison: { alternative: 'Treinta', rows: [
      ['Acceso principal', 'App movil y web segun plan', 'Web y variante de escritorio Electron'],
      ['Ventas y stock', 'Ventas, gastos e inventario', 'Ventas, compras, stock, ajustes y transferencias'],
      ['Estructura del comercio', 'Clientes y proveedores publicados', 'Sucursales, cajas, usuarios, roles y modulos por cuenta'],
      ['Tickets de servicio tecnico', 'No se presenta como flujo central', 'Recepcion y seguimiento de trabajos vinculados al cliente'],
      ['Facturacion ARCA', 'La publica para su plan web', 'Integracion fiscal en proceso de validacion operativa'],
    ] },
    sections: [
      { title: 'Cuando Treinta puede convenir mas', body: 'Si buscas una operacion muy centrada en celular y un catalogo simple para un negocio pequeno, Treinta esta enfocado en ese uso.' },
      { title: 'Cuando operando.app puede convenir mas', body: 'Si necesitas separar responsabilidades por caja, sucursal y usuario, controlar compras y proveedores, o trabajar con tickets de servicio tecnico.' },
    ],
    featureList: ['Sucursales', 'Cajas', 'Usuarios', 'Compras', 'Tickets'],
  },
  {
    slug: 'operando-vs-contabilium',
    seoTitle: 'Operando vs Contabilium | Comparacion para comercios',
    description: 'Compara operando.app y Contabilium para elegir entre operacion comercial con tickets y un ERP con contabilidad e integraciones de e-commerce.',
    kicker: 'Comparacion',
    h1: 'operando.app vs Contabilium: operacion de comercio o ERP administrativo',
    lead: 'Contabilium ofrece una cobertura ERP amplia. operando.app se enfoca en los flujos cotidianos de ventas, caja, stock, sucursales y tickets.',
    image: '/control-stock-por-sucursal.svg',
    imageAlt: 'Control de stock por sucursal en operando.app',
    whatsAppPrompt: 'Hola operando.app, quiero comparar operando.app con Contabilium.',
    comparison: { alternative: 'Contabilium', rows: [
      ['Ventas, stock y cajas', 'ERP con punto de venta, multideposito y cajas', 'Operacion de ventas, caja y stock separada por sucursal'],
      ['Contabilidad e impuestos', 'Incluye contabilidad, libros, balances e impuestos', 'No se ofrece como sistema contable'],
      ['E-commerce y marketplaces', 'Integra Mercado Libre, Tienda Nube, Shopify y otros', 'No se ofrece como integracion publica'],
      ['Tickets de servicio tecnico', 'No se presenta como flujo central', 'Recepcion, estados, historial y venta asociada'],
      ['Facturacion ARCA', 'La publica como disponible', 'Integracion fiscal en proceso de validacion operativa'],
    ] },
    sections: [
      { title: 'Cuando Contabilium puede convenir mas', body: 'Si tu operacion necesita contabilidad, impuestos, multi CUIT, e-commerce o marketplaces integrados, Contabilium publica una propuesta mas completa.' },
      { title: 'Cuando operando.app puede convenir mas', body: 'Si el centro del negocio es el mostrador, la caja, el stock por sucursal y el seguimiento de servicios o reparaciones, sin requerir un ERP contable.' },
    ],
    featureList: ['Ventas', 'Caja', 'Stock', 'Sucursales', 'Tickets'],
  },
  {
    slug: 'operando-vs-gestion-comercio',
    seoTitle: 'Operando vs Gestion Comercio | Comparacion para comercios',
    description: 'Compara operando.app y Gestion Comercio para evaluar punto de venta, stock, sucursales, balanzas, escritorio y tickets de servicio.',
    kicker: 'Comparacion',
    h1: 'operando.app vs Gestion Comercio: gestion comercial segun tu forma de operar',
    lead: 'Los dos abordan ventas, stock y sucursales. La eleccion depende de si necesitas balanzas y una instalacion local tradicional, o una operacion web con tickets de servicio.',
    image: '/cierre-caja-comercio.svg',
    imageAlt: 'Control de caja de operando.app',
    whatsAppPrompt: 'Hola operando.app, quiero comparar operando.app con Gestion Comercio.',
    comparison: { alternative: 'Gestion Comercio', rows: [
      ['Punto de venta y stock', 'POS, stock por local y transferencias', 'Ventas, caja, stock, ajustes y transferencias por sucursal'],
      ['Balanzas y perifericos', 'Publica integracion con balanzas y QR Mercado Pago', 'No se ofrece como integracion publica'],
      ['Acceso', 'Sistema instalado en PC y app movil de gestion', 'Web y variante de escritorio Electron'],
      ['Tickets de servicio tecnico', 'No se presenta como flujo central', 'Recepcion y seguimiento de equipos o servicios'],
      ['Operacion sin conexion', 'Declara respaldo local y sincronizacion al reconectar', 'La web requiere cloud; Electron conserva datos locales'],
    ] },
    sections: [
      { title: 'Cuando Gestion Comercio puede convenir mas', body: 'Si necesitas integracion con balanzas, QR Mercado Pago o una operacion local ya establecida para mostrador, esas capacidades estan publicadas por Gestion Comercio.' },
      { title: 'Cuando operando.app puede convenir mas', body: 'Si buscas una operacion web con accesos por rol, trazabilidad, sucursales y tickets de servicio tecnico junto con ventas, caja y stock.' },
    ],
    featureList: ['Web', 'Escritorio', 'Sucursales', 'Auditoria', 'Tickets'],
  },
]

const glossaryTerms = [
  {
    slug: 'sistema-pos', title: 'Sistema POS',
    description: 'Que es un sistema POS y como ayuda a organizar ventas, cobros, productos y caja en un comercio.',
    lead: 'Un sistema POS, o punto de venta, registra la venta y conecta el cobro con los productos, el cliente y la caja.',
    sections: [
      { title: 'Que registra un POS', body: 'Productos, cantidades, precios, descuentos, medio de pago y, cuando hace falta, los datos del cliente o comprobante.' },
      { title: 'Por que reemplaza al cuaderno', body: 'La misma operacion deja un historial de venta y evita volver a cargar los datos para controlar caja o stock.' },
      { title: 'Como lo aplica operando.app', body: 'operando.app combina carrito multiitem, medios de pago, cliente, descuentos, comprobantes y trazabilidad por operacion.' },
    ],
    faq: [['¿Un POS sirve solo para cobrar?', 'No. Tambien permite relacionar la venta con productos, caja, cliente y comprobantes para poder controlar la operacion.']],
  },
  {
    slug: 'control-de-stock', title: 'Control de stock',
    description: 'Que es el control de stock y como registrar existencias, movimientos, ajustes y faltantes en un comercio.',
    lead: 'El control de stock permite saber que productos hay, que se vendio, que ingreso y que conviene reponer.',
    sections: [
      { title: 'Movimientos que cambian el stock', body: 'Una venta descuenta unidades; una compra o recepcion las incorpora; un ajuste corrige una diferencia registrada.' },
      { title: 'Por que importa la trazabilidad', body: 'Cuando aparece una diferencia, hace falta conocer si vino de una venta, compra, transferencia o ajuste y quien lo registro.' },
      { title: 'Como lo aplica operando.app', body: 'El catalogo incluye SKU, codigo de barras, costo, stock minimo, importacion CSV, ajustes y transferencias entre sucursales.' },
    ],
    faq: [['¿Se puede corregir una diferencia de stock?', 'Si, mediante un ajuste registrado. El ajuste debe conservar el motivo y no puede dejar existencias negativas.']],
  },
  {
    slug: 'stock-minimo', title: 'Stock minimo',
    description: 'Que es el stock minimo y como usarlo para detectar productos que necesitan reposicion en un comercio.',
    lead: 'El stock minimo es el nivel de existencias a partir del cual un producto requiere revision o reposicion.',
    sections: [
      { title: 'Para que sirve', body: 'Ayuda a priorizar compras antes de que un producto se agote y a ordenar la reposicion del comercio.' },
      { title: 'Como definirlo', body: 'Considera la rotacion, el plazo del proveedor y el margen que necesitas para no quedarte sin mercaderia.' },
      { title: 'Como lo aplica operando.app', body: 'Cada producto puede conservar su nivel minimo junto con precio, costo, SKU y existencias por sucursal.' },
    ],
    faq: [['¿El stock minimo reemplaza el inventario fisico?', 'No. Es una alerta operativa; el conteo fisico sigue siendo necesario para detectar diferencias reales.']],
  },
  {
    slug: 'cierre-de-caja', title: 'Cierre de caja',
    description: 'Que es el cierre de caja y como controlar efectivo esperado, efectivo contado y diferencias al terminar un turno.',
    lead: 'El cierre de caja compara los movimientos registrados con el dinero contado y deja una diferencia explicita si no coinciden.',
    sections: [
      { title: 'Que incluye un cierre', body: 'Monto inicial, ventas y movimientos de efectivo, monto esperado, efectivo contado y diferencia final.' },
      { title: 'Por que no conviene cerrar de memoria', body: 'Separar ventas, retiros, gastos y cobros evita que una diferencia quede oculta dentro de un total general.' },
      { title: 'Como lo aplica operando.app', body: 'Cada cierre queda asociado a caja, sucursal y responsable, con los movimientos manuales incluidos en el esperado.' },
    ],
    faq: [['¿Que pasa si hay una diferencia?', 'Debe quedar registrada para poder revisarla con el responsable y los movimientos del turno.']],
  },
  {
    slug: 'arqueo-de-caja', title: 'Arqueo de caja',
    description: 'Que es un arqueo de caja y que revisar para controlar el efectivo y los medios de pago de un turno.',
    lead: 'El arqueo de caja es la verificacion del dinero y los medios de cobro contra las operaciones registradas.',
    sections: [
      { title: 'Arqueo y cierre no son lo mismo', body: 'El arqueo verifica lo que hay; el cierre registra el resultado del turno y deja trazabilidad de la diferencia.' },
      { title: 'Que revisar', body: 'Efectivo, transferencias, Mercado Pago, e-cheques, cuenta corriente y cualquier retiro o ingreso manual.' },
      { title: 'Como lo aplica operando.app', body: 'La venta admite medios de pago separados y la caja conserva movimientos, efectivo esperado, contado y diferencia.' },
    ],
    faq: [['¿Cada cajero necesita su propia caja?', 'Depende de la operacion. Separar caja y responsable ayuda a atribuir correctamente los movimientos y las diferencias.']],
  },
  {
    slug: 'cuenta-corriente', title: 'Cuenta corriente de clientes',
    description: 'Que es una cuenta corriente de clientes y como registrar saldos, pagos y ventas pendientes en un comercio.',
    lead: 'Una cuenta corriente registra lo que un cliente debe, los pagos recibidos y el historial de operaciones pendientes.',
    sections: [
      { title: 'Que evita', body: 'Evita anotar deudas en mensajes o cuadernos separados de la venta original y perder el detalle de cada saldo.' },
      { title: 'Como se mantiene actualizada', body: 'Cada venta a cuenta incrementa el saldo; cada abono documentado lo reduce sin superar el importe pendiente.' },
      { title: 'Como lo aplica operando.app', body: 'Clientes, ventas, comprobantes y abonos se relacionan para consultar saldo e historial comercial desde la misma base.' },
    ],
    faq: [['¿Una cuenta corriente es solo para clientes frecuentes?', 'Puede usarse con cualquier cliente al que se le otorgue pago pendiente, siempre con condiciones y seguimiento claros.']],
  },
  {
    slug: 'transferencia-de-stock', title: 'Transferencia de stock',
    description: 'Que es una transferencia de stock entre sucursales y como mantener trazabilidad de origen, destino y cantidad.',
    lead: 'Una transferencia de stock mueve unidades de una sucursal a otra sin perder el registro del origen y el destino.',
    sections: [
      { title: 'Que debe validar', body: 'La sucursal de origen y destino deben ser diferentes y el origen necesita existencias suficientes antes de mover unidades.' },
      { title: 'Por que no conviene editar cantidades a mano', body: 'Un cambio manual no explica desde que local salio la mercaderia ni permite conciliar el movimiento entre ambos inventarios.' },
      { title: 'Como lo aplica operando.app', body: 'La transferencia descuenta el origen, suma el destino y deja el movimiento asociado al producto y a las sucursales.' },
    ],
    faq: [['¿Una transferencia cambia el total de mercaderia?', 'No. Cambia la ubicacion de las unidades entre sucursales, no la existencia total del comercio.']],
  },
  {
    slug: 'lector-de-codigo-de-barras', title: 'Lector de codigo de barras',
    description: 'Como funciona un lector de codigo de barras en un punto de venta y que datos debe tener cargado cada producto.',
    lead: 'Un lector de codigo de barras acelera la busqueda de productos al ingresar su codigo en la venta.',
    sections: [
      { title: 'Que necesita el catalogo', body: 'Cada producto debe tener un codigo asociado, ademas de nombre, precio y existencias para que la busqueda sea confiable.' },
      { title: 'Que problema resuelve', body: 'Reduce errores al tipear y acelera la atencion cuando hay muchos productos parecidos o alta rotacion.' },
      { title: 'Como lo aplica operando.app', body: 'El catalogo admite codigo de barras y la venta permite agregar productos mediante lector o busqueda manual.' },
    ],
    faq: [['¿Se puede vender si un producto no tiene codigo?', 'Si. El producto tambien puede buscarse manualmente desde el catalogo.']],
  },
  {
    slug: 'ticket-de-servicio-tecnico', title: 'Ticket de servicio tecnico',
    description: 'Que es un ticket de servicio tecnico y como registrar la recepcion, estado y entrega de equipos de clientes.',
    lead: 'Un ticket de servicio tecnico documenta la recepcion de un equipo o trabajo, su estado y la relacion con el cliente.',
    sections: [
      { title: 'Que informacion conviene registrar', body: 'Cliente, sucursal, equipo, detalle del problema, estado del trabajo y observaciones para evitar confusiones al entregar.' },
      { title: 'Por que debe estar vinculado a ventas', body: 'Repuestos, mano de obra y cobros no deberian quedar aislados del trabajo que los origino.' },
      { title: 'Como lo aplica operando.app', body: 'Los tickets conservan recepcion y seguimiento de equipos o servicios y pueden originarse desde una venta.' },
    ],
    faq: [['¿Sirve para servicios sin equipo fisico?', 'Si. El ticket puede registrar un servicio, siempre que conserve cliente, detalle y estado de seguimiento.']],
  },
]

const glossaryPages = glossaryTerms.map((term) => ({
  slug: `glosario-pos/${term.slug}`,
  seoTitle: `${term.title} | Glosario Operando`,
  description: term.description,
  kicker: 'Glosario operando.app',
  h1: `${term.title}: que es y como se aplica en un comercio`,
  lead: term.lead,
  image: '/operando-panel-real.png',
  imageAlt: `Gestion comercial en operando.app: ${term.title}`,
  whatsAppPrompt: `Hola operando.app, quiero ayuda con ${term.title.toLowerCase()}.`,
  sections: term.sections,
  faq: term.faq,
  featureList: ['Guia practica', 'Operacion comercial', 'operando.app'],
}))

const comparisonRows = [
  ['Ventas y caja', 'Planillas separadas o cuaderno', 'Todo en una sola web'],
  ['Stock', 'Actualizacion manual', 'Actualizacion por venta, compra o ajuste'],
  ['Sucursales', 'Difcil consolidar', 'Separacion por local y caja'],
  ['Usuarios', 'Sin permisos reales', 'Roles, modulos y acciones por cuenta'],
  ['Reportes', 'Requieren armar formulas', 'Vistas listas por fecha, caja y sucursal'],
]

const importTemplateDownloads = [{
  href: 'https://wa.me/5491135708345?text=Hola%20operando.app%2C%20necesito%20cargar%20productos%20desde%20una%20planilla.',
  label: 'Solicitar carga asistida',
  body: 'Envia tu planilla a soporte. Revisamos su formato y migramos los productos de forma controlada.',
}]

const controlStories = [
  {
    number: '01',
    eyebrow: 'Multi sucursal',
    title: 'Cada local en foco. Todo el negocio en perspectiva.',
    body: 'Separá la operación por sucursal para consultar stock, cajas y resultados con el contexto correcto. Cuando necesitás mirar el conjunto, seguís trabajando sobre la misma base.',
    details: ['Stock y movimientos por sucursal', 'Cajas y puestos ligados a cada local'],
    image: '/operando-stock-real.png',
    alt: 'Vista de control de stock por sucursal en operando.app',
    caption: 'La operación se organiza por local, sin perder una visión común.',
  },
  {
    number: '02',
    eyebrow: 'Caja por puesto',
    title: 'Un cobro rápido también puede quedar bien respaldado.',
    body: 'Vinculá cada venta, apertura, cierre, movimiento y diferencia a la caja desde la que se operó. El equipo sigue atendiendo; vos conservás una lectura clara del turno.',
    details: ['Apertura y cierre por caja', 'Movimientos y diferencias por puesto'],
    image: '/operando-panel-real.png',
    alt: 'Resumen de caja y cierre operativo en operando.app',
    caption: 'Cada puesto mantiene su propio recorrido de caja.',
  },
  {
    number: '03',
    eyebrow: 'Trazabilidad',
    title: 'Cuando algo cambia, podés volver a entender por qué.',
    body: 'Ventas, movimientos de caja, ajustes, compras y transferencias conservan un historial operativo. No se trata de vigilar de más: se trata de poder revisar sin reconstruir la historia a mano.',
    details: ['Historial de acciones relevantes', 'Origen y destino en transferencias'],
    image: '/operando-punto-venta-real.png',
    alt: 'Pantalla de ventas de operando.app',
    caption: 'La operación diaria deja contexto para la revisión posterior.',
  },
  {
    number: '04',
    eyebrow: 'Compras y proveedores',
    title: 'Reponer deja de ser una conversación suelta.',
    body: 'Registrá proveedores, recepciones y costos dentro de la misma operación. Así, cuando llega mercadería, el stock recibe el movimiento y la compra conserva su referencia.',
    details: ['Recepciones con costo y proveedor', 'Compras que actualizan el stock'],
    image: '/operando-stock-real.png',
    alt: 'Control de productos y stock en operando.app',
    caption: 'Compras y stock se encuentran en el mismo flujo.',
  },
  {
    number: '05',
    eyebrow: 'Permisos',
    title: 'Cada persona entra para hacer lo que le toca.',
    body: 'Definí roles, módulos habilitados y permisos bloqueados según la responsabilidad de cada usuario. Reducís pantallas innecesarias sin sumar pasos para quien necesita operar.',
    details: ['Roles para caja, depósito y administración', 'Módulos y acciones por usuario'],
    image: '/operando-punto-venta-real.png',
    alt: 'Operación de ventas en operando.app',
    caption: 'La interfaz puede acompañar el rol de quien trabaja.',
  },
  {
    number: '06',
    eyebrow: 'Preparación ARCA',
    title: 'Prepará la conexión fiscal antes de llevarla a producción.',
    body: 'Cargá los datos fiscales, generá la solicitud de certificado y verificá la conexión con ARCA en homologación. La salida fiscal productiva se define con tu comercio antes de operar.',
    details: ['Configuración fiscal guiada', 'Verificación en homologación'],
    image: '/operando-panel-real.png',
    alt: 'Resumen operativo de operando.app',
    caption: 'La preparación fiscal se comunica con el alcance correcto.',
  },
]

const marketingPages = [
  {
    slug: '',
    seoTitle: 'Operando | Sistema de ventas, caja y stock para comercios',
    description: 'Sistema de ventas, caja y stock para comercios argentinos. Gestioná sucursales, productos, compras y equipo desde una sola plataforma. Probalo gratis.',
    kicker: 'Software de gestión para comercios',
    h1: 'Vendé más. Controlá todo. Crecé sin perderte.',
    lead: 'Operando reúne ventas, caja, stock, compras y sucursales en un solo lugar para que tomes decisiones con información real.',
    primaryCta: { href: signupPath, label: 'Probá gratis' },
    secondaryCta: { href: '#como-funciona', label: 'Ver cómo funciona' },
    whatsAppPrompt: 'Hola Operando, quiero probar operando.app en mi comercio.',
    image: '/operando-punto-venta-real.png',
    imageAlt: 'Pantalla de ventas de operando.app en una computadora',
    stats: [
      ['Por sucursal', 'Stock y resultados separados'],
      ['Por puesto', 'Caja ligada a cada cobro'],
      ['Por acción', 'Historial para revisar'],
    ],
    sections: [
      {
        title: 'Una operación, menos cruces',
        body: 'Centralizá clientes, ventas, stock, compras y proveedores para evitar datos repartidos entre planillas, papeles y chats.',
      },
      {
        title: 'Control que acompaña el ritmo',
        body: 'Abrí y cerrá caja por puesto, registrá movimientos y consultá diferencias sin frenar la atención.',
      },
      {
        title: 'Listo para crecer por local y equipo',
        body: 'Sumá sucursales, puestos de cobro y usuarios con roles definidos, conservando una vista ordenada de la operación.',
      },
    ],
    downloads: importTemplateDownloads,
    featureList: ['Ventas', 'Caja', 'Stock', 'Sucursales', 'Compras'],
    faq: [
      ['¿Puedo usar Operando desde el celular?', 'Sí. Operando funciona desde el navegador en PC, tablet o celular, sin instalar un programa.'],
      ['¿Puedo controlar más de una sucursal?', 'Sí. Podés separar stock, cajas y resultados por local y mantener una visión general del negocio.'],
      ['¿Qué puedo gestionar?', 'Ventas, medios de pago, caja, productos, stock, compras, clientes, usuarios y permisos.'],
    ],
  },
  {
    slug: 'funciones',
    seoTitle: 'Funciones del sistema comercial | Operando',
    description: 'Conoce todas las funciones de operando.app: ventas, caja, stock, compras, clientes, tickets, facturacion, sucursales y reportes.',
    kicker: 'Funciones',
    h1: 'Funciones para ganar control operativo sin sumar fricción',
    lead: 'Vendé y cobrá con agilidad, mientras cada caja, sucursal, compra y movimiento queda ordenado para consultarlo cuando lo necesitás.',
    image: '/operando-punto-venta-real.png',
    imageAlt: 'Pantalla de ventas y cobros de operando.app',
    whatsAppPrompt: 'Hola Operando, quiero ver todas las funciones de operando.app.',
    sections: [
      { title: 'Ventas y caja por puesto', body: 'Venta multi ítem y medios de pago, con apertura, cierre, diferencias y movimientos ligados a la caja que opera cada puesto.' },
      { title: 'Stock y trazabilidad', body: 'Catálogo, stock por sucursal, ajustes y transferencias con historial de los movimientos de inventario.' },
      { title: 'Clientes, compras y proveedores', body: 'Base comercial, cuentas corrientes, proveedores, recepción de compras, costos y comprobantes asociados.' },
      { title: 'Usuarios y permisos', body: 'Roles, módulos habilitados y permisos bloqueables para definir qué puede consultar u operar cada persona.' },
      { title: 'Tickets y seguimiento', body: 'Recepcion de equipos, estados de trabajo, historial operativo y control por sucursal.' },
      { title: 'ARCA en preparación', body: 'La configuración fiscal y la verificación con ARCA se realizan en homologación. La salida fiscal en producción se define con tu comercio antes de operar.' },
    ],
    featureList: ['Ventas', 'Caja', 'Stock', 'Clientes', 'Compras', 'Facturacion', 'Tickets', 'Reportes'],
  },
  {
    slug: 'precios',
    seoTitle: 'Acceso gratis durante 2026 | Operando',
    description: 'Operando es gratis durante 2026. Durante 2027 revisaremos planes y precios de forma transparente, con aviso previo.',
    kicker: 'Acceso 2026',
    h1: 'Operando es gratis durante todo 2026',
    lead: 'Usá ventas, caja, stock y el resto de las herramientas sin cargo durante 2026. En 2027 vamos a revisar los planes y precios para acompañar el crecimiento del producto, siempre con comunicación previa y clara.',
    image: '/operando-panel-real.png',
    imageAlt: 'Resumen de caja y cierre operativo de operando.app',
    whatsAppPrompt: 'Hola Operando, quiero conocer las condiciones de acceso gratis durante 2026.',
    sections: [
      { title: 'Qué incluye el acceso gratis', body: 'Accedé a ventas, caja, productos, stock, clientes, compras, proveedores, tickets, sucursales y reportes desde la web.' },
      { title: 'Vigencia', body: 'El acceso sin cargo se mantiene hasta el 31 de diciembre de 2026 para que puedas conocer y usar Operando en tu comercio.' },
      { title: 'Revisión desde 2027', body: 'Durante 2027 revisaremos la estructura de planes y precios según las funcionalidades y el soporte disponible en ese momento.' },
      { title: 'Transparencia antes que nada', body: 'Antes de cualquier cambio de precio o modalidad, lo comunicaremos con anticipación dentro de la plataforma y por los canales de contacto disponibles.' },
    ],
    featureList: ['Gratis durante 2026', 'Sin tarjeta', 'Sin instalación', 'Revisión de planes en 2027'],
  },
  {
    slug: 'sistema-de-ventas',
    seoTitle: 'Sistema de ventas para comercios | Operando',
    description: 'Sistema de ventas para comercios con cobros, tickets, caja y control comercial desde una sola web.',
    kicker: 'Ventas',
    h1: 'Sistema de ventas para comercios que quieren cobrar rapido y trabajar con mas control',
    lead: 'operando.app ayuda a registrar ventas, sugerir canales de cobro, emitir tickets y asociar comprobantes sin moverte de la misma herramienta.',
    image: '/operando-punto-venta-real.png',
    imageAlt: 'Pantalla de ventas y cobros de operando.app',
    whatsAppPrompt: 'Hola Operando, quiero ver el sistema de ventas para mi comercio.',
    sections: [
      { title: 'Venta multi item', body: 'Agrega varios productos, descuentos, observaciones y medios de pago en una sola pantalla.' },
      { title: 'Cobros mixtos', body: 'Efectivo, transferencia, Mercado Pago y cuenta corriente dentro de la misma operacion.' },
      { title: 'Comprobantes listos', body: 'Relaciona la venta con ticket o factura y sigue lo cobrado o pendiente.' },
    ],
    featureList: ['Ventas', 'Cobros', 'Caja', 'Facturas', 'Historial comercial'],
  },
  {
    slug: 'control-de-stock',
    seoTitle: 'Programa para controlar stock | Operando',
    description: 'Programa para controlar stock, productos, sucursales, transferencias y reposicion desde PC o celular.',
    kicker: 'Stock',
    h1: 'Programa para controlar stock y saber que falta antes de quedarte sin vender',
    lead: 'Gestiona catalogo, existencias, stock minimo y movimientos de productos en una sola web para no depender de planillas separadas.',
    image: '/operando-stock-real.png',
    imageAlt: 'Control de stock por sucursal de operando.app',
    whatsAppPrompt: 'Hola Operando, necesito controlar stock y reposicion en mi negocio.',
    sections: [
      { title: 'Catalogo centralizado', body: 'Todos tus productos en una sola base, con precio, costo, codigo, SKU y control por sucursal.' },
      { title: 'Ajustes y transferencias', body: 'Corrige diferencias, mueve mercaderia entre locales y deja trazabilidad del inventario.' },
      { title: 'Migracion asistida', body: 'Si ya tienes una planilla, nuestro equipo revisa su formato y carga tus productos sin improvisar equivalencias.' },
    ],
    downloads: importTemplateDownloads,
    featureList: ['Stock por sucursal', 'Ajustes', 'Transferencias', 'Carga asistida', 'Stock minimo'],
  },
  {
    slug: 'sistema-de-caja',
    seoTitle: 'Sistema de caja para negocios | Operando',
    description: 'Sistema de caja para negocios con apertura, cierre, diferencias, movimientos y control por operador.',
    kicker: 'Caja',
    h1: 'Sistema de caja por puesto para cobrar rápido y cerrar con respaldo',
    lead: 'Abrí y cerrá cada caja, controlá el efectivo esperado y registrá ingresos o egresos. Así mantenés la velocidad de venta y la trazabilidad de la operación.',
    image: '/operando-panel-real.png',
    imageAlt: 'Cierre de caja comercial de operando.app',
    whatsAppPrompt: 'Hola Operando, quiero mejorar la apertura y cierre de caja de mi negocio.',
    sections: [
      { title: 'Apertura y cierre por puesto', body: 'Definí monto inicial, efectivo contado y diferencia final para cada caja o puesto de cobro.' },
      { title: 'Movimientos con responsable', body: 'Registrá ingresos, gastos, retiros, depósitos y ajustes con el detalle de la operación.' },
      { title: 'Resultados por caja y sucursal', body: 'Consultá el movimiento del turno y separá resultados según la caja y el local que correspondan.' },
    ],
    featureList: ['Apertura', 'Cierre', 'Diferencias', 'Cobros', 'Movimientos'],
  },
  {
    slug: 'software-para-kioscos',
    seoTitle: 'Sistema para kioscos | Operando',
    description: 'Sistema para kioscos con ventas, caja, stock, precios y control rapido desde navegador.',
    kicker: 'Rubros',
    h1: 'Sistema para kioscos que necesitan vender rapido y controlar stock en serio',
    lead: 'Ideal para kioscos con productos de alta rotacion, cobros rapidos y necesidad de saber que se vendio, que falta y cuanto quedo en caja.',
    image: '/operando-punto-venta-real.png',
    imageAlt: 'Sistema para kioscos con ventas y stock en operando.app',
    whatsAppPrompt: 'Hola Operando, quiero probar operando.app para mi kiosco.',
    sections: [
      { title: 'Mostrador rapido', body: 'Cobros agiles para productos de paso, con caja clara y seguimiento diario.' },
      { title: 'Reposicion simple', body: 'Control de faltantes, compras y proveedores sin cargar pantallas tecnicas innecesarias.' },
      { title: 'Acceso desde celular', body: 'Consulta ventas o stock rapido desde tu telefono cuando no estas en el local.' },
    ],
    featureList: ['Kioscos', 'Caja', 'Stock', 'Compras', 'Precios'],
  },
  {
    slug: 'software-para-tiendas',
    seoTitle: 'Software para tiendas y locales | Operando',
    description: 'Software para tiendas y locales con ventas, clientes, stock, compras y sucursales desde la web.',
    kicker: 'Rubros',
    h1: 'Software para tiendas y locales que necesitan vender, cobrar y ordenar su operacion',
    lead: 'operando.app ayuda a tiendas y locales a trabajar mejor con productos, clientes, historial comercial, caja y reportes desde una sola plataforma.',
    image: '/operando-stock-real.png',
    imageAlt: 'Software para tiendas y locales con control de stock',
    whatsAppPrompt: 'Hola Operando, quiero probar operando.app para mi tienda o local.',
    sections: [
      { title: 'Clientes y cuentas', body: 'Lleva historial, saldo y seguimiento comercial para ventas de mostrador o atencion recurrente.' },
      { title: 'Productos y precios', body: 'Ordena catalogo, categorias, stock y reposicion sin depender de planillas separadas.' },
      { title: 'Cajas y sucursales', body: 'Si creces, puedes sumar mas locales, usuarios y puestos de cobro sin cambiar de sistema.' },
    ],
    featureList: ['Tiendas', 'Clientes', 'Precios', 'Ventas', 'Sucursales'],
  },
  {
    slug: 'software-para-servicio-tecnico',
    seoTitle: 'Software para servicio tecnico | Operando',
    description: 'Software para servicio tecnico con tickets, clientes, caja, ventas de repuestos y seguimiento operativo.',
    kicker: 'Rubros',
    h1: 'Software para servicio tecnico con tickets, clientes, caja y control operativo',
    lead: 'Si trabajas con equipos, reparaciones, repuestos y cobros, puedes combinar tickets activos con ventas, stock y caja en el mismo sistema.',
    image: '/operando-panel-real.png',
    imageAlt: 'Software para servicio tecnico con tickets y caja',
    whatsAppPrompt: 'Hola Operando, quiero ver operando.app para servicio tecnico.',
    sections: [
      { title: 'Tickets y estados', body: 'Recibe equipos, registra detalle, cambia estado y sigue trabajos por sucursal.' },
      { title: 'Clientes y repuestos', body: 'Relaciona cliente, trabajo, ventas y productos sin duplicar datos.' },
      { title: 'Operacion diaria', body: 'Caja, compras y stock quedan en la misma base para ordenar mejor el taller.' },
    ],
    featureList: ['Tickets', 'Servicio tecnico', 'Clientes', 'Caja', 'Stock'],
  },
  {
    slug: 'pos-por-rubro',
    seoTitle: 'Sistema POS por rubro | Operando',
    description: 'Conoce como operando.app acompana kioscos, tiendas y servicios tecnicos con ventas, caja, stock y seguimiento operativo.',
    kicker: 'POS por rubro',
    h1: 'Un sistema comercial que se adapta a la forma de trabajar de tu negocio',
    lead: 'Cada rubro tiene un ritmo distinto. Elegi tu actividad y conoce los flujos de operando.app que sirven para su operacion diaria.',
    image: '/operando-panel-real.png',
    imageAlt: 'Panel de operando.app para gestionar un comercio',
    whatsAppPrompt: 'Hola Operando, quiero saber si operando.app se adapta a mi rubro.',
    sections: marketingSectors,
    featureList: ['Ventas', 'Caja', 'Stock', 'Clientes', 'Soporte'],
  },
  ...sectorLandingPages,
  {
    slug: 'como-funciona',
    seoTitle: 'Como funciona Operando | Sistema para comercios',
    description: 'Conoce el recorrido para crear una cuenta, cargar productos, vender, controlar la caja y hacer seguimiento de tu comercio con operando.app.',
    kicker: 'Como funciona',
    h1: 'De la configuracion inicial a una operacion mas ordenada',
    lead: 'operando.app centraliza el trabajo diario del comercio. Empeza por lo esencial y suma los modulos que tu operacion necesita.',
    image: '/operando-mobile-devices.png',
    imageAlt: 'operando.app funcionando en computadora, tablet y celular',
    whatsAppPrompt: 'Hola Operando, quiero que me expliquen como empezar a usar operando.app.',
    sections: [
      { title: '1. Crea tu cuenta', body: 'Registra tu comercio y entra desde el navegador, sin una instalacion tecnica para empezar. Creamos Casa central y Caja 1 para que no arranques con una pantalla vacía.', href: signupPath, linkLabel: 'Crear cuenta' },
      { title: '2. Carga tu catalogo', body: 'Agrega productos de forma manual o pedí una carga asistida si ya trabajas con una planilla. El equipo de soporte puede acompañarte 24/7.', href: '/control-de-stock/', linkLabel: 'Ver control de stock' },
      { title: '3. Registra ventas y cobros', body: 'Opera desde el mostrador y relaciona ventas, medios de pago, clientes y comprobantes. La guía inicial te muestra cada paso dentro del sistema.', href: '/sistema-de-ventas/', linkLabel: 'Ver sistema de ventas' },
      { title: '4. Controla caja y seguimiento', body: 'Consulta movimientos, cierres, existencias y reportes desde una misma base comercial; después suma sucursales, cajas y usuarios cuando tu operación lo necesite.', href: '/sistema-de-caja/', linkLabel: 'Ver sistema de caja' },
    ],
    featureList: ['Sin instalar', 'Acceso web', 'Carga asistida', 'Modulos escalables'],
  },
  {
    slug: 'blog',
    seoTitle: 'Guias para gestionar tu comercio | Operando',
    description: 'Guias practicas sobre stock, caja e importacion de productos para comercios argentinos.',
    kicker: 'Guias para comercios',
    h1: 'Consejos claros para ordenar la gestion diaria de tu comercio',
    lead: 'Recursos practicos sobre ventas, caja, stock y productos, escritos para tomar mejores decisiones en la operacion cotidiana.',
    image: '/control-stock-por-sucursal.svg',
    imageAlt: 'Control de stock por sucursal en operando.app',
    whatsAppPrompt: 'Hola Operando, quiero ayuda para ordenar la gestion de mi comercio.',
    sections: blogGuides,
    featureList: ['Stock', 'Caja', 'Productos', 'Guias practicas'],
  },
  {
    slug: 'comparar-sistemas-de-gestion',
    seoTitle: 'Comparar sistemas de gestion para comercios | Operando',
    description: 'Compara operando.app con otras plataformas de gestion para elegir segun ventas, stock, caja, sucursales, tickets, e-commerce y contabilidad.',
    kicker: 'Comparaciones honestas',
    h1: 'Compara sistemas de gestion y elegi el que mejor se adapta a tu comercio',
    lead: 'No todos los sistemas resuelven lo mismo. Revisa funciones, tipo de operacion y limites concretos antes de decidir.',
    image: '/operando-panel-real.png',
    imageAlt: 'Panel de gestion de operando.app',
    whatsAppPrompt: 'Hola operando.app, quiero ayuda para elegir el sistema adecuado para mi comercio.',
    sections: comparisonPages.map((page) => ({
      title: page.h1.replace(/^operando.app vs /, 'operando.app vs '),
      body: page.lead,
      href: `/${page.slug}/`,
      linkLabel: 'Ver comparacion',
    })),
    featureList: ['Comparacion por funciones', 'Limites explicitados', 'Eleccion por operacion'],
  },
  ...comparisonPages,
  {
    slug: 'glosario-pos',
    seoTitle: 'Glosario POS para comercios | Operando',
    description: 'Glosario de terminos de ventas, caja, stock, clientes, sucursales y tickets basado en la operacion real de operando.app.',
    kicker: 'Glosario POS',
    h1: 'Conceptos de gestion comercial explicados para el dia a dia del comercio',
    lead: 'Entende los terminos de ventas, caja, stock, clientes y servicios con ejemplos conectados a una operacion comercial real.',
    image: '/operando-panel-real.png',
    imageAlt: 'Operacion comercial con operando.app',
    whatsAppPrompt: 'Hola operando.app, quiero ayuda para ordenar la gestion de mi comercio.',
    sections: glossaryTerms.map((term) => ({
      title: term.title,
      body: term.lead,
      href: `/glosario-pos/${term.slug}/`,
      linkLabel: 'Leer termino',
    })),
    featureList: ['Ventas', 'Caja', 'Stock', 'Clientes', 'Sucursales', 'Tickets'],
  },
  ...glossaryPages,
  {
    slug: 'gestion-de-clientes',
    seoTitle: 'Gestion de clientes y compras | Operando',
    description: 'Gestiona clientes, compras, cuentas corrientes, historial comercial y proveedores desde una sola web.',
    kicker: 'Clientes',
    h1: 'Compras y proveedores para reponer con más criterio y menos vueltas',
    lead: 'Centralizá clientes, proveedores y recepciones de compra para que costos, stock y seguimiento comercial no queden en sistemas separados.',
    image: '/operando-stock-real.png',
    imageAlt: 'Gestion de clientes, compras y proveedores de operando.app',
    whatsAppPrompt: 'Hola Operando, quiero ordenar clientes y compras en mi comercio.',
    sections: [
      { title: 'Base comercial', body: 'Crea clientes, historiales y saldos sin obligar a pedir datos innecesarios.' },
      { title: 'Compras y proveedores', body: 'Registrá recepciones, costos, categorías y saldo comercial para consultar cada proveedor con contexto.' },
      { title: 'Impacto visible en la operación', body: 'Las compras actualizan el stock y quedan dentro de la misma base que ventas, caja y reportes.' },
    ],
    featureList: ['Clientes', 'Compras', 'Proveedores', 'Saldos', 'Historial'],
  },
  {
    slug: 'multi-sucursal',
    seoTitle: 'Sistema multi sucursal | Operando',
    description: 'Gestiona sucursales, cajas, usuarios, permisos y transferencias de stock desde una sola plataforma.',
    kicker: 'Escala',
    h1: 'Sistema multi sucursal para ver cada local sin perder el control del conjunto',
    lead: 'Separá resultados por sucursal, vinculá cajas a cada local y transferí mercadería con trazabilidad. Todo sin obligar al equipo a trabajar más lento.',
    image: '/operando-stock-real.png',
    imageAlt: 'Control multi sucursal de operando.app',
    whatsAppPrompt: 'Hola Operando, necesito varias sucursales y cajas en el sistema.',
    sections: [
      { title: 'Sucursales y cajas por puesto', body: 'Cada local puede tener sus cajas, puestos de cobro, operadores y reportes separados.' },
      { title: 'Permisos por usuario', body: 'Un administrador define roles, módulos habilitados y permisos bloqueados según la responsabilidad de cada persona.' },
      { title: 'Transferencias con trazabilidad', body: 'Mové productos entre sucursales y conservá el historial de origen, destino y detalle del movimiento.' },
    ],
    featureList: ['Multi sucursal', 'Usuarios', 'Permisos', 'Transferencias', 'Cajas'],
  },
  {
    slug: 'preguntas-frecuentes',
    seoTitle: 'Preguntas frecuentes | Operando',
    description: 'Respuestas sobre instalacion, celulares, lector de codigos, varias cajas, importacion de productos y prueba gratis.',
    kicker: 'FAQ',
    h1: 'Preguntas frecuentes sobre operando.app',
    lead: 'Resolvemos las dudas mas comunes de comercios que quieren probar una web para ventas, caja y stock sin perder tiempo.',
    image: '/operando-logo.png',
    imageAlt: 'Preguntas frecuentes y acceso a operando.app',
    whatsAppPrompt: 'Hola Operando, tengo dudas antes de probar operando.app.',
    faq: [
      ['Necesito instalar algo?', 'No en la version web. Entras desde navegador en PC o celular.'],
      ['Funciona desde celular?', 'Si. La interfaz esta pensada para operar y consultar desde distintos dispositivos.'],
      ['Puedo usar lector de codigos?', 'Si. El sistema acepta lectores USB tipo teclado y busqueda manual.'],
      ['Permite varias cajas?', 'Si. Puedes ligar ventas y caja a una caja especifica y separar reportes por puesto de cobro.'],
      ['Como cargo una planilla de productos?', 'Habla con soporte y envianos el archivo. Revisamos sus columnas y hacemos una carga controlada para evitar duplicados o datos mal interpretados.'],
      ['Que incluye la prueba gratis?', 'Acceso inicial para conocer ventas, caja, stock y el flujo completo del sistema antes de definir el pack ideal. Al crear la cuenta dejamos configurados tu comercio, Casa central y Caja 1; la guía inicial y el soporte por WhatsApp 24/7 te acompañan para cargar productos y empezar a operar.'],
    ],
    featureList: ['FAQ', 'Prueba gratis', 'Soporte', 'Carga asistida', 'Caja'],
  },
  {
    slug: 'blog/como-controlar-stock',
    seoTitle: 'Como controlar stock en un comercio | Operando',
    description: 'Aprende como controlar stock en un comercio, detectar faltantes y evitar vender sin mercaderia disponible.',
    kicker: 'Blog',
    h1: 'Como controlar stock en un comercio sin depender de Excel',
    lead: 'Controlar stock no es solo saber cuantas unidades quedan. Tambien es conocer que se vendio, que falta comprar y entre que sucursales se movio cada articulo.',
    image: '/operando-stock-real.png',
    imageAlt: 'Articulo sobre como controlar stock con operando.app',
    whatsAppPrompt: 'Hola Operando, vi el articulo de stock y quiero una demo.',
    sections: [
      { title: '1. Unifica catalogo y precios', body: 'Empieza con un listado unico de productos que tenga nombre, SKU, codigo de barras, costo y precio de venta.' },
      { title: '2. Registra compras y ventas', body: 'El stock debe actualizarse cuando compras, vendes, ajustas o transfieres productos.' },
      { title: '3. Mira faltantes y reposicion', body: 'Un buen sistema te ayuda a detectar stock bajo antes de perder ventas.' },
      { title: '4. Carga masiva desde Excel', body: 'Si ya tienes muchos articulos, conviene importarlos con plantilla, vista previa y validacion fila por fila.' },
    ],
    featureList: ['Programa para controlar stock', 'Excel a sistema', 'Stock minimo', 'Sucursales'],
  },
  {
    slug: 'blog/cierre-de-caja-correcto',
    seoTitle: 'Como hacer un cierre de caja correctamente | Operando',
    description: 'Guia para abrir y cerrar caja correctamente, controlar diferencias y ordenar medios de pago.',
    kicker: 'Blog',
    h1: 'Como hacer un cierre de caja correctamente en un negocio',
    lead: 'Un buen cierre de caja no solo compara efectivo. Tambien separa cobros, diferencias y movimientos para que el negocio tenga trazabilidad real.',
    image: '/operando-panel-real.png',
    imageAlt: 'Articulo sobre cierre de caja con operando.app',
    whatsAppPrompt: 'Hola Operando, quiero una demo para ordenar la caja de mi negocio.',
    sections: [
      { title: 'Apertura clara', body: 'Define el monto inicial y quien opera la caja para arrancar el turno sin dudas.' },
      { title: 'Cobros bien clasificados', body: 'Separa efectivo, transferencia, billeteras y cuenta corriente dentro del mismo turno.' },
      { title: 'Diferencia final', body: 'El cierre debe comparar lo esperado contra lo contado y dejar observaciones si hubo diferencia.' },
    ],
    featureList: ['Apertura de caja', 'Cierre', 'Diferencias', 'Medios de pago'],
  },
  {
    slug: 'blog/importar-productos-desde-excel',
    seoTitle: 'Como importar productos desde Excel | Operando',
    description: 'Migra productos desde Excel o CSV a operando.app con revision y carga asistida para evitar errores de stock y precios.',
    kicker: 'Blog',
    h1: 'Como pasar tus productos desde Excel a operando.app',
    lead: 'Cada comercio organiza sus planillas de una forma distinta. Por eso revisamos tu archivo y hacemos la migracion contigo, sin obligarte a adaptar columnas a ciegas.',
    image: '/operando-stock-real.png',
    imageAlt: 'Importacion masiva de productos desde Excel en operando.app',
    whatsAppPrompt: 'Hola Operando, quiero importar mis productos desde Excel.',
    sections: [
      { title: 'Nos envias tu archivo', body: 'Aceptamos Excel o CSV tal como lo usas hoy. No necesitas aprender una plantilla nueva antes de hablar con nosotros.' },
      { title: 'Revisamos y confirmamos', body: 'Identificamos nombre, codigo, precio, costo y stock; te mostramos que se va a crear o actualizar antes de guardar.' },
      { title: 'Carga segura', body: 'Importamos sobre el comercio correcto, controlamos duplicados y dejamos un resumen de filas aceptadas o rechazadas.' },
    ],
    downloads: importTemplateDownloads,
    featureList: ['Excel', 'CSV', 'Revision', 'Validacion', 'Carga asistida'],
  },
  {
    slug: 'privacidad',
    seoTitle: 'Politica de privacidad | Operando',
    description: 'Conoce como operando.app trata datos comerciales, accesos, comunicaciones y soporte.',
    kicker: 'Legal',
    h1: 'Politica de privacidad de operando.app',
    lead: 'Esta pagina resume como tratamos datos de acceso, datos comerciales y consultas enviadas por formularios o WhatsApp.',
    image: '/operando-logo.png',
    imageAlt: 'Politica de privacidad de operando.app',
    whatsAppPrompt: 'Hola Operando, quiero consultar sobre privacidad y datos.',
    sections: [
      { title: 'Datos de acceso', body: 'Los accesos se usan para identificar usuarios y proteger la operacion de cada comercio.' },
      { title: 'Datos operativos', body: 'La informacion de ventas, caja, stock y clientes pertenece al comercio que usa la plataforma.' },
      { title: 'Soporte y contacto', body: 'Los mensajes enviados por WhatsApp o formularios se usan para responder consultas comerciales o tecnicas.' },
    ],
    featureList: ['Privacidad', 'Accesos', 'Datos comerciales', 'Soporte'],
  },
  {
    slug: 'terminos',
    seoTitle: 'Terminos de uso | Operando',
    description: 'Terminos generales de uso, prueba, soporte y operacion de operando.app.',
    kicker: 'Legal',
    h1: 'Terminos de uso de operando.app',
    lead: 'La prueba y el uso comercial del sistema se prestan bajo condiciones claras de acceso, soporte, seguridad y operacion responsable.',
    image: '/operando-logo.png',
    imageAlt: 'Terminos de uso de operando.app',
    whatsAppPrompt: 'Hola Operando, quiero consultar los terminos de uso del sistema.',
    sections: [
      { title: 'Prueba y acceso', body: 'La prueba inicial permite conocer el sistema antes de definir el pack comercial adecuado.' },
      { title: 'Uso responsable', body: 'Cada comercio administra sus usuarios, roles y claves para operar de manera segura.' },
      { title: 'Soporte y continuidad', body: 'El soporte acompana configuracion, dudas comerciales y continuidad operativa segun el alcance acordado.' },
    ],
    featureList: ['Terminos', 'Prueba', 'Soporte', 'Uso comercial'],
  },
]

const marketingPageMap = Object.fromEntries(marketingPages.map((page) => [page.slug, page]))

const buildSoftwareJsonLd = (page) => ({
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'operando.app',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: pageUrl(page.slug),
  image: `${siteOrigin}/operando-logo.png`,
  screenshot: [
    `${siteOrigin}/pantalla-ventas-operando.svg`,
    `${siteOrigin}/control-stock-por-sucursal.svg`,
    `${siteOrigin}/cierre-caja-comercio.svg`,
  ],
  softwareVersion: assetVersion,
  description: page.description,
  featureList: page.featureList || [],
  offers: {
    '@type': 'Offer',
    availability: 'https://schema.org/InStock',
    description: 'Prueba gratis y planes comerciales para comercios.',
    url: `${siteOrigin}/precios/`,
  },
})

const buildOrganizationJsonLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'operando.app',
  url: siteOrigin,
  logo: `${siteOrigin}/operando-logo.png`,
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'sales',
    url: supportUrl,
    availableLanguage: ['es-AR', 'es'],
  },
})

const buildFaqJsonLd = (page) => {
  if (!Array.isArray(page.faq) || !page.faq.length) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: page.faq.map(([question, answer]) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: answer,
      },
    })),
  }
}

const renderTopbar = (page) => `
  <header class="marketing-topbar">
    <a class="marketing-brand" href="/">
      <img src="/operando-logo.png?v=operando-20260831" alt="operando.app" width="48" height="46" />
      <div>
        <strong><span>Operando</span><em>.app</em></strong>
      </div>
    </a>
    <nav class="marketing-nav" aria-label="Navegacion principal">
      ${topLinks.map((link) => `<a href="${link.href}" data-analytics="nav_${escapeHtml(link.label).toLowerCase().replaceAll(' ', '_')}">${escapeHtml(link.label)}</a>`).join('')}
      <details class="marketing-nav-menu">
        <summary aria-label="Ver recursos y guías">Recursos</summary>
        <div class="marketing-nav-menu-panel">
          <a href="/preguntas-frecuentes/" data-analytics="nav_faq">Preguntas frecuentes</a>
          <a href="/pos-por-rubro/" data-analytics="nav_pos_por_rubro">Soluciones por actividad</a>
          <a href="/comparar-sistemas-de-gestion/" data-analytics="nav_comparaciones_menu">Elegí tu sistema</a>
          <a href="/glosario-pos/" data-analytics="nav_glosario">Diccionario comercial</a>
          <a href="/como-funciona/" data-analytics="nav_como_funciona">Cómo empezar</a>
          <a href="/blog/" data-analytics="nav_blog">Guías para tu negocio</a>
        </div>
      </details>
    </nav>
    <details class="marketing-mobile-menu">
      <summary>Menú</summary>
      <nav aria-label="Navegación móvil">
        ${topLinks.map((link) => `<a href="${link.href}" data-analytics="mobile_nav_${escapeHtml(link.label).toLowerCase().replaceAll(' ', '_')}">${escapeHtml(link.label)}</a>`).join('')}
        <a href="/preguntas-frecuentes/" data-analytics="mobile_nav_faq">Preguntas frecuentes</a>
        <a href="/como-funciona/" data-analytics="mobile_nav_como_funciona">Cómo funciona</a>
        <a href="/blog/" data-analytics="mobile_nav_blog">Blog</a>
      </nav>
    </details>
    <div class="marketing-auth-links">
      <a href="${loginPath}" data-analytics="header_login">Iniciar sesion</a>
      <a class="is-primary" href="${signupPath}" data-analytics="header_signup">Probar gratis</a>
    </div>
  </header>
`

const renderFooter = () => `
  <footer class="marketing-footer">
    <div class="marketing-footer-brand">
      <strong>Operando</strong>
      <p>Software comercial web para ventas, caja, stock, clientes, compras, tickets y sucursales.</p>
    </div>
    <div class="marketing-footer-links">
      <p class="marketing-footer-title">Accesos</p>
      <nav>
        <a href="${loginPath}" data-analytics="footer_login">Iniciar sesion</a>
        <a href="${signupPath}" data-analytics="footer_signup_primary">Crear cuenta</a>
      </nav>
    </div>
    <div class="marketing-footer-links">
      <p class="marketing-footer-title">Mas informacion</p>
      <nav>
        <a href="/funciones/" data-analytics="footer_funciones">Funciones</a>
        <a href="/precios/" data-analytics="footer_precios">Precios y acceso 2026</a>
        <a href="/preguntas-frecuentes/" data-analytics="footer_faq">Preguntas frecuentes</a>
        <a href="/privacidad/" data-analytics="footer_privacidad">Privacidad</a>
        <a href="/terminos/" data-analytics="footer_terminos">Terminos</a>
      </nav>
    </div>
    <div class="marketing-footer-actions">
      <p class="marketing-footer-title">Contacto</p>
      <a href="${supportUrl}" target="_blank" rel="noreferrer" data-analytics="footer_whatsapp">Hablar por WhatsApp</a>
    </div>
  </footer>
`

const renderSectionCards = (sections = []) => `
  <section class="marketing-grid">
    ${sections.map((section, index) => `
      <article class="marketing-card">
        <h2>${escapeHtml(section.title)}</h2>
        <p>${escapeHtml(section.body)}</p>
        ${section.href ? `<a href="${section.href}" data-analytics="section_${escapeHtml(section.title).toLowerCase().replaceAll(' ', '_')}">${escapeHtml(section.linkLabel || 'Ver solucion')}</a>` : ''}
      </article>
    `).join('')}
  </section>
`

const renderComparison = (comparison) => comparison ? `
  <section class="marketing-compare" aria-labelledby="comparison-title">
    <div class="marketing-compare-copy">
      <p class="marketing-kicker">Funcion a funcion</p>
      <h2 id="comparison-title">operando.app vs ${escapeHtml(comparison.alternative)}</h2>
      <p>Esta comparacion usa informacion publica de cada alternativa y las funciones verificadas de operando.app. Revisa siempre el plan vigente antes de contratar.</p>
    </div>
    <div class="marketing-compare-table" role="region" aria-label="Tabla comparativa" tabindex="0">
      <div class="marketing-compare-head"><span>Aspecto</span><span>${escapeHtml(comparison.alternative)}</span><span>operando.app</span></div>
      ${comparison.rows.map(([feature, alternative, operando]) => `<div class="marketing-compare-row"><strong>${escapeHtml(feature)}</strong><span>${escapeHtml(alternative)}</span><span>${escapeHtml(operando)}</span></div>`).join('')}
    </div>
  </section>
` : ''

const renderFaq = (faq = []) => faq.length ? `
  <section class="marketing-faq">
    <h2>Preguntas frecuentes</h2>
    ${faq.map(([question, answer]) => `
      <details>
        <summary>${escapeHtml(question)}</summary>
        <p>${escapeHtml(answer)}</p>
      </details>
    `).join('')}
  </section>
` : ''

const renderDownloads = (downloads = []) => downloads.length ? `
  <section class="marketing-grid marketing-grid-compact">
    ${downloads.map((item) => `
      <article class="marketing-card marketing-card-link">
        <h2>${escapeHtml(item.label)}</h2>
        <p>${escapeHtml(item.body)}</p>
        <a href="${item.href}" data-analytics="${item.href.endsWith('.csv') ? 'download_template' : 'open_import_guide'}">${item.href.endsWith('.csv') ? 'Descargar ahora' : 'Abrir guia'}</a>
      </article>
    `).join('')}
  </section>
` : ''

const renderHomeExtras = (page) => {
  if (page.slug) return ''
  const publishedMetrics = (marketingMetrics.metrics || []).filter((metric) => Number(metric.value) > 0)
  return `
  <section id="como-funciona" class="marketing-home-rows" aria-labelledby="beneficios-title">
    <div class="marketing-section-intro">
      <p class="marketing-kicker">Una operación más ordenada</p>
      <h2 id="beneficios-title">Todo lo que necesitás para administrar tu comercio</h2>
      <p>Menos tiempo buscando datos. Más tiempo atendiendo, comprando y haciendo crecer el negocio.</p>
    </div>
    ${homeFeatureRows.map((row) => `
      <article class="marketing-story ${row.reverse ? 'is-reverse' : ''}">
        <div class="marketing-story-media">
          <img src="${row.image}" alt="${escapeHtml(row.alt)}" width="1200" height="800" loading="lazy" />
        </div>
        <div class="marketing-story-copy">
          <p class="marketing-kicker">${escapeHtml(row.eyebrow || 'operando.app')}</p>
          <h2>${escapeHtml(row.title)}</h2>
          <p>${escapeHtml(row.body)}</p>
        </div>
      </article>
    `).join('')}
  </section>
  <section class="marketing-live-metrics" aria-labelledby="live-metrics-title">${publishedMetrics.length ? `
    <div class="marketing-live-metrics-grid">${publishedMetrics.map((metric) => `
        <article>
          <strong class="marketing-counter" data-counter-value="${Number(metric.value)}" data-counter-prefix="${escapeHtml(metric.prefix || '')}" data-counter-suffix="${escapeHtml(metric.suffix || '')}" data-counter-format="${escapeHtml(metric.format || 'integer')}">${escapeHtml(metric.prefix || '')}${metric.format === 'millions' ? Math.round(Number(metric.value) / 1000000).toLocaleString('es-AR') : Number(metric.value).toLocaleString('es-AR')}${escapeHtml(metric.suffix || '')}</strong>
          <span>${escapeHtml(metric.label)}</span>
        </article>`).join('')}
    </div>` : ''}<div class="marketing-vertical-rotation">
      <p class="marketing-kicker">Diseñado para crecer con tu rubro</p>
      <h2 id="live-metrics-title">Herramientas para comercios de <em>todos los rubros</em></h2>
      <ul class="marketing-vertical-list" aria-label="Rubros incluidos">${[...(marketingMetrics.verticals || []), 'tu rubro'].map((vertical) => `<li>${escapeHtml(vertical)}</li>`).join('')}</ul>
      <p>Los rubros son ejemplos: operando.app se adapta a la operación de cualquier comercio que necesite vender, cobrar, controlar stock y trabajar con su equipo.</p>
    </div>
  </section>
  <section class="marketing-support" aria-labelledby="support-title">
    <div class="marketing-support-copy">
      <p class="marketing-kicker">Soporte 24/7</p>
      <h2 id="support-title">Una persona del otro lado, cuando tu negocio la necesita.</h2>
      <p>Si algo no cierra en caja, el stock se comporta distinto o necesitás una mano para configurar una operación, podés escribirnos. El soporte está disponible las 24 horas, todos los días.</p>
      <ol class="marketing-support-points">
        <li><span>01</span><div><strong>Disponible 24/7</strong><p>Para acompañar la operación, incluso fuera del horario de mostrador.</p></div></li>
        <li><span>02</span><div><strong>Directo por WhatsApp</strong><p>Escribinos como le escribirías a alguien de tu equipo.</p></div></li>
        <li><span>03</span><div><strong>Ayuda sobre la operación</strong><p>Stock, caja, productos y configuración, con el contexto del día a día.</p></div></li>
      </ol>
    </div>
    <div class="marketing-support-phone" aria-label="Ejemplo ilustrativo de una conversación de soporte">
      <div class="marketing-phone-head"><img class="marketing-phone-logo" src="/operando-logo.png?v=operando-20260831" alt="" width="36" height="36" /><div><strong>Soporte Operando</strong><small>En línea</small></div><span class="marketing-phone-actions" aria-hidden="true">⌕　⋮</span></div>
      <div class="marketing-phone-chat">
        <p class="marketing-chat-day">HOY</p>
        <p class="marketing-message is-client">Hola, no me aparece una venta que hice recién. ¿Puede haberse perdido?<small>18:41</small></p>
        <p class="marketing-message is-support">Hola. La revisamos. ¿La venta llegó a mostrarte el comprobante al finalizar?<small>18:42</small></p>
        <p class="marketing-message is-client">Sí, pero después fui al historial y no la encontraba.<small>18:42</small></p>
        <p class="marketing-message is-support">Ya la veo registrada. Tenés aplicado un filtro que muestra solamente las ventas del turno anterior.<small>18:44</small></p>
        <p class="marketing-message is-client">Ahh, era eso 😅<small>18:44</small></p>
        <p class="marketing-message is-support">Probá seleccionando “Hoy” y debería aparecerte arriba de todo.<small>18:45</small></p>
        <p class="marketing-message is-client">Sí, apareció. Perfecto.<small>18:45</small></p>
        <p class="marketing-message is-support">Buenísimo. La venta estaba correctamente guardada, así que no hace falta cargarla otra vez.<small>18:46</small></p>
        <p class="marketing-message is-client">Gracias por la ayuda 🙌<small>18:46</small></p>
        <p class="marketing-message is-support">Cuando necesites, escribinos por acá.<small>18:46</small></p>
      </div>
      <div class="marketing-phone-input"><span>Escribí un mensaje…</span><b>↑</b></div>
    </div>
  </section>
  <section class="marketing-control-panel" aria-labelledby="control-panel-title">
    <div class="marketing-control-panel-intro">
      <p class="marketing-kicker">Recorrido de control</p>
      <h2 id="control-panel-title">Tres controles para operar con más contexto</h2>
      <p>Lo esencial para vender, controlar y revisar sin sumar pasos en el mostrador.</p>
    </div>
    <div class="marketing-control-progress" aria-hidden="true"><span>01</span><i></i><span>03</span></div>
    <div class="marketing-control-stories">${controlStories.slice(0, 3).map((story, index) => `
        <article class="marketing-control-story ${index % 2 ? 'is-reverse' : ''}">
          <div class="marketing-control-story-copy">
            <p class="marketing-control-index"><span>${story.number}</span>${escapeHtml(story.eyebrow)}</p>
            <h3>${escapeHtml(story.title)}</h3>
            <p>${escapeHtml(story.body)}</p>
            <ul>${story.details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join('')}</ul>
          </div>
          <figure class="marketing-control-story-media">
            <div class="marketing-control-image-frame"><img src="${story.image}" alt="${escapeHtml(story.alt)}" width="1200" height="800" loading="lazy" /></div>
            <figcaption>${escapeHtml(story.caption)}</figcaption>
          </figure>
        </article>`).join('')}
    </div>
    <p class="marketing-control-more"><a href="/funciones/" data-analytics="home_control_more">Ver todas las funciones</a></p>
  </section>
  <section class="marketing-home-cta marketing-card">
    <div>
      <p class="marketing-kicker">Empieza hoy</p>
      <h2>Prueba operando.app en tu propio negocio</h2>
      <p>Crea tu cuenta en minutos y conoce la herramienta trabajando con tus productos y tus ventas.</p>
    </div>
    <div class="marketing-cta-row">
      <a class="is-primary" href="${signupPath}" data-analytics="home_cta_signup">Crear cuenta</a>
      <a href="${loginPath}" data-analytics="home_cta_login">Iniciar sesion</a>
    </div>
  </section>
`
}

const renderHeroStats = (stats = []) => stats.length ? `
  <div class="marketing-hero-stats">
    ${stats.map(([label, value]) => `
      <article class="marketing-hero-stat">
        <strong>${escapeHtml(label)}</strong>
        <span>${escapeHtml(value)}</span>
      </article>
    `).join('')}
  </div>
` : ''

const marketingStyles = `
      html, body {
        margin: 0;
        min-height: 100%;
        background:
          radial-gradient(circle at top right, rgba(255, 59, 48, 0.12), transparent 18%),
          radial-gradient(circle at bottom left, rgba(121, 200, 28, 0.08), transparent 14%),
          linear-gradient(180deg, #050505 0%, #0b0b0b 100%);
      }
      body {
        color: #f3f4f6;
        font-family: Inter, Arial, sans-serif;
      }
      * { box-sizing: border-box; }
      a { color: inherit; }
      .marketing-shell {
        width: min(1240px, calc(100% - 36px));
        margin: 0 auto;
        padding: 16px 0 34px;
      }
      .marketing-hero-copy,
      .marketing-hero-media,
      .marketing-card,
      .marketing-faq,
      .marketing-footer,
      .marketing-demo,
      .marketing-compare-copy,
      .marketing-compare-table {
        border: 1px solid rgba(255,255,255,0.08);
        background: linear-gradient(180deg, rgba(17, 17, 17, 0.96), rgba(23, 23, 23, 0.96));
        box-shadow: 0 20px 60px rgba(0,0,0,0.24);
      }
      .marketing-topbar {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 22px;
        align-items: center;
        padding: 8px 0 14px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
      }
      .marketing-brand {
        display: flex;
        gap: 12px;
        align-items: center;
        text-decoration: none;
      }
      .marketing-brand img {
        width: 52px;
        height: auto;
        object-fit: contain;
      }
      .marketing-brand p {
        margin: 5px 0 0;
        color: #9ca3af;
        letter-spacing: 0.01em;
        font-size: 0.92rem;
      }
      .marketing-brand strong,
      .marketing-hero-copy h1,
      .marketing-card h2,
      .marketing-faq h2 {
        font-family: Oswald, Arial, sans-serif;
      }
      .marketing-brand strong {
        display: block;
        font-size: 1.45rem;
      }
      .marketing-nav,
      .marketing-auth-links,
      .marketing-badges,
      .marketing-cta-row,
      .marketing-footer nav,
      .marketing-footer-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .marketing-nav {
        justify-content: center;
        gap: 20px;
      }
      .marketing-nav a,
      .marketing-auth-links a,
      .marketing-cta-row a,
      .marketing-card-link a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 42px;
        padding: 0 15px;
        border-radius: 14px;
        text-decoration: none;
      }
      .marketing-nav a,
      .marketing-auth-links a:not(.is-primary) {
        min-height: 0;
        padding: 0;
        border: 0;
        border-radius: 0;
        color: #d6dde8;
      }
      .marketing-nav a:hover,
      .marketing-auth-links a:not(.is-primary):hover {
        color: #ffffff;
      }
      .marketing-nav-menu {
        position: relative;
      }
      .marketing-nav-menu summary {
        cursor: pointer;
        color: #f8fafc;
        font-size: 0.93rem;
        font-weight: 600;
        list-style: none;
      }
      .marketing-nav-menu summary::-webkit-details-marker { display: none; }
      .marketing-nav-menu summary::after {
        content: '⌄';
        margin-left: 5px;
        color: #c0c6cf;
      }
      .marketing-nav-menu-panel {
        position: absolute;
        z-index: 30;
        top: calc(100% + 12px);
        left: 50%;
        min-width: 218px;
        padding: 8px;
        transform: translateX(-50%);
        border: 1px solid #464c55;
        border-radius: 14px;
        background: #1c1f23;
        box-shadow: 0 18px 44px rgba(0,0,0,0.4);
      }
      .marketing-nav-menu-panel a {
        display: block;
        padding: 10px 12px;
        border-radius: 9px;
        color: #f8fafc;
        text-decoration: none;
      }
      .marketing-nav-menu-panel a:hover {
        color: #ffffff;
        background: #30343a;
      }
      .marketing-footer nav a,
      .marketing-footer-actions a {
        display: inline-flex;
        align-items: center;
        min-height: 0;
        padding: 0;
        border: 0;
        border-radius: 0;
        color: #e5e7eb;
        text-decoration: none;
      }
      .marketing-footer nav a:hover,
      .marketing-footer-actions a:hover {
        color: #ffffff;
      }
      .marketing-nav a {
        font-size: 0.93rem;
      }
      .marketing-auth-links .is-primary,
      .marketing-cta-row .is-primary {
        border: 1px solid rgba(255,59,48,0.3);
        background: linear-gradient(180deg, #ff4d45 0%, #db1616 100%);
      }
      .marketing-hero {
        display: grid;
        grid-template-columns: minmax(0, 0.92fr) minmax(360px, 1.08fr);
        gap: 22px;
        margin-top: 24px;
      }
      .marketing-hero-copy,
      .marketing-hero-media {
        border-radius: 26px;
        padding: 28px;
      }
      .marketing-kicker {
        margin: 0 0 8px;
        color: #9ca3af;
        text-transform: uppercase;
        letter-spacing: 0.2em;
        font-size: 0.76rem;
      }
      .marketing-hero-copy h1 {
        margin: 0;
        font-size: clamp(2.4rem, 5.3vw, 4.8rem);
        line-height: 0.96;
        max-width: 9ch;
      }
      .marketing-lead {
        margin: 0;
        color: #c7d2de;
        line-height: 1.62;
        font-size: 1.05rem;
        max-width: 42ch;
      }
      .marketing-badges {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      .marketing-hero-copy .marketing-badges:empty {
        display: none;
      }
      .marketing-badges li {
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.08);
        background: rgba(255,255,255,0.03);
        font-size: 0.84rem;
      }
  .marketing-hero-helper {
  margin: 14px 0 0;
  color: #aeb9c8;
  font-size: 0.95rem;
  }
  .marketing-section-intro { max-width: 680px; margin: 48px 0 8px; }
  .marketing-section-intro h2 { margin: 0 0 10px; font-family: Oswald, Arial, sans-serif; font-size: clamp(2rem, 4vw, 3.4rem); line-height: 1; }
  .marketing-section-intro p:last-child { margin: 0; color: #b9c2ce; line-height: 1.6; }
      .marketing-hero-helper a {
        color: #ffffff;
        text-decoration: underline;
        text-decoration-thickness: 0.1em;
        text-underline-offset: 0.14em;
      }
      .marketing-hero-stats {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        margin-top: 16px;
      }
      .marketing-hero-stat {
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 16px;
        padding: 12px 14px;
        background: rgba(255,255,255,0.03);
      }
      .marketing-hero-stat strong {
        display: block;
        margin-bottom: 6px;
        font-size: 1rem;
        color: #ffffff;
      }
      .marketing-hero-stat span {
        color: #aeb9c8;
        font-size: 0.88rem;
        line-height: 1.45;
      }
      .marketing-hero-media img {
        width: 100%;
        height: auto;
        display: block;
        border-radius: 18px;
        border: 1px solid rgba(255,255,255,0.08);
        background: rgba(255,255,255,0.02);
      }
      .marketing-image-caption {
        margin: 12px 0 0;
        color: #aeb9c8;
        font-size: 0.9rem;
        line-height: 1.5;
      }
      .marketing-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
        margin-top: 14px;
      }
      .marketing-home-rows {
        display: grid;
        gap: 22px;
        margin-top: 28px;
      }
      .marketing-story {
        display: grid;
        grid-template-columns: minmax(380px, 1.02fr) minmax(0, 0.98fr);
        gap: 28px;
        align-items: center;
        border: 1px solid rgba(255,255,255,0.06);
        background: linear-gradient(180deg, rgba(14, 14, 14, 0.92), rgba(18, 18, 18, 0.92));
        box-shadow: 0 16px 44px rgba(0,0,0,0.2);
        border-radius: 30px;
        padding: 28px;
      }
      .marketing-story.is-reverse {
        grid-template-columns: minmax(0, 0.98fr) minmax(380px, 1.02fr);
      }
      .marketing-story.is-reverse .marketing-story-media {
        order: 2;
      }
      .marketing-story.is-reverse .marketing-story-copy {
        order: 1;
      }
      .marketing-story-media {
        position: relative;
        overflow: hidden;
        border-radius: 18px;
        background: #111216;
      }
      .marketing-story-media::after {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: linear-gradient(115deg, transparent 36%, rgba(255,255,255,0.08) 49%, transparent 62%);
        transform: translateX(-120%);
        animation: marketing-interface-sheen 9s ease-in-out infinite;
      }
      .marketing-story-media img {
        width: 100%;
        height: auto;
        display: block;
        border: 1px solid rgba(255,255,255,0.08);
        transition: transform 700ms cubic-bezier(.2,.8,.2,1), filter 700ms cubic-bezier(.2,.8,.2,1);
      }
      .marketing-story:hover .marketing-story-media img { transform: scale(1.018); filter: brightness(1.04); }
      @keyframes marketing-interface-sheen { 0%, 68% { transform: translateX(-120%); } 82%, 100% { transform: translateX(120%); } }
      .marketing-story-copy h2 {
        margin: 0 0 12px;
        font-family: Oswald, Arial, sans-serif;
        font-size: clamp(2rem, 3.5vw, 3.15rem);
        line-height: 1.02;
        max-width: 11ch;
      }
      .marketing-story-copy p {
        margin: 0;
        color: #b9c3d1;
        font-size: 1.02rem;
        line-height: 1.72;
        max-width: 44ch;
      }
      .marketing-home-cta {
        margin-top: 22px;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 22px;
        align-items: center;
        border-radius: 30px;
        padding: 24px 28px;
      }
      .marketing-home-cta h2 {
        margin: 0 0 10px;
      }
      .marketing-home-cta p {
        margin: 0;
      }
      .marketing-grid-compact {
        margin-top: 16px;
      }
      .marketing-compare {
        margin-top: 14px;
        display: grid;
        grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
        gap: 14px;
      }
      .marketing-card {
        border-radius: 22px;
        padding: 18px;
      }
      .marketing-card h2 {
        margin: 0 0 8px;
        font-size: 1.16rem;
        line-height: 1.1;
      }
      .marketing-card p {
        margin: 0;
        color: #b9c3d1;
        line-height: 1.52;
        font-size: 0.95rem;
      }
      .marketing-card-link a,
      .marketing-card > a {
        margin-top: 14px;
        display: inline-flex;
        align-items: center;
        min-height: 42px;
        padding: 0 15px;
        border: 1px solid rgba(255,255,255,0.16);
        border-radius: 14px;
        color: #f3f4f6;
        text-decoration: none;
      }
      .marketing-card > a:hover {
        border-color: rgba(255,59,48,0.55);
        color: #fff;
      }
      .marketing-compare-head,
      .marketing-compare-row {
        display: grid;
        grid-template-columns: minmax(0, 0.8fr) minmax(0, 1fr) minmax(0, 1fr);
        gap: 14px;
      }
      .marketing-compare-head {
        padding-bottom: 10px;
        margin-bottom: 10px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        color: #9ca3af;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 0.74rem;
      }
      .marketing-compare-row {
        padding: 10px 0;
        border-bottom: 1px solid rgba(255,255,255,0.06);
      }
      .marketing-compare-row:last-child {
        border-bottom: 0;
      }
      .marketing-demo {
        margin-top: 14px;
        display: grid;
        grid-template-columns: minmax(0, 0.92fr) minmax(320px, 1.08fr);
        gap: 14px;
        align-items: center;
      }
      .marketing-demo-form {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }
      .marketing-demo-form label {
        display: grid;
        gap: 6px;
        color: #d6dde8;
      }
      .marketing-demo-form input,
      .marketing-demo-form select {
        min-height: 48px;
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,0.08);
        background: rgba(255,255,255,0.03);
        color: #f3f4f6;
        padding: 0 14px;
      }
      .marketing-demo-form button {
        min-height: 48px;
        border-radius: 14px;
        border: 1px solid rgba(255,59,48,0.3);
        background: linear-gradient(180deg, #ff4d45 0%, #db1616 100%);
        color: #fff;
        font: inherit;
        font-weight: 700;
      }
      .marketing-faq {
        margin-top: 16px;
        border-radius: 22px;
        padding: 18px;
      }
      .marketing-faq h2 {
        margin: 0 0 12px;
        font-size: 1.28rem;
      }
      .marketing-faq details + details {
        margin-top: 12px;
      }
      .marketing-faq summary {
        cursor: pointer;
        font-weight: 700;
      }
      .marketing-faq p {
        margin: 10px 0 0;
        color: #b9c3d1;
        line-height: 1.7;
      }
      .marketing-footer {
        margin-top: 16px;
        border-radius: 22px;
        padding: 18px;
        display: grid;
        grid-template-columns: 1.05fr 0.9fr 0.9fr 0.8fr;
        gap: 14px;
        align-items: start;
      }
      .marketing-footer-title {
        margin: 0 0 10px;
        color: #9ca3af;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        font-size: 0.74rem;
      }
      .marketing-footer-links nav,
      .marketing-footer-actions {
        display: grid;
        gap: 12px;
        align-content: start;
      }
      .marketing-footer strong {
        font-family: Oswald, Arial, sans-serif;
        font-size: 1.35rem;
      }
      .marketing-footer p {
        margin: 8px 0 0;
        color: #b9c3d1;
        line-height: 1.58;
      }
      .marketing-floating-whatsapp {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 30;
        background: linear-gradient(180deg, #22c55e 0%, #138a3d 100%);
        color: #ffffff;
        border-radius: 999px;
        padding: 14px 18px;
        border: 1px solid rgba(255,255,255,0.12);
        box-shadow: 0 20px 40px rgba(0,0,0,0.28);
        text-decoration: none;
      }
      body[data-page="home"] .marketing-grid,
      body[data-page="home"] .marketing-grid-compact {
        display: none;
      }
      @media (max-width: 1024px) {
        .marketing-topbar {
          grid-template-columns: 1fr;
          gap: 12px;
        }
        .marketing-nav {
          justify-content: flex-start;
        }
        .marketing-footer {
          grid-template-columns: 1fr;
        }
      }
      @media (max-width: 920px) {
        .marketing-hero,
        .marketing-grid,
        .marketing-footer,
        .marketing-compare,
        .marketing-demo,
        .marketing-story,
        .marketing-home-cta {
          grid-template-columns: 1fr;
        }
        .marketing-story.is-reverse .marketing-story-media,
        .marketing-story.is-reverse .marketing-story-copy {
          order: initial;
        }
        .marketing-story-copy h2 {
          max-width: none;
        }
        .marketing-hero-stats {
          grid-template-columns: 1fr;
        }
      }
      @media (max-width: 640px) {
        .marketing-shell {
          width: min(100% - 20px, 100%);
          padding: 12px 0 28px;
        }
        .marketing-hero-copy,
        .marketing-hero-media,
        .marketing-card,
        .marketing-faq,
        .marketing-footer,
        .marketing-demo,
        .marketing-story,
        .marketing-home-cta {
          padding: 20px;
          border-radius: 20px;
        }
        .marketing-hero-copy h1 {
          font-size: clamp(2.2rem, 13vw, 3.2rem);
          max-width: 9ch;
        }
        .marketing-image-caption {
          font-size: 0.92rem;
        }
        .marketing-nav,
        .marketing-auth-links,
        .marketing-cta-row,
        .marketing-footer nav,
        .marketing-footer-actions {
          gap: 10px;
        }
        .marketing-demo-form,
        .marketing-compare-head,
        .marketing-compare-row {
          grid-template-columns: 1fr;
        }
        .marketing-floating-whatsapp {
          right: 10px;
          bottom: 10px;
          padding: 12px 14px;
          font-size: 0.92rem;
        }
        .marketing-nav {
          gap: 16px;
        }
        .marketing-nav a {
          font-size: 0.9rem;
        }
      }

      /* Public website: a clear commercial identity, distinct from the dark app UI. */
      html, body {
        background: #111214;
      }
      body {
        color: #f8fafc;
        font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      }
      .marketing-shell {
        width: min(1320px, calc(100% - 48px));
        padding-top: 0;
      }
      .marketing-topbar {
        position: sticky;
        top: 0;
        z-index: 20;
        min-height: 82px;
        padding: 12px 0;
        border-bottom: 1px solid #30343a;
        background: rgba(245, 242, 236, 0.94);
        backdrop-filter: blur(16px);
      }
      .marketing-brand img {
        width: 48px;
      }
      .marketing-brand strong,
      .marketing-hero-copy h1,
      .marketing-card h2,
      .marketing-faq h2,
      .marketing-story-copy h2,
      .marketing-footer strong {
        font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      }
      .marketing-brand strong {
        font-size: 1.12rem;
        letter-spacing: -0.02em;
      }
      .marketing-brand p {
        margin-top: 2px;
        color: #c0c6cf;
        font-size: 0.82rem;
      }
      .marketing-nav a,
      .marketing-auth-links a:not(.is-primary) {
        color: #edf0f4;
        font-weight: 600;
      }
      .marketing-nav a:hover,
      .marketing-auth-links a:not(.is-primary):hover,
      .marketing-hero-helper a {
        color: #d51d22;
      }
      .marketing-auth-links .is-primary,
      .marketing-cta-row .is-primary {
        min-height: 46px;
        padding-inline: 22px;
        border: 0;
        border-radius: 8px;
        background: #ff3340;
        color: #fff;
        box-shadow: 0 10px 24px rgba(213, 29, 34, 0.2);
        font-weight: 700;
      }
      .marketing-auth-links .is-primary:hover,
      .marketing-cta-row .is-primary:hover {
        background: #c8171d;
        transform: translateY(-1px);
      }
      .marketing-mobile-menu { display: none; }
      .marketing-hero {
        min-height: 0;
        grid-template-columns: minmax(0, 0.86fr) minmax(480px, 1.14fr);
        gap: clamp(36px, 6vw, 88px);
        align-items: center;
        margin-top: 0;
        padding: clamp(38px, 5vw, 68px) 0;
      }
      .marketing-hero > *,
      .marketing-story > * {
        min-width: 0;
      }
      .marketing-hero-copy,
      .marketing-hero-media,
      .marketing-card,
      .marketing-faq,
      .marketing-footer,
      .marketing-demo,
      .marketing-compare-copy,
      .marketing-compare-table {
        border: 0;
        background: transparent;
        box-shadow: none;
      }
      .marketing-hero-copy,
      .marketing-hero-media {
        padding: 0;
      }
      .marketing-kicker {
        color: #b91c1c;
        font-weight: 800;
        letter-spacing: 0.16em;
      }
      .marketing-hero-copy h1 {
        max-width: 14ch;
        margin: 0 0 24px;
        color: #f8fafc;
        font-size: clamp(2.8rem, 4.5vw, 4.4rem);
        font-weight: 780;
        letter-spacing: -0.055em;
        line-height: 0.98;
      }
      .marketing-lead {
        max-width: 54ch;
        color: #d6dae0;
        font-size: clamp(1.05rem, 1.5vw, 1.25rem);
        line-height: 1.65;
      }
      .marketing-cta-row {
        margin-top: 30px;
      }
      .marketing-hero-helper {
        margin-top: 16px;
        color: #c0c6cf;
      }
      .marketing-hero-media {
        position: relative;
        padding: 22px;
        border-radius: 28px;
        background: #f8fafc;
        box-shadow: 0 30px 70px rgba(35, 30, 24, 0.2);
      }
      .marketing-hero-media::before {
        content: "";
        position: absolute;
        width: 94px;
        height: 94px;
        right: -24px;
        top: -28px;
        border-radius: 28px;
        background: #ff3340;
        z-index: -1;
      }
      .marketing-hero-media img {
        max-width: 100%;
        border: 0;
        border-radius: 14px;
        background: #111;
      }
      .marketing-image-caption {
        margin: 14px 4px 0;
        color: #aeb5bf;
      }
      .marketing-hero-stats {
        gap: 8px;
      }
      .marketing-hero-stat {
        padding: 10px 12px;
        border: 1px solid #343434;
        border-radius: 10px;
        background: #222;
      }
      .marketing-hero-stat strong {
        margin-bottom: 3px;
        color: #fff;
        font-size: 0.9rem;
      }
      .marketing-hero-stat span {
        color: #aeb5bf;
        font-size: 0.78rem;
      }
      .marketing-home-rows {
        gap: 0;
        margin-top: 0;
        border-top: 1px solid #30343a;
      }
      .marketing-story,
      .marketing-story.is-reverse {
        min-height: 540px;
        grid-template-columns: minmax(0, 1fr) minmax(0, 0.82fr);
        gap: clamp(42px, 8vw, 108px);
        padding: clamp(58px, 8vw, 100px) 0;
        border: 0;
        border-bottom: 1px solid #30343a;
        border-radius: 0;
        background: transparent;
        box-shadow: none;
      }
      .marketing-story-media {
        padding: 20px;
        border-radius: 24px;
        background: #e8e3da;
      }
      .marketing-story-media img {
        border: 0;
        border-radius: 12px;
        background: #111;
        box-shadow: 0 24px 48px rgba(35, 30, 24, 0.14);
      }
      .marketing-story-copy h2 {
        max-width: 12ch;
        margin-bottom: 18px;
        color: #f8fafc;
        font-size: clamp(2.25rem, 4vw, 4rem);
        font-weight: 750;
        letter-spacing: -0.045em;
        line-height: 1.02;
      }
      .marketing-story-copy p:not(.marketing-kicker) {
        color: #625e57;
        font-size: 1.08rem;
        line-height: 1.75;
      }
      .marketing-story .marketing-kicker {
        color: #f8fafc;
      }
      .marketing-live-metrics {
        margin-inline: calc((100vw - min(1320px, calc(100vw - 48px))) / -2);
        padding: clamp(72px, 10vw, 132px) max(24px, calc((100vw - min(1320px, calc(100vw - 48px))) / 2));
        background: #f8fafc;
        color: #f8fafc;
      }
      .marketing-live-metrics-head {
        display: flex;
        justify-content: space-between;
        gap: 20px;
        padding-bottom: 24px;
        border-bottom: 1px solid rgba(255,255,255,0.12);
        color: #c0c6cf;
        font-size: 0.78rem;
      }
      .marketing-live-metrics-head p { margin: 0; }
      .marketing-metrics-status {
        color: #ffb0aa;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .marketing-live-metrics-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 20px;
        padding: 34px 0 clamp(58px, 7vw, 88px);
      }
      .marketing-live-metrics-grid article { min-width: 0; }
      .marketing-live-metrics-grid strong {
        display: block;
        color: #fff;
        font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
        font-size: clamp(2.1rem, 4vw, 4.1rem);
        font-weight: 780;
        letter-spacing: -0.06em;
        line-height: 1;
      }
      .marketing-live-metrics-grid span {
        display: block;
        margin-top: 10px;
        color: #c0c6cf;
        font-size: 0.86rem;
        line-height: 1.45;
      }
      .marketing-vertical-rotation {
        max-width: 1020px;
        margin: 0 auto;
        text-align: center;
      }
      .marketing-vertical-rotation .marketing-kicker { color: #ff8e87; }
      .marketing-vertical-rotation h2 {
        margin: 14px 0 20px;
        color: #fff;
        font-size: clamp(2.45rem, 5.6vw, 5.8rem);
        font-weight: 760;
        letter-spacing: -0.064em;
        line-height: 0.98;
      }
      .marketing-vertical-rotation em {
        position: relative;
        display: inline-block;
        min-width: 0;
        height: 1.05em;
        color: #ff5e55;
        font-family: Georgia, 'Times New Roman', serif;
        font-weight: 400;
        letter-spacing: -0.06em;
        vertical-align: bottom;
      }
      .marketing-vertical-carousel span {
        position: absolute;
        right: 0;
        left: 0;
        opacity: 0;
        animation: vertical-word-cycle calc(var(--vertical-count) * 2.15s) infinite ease-in-out;
        animation-delay: calc(var(--vertical-index) * -2.15s);
      }
      .marketing-vertical-rotation > p:last-child {
        max-width: 64ch;
        margin: 0 auto;
        color: #c0c6cf;
        font-size: 1.03rem;
        line-height: 1.7;
      }
      @keyframes vertical-word-cycle {
        0%, 14% { opacity: 1; transform: translateY(0); }
        20%, 94% { opacity: 0; transform: translateY(-12px); }
        100% { opacity: 0; transform: translateY(10px); }
      }
      .marketing-support {
        display: grid;
        grid-template-columns: minmax(0, 0.94fr) minmax(370px, 0.76fr);
        align-items: center;
        gap: clamp(42px, 9vw, 132px);
        padding: clamp(70px, 10vw, 132px) 0;
        border-bottom: 1px solid #30343a;
      }
      .marketing-support-copy h2 {
        max-width: 11ch;
        margin: 0 0 20px;
        color: #f8fafc;
        font-size: clamp(2.5rem, 4.5vw, 4.5rem);
        font-weight: 760;
        letter-spacing: -0.055em;
        line-height: 1;
      }
      .marketing-support-copy > p:not(.marketing-kicker) {
        max-width: 48ch;
        margin: 0;
        color: #625e57;
        font-size: 1.06rem;
        line-height: 1.72;
      }
      .marketing-support-points {
        display: grid;
        margin: 34px 0 0;
        padding: 0;
        list-style: none;
        border-top: 1px solid #30343a;
      }
      .marketing-support-points li {
        display: grid;
        grid-template-columns: 42px 1fr;
        gap: 14px;
        padding: 18px 0;
        border-bottom: 1px solid #30343a;
      }
      .marketing-support-points > li > span {
        color: #b91c1c;
        font-size: 0.78rem;
        font-weight: 800;
        letter-spacing: 0.08em;
      }
      .marketing-support-points strong { color: #24211e; }
      .marketing-support-points p {
        margin: 5px 0 0;
        color: #716c64;
        font-size: 0.94rem;
        line-height: 1.5;
      }
      .marketing-support-phone {
        width: min(390px, 100%);
        justify-self: center;
        overflow: hidden;
        border: 8px solid #f8fafc;
        border-radius: 34px;
        background: #f8fafc;
        box-shadow: 0 28px 60px rgba(34, 30, 24, 0.23);
      }
      .marketing-phone-head {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 16px;
        background: #075e54;
        color: #fff;
      }
      .marketing-phone-logo {
        width: 36px;
        height: 36px;
        flex: 0 0 auto;
        border-radius: 50%;
        box-sizing: border-box;
        padding: 2px;
        border: 1px solid rgba(255,255,255,0.28);
        background: #050505;
        object-fit: contain;
      }
      .marketing-phone-head strong,
      .marketing-phone-head small { display: block; }
      .marketing-phone-head strong { font-size: 0.92rem; }
      .marketing-phone-head small { margin-top: 2px; color: #d6f4ea; font-size: 0.74rem; }
      .marketing-phone-actions { margin-left: auto; color: #e7f5f0; font-size: 1.05rem; letter-spacing: 0.08em; }
      .marketing-phone-chat {
        display: grid;
        gap: 10px;
        height: 390px;
        padding: 15px 12px 22px;
        overflow-y: auto;
        scrollbar-color: #49635d transparent;
        background: #0b141a;
      }
      .marketing-chat-day {
        margin: 0;
        color: #8fa6a0;
        font-size: 0.7rem;
        font-weight: 800;
        letter-spacing: 0.1em;
        text-align: center;
      }
      .marketing-message {
        max-width: 85%;
        margin: 0;
        padding: 10px 11px 6px;
        border-radius: 12px;
        color: #ecf4f1;
        font-size: 0.85rem;
        line-height: 1.38;
      }
      .marketing-message.is-client { justify-self: end; border-top-right-radius: 3px; background: #005c4b; }
      .marketing-message.is-support { justify-self: start; border-top-left-radius: 3px; background: #202c33; }
      .marketing-message small { display: block; margin-top: 5px; color: rgba(255,255,255,0.62); font-size: 0.64rem; text-align: right; }
      .marketing-phone-input {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 12px;
        background: #202c33;
        color: #aebfba;
        font-size: 0.8rem;
      }
      .marketing-phone-input span { padding-left: 8px; }
      .marketing-phone-input b {
        display: grid;
        width: 31px;
        height: 31px;
        place-items: center;
        border-radius: 50%;
        background: #ff3340;
        color: #fff;
        font-size: 1rem;
      }
      .marketing-control-panel {
        position: relative;
        padding: clamp(58px, 8vw, 100px) 0;
        border-bottom: 1px solid #30343a;
      }
      .marketing-control-panel-intro h2 {
        max-width: 14ch;
        margin: 0 0 18px;
        color: #f8fafc;
        font-size: clamp(2.25rem, 4vw, 4rem);
        font-weight: 750;
        letter-spacing: -0.045em;
        line-height: 1.02;
      }
      .marketing-control-panel-intro > p:not(.marketing-kicker) {
        max-width: 52ch;
        margin: 0;
        color: #625e57;
        font-size: 1.04rem;
        line-height: 1.72;
      }
      .marketing-control-progress {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 12px;
        max-width: 720px;
        margin: 34px 0 clamp(48px, 7vw, 86px);
        color: #b91c1c;
        font-size: 0.76rem;
        font-weight: 800;
        letter-spacing: 0.12em;
      }
      .marketing-control-progress i {
        display: block;
        height: 1px;
        background: linear-gradient(90deg, #ff3340 0 38%, #30343a 38% 100%);
      }
      .marketing-control-stories {
        display: grid;
        gap: clamp(62px, 10vw, 134px);
      }
      .marketing-control-story {
        position: relative;
        display: grid;
        grid-template-columns: minmax(0, 0.78fr) minmax(380px, 1.22fr);
        align-items: center;
        gap: clamp(36px, 7vw, 100px);
        min-height: 500px;
      }
      .marketing-control-story.is-reverse {
        grid-template-columns: minmax(380px, 1.22fr) minmax(0, 0.78fr);
      }
      .marketing-control-story.is-reverse .marketing-control-story-copy { order: 2; }
      .marketing-control-story.is-reverse .marketing-control-story-media { order: 1; }
      .marketing-control-story-copy {
        position: relative;
        z-index: 1;
      }
      .marketing-control-index {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 0 0 16px;
        color: #b91c1c;
        font-size: 0.78rem;
        font-weight: 800;
        letter-spacing: 0.11em;
        text-transform: uppercase;
      }
      .marketing-control-index span {
        display: inline-grid;
        width: 34px;
        height: 34px;
        place-items: center;
        border-radius: 50%;
        background: #ff3340;
        color: #fff;
        font-size: 0.74rem;
      }
      .marketing-control-story h3 {
        max-width: 12ch;
        margin: 0 0 18px;
        color: #f8fafc;
        font-size: clamp(2.15rem, 3.7vw, 3.8rem);
        font-weight: 750;
        letter-spacing: -0.047em;
        line-height: 1.02;
      }
      .marketing-control-story-copy > p:not(.marketing-control-index) {
        margin: 0;
        color: #625e57;
        font-size: 1.05rem;
        line-height: 1.72;
      }
      .marketing-control-story ul {
        display: grid;
        gap: 8px;
        margin: 24px 0 0;
        padding: 0;
        list-style: none;
      }
      .marketing-control-story li {
        display: flex;
        gap: 9px;
        color: #38342f;
        font-size: 0.94rem;
        line-height: 1.45;
      }
      .marketing-control-story li::before {
        content: "↗";
        color: #ff3340;
        font-weight: 800;
      }
      .marketing-control-story-media {
        margin: 0;
      }
      .marketing-control-image-frame {
        position: relative;
        padding: clamp(12px, 2.2vw, 24px);
        border-radius: 28px;
        background: #e8e3da;
        overflow: hidden;
      }
      .marketing-control-image-frame img {
        display: block;
        width: 100%;
        height: auto;
        border-radius: 14px;
        box-shadow: 0 22px 46px rgba(35, 30, 24, 0.17);
        transition: transform 700ms cubic-bezier(.2,.8,.2,1);
      }
      .marketing-control-story:hover .marketing-control-image-frame img { transform: scale(1.018); }
      .marketing-control-story-media figcaption {
        margin: 13px 4px 0;
        color: #716c64;
        font-size: 0.87rem;
        line-height: 1.5;
      }
      .marketing-control-more {
        margin: 32px 0 0;
        text-align: center;
      }
      .marketing-control-more a {
        color: #b91c1c;
        font-weight: 750;
        text-decoration-thickness: 0.12em;
        text-underline-offset: 0.2em;
      }
      @supports (animation-timeline: view()) {
        .marketing-control-story {
          animation: marketing-story-reveal linear both;
          animation-timeline: view();
          animation-range: entry 8% cover 35%;
        }
      }
      @keyframes marketing-story-reveal {
        from { opacity: 0; transform: translateY(30px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .marketing-home-cta {
        margin-top: 0;
        padding: clamp(54px, 7vw, 86px);
        border-radius: 0;
        background: #f8fafc;
        color: #fff;
      }
      .marketing-home-cta.marketing-card h2 {
        max-width: 18ch;
        color: #ffffff;
        font-size: clamp(2rem, 3.5vw, 3.5rem);
        letter-spacing: -0.04em;
      }
      .marketing-home-cta .marketing-kicker {
        color: #ff9ba1;
      }
      .marketing-home-cta p:not(.marketing-kicker) {
        max-width: 55ch;
        color: #c0c6cf;
        line-height: 1.65;
      }
      .marketing-footer {
        margin-top: 0;
        padding: 48px 0;
        border-top: 1px solid #30343a;
        border-radius: 0;
      }
      .marketing-footer-title,
      .marketing-footer p {
        color: #716c64;
      }
      .marketing-footer nav a,
      .marketing-footer-actions a {
        color: #3f3b36;
      }
      .marketing-footer nav a:hover,
      .marketing-footer-actions a:hover {
        color: #d51d22;
      }
      .marketing-card h2,
      .marketing-faq h2,
      .marketing-faq summary,
      .marketing-compare-copy h2,
      .marketing-compare-table strong {
        color: #f8fafc;
      }
      .marketing-card p,
      .marketing-faq p,
      .marketing-compare-row,
      .marketing-compare-copy p {
        color: #625e57;
      }
      .marketing-compare-head {
        color: #777169;
        border-bottom-color: #30343a;
      }
      .marketing-compare-row {
        border-bottom-color: #e6e1d9;
      }
      .marketing-floating-whatsapp {
        padding: 13px 17px;
        border: 0;
        box-shadow: 0 14px 34px rgba(20, 110, 54, 0.25);
        font-weight: 700;
      }
      @media (max-width: 1024px) {
        .marketing-topbar {
          grid-template-columns: auto 1fr auto;
        }
        .marketing-nav {
          grid-column: 1 / -1;
          justify-content: flex-start;
          padding: 2px 0 4px;
        }
      }
      @media (max-width: 920px) {
        .marketing-shell {
          width: min(100% - 28px, 100%);
        }
        .marketing-hero {
          min-height: 0;
          grid-template-columns: 1fr;
          padding: 54px 0 68px;
        }
        .marketing-hero-copy h1 {
          max-width: 11ch;
        }
        .marketing-story,
        .marketing-story.is-reverse {
          min-height: 0;
          grid-template-columns: 1fr;
          gap: 34px;
        }
        .marketing-story.is-reverse .marketing-story-media {
          order: initial;
        }
        .marketing-story.is-reverse .marketing-story-copy {
          order: initial;
        }
        .marketing-control-story,
        .marketing-control-story.is-reverse {
          min-height: 0;
          grid-template-columns: 1fr;
          gap: 34px;
        }
        .marketing-control-story.is-reverse .marketing-control-story-copy,
        .marketing-control-story.is-reverse .marketing-control-story-media {
          order: initial;
        }
        .marketing-live-metrics-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .marketing-support { grid-template-columns: 1fr; gap: 42px; }
      }
      @media (max-width: 640px) {
        html,
        body {
          width: 100%;
          overflow-x: hidden;
        }
        .marketing-shell {
          width: calc(100% - 22px);
          max-width: calc(100vw - 22px);
          padding-top: 0;
        }
        .marketing-topbar {
          min-height: 70px;
          gap: 10px;
        }
        .marketing-brand img {
          width: 40px;
        }
        .marketing-brand p {
          display: none;
        }
        .marketing-auth-links a:not(.is-primary) {
          display: none;
        }
        .marketing-auth-links .is-primary {
          min-height: 40px;
          padding-inline: 14px;
          font-size: 0.86rem;
        }
        .marketing-nav { display: none; }
        .marketing-mobile-menu {
          position: relative;
          display: block;
        }
        .marketing-mobile-menu summary {
          min-height: 40px;
          display: inline-flex;
          align-items: center;
          cursor: pointer;
          color: #3f3b36;
          font-size: 0.86rem;
          font-weight: 750;
          list-style: none;
        }
        .marketing-mobile-menu summary::-webkit-details-marker { display: none; }
        .marketing-mobile-menu summary::after { content: '⌄'; margin-left: 5px; }
        .marketing-mobile-menu nav {
          position: absolute;
          z-index: 30;
          top: calc(100% + 8px);
          right: 0;
          display: grid;
          min-width: 180px;
          padding: 8px;
          border: 1px solid #30343a;
          border-radius: 12px;
          background: #f8fafc;
          box-shadow: 0 18px 42px rgba(35, 30, 24, 0.16);
        }
        .marketing-mobile-menu nav a {
          padding: 10px 12px;
          border-radius: 8px;
          color: #3f3b36;
          font-size: 0.9rem;
          font-weight: 650;
          text-decoration: none;
        }
        .marketing-mobile-menu nav a:hover,
        .marketing-mobile-menu nav a:focus-visible { color: #b91c1c; background: #2b3036; }
        .marketing-nav {
          gap: 14px;
          overflow: visible;
          flex-wrap: wrap;
        }
        .marketing-nav a,
        .marketing-nav-menu summary {
          font-size: 0.86rem;
          white-space: nowrap;
        }
        .marketing-nav-menu-panel {
          right: -1px;
          left: auto;
          max-width: calc(100vw - 22px);
          transform: none;
        }
        .marketing-hero {
          width: 100%;
          max-width: calc(100vw - 22px);
          grid-template-columns: minmax(0, 1fr);
          gap: 42px;
          padding: 44px 0 58px;
          overflow: hidden;
        }
        .marketing-hero-copy h1 {
          width: 100%;
          max-width: calc(100vw - 22px);
          white-space: normal;
          overflow-wrap: normal;
          font-size: clamp(2.45rem, 11.5vw, 3.5rem);
        }
        .marketing-hero-copy,
        .marketing-hero-media,
        .marketing-story,
        .marketing-story-copy,
        .marketing-story-media {
          width: 100%;
          max-width: calc(100vw - 22px);
        }
        .marketing-lead {
          font-size: 1rem;
        }
        .marketing-hero-media {
          padding: 12px;
          border-radius: 18px;
        }
        .marketing-hero-media::before {
          display: none;
        }
        .marketing-hero-stats {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .marketing-hero-stat {
          padding: 8px;
        }
        .marketing-hero-stat span {
          display: none;
        }
        .marketing-story,
        .marketing-story.is-reverse {
          padding: 52px 0;
        }
        .marketing-story-media {
          padding: 10px;
          border-radius: 16px;
        }
        .marketing-story-copy h2 {
          font-size: 2.45rem;
        }
        .marketing-live-metrics {
          margin-inline: -11px;
          padding: 44px 18px 52px;
        }
        .marketing-live-metrics-head { align-items: flex-start; flex-direction: column; gap: 8px; }
        .marketing-live-metrics-grid { gap: 30px 18px; padding: 28px 0 56px; }
        .marketing-live-metrics-grid strong { font-size: 2.35rem; }
        .marketing-live-metrics-grid span { font-size: 0.78rem; }
        .marketing-vertical-rotation h2 { font-size: clamp(2.45rem, 13vw, 3.8rem); }
        .marketing-support { padding: 68px 0; }
        .marketing-support-phone { width: min(100%, 390px); }
        .marketing-control-panel {
          margin: 0;
          padding: 52px 0;
        }
        .marketing-control-progress {
          margin: 28px 0 56px;
        }
        .marketing-control-stories {
          gap: 70px;
        }
        .marketing-control-story h3 {
          font-size: 2.45rem;
        }
        .marketing-control-image-frame {
          padding: 10px;
          border-radius: 18px;
        }
        .marketing-control-image-frame::before {
          top: 8px;
          right: 10px;
          font-size: 0.53rem;
        }
        .marketing-home-cta {
          margin-inline: -11px;
          padding: 46px 24px;
        }
        .marketing-footer {
          padding: 36px 0 76px;
        }
        .marketing-floating-whatsapp {
          right: 12px;
          bottom: 12px;
          padding: 11px 14px;
          font-size: 0;
        }
        .marketing-floating-whatsapp::after {
          content: "WhatsApp";
          font-size: 0.86rem;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .marketing-control-story,
        .marketing-control-image-frame img,
        .marketing-story-media::after,
        .marketing-story-media img,
        .marketing-vertical-rotation em,
        .marketing-vertical-carousel span {
          animation: none;
          transition: none;
        }
        .marketing-vertical-carousel span:not(:first-child) { display: none; }
      }
      /* Public palette: neutral carbon, white typography and red accents. */
      html,
      body {
        background: #111214;
        color: #f8fafc;
      }
      body .marketing-topbar {
        border-bottom-color: #30343a;
        background: rgba(17, 18, 20, 0.94);
      }
      body .marketing-brand strong,
      body .marketing-nav a,
      body .marketing-auth-links a:not(.is-primary),
      body .marketing-hero-copy h1,
      body .marketing-card h2,
      body .marketing-faq h2,
      body .marketing-faq summary,
      body .marketing-compare-copy h2,
      body .marketing-compare-table strong,
      body .marketing-story-copy h2,
      body .marketing-support-copy h2,
      body .marketing-control-panel-intro h2,
      body .marketing-control-story h3 {
        color: #f8fafc;
      }
      body .marketing-brand p,
      body .marketing-lead,
      body .marketing-card p,
      body .marketing-faq p,
      body .marketing-compare-row,
      body .marketing-compare-copy p,
      body .marketing-story-copy p:not(.marketing-kicker),
      body .marketing-support-copy > p:not(.marketing-kicker),
      body .marketing-control-panel-intro > p:not(.marketing-kicker),
      body .marketing-control-story-copy > p:not(.marketing-control-index),
      body .marketing-control-story li,
      body .marketing-footer p,
      body .marketing-footer-title {
        color: #d6dae0;
      }
      body .marketing-home-rows,
      body .marketing-story,
      body .marketing-support,
      body .marketing-control-panel,
      body .marketing-footer,
      body .marketing-support-points,
      body .marketing-support-points li {
        border-color: #30343a;
      }
      body .marketing-story-media,
      body .marketing-control-image-frame {
        background: #1c1f23;
      }
      .marketing-vertical-list {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
        max-width: 760px;
        margin: 0 auto 24px;
        padding: 0;
        list-style: none;
      }
      .marketing-vertical-list li {
        padding: 7px 11px;
        border: 1px solid #464c55;
        border-radius: 999px;
        color: #f8fafc;
        font-size: 0.88rem;
        line-height: 1.2;
      }
      body .marketing-grid .marketing-card,
      body .marketing-faq,
      body .marketing-compare-copy,
      body .marketing-compare-table {
        border: 1px solid #30343a;
        background: #1c1f23;
      }
      body .marketing-card > a {
        border-color: #464c55;
        color: #f8fafc;
      }
      body .marketing-card > a:hover {
        border-color: #ff3340;
        color: #ffffff;
      }
      body .marketing-story .marketing-kicker { color: #ff9ba1; }
      body .marketing-support-points strong { color: #f8fafc; }
      body .marketing-support-points p,
      body .marketing-control-story-media figcaption { color: #aeb5bf; }
      body .marketing-control-progress i {
        background: linear-gradient(90deg, #ff3340 0 38%, #30343a 38% 100%);
      }
      body .marketing-footer nav a,
      body .marketing-footer-actions a { color: #f8fafc; }
      .marketing-brand img {
        transform-origin: center;
        animation: operando-logo-float 3.8s ease-in-out infinite;
      }
      .marketing-brand strong {
        color: #f8fafc;
        display: inline-flex;
        align-items: baseline;
        gap: 0.02em;
      }
      .marketing-brand strong em {
        color: transparent;
        font-style: normal;
        background: linear-gradient(105deg, #ff8f95 0%, #ff3340 42%, #ffffff 67%, #ff3340 100%);
        background-size: 220% 100%;
        -webkit-background-clip: text;
        background-clip: text;
        animation: operando-name-shine 4.6s linear infinite;
      }
      @keyframes operando-logo-float {
        0%, 100% { transform: translateY(0) scale(1); }
        50% { transform: translateY(-3px) scale(1.035); }
      }
      @keyframes operando-name-shine {
        from { background-position: 100% 0; }
        to { background-position: -120% 0; }
      }
      @media (prefers-reduced-motion: reduce) {
        .marketing-brand img,
        .marketing-brand strong em { animation: none; }
      }
      /* Editorial navigation: a clear pricing action plus grouped resources. */
      body .marketing-nav {
        gap: 18px;
        padding: 0;
        border: 0;
        border-radius: 0;
        background: transparent;
        box-shadow: none;
      }
      body .marketing-nav > a,
      body .marketing-nav-menu summary {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 36px;
        padding: 0 1px;
        border-radius: 0;
        color: #edf0f4;
        font-size: 0.86rem;
        font-weight: 700;
        line-height: 1;
        text-decoration: none;
        transition: color 160ms ease, border-color 160ms ease, background 160ms ease;
      }
      body .marketing-nav > a:hover,
      body .marketing-nav > a:focus-visible,
      body .marketing-nav-menu summary:hover,
      body .marketing-nav-menu summary:focus-visible {
        color: #ff6a72;
        background: transparent;
        outline: none;
      }
      body .marketing-nav > a[href="/precios/"] {
        margin-left: 2px;
        padding: 0 13px;
        border-radius: 8px;
        background: #f8fafc;
        color: #111214;
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18);
      }
      body .marketing-nav > a[href="/precios/"]:hover,
      body .marketing-nav > a[href="/precios/"]:focus-visible {
        background: #ff3340;
        color: #ffffff;
      }
      body .marketing-nav-menu summary::after {
        content: '⌄';
        margin: 0 0 0 5px;
        color: currentColor;
        font-size: 0.9rem;
        font-weight: 500;
      }
      body .marketing-nav-menu[open] summary {
        color: #ff6a72;
        background: transparent;
      }
      body .marketing-nav-menu[open] summary::after { content: '⌃'; }
      body .marketing-nav-menu-panel {
        top: calc(100% + 10px);
        left: auto;
        right: 0;
        min-width: 248px;
        padding: 6px;
        transform: none;
        border-color: #3d424a;
        border-radius: 16px;
        background: #1b1e22;
        box-shadow: 0 18px 42px rgba(0, 0, 0, 0.42);
      }
      body .marketing-nav-menu-panel a {
        padding: 11px 12px;
        color: #edf0f4;
        font-size: 0.88rem;
        font-weight: 650;
      }
      body .marketing-nav-menu-panel a:hover,
      body .marketing-nav-menu-panel a:focus-visible {
        color: #ffffff;
        background: #30343a;
        outline: none;
      }
      /* Home-page contrast pass: every dark surface carries light type. */
      body .marketing-hero-media,
      body .marketing-story-media {
        background: #1c1f23;
        box-shadow: 0 24px 54px rgba(0, 0, 0, 0.28);
      }
      body .marketing-live-metrics,
      body .marketing-home-cta {
        background: #17191d;
        color: #f8fafc;
        border-top: 1px solid #30343a;
        border-bottom: 1px solid #30343a;
      }
      body .marketing-live-metrics-head,
      body .marketing-live-metrics-grid span,
      body .marketing-vertical-rotation > p:last-child,
      body .marketing-home-cta p:not(.marketing-kicker) {
        color: #d6dae0;
      }
      body .marketing-live-metrics-grid strong,
      body .marketing-vertical-rotation h2,
      body .marketing-home-cta.marketing-card h2 {
        color: #f8fafc;
      }
      body .marketing-story-copy p:not(.marketing-kicker),
      body .marketing-support-copy > p:not(.marketing-kicker),
      body .marketing-support-points p,
      body .marketing-card p,
      body .marketing-faq p,
      body .marketing-compare-row,
      body .marketing-compare-copy p {
        color: #d6dae0;
      }
      body .marketing-support-points strong,
      body .marketing-footer nav a,
      body .marketing-footer-actions a {
        color: #f8fafc;
      }
      body .marketing-footer-title,
      body .marketing-footer p,
      body .marketing-compare-head {
        color: #c0c6cf;
      }
      body .marketing-compare-row { border-bottom-color: #30343a; }

      /* --- Home redesign: scoped to body[data-page="home"] only, does not affect the 30+ SEO pages sharing this stylesheet --- */
      body[data-page="home"] { position: relative; }
      body[data-page="home"]::before {
        content: '';
        position: fixed;
        top: 0; left: 0;
        height: 3px;
        width: var(--op-scroll, 0%);
        background: linear-gradient(90deg, #ff3340, #ff8a65);
        z-index: 9999;
        transition: width 0.12s linear;
      }
      body[data-page="home"] .marketing-hero {
        position: relative;
        display: grid;
        grid-template-columns: 1.05fr 1fr;
        align-items: center;
        gap: 48px;
        padding-top: 28px;
        overflow: visible;
      }
      body[data-page="home"] .marketing-hero::before {
        content: '';
        position: absolute;
        top: -140px;
        right: -80px;
        width: 460px;
        height: 460px;
        background: radial-gradient(circle, rgba(255,51,64,0.22), transparent 70%);
        filter: blur(10px);
        z-index: -1;
        pointer-events: none;
      }
      body[data-page="home"] .marketing-kicker {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 14px;
        border: 1px solid rgba(255,51,64,0.35);
        border-radius: 999px;
        background: rgba(255,51,64,0.08);
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #ff8a80;
      }
      body[data-page="home"] .marketing-kicker::before {
        content: '';
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #ff3340;
        box-shadow: 0 0 0 3px rgba(255,51,64,0.25);
      }
      body[data-page="home"] .marketing-hero-copy h1 {
        font-size: clamp(2.6rem, 4.6vw, 4.1rem);
        line-height: 0.98;
        letter-spacing: -0.02em;
        margin: 18px 0 16px;
        background: linear-gradient(135deg, #ffffff 45%, #ffb4ac 78%, #ff3340 100%);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        color: #fff;
      }
      body[data-page="home"] .marketing-lead {
        max-width: 46ch;
        font-size: 1.08rem;
        line-height: 1.6;
        color: rgba(243,244,246,0.78);
      }
      body[data-page="home"] .marketing-cta-row .is-primary {
        position: relative;
        overflow: hidden;
        box-shadow: 0 14px 34px rgba(255,51,64,0.32);
        transition: transform 0.25s ease, box-shadow 0.25s ease;
      }
      body[data-page="home"] .marketing-cta-row .is-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 18px 42px rgba(255,51,64,0.44);
      }
      body[data-page="home"] .marketing-cta-row a:not(.is-primary) {
        position: relative;
        transition: color 0.2s ease;
      }
      body[data-page="home"] .marketing-cta-row a:not(.is-primary)::after {
        content: '';
        position: absolute;
        left: 0; bottom: -4px;
        width: 0%;
        height: 1px;
        background: #ff8a80;
        transition: width 0.25s ease;
      }
      body[data-page="home"] .marketing-cta-row a:not(.is-primary):hover::after { width: 100%; }
      body[data-page="home"] .marketing-hero-media {
        position: relative;
        border-radius: 24px;
        border: 1px solid rgba(255,255,255,0.08);
        overflow: hidden;
        transition: transform 0.4s ease;
      }
      body[data-page="home"] .marketing-hero-media::after {
        content: '';
        position: absolute;
        inset: -1px;
        border-radius: 24px;
        background: radial-gradient(circle at 30% 10%, rgba(255,51,64,0.18), transparent 55%);
        pointer-events: none;
        z-index: 1;
      }
      body[data-page="home"] .marketing-hero-media img { transition: transform 0.5s ease; }
      body[data-page="home"] .marketing-hero-media:hover img { transform: scale(1.015); }
      body[data-page="home"] .marketing-hero-stats { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 16px; }
      body[data-page="home"] .marketing-hero-stat {
        flex: 1;
        min-width: 130px;
        padding: 12px 14px;
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,0.08);
        background: rgba(255,255,255,0.03);
        transition: transform 0.25s ease, border-color 0.25s ease;
      }
      body[data-page="home"] .marketing-hero-stat:hover {
        transform: translateY(-3px);
        border-color: rgba(255,51,64,0.4);
      }
      body[data-page="home"] .marketing-section-intro h2 {
        font-size: clamp(1.9rem, 3.2vw, 2.6rem);
        letter-spacing: -0.01em;
      }
      body[data-page="home"] .marketing-story,
      body[data-page="home"] .marketing-live-metrics,
      body[data-page="home"] .marketing-support,
      body[data-page="home"] .marketing-control-story,
      body[data-page="home"] .marketing-home-cta {
        transition: transform 0.25s ease;
      }
      body[data-page="home"] .marketing-story-media img,
      body[data-page="home"] .marketing-control-image-frame img {
        border-radius: 18px;
        transition: transform 0.4s ease;
      }
      body[data-page="home"] .marketing-story:hover .marketing-story-media img,
      body[data-page="home"] .marketing-control-story:hover .marketing-control-image-frame img {
        transform: scale(1.02);
      }
      body[data-page="home"] .marketing-live-metrics-grid article {
        position: relative;
        border-radius: 16px;
        transition: transform 0.25s ease, box-shadow 0.25s ease;
      }
      body[data-page="home"] .marketing-live-metrics-grid article::before {
        content: '';
        position: absolute;
        top: 0; left: 14px; right: 14px;
        height: 2px;
        background: linear-gradient(90deg, #ff3340, transparent);
        border-radius: 2px;
      }
      body[data-page="home"] .marketing-live-metrics-grid article:hover {
        transform: translateY(-4px);
        box-shadow: 0 20px 45px rgba(0,0,0,0.35);
      }
      body[data-page="home"] .marketing-counter {
        background: linear-gradient(135deg, #ffffff, #ff8a80);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      body[data-page="home"] .marketing-home-cta {
        position: relative;
        overflow: hidden;
        border-radius: 28px;
      }
      body[data-page="home"] .marketing-home-cta::before {
        content: '';
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at 85% 20%, rgba(255,51,64,0.25), transparent 55%);
        pointer-events: none;
      }
      @media (prefers-reduced-motion: no-preference) {
        body[data-page="home"] .marketing-story,
        body[data-page="home"] .marketing-live-metrics,
        body[data-page="home"] .marketing-support,
        body[data-page="home"] .marketing-control-story,
        body[data-page="home"] .marketing-home-cta {
          opacity: 0;
          transform: translateY(26px);
          transition: opacity 0.7s ease, transform 0.7s ease;
        }
        body[data-page="home"] .is-revealed {
          opacity: 1 !important;
          transform: none !important;
        }
      }
      @media (max-width: 860px) {
        body[data-page="home"] .marketing-hero { grid-template-columns: 1fr; }
        body[data-page="home"] .marketing-hero-stats { flex-direction: column; }
      }
`

const renderMarketingPage = (page) => {
  const structuredData = JSON.stringify(buildSoftwareJsonLd(page))
  const organizationData = JSON.stringify(buildOrganizationJsonLd())
  const faqData = buildFaqJsonLd(page)
  const breadcrumbData = buildBreadcrumbJsonLd(page)
  const articleData = buildArticleJsonLd(page)
  const pageSupportUrl = `https://wa.me/5491135708345?text=${encodeURIComponent(page.whatsAppPrompt || 'Hola Operando, quiero informacion de operando.app.')}`
  const faqSection = renderFaq(page.faq || [])
  const downloadSection = page.slug ? renderDownloads(page.downloads || []) : ''
  const sections = page.slug ? renderSectionCards(page.sections || []) : ''
  const comparisonSection = renderComparison(page.comparison)
  const homeExtras = renderHomeExtras(page)
  const canonical = pageUrl(page.slug)
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="${escapeHtml(page.description)}" />
    <meta name="keywords" content="sistema de ventas, control de stock, sistema de caja, software para comercios, sistema para kioscos, software para tiendas, operando.app" />
    <meta name="robots" content="index,follow" />
    <link rel="canonical" href="${canonical}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(page.seoTitle)}" />
    <meta property="og:description" content="${escapeHtml(page.description)}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${siteOrigin}/operando-logo.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(page.seoTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(page.description)}" />
    <meta name="twitter:image" content="${siteOrigin}/operando-logo.png" />
    <link rel="icon" type="image/png" href="/favicon.png?v=operando-20260831" />
    <link rel="shortcut icon" type="image/png" href="/favicon.png?v=operando-20260831" />
    <title>${escapeHtml(page.seoTitle)}</title>
    <style>${marketingStyles}</style>
    ${gtmHeadSnippet}
    <script type="application/ld+json">${structuredData}</script>
    <script type="application/ld+json">${organizationData}</script>
    ${faqData ? `<script type="application/ld+json">${JSON.stringify(faqData)}</script>` : ''}
    ${breadcrumbData ? `<script type="application/ld+json">${JSON.stringify(breadcrumbData)}</script>` : ''}
    ${articleData ? `<script type="application/ld+json">${JSON.stringify(articleData)}</script>` : ''}
  </head>
  <body data-page="${page.slug ? escapeHtml(page.slug) : 'home'}">
    ${gtmBodySnippet}
    <div class="marketing-shell">
      ${renderTopbar(page)}
      <main>
        <section class="marketing-hero">
          <div class="marketing-hero-copy">
            <p class="marketing-kicker">${escapeHtml(page.kicker)}</p>
            <h1>${escapeHtml(page.h1)}</h1>
            <p class="marketing-lead">${escapeHtml(page.lead)}</p>
            ${page.slug ? `
            <div class="marketing-cta-row">
              <a class="is-primary" data-analytics="hero_start_trial" href="${page.primaryCta?.href || signupPath}">${escapeHtml(page.primaryCta?.label || 'Probar gratis')}</a>
              <a data-analytics="header_login" href="${page.secondaryCta?.href || loginPath}">${escapeHtml(page.secondaryCta?.label || 'Iniciar sesion')}</a>
              ${page.tertiaryCta ? `<a data-analytics="hero_demo" href="${page.tertiaryCta.href}" target="_blank" rel="noreferrer">${escapeHtml(page.tertiaryCta.label)}</a>` : ''}
            </div>
            <ul class="marketing-badges">
              ${(page.featureList || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
            </ul>` : `
            <div class="marketing-cta-row">
              <a class="is-primary" data-analytics="hero_start_trial" href="${page.primaryCta?.href || signupPath}">${escapeHtml(page.primaryCta?.label || 'Probar gratis')}</a>
            </div>
            <p class="marketing-hero-helper">¿Ya tenés cuenta? <a data-analytics="hero_login_inline" href="${loginPath}">Iniciá sesión</a>.</p>`}
          </div>
          <aside class="marketing-hero-media">
            <img src="${page.image}" alt="${escapeHtml(page.imageAlt || page.h1)}" width="1200" height="630" loading="eager" fetchpriority="high" />
            <p class="marketing-image-caption">${escapeHtml(page.imageCaption || 'Vista real del sistema con ventas, stock, caja y control comercial desde una sola web.')}</p>
            ${!page.slug ? renderHeroStats(page.stats || []) : ''}
          </aside>
        </section>
        ${homeExtras}
        ${sections}
        ${comparisonSection}
        ${downloadSection}
      ${faqSection}
      </main>
      ${renderFooter()}
    </div>
    <a href="${pageSupportUrl}" class="marketing-floating-whatsapp" target="_blank" rel="noreferrer" data-analytics="whatsapp_support">Hablar por WhatsApp</a>
    <script>
      const demoForm = document.querySelector('[data-demo-form]');
      if (demoForm) {
        demoForm.addEventListener('submit', function (event) {
          event.preventDefault();
          const data = new FormData(demoForm);
          const parts = [
            'Hola Operando, quiero solicitar una demo de operando.app.',
            data.get('nombre') ? 'Nombre: ' + data.get('nombre') : '',
            data.get('comercio') ? 'Comercio: ' + data.get('comercio') : '',
            data.get('whatsapp') ? 'WhatsApp: ' + data.get('whatsapp') : '',
            data.get('rubro') ? 'Rubro: ' + data.get('rubro') : '',
            data.get('cajas') ? 'Cajas: ' + data.get('cajas') : ''
          ].filter(Boolean);
          const href = 'https://wa.me/5491135708345?text=' + encodeURIComponent(parts.join('\\n'));
          if (Array.isArray(window.dataLayer)) {
            window.dataLayer.push({
              event: 'generate_lead',
              page_title: document.title,
              page_location: window.location.href
            });
          }
          window.open(href, '_blank', 'noopener,noreferrer');
        });
      }
      document.querySelectorAll('[data-analytics]').forEach(function (element) {
        element.addEventListener('click', function () {
          if (Array.isArray(window.dataLayer)) {
            window.dataLayer.push({
              event: element.getAttribute('data-analytics'),
              page_title: document.title,
              page_location: window.location.href
            });
          }
        });
      });
      const formatPublicMetric = function (value) {
        return new Intl.NumberFormat('es-AR').format(value);
      };
      const animatedCounters = Array.from(document.querySelectorAll('[data-counter-value]')).map(function (counter) {
        const target = Number(counter.dataset.counterValue || 0);
        const prefix = counter.dataset.counterPrefix || '';
        const suffix = counter.dataset.counterSuffix || '';
        const format = counter.dataset.counterFormat || 'integer';
        const update = function (progress) {
          const value = Math.round(target * progress);
          const displayedValue = format === 'millions' ? Math.round(value / 1000000) : value;
          counter.textContent = prefix + formatPublicMetric(displayedValue) + suffix;
        };
        update(target ? 1 : 0);
        if (!target) {
          update(1);
          return null;
        }
        return { update: update, target: target };
      }).filter(Boolean);
      const metricsGrid = document.querySelector('.marketing-live-metrics-grid');
      if (metricsGrid && animatedCounters.length) {
        let isAnimating = false;
        let hasCompleted = false;
        const observer = new IntersectionObserver(function (entries) {
          const isVisible = entries.some(function (entry) { return entry.isIntersecting; });
          if (!isVisible) {
            isAnimating = false;
            hasCompleted = false;
            animatedCounters.forEach(function (counter) { counter.update(1); });
            return;
          }
          if (isAnimating || hasCompleted) return;
          isAnimating = true;
          const startedAt = performance.now();
          const duration = 1600;
          const tick = function (now) {
            const progress = Math.min(1, (now - startedAt) / duration);
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            animatedCounters.forEach(function (counter) { counter.update(easedProgress); });
            if (progress < 1) requestAnimationFrame(tick);
            else {
              isAnimating = false;
              hasCompleted = true;
            }
          };
          requestAnimationFrame(tick);
        }, { threshold: 0.45, rootMargin: '0px 0px -35% 0px' });
        observer.observe(metricsGrid);
      }
      if (document.body.dataset.page === 'home') {
        const updateScrollProgress = function () {
          const doc = document.documentElement;
          const max = doc.scrollHeight - doc.clientHeight;
          const ratio = max > 0 ? Math.min(1, Math.max(0, doc.scrollTop / max)) : 0;
          doc.style.setProperty('--op-scroll', (ratio * 100) + '%');
        };
        updateScrollProgress();
        window.addEventListener('scroll', updateScrollProgress, { passive: true });
        window.addEventListener('resize', updateScrollProgress);
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          const revealTargets = document.querySelectorAll('.marketing-story, .marketing-live-metrics, .marketing-support, .marketing-control-story, .marketing-home-cta');
          const revealObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
              if (entry.isIntersecting) {
                entry.target.classList.add('is-revealed');
                revealObserver.unobserve(entry.target);
              }
            });
          }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });
          revealTargets.forEach(function (el) { revealObserver.observe(el); });
        }
      }
      const vertical = document.querySelector('[data-vertical-rotation]');
      if (vertical && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        let verticals = [];
        try { verticals = JSON.parse(vertical.dataset.verticals || '[]'); } catch (error) { verticals = []; }
        if (verticals.length > 1) {
          let index = 0;
          window.setInterval(function () {
            index = (index + 1) % verticals.length;
            vertical.classList.remove('is-changing');
            void vertical.offsetWidth;
            vertical.textContent = verticals[index];
            vertical.classList.add('is-changing');
          }, 2600);
        }
      }
    </script>
  </body>
</html>
`.replace(/[ \t]+$/gm, '')
}

const appHtml = (entry = 'panel') => `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Acceso a operando.app para operar ventas, caja, stock, clientes, compras y comprobantes." />
    <meta name="robots" content="noindex,nofollow" />
    <meta name="referrer" content="strict-origin-when-cross-origin" />
    <meta http-equiv="Permissions-Policy" content="camera=(), microphone=(), geolocation=(), interest-cohort=()" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' https://esm.sh https://challenges.cloudflare.com https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://rfwsnqmjkclxhbmidbkm.supabase.co https://www.google-analytics.com; frame-src https://challenges.cloudflare.com https://www.google.com https://www.googletagmanager.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none';" />
    <link rel="canonical" href="${siteOrigin}${entry === 'login' ? loginPath : entry === 'signup' ? signupPath : entry === 'recovery' ? recoveryPath : entry === 'reset' ? resetPasswordPath : panelPath}" />
    <link rel="icon" type="image/png" href="/favicon.png?v=operando-20260831" />
    <link rel="shortcut icon" type="image/png" href="/favicon.png?v=operando-20260831" />
    <link rel="stylesheet" href="/app.css?v=${assetVersion}" />
    ${gtmHeadSnippet}
    <title>${entry === 'panel' || entry === 'legacy' ? 'Panel | Operando' : entry === 'reset' ? 'Restablecer clave | Operando' : entry === 'recovery' ? 'Recuperar clave | Operando' : entry === 'signup' ? 'Crear cuenta | Operando' : 'Ingresar | Operando'}</title>
    <style>
      html, body {
        margin: 0;
        min-height: 100%;
        background: linear-gradient(180deg, #050505 0%, #0b0b0b 100%);
      }
      body[data-booting='true'] {
        overflow: hidden;
      }
      #app {
        min-height: 100vh;
      }
      #boot-status {
        position: fixed;
        inset: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        background: linear-gradient(180deg, #050505 0%, #0b0b0b 100%);
        color: #f3f4f6;
        font-family: Arial, sans-serif;
        z-index: 9999;
      }
      .boot-card {
        width: min(560px, 100%);
        padding: 28px;
        border-radius: 24px;
        border: 1px solid rgba(255,255,255,0.08);
        background: rgba(17, 17, 17, 0.96);
        box-shadow: 0 20px 60px rgba(0,0,0,0.35);
      }
      .boot-card strong {
        display: block;
        margin-bottom: 10px;
        font-size: 28px;
      }
      .boot-card p {
        margin: 0;
        color: #9ca3af;
        line-height: 1.5;
      }
      .boot-card p + p {
        margin-top: 10px;
      }
      .boot-card.is-error strong {
        color: #ff5a4f;
      }
    </style>
  </head>
  <body data-booting="true">
    ${gtmBodySnippet}
    <div id="app"></div>
    <div id="boot-status">
      <div class="boot-card">
        <strong>Operando</strong>
        <p>Cargando sistema...</p>
      </div>
    </div>
    <script>
      window.__operandoEntry = ${JSON.stringify(entry)};
      window.__operandoAppEntry = ${entry === 'panel' || entry === 'legacy'};
      window.__operandoBooted = false;
      window.__operandoBootError = null;
      try {
        if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
      } catch (error) {}
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      window.addEventListener('error', function (event) {
        window.__operandoBootError = event && event.message ? event.message : 'Error inesperado al iniciar la aplicacion.';
      });
      window.addEventListener('unhandledrejection', function (event) {
        var reason = event && event.reason;
        window.__operandoBootError = reason && reason.message ? reason.message : 'Fallo una promesa al iniciar la aplicacion.';
      });
      window.addEventListener('pageshow', function () {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      });
      window.setTimeout(function () {
        if (window.__operandoBooted) return;
        var shell = document.getElementById('boot-status');
        if (!shell) return;
        var message = window.__operandoBootError || 'La aplicacion no termino de cargar. Proba recargar con Ctrl + F5.';
        shell.innerHTML = '<div class="boot-card is-error"><strong>No se pudo iniciar</strong><p>' + message + '</p><p>Si sigue igual, avisame y reviso el error puntual.</p></div>';
      }, 4000);
    </script>
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"></script>
    <script type="module" src="/app.js?v=${assetVersion}"></script>
  </body>
</html>
`

const pageEntries = marketingPages.map((page) => ({
  pathname: page.slug ? `/${page.slug}/` : '/',
  html: renderMarketingPage(page),
  filePath: page.slug ? `${page.slug}/index.html` : 'index.html',
  cacheControl: 'public, max-age=300',
}))

const panelSections = ['', 'clientes', 'ventas', 'caja', 'catalogo', 'compras', 'facturacion', 'servicios', 'informes', 'actividad', 'configuracion', 'consola', 'sucursales', 'cajeros']
for (const section of panelSections) {
  pageEntries.push({
    pathname: `${panelPath}${section ? `${section}/` : ''}`,
    html: appHtml('panel'),
    filePath: `panel/${section ? `${section}/` : ''}index.html`,
    cacheControl: 'no-store',
  })
}
for (const section of ['', 'clientes', 'ventas', 'caja-diaria', 'productos', 'compras', 'facturacion', 'tickets', 'reportes', 'auditoria', 'ajustes', 'mi-admin', 'sucursales', 'cajeros']) {
  pageEntries.push({
    pathname: `${legacyAppPath}${section ? `${section}/` : ''}`,
    html: appHtml('legacy'),
    filePath: `app/${section ? `${section}/` : ''}index.html`,
    cacheControl: 'no-store',
  })
}
for (const [pathname, entry] of [[loginPath, 'login'], [signupPath, 'signup'], [recoveryPath, 'recovery'], [resetPasswordPath, 'reset']]) {
  pageEntries.push({ pathname, html: appHtml(entry), filePath: `${pathname.slice(1)}index.html`, cacheControl: 'no-store' })
}

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pageEntries.filter((entry) => !entry.pathname.startsWith(panelPath) && !entry.pathname.startsWith(legacyAppPath) && ![loginPath, signupPath, recoveryPath, resetPasswordPath].includes(entry.pathname)).map((entry) => `  <url>
    <loc>${siteOrigin}${entry.pathname}</loc>
    <changefreq>${entry.pathname === '/' ? 'weekly' : 'monthly'}</changefreq>
    <priority>${entry.pathname === '/' ? '1.0' : '0.8'}</priority>
  </url>`).join('\n')}
</urlset>
`

const robotsTxt = `User-agent: *
Allow: /
Disallow: /app/
Disallow: /panel/
Disallow: /ingresar/
Disallow: /crear-cuenta/
Disallow: /recuperar-clave/
Disallow: /restablecer-clave/
Disallow: /admin/

Sitemap: ${siteOrigin}/sitemap.xml
`

const htmlIndex = Object.fromEntries(pageEntries.map((entry) => [entry.pathname, entry]))

const serverCode = `const appCss = ${JSON.stringify(stylesCss)};
const appJs = ${JSON.stringify(builtClientJs)};
const dataStore = ${JSON.stringify(builtDataStoreJs)};
const cloudSync = ${JSON.stringify(cloudSyncJs)};
const cloudAuth = ${JSON.stringify(cloudAuthJs)};
const cloudCore = ${JSON.stringify(cloudCoreJs)};
const cloudConfig = ${JSON.stringify(cloudConfigJson)};
const favicon = ${JSON.stringify(faviconSvg)};
const robots = ${JSON.stringify(robotsTxt)};
const sitemap = ${JSON.stringify(sitemapXml)};
const pages = ${JSON.stringify(Object.fromEntries(pageEntries.map((entry) => [entry.pathname, { html: entry.html, cacheControl: entry.cacheControl }])))};

const asset = (body, contentType) =>
  new Response(body, {
    headers: {
      'content-type': contentType,
      'cache-control': 'public, max-age=300',
    },
  });

const page = (html, cacheControl = 'public, max-age=300') =>
  new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': cacheControl,
    },
  });

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const pathname = url.pathname.endsWith('/') ? url.pathname : \`\${url.pathname}/\`;

    if (url.pathname === '/app.css') return asset(appCss, 'text/css; charset=utf-8');
    if (url.pathname === '/app.js') return asset(appJs, 'application/javascript; charset=utf-8');
    if (url.pathname === '/data-store.js') return asset(dataStore, 'application/javascript; charset=utf-8');
    if (url.pathname === '/cloud-sync.js') return asset(cloudSync, 'application/javascript; charset=utf-8');
    if (url.pathname === '/cloud-auth.js') return asset(cloudAuth, 'application/javascript; charset=utf-8');
    if (url.pathname === '/cloud-core.js') return asset(cloudCore, 'application/javascript; charset=utf-8');
    if (url.pathname === '/cloud-config.json') return asset(cloudConfig, 'application/json; charset=utf-8');
    if (url.pathname === '/favicon.svg') return asset(favicon, 'image/svg+xml; charset=utf-8');
    if (url.pathname === '/robots.txt') return asset(robots, 'text/plain; charset=utf-8');
    if (url.pathname === '/sitemap.xml') return asset(sitemap, 'application/xml; charset=utf-8');

    if (pages[url.pathname]) return page(pages[url.pathname].html, pages[url.pathname].cacheControl);
    if (pages[pathname]) return page(pages[pathname].html, pages[pathname].cacheControl);

    return new Response(null, {
      status: 302,
      headers: { location: '/' },
    });
  },
};
`

const writePageTree = async (baseDir) => {
  for (const entry of pageEntries) {
    const fullPath = path.join(baseDir, entry.filePath)
    await mkdir(path.dirname(fullPath), { recursive: true })
    await writeFile(fullPath, entry.html)
  }
}

const copyDirectory = async (sourceDir, targetDir) => {
  await mkdir(targetDir, { recursive: true })
  const entries = await readdir(sourceDir, { withFileTypes: true })
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name)
    const targetPath = path.join(targetDir, entry.name)
    if (entry.isDirectory()) await copyDirectory(sourcePath, targetPath)
    else await copyFile(sourcePath, targetPath)
  }
}

await rm(dist, { recursive: true, force: true })
await mkdir(serverDir, { recursive: true })

await writePageTree(dist)
await writeFile(path.join(dist, 'app.css'), stylesCss)
await writeFile(path.join(dist, 'app.js'), builtClientJs)
await writeFile(path.join(dist, 'data-store.js'), builtDataStoreJs)
await writeFile(path.join(dist, 'cloud-sync.js'), cloudSyncJs)
await writeFile(path.join(dist, 'cloud-auth.js'), cloudAuthJs)
await writeFile(path.join(dist, 'cloud-core.js'), cloudCoreJs)
await writeFile(path.join(dist, 'cloud-config.json'), cloudConfigJson)
await writeFile(path.join(dist, 'robots.txt'), robotsTxt)
await writeFile(path.join(dist, 'sitemap.xml'), sitemapXml)
await writeFile(path.join(dist, 'CNAME'), cnameFile)
await writeFile(path.join(serverDir, 'index.js'), serverCode)
await copyDirectory(path.join(root, 'public'), dist)

if (!isDevBuild) {
  await writePageTree(root)
  await writeFile(path.join(root, 'app.css'), stylesCss)
  await writeFile(path.join(root, 'app.js'), builtClientJs)
  await writeFile(path.join(root, 'data-store.js'), builtDataStoreJs)
  await writeFile(path.join(root, 'cloud-sync.js'), cloudSyncJs)
  await writeFile(path.join(root, 'cloud-auth.js'), cloudAuthJs)
  await writeFile(path.join(root, 'cloud-core.js'), cloudCoreJs)
  await writeFile(path.join(root, 'cloud-config.json'), cloudConfigJson)
  await writeFile(path.join(root, 'robots.txt'), robotsTxt)
  await writeFile(path.join(root, 'sitemap.xml'), sitemapXml)
  await writeFile(path.join(root, 'CNAME'), cnameFile)
  await copyDirectory(path.join(root, 'public'), root)
}
