import { mkdir, readFile, readdir, rm, writeFile, copyFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const dist = path.join(root, 'dist')
const serverDir = path.join(dist, 'server')
const buildTarget = (process.argv[2] || process.env.PCLAF_ENV || 'prod').toLowerCase()
const isDevBuild = buildTarget === 'dev'
const selectedCloudConfigFile = isDevBuild ? 'cloud-config.dev.json' : 'cloud-config.prod.json'
const siteOrigin = 'https://www.pclafcontrol.com.ar'
const appPath = '/app/'
const supportUrl = 'https://wa.me/5491135708345?text=Hola%20PCLAF%2C%20quiero%20informacion%20de%20PCLAF%20Control.'
const gaMeasurementId = String(process.env.PCLAF_GA4_ID || 'G-R0TVQX7DJJ').trim()

const clientJs = await readFile(path.join(root, 'site', 'client.js'), 'utf8')
const dataStoreJs = await readFile(path.join(root, 'site', 'data-store.js'), 'utf8')
const cloudSyncJs = await readFile(path.join(root, 'site', 'cloud-sync.js'), 'utf8')
const cloudAuthJs = await readFile(path.join(root, 'site', 'cloud-auth.js'), 'utf8')
const cloudCoreJs = await readFile(path.join(root, 'site', 'cloud-core.js'), 'utf8')
const stylesCss = await readFile(path.join(root, 'site', 'styles.css'), 'utf8')
const cloudConfigJson = await readFile(path.join(root, 'site', selectedCloudConfigFile), 'utf8')
const assetVersion = createHash('sha256').update(`${clientJs}${cloudAuthJs}${stylesCss}${cloudConfigJson}`).digest('hex').slice(0, 12)
const releaseRevision = String(process.env.GITHUB_SHA || process.env.PCLAF_RELEASE_VERSION || assetVersion).trim().slice(0, 12)
const releaseVersion = `v${releaseRevision}`
const builtClientJs = clientJs.replaceAll('__PCLAF_RELEASE_VERSION__', releaseVersion)
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
      name: 'PCLAF Control',
      logo: {
        '@type': 'ImageObject',
        url: `${siteOrigin}/favicon.svg`,
      },
    },
    author: {
      '@type': 'Organization',
      name: 'PCLAF Control',
    },
    datePublished: '2026-07-21',
    dateModified: '2026-07-21',
  }
}

const topLinks = [
  { href: '/funciones/', label: 'Funciones' },
  { href: '/precios/', label: 'Gratis' },
  { href: '/preguntas-frecuentes/', label: 'FAQ' },
]

const footerLinks = [
  { href: '/sistema-de-ventas/', label: 'Sistema de ventas' },
  { href: '/control-de-stock/', label: 'Control de stock' },
  { href: '/sistema-de-caja/', label: 'Sistema de caja' },
  { href: '/gestion-de-clientes/', label: 'Gestion de clientes' },
  { href: '/software-para-servicio-tecnico/', label: 'Servicio tecnico' },
  { href: '/blog/como-controlar-stock/', label: 'Blog' },
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
    eyebrow: 'Ventas y caja',
    title: 'Vende y cobra rapido',
    body: 'Registra ventas, combina medios de pago y controla la caja del dia desde una pantalla clara, pensada para atender sin demoras.',
    image: '/pclaf-control-punto-venta-real.png',
    alt: 'Punto de venta real de PCLAF Control',
  },
  {
    eyebrow: 'Productos y stock',
    title: 'Controla stock sin planillas',
    body: 'Carga productos, recibe alertas de faltantes y, si ya tienes una planilla, nuestro equipo te ayuda a migrarla.',
    image: '/pclaf-control-stock-real.png',
    alt: 'Catalogo y stock real de PCLAF Control',
    reverse: true,
  },
  {
    eyebrow: 'Siempre disponible',
    title: 'Entra desde PC o celular',
    body: 'Trabaja desde cualquier navegador, sin instalar programas y con la informacion del negocio disponible cuando la necesitas.',
    image: '/pclaf-control-mobile-devices.png',
    alt: 'PCLAF Control en tablet y telefono',
  },
]

const marketingSectors = [
  { title: 'Kioscos', body: 'Ventas rapidas, reposicion, caja diaria y control de productos de alta rotacion.', href: '/software-para-kioscos/' },
  { title: 'Tiendas y locales', body: 'Clientes, productos, compras, sucursales y reportes para la operacion completa.', href: '/software-para-tiendas/' },
  { title: 'Servicio tecnico', body: 'Tickets, clientes, repuestos, caja y stock en la misma base comercial.', href: '/software-para-servicio-tecnico/' },
]

const comparisonRows = [
  ['Ventas y caja', 'Planillas separadas o cuaderno', 'Todo en una sola web'],
  ['Stock', 'Actualizacion manual', 'Actualizacion por venta, compra o ajuste'],
  ['Sucursales', 'Difcil consolidar', 'Separacion por local y caja'],
  ['Usuarios', 'Sin permisos reales', 'Roles, modulos y acciones por cuenta'],
  ['Reportes', 'Requieren armar formulas', 'Vistas listas por fecha, caja y sucursal'],
]

const importTemplateDownloads = [{
  href: 'https://wa.me/5491135708345?text=Hola%20PCLAF%2C%20necesito%20cargar%20productos%20desde%20una%20planilla.',
  label: 'Solicitar carga asistida',
  body: 'Envia tu planilla a soporte. Revisamos su formato y migramos los productos de forma controlada.',
}]

const marketingPages = [
  {
    slug: '',
    seoTitle: 'Sistema de ventas y stock | PCLAF Control',
    description: 'Gestiona ventas, caja, stock, clientes y compras desde una sola plataforma. Prueba PCLAF Control gratis desde PC o celular.',
    kicker: 'Sistema comercial web',
    h1: 'Tu negocio ordenado, desde la venta hasta el cierre de caja',
    lead: 'Vende, controla stock y administra tu comercio desde una plataforma simple. Crea tu cuenta y empieza a usarla ahora, sin instalar nada.',
    primaryCta: { href: `${appPath}?view=signup`, label: 'Probar gratis' },
    secondaryCta: { href: `${appPath}?view=login`, label: 'Iniciar sesion' },
    whatsAppPrompt: 'Hola PCLAF, quiero probar PCLAF Control en mi comercio.',
    image: '/pclaf-control-panel-real.png',
    imageAlt: 'Panel de control real de PCLAF Control en una computadora',
    stats: [
      ['Ventas', 'Rapidas y claras'],
      ['Stock', 'Siempre actualizado'],
      ['Caja', 'Cierres con control'],
    ],
    sections: [
      {
        title: 'Todo mas ordenado',
        body: 'Centraliza clientes, ventas, stock y proveedores para no trabajar con datos repartidos en planillas o papeles.',
      },
      {
        title: 'Simple para empezar',
        body: 'Arrancas con lo basico y luego sumas compras, facturas, usuarios, cajas o sucursales segun tu negocio.',
      },
      {
        title: 'Listo para crecer',
        body: 'Acompana kioscos, tiendas, comercios y servicios tecnicos con una base cloud real y modulos por necesidad.',
      },
    ],
    downloads: importTemplateDownloads,
    featureList: [],
  },
  {
    slug: 'funciones',
    seoTitle: 'Funciones del sistema comercial | PCLAF Control',
    description: 'Conoce todas las funciones de PCLAF Control: ventas, caja, stock, compras, clientes, tickets, facturacion, sucursales y reportes.',
    kicker: 'Funciones',
    h1: 'Funciones claras para operar mejor tu negocio',
    lead: 'Estas son las herramientas principales para vender, cobrar, controlar stock y ordenar la operacion diaria sin mezclar todo en una sola pantalla.',
    image: '/pantalla-ventas-pclaf-control.svg',
    imageAlt: 'Pantalla de ventas y cobros de PCLAF Control',
    whatsAppPrompt: 'Hola PCLAF, quiero ver todas las funciones de PCLAF Control.',
    sections: [
      { title: 'Ventas y caja', body: 'Venta multi item, medios de pago, apertura y cierre, diferencias, tickets y facturacion opcional desde la venta.' },
      { title: 'Stock y productos', body: 'Catalogo, stock por sucursal, transferencias, ajustes, importacion masiva y alertas por faltantes.' },
      { title: 'Clientes y compras', body: 'Base comercial, cuentas corrientes, proveedores, recepcion de compras y comprobantes asociados.' },
      { title: 'Usuarios y permisos', body: 'Accesos por rol, modulos por cuenta, cajeros, administradores y control de acciones sensibles.' },
      { title: 'Tickets y seguimiento', body: 'Recepcion de equipos, estados de trabajo, historial operativo y control por sucursal.' },
      { title: 'Reportes', body: 'Ventas, facturas, caja y movimientos filtrados por fechas, caja o sucursal.' },
    ],
    featureList: ['Ventas', 'Caja', 'Stock', 'Clientes', 'Compras', 'Facturacion', 'Tickets', 'Reportes'],
  },
  {
    slug: 'precios',
    seoTitle: 'PCLAF Control gratis hasta nuevo aviso | Planes y modulos',
    description: 'PCLAF Control esta gratis hasta nuevo aviso. Gestiona ventas, caja, stock, clientes, compras y sucursales desde una sola web.',
    kicker: 'Gratis hasta nuevo aviso',
    h1: 'PCLAF Control esta gratis hasta nuevo aviso',
    lead: 'Crea tu cuenta y usa las herramientas disponibles para ventas, caja, stock y operacion comercial sin costo durante esta etapa. Si la modalidad cambia, avisaremos antes a los titulares de las cuentas.',
    image: '/cierre-caja-comercio.svg',
    imageAlt: 'Resumen de caja y cierre operativo de PCLAF Control',
    primaryCta: { href: `${appPath}?view=signup`, label: 'Crear cuenta gratis' },
    whatsAppPrompt: 'Hola PCLAF, quiero crear una cuenta gratis en PCLAF Control.',
    sections: [
      { title: 'Oferta vigente', body: 'El acceso es gratis hasta nuevo aviso. No hay cargos por crear tu cuenta ni cargos retroactivos por el uso realizado durante esta etapa.' },
      { title: 'Gestion Base', body: 'Clientes, productos, ventas simples y comprobantes para negocios que quieren dejar Excel y empezar ordenados.' },
      { title: 'Mostrador', body: 'Caja diaria, cobros mixtos, apertura y cierre, ticket rapido y operadores para puestos de venta.' },
      { title: 'Operacion', body: 'Compras, proveedores, stock por sucursal, facturas, reportes y mejores controles del negocio.' },
      { title: 'Multi Sucursal', body: 'Varias sucursales, cajas, transferencias, usuarios por puesto y reportes separados por local.' },
    ],
    featureList: ['Gratis hasta nuevo aviso', 'Sin instalar', 'Modulos para crecer', 'Acceso web desde PC o celular'],
  },
  {
    slug: 'sistema-de-ventas',
    seoTitle: 'Sistema de ventas para comercios | PCLAF Control',
    description: 'Sistema de ventas para comercios con cobros, tickets, caja y control comercial desde una sola web.',
    kicker: 'Ventas',
    h1: 'Sistema de ventas para comercios que quieren cobrar rapido y trabajar con mas control',
    lead: 'PCLAF Control ayuda a registrar ventas, sugerir canales de cobro, emitir tickets y asociar comprobantes sin moverte de la misma herramienta.',
    image: '/pantalla-ventas-pclaf-control.svg',
    imageAlt: 'Pantalla de ventas y cobros de PCLAF Control',
    whatsAppPrompt: 'Hola PCLAF, quiero ver el sistema de ventas para mi comercio.',
    sections: [
      { title: 'Venta multi item', body: 'Agrega varios productos, descuentos, observaciones y medios de pago en una sola pantalla.' },
      { title: 'Cobros mixtos', body: 'Efectivo, transferencia, Mercado Pago y cuenta corriente dentro de la misma operacion.' },
      { title: 'Comprobantes listos', body: 'Relaciona la venta con ticket o factura y sigue lo cobrado o pendiente.' },
    ],
    featureList: ['Ventas', 'Cobros', 'Caja', 'Facturas', 'Historial comercial'],
  },
  {
    slug: 'sistema-de-compras',
    seoTitle: 'Sistema de compras y proveedores | PCLAF Control',
    description: 'Registra compras, proveedores, costos y recepcion de mercaderia para mantener ordenados stock y caja.',
    kicker: 'Compras y proveedores',
    h1: 'Compras y proveedores en la misma operacion comercial',
    lead: 'Registra ingresos de mercaderia, consulta proveedores y conecta los costos con tus productos sin trabajar en planillas separadas.',
    image: '/control-stock-por-sucursal.svg',
    imageAlt: 'Control de productos y stock en PCLAF Control',
    whatsAppPrompt: 'Hola PCLAF, quiero ordenar las compras y proveedores de mi comercio.',
    sections: [
      { title: 'Recepcion de compras', body: 'Carga productos, cantidades y costos para registrar la entrada de mercaderia de forma ordenada.' },
      { title: 'Proveedores centralizados', body: 'Conserva los datos comerciales de cada proveedor y consulta el historial desde la misma plataforma.' },
      { title: 'Impacto en stock', body: 'Las compras se integran con productos y existencias para que el inventario refleje la operacion real.' },
    ],
    featureList: ['Compras', 'Proveedores', 'Costos', 'Productos', 'Stock'],
  },
  {
    slug: 'facturacion',
    seoTitle: 'Facturacion y comprobantes para comercios | PCLAF Control',
    description: 'Organiza comprobantes y facturas relacionadas con tus ventas desde la misma plataforma comercial.',
    kicker: 'Facturacion',
    h1: 'Comprobantes y facturas asociados a cada venta',
    lead: 'Mantiene la relacion entre ventas, cobros, clientes y comprobantes para que puedas consultar la operacion comercial con mas claridad.',
    image: '/pantalla-ventas-pclaf-control.svg',
    imageAlt: 'Pantalla de ventas y comprobantes de PCLAF Control',
    whatsAppPrompt: 'Hola PCLAF, quiero conocer la facturacion y comprobantes del sistema.',
    sections: [
      { title: 'Comprobantes por venta', body: 'Relaciona cada venta con sus comprobantes para seguir lo emitido, cobrado o pendiente.' },
      { title: 'Clientes y saldos', body: 'Consulta los comprobantes junto con el historial comercial del cliente cuando lo necesites.' },
      { title: 'Consulta operativa', body: 'Encuentra ventas y facturas en una misma base sin duplicar la informacion comercial.' },
    ],
    featureList: ['Facturas', 'Comprobantes', 'Ventas', 'Clientes', 'Historial'],
  },
  {
    slug: 'sistema-de-tickets',
    seoTitle: 'Sistema de tickets para servicio tecnico | PCLAF Control',
    description: 'Registra tickets, equipos, estados y clientes para seguir reparaciones y servicios desde una sola web.',
    kicker: 'Tickets y seguimiento',
    h1: 'Sistema de tickets para ordenar servicios y reparaciones',
    lead: 'Registra equipos, tareas y estados de trabajo; relaciona cada ticket con el cliente y mantene el seguimiento operativo por sucursal.',
    image: '/cierre-caja-comercio.svg',
    imageAlt: 'Operacion comercial y seguimiento de tickets en PCLAF Control',
    whatsAppPrompt: 'Hola PCLAF, quiero probar el sistema de tickets para mi servicio tecnico.',
    sections: [
      { title: 'Ingreso de equipos', body: 'Registra el detalle del equipo y del trabajo para conservar una recepcion clara.' },
      { title: 'Estados de trabajo', body: 'Sigue cada ticket desde su ingreso hasta la entrega con un historial operativo.' },
      { title: 'Relacion comercial', body: 'Conecta el ticket con el cliente, repuestos, ventas y caja cuando corresponda.' },
    ],
    featureList: ['Tickets', 'Clientes', 'Estados', 'Repuestos', 'Sucursales'],
  },
  {
    slug: 'reportes',
    seoTitle: 'Reportes de ventas, caja y stock | PCLAF Control',
    description: 'Consulta reportes de ventas, caja, stock, compras y comprobantes por fecha, sucursal y operador.',
    kicker: 'Reportes y control',
    h1: 'Reportes para entender la operacion diaria de tu comercio',
    lead: 'Consulta ventas, movimientos de caja, stock y comprobantes con filtros por fecha, sucursal o caja para tomar decisiones con datos.',
    image: '/cierre-caja-comercio.svg',
    imageAlt: 'Resumen de caja y reportes comerciales de PCLAF Control',
    whatsAppPrompt: 'Hola PCLAF, quiero conocer los reportes del sistema.',
    sections: [
      { title: 'Ventas y cobros', body: 'Revisa ventas y medios de pago para entender la actividad comercial por periodo.' },
      { title: 'Caja y movimientos', body: 'Consulta aperturas, cierres, diferencias e ingresos o egresos de cada caja.' },
      { title: 'Stock y compras', body: 'Relaciona existencias y movimientos de mercaderia con la operacion de compras.' },
    ],
    featureList: ['Ventas', 'Caja', 'Stock', 'Compras', 'Sucursales'],
  },
  {
    slug: 'control-de-stock',
    seoTitle: 'Programa para controlar stock | PCLAF Control',
    description: 'Programa para controlar stock, productos, sucursales, transferencias y reposicion desde PC o celular.',
    kicker: 'Stock',
    h1: 'Programa para controlar stock y saber que falta antes de quedarte sin vender',
    lead: 'Gestiona catalogo, existencias, stock minimo y movimientos de productos en una sola web para no depender de planillas separadas.',
    image: '/control-stock-por-sucursal.svg',
    imageAlt: 'Control de stock por sucursal de PCLAF Control',
    whatsAppPrompt: 'Hola PCLAF, necesito controlar stock y reposicion en mi negocio.',
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
    seoTitle: 'Sistema de caja para negocios | PCLAF Control',
    description: 'Sistema de caja para negocios con apertura, cierre, diferencias, movimientos y control por operador.',
    kicker: 'Caja',
    h1: 'Sistema de caja para negocios que necesitan ordenar apertura, cierre y cobros',
    lead: 'Abre y cierra caja, controla efectivo esperado, registra ingresos o egresos y sigue la operacion diaria sin perder trazabilidad.',
    image: '/cierre-caja-comercio.svg',
    imageAlt: 'Cierre de caja comercial de PCLAF Control',
    whatsAppPrompt: 'Hola PCLAF, quiero mejorar la apertura y cierre de caja de mi negocio.',
    sections: [
      { title: 'Apertura y cierre', body: 'Define monto inicial, efectivo contado y diferencia final por caja o puesto de cobro.' },
      { title: 'Movimientos manuales', body: 'Registra ingresos, gastos, retiros, depositos y ajustes con responsable y detalle.' },
      { title: 'Reportes por caja', body: 'Consulta el movimiento del turno y separa resultados por sucursal y caja.' },
    ],
    featureList: ['Apertura', 'Cierre', 'Diferencias', 'Cobros', 'Movimientos'],
  },
  {
    slug: 'software-para-kioscos',
    seoTitle: 'Sistema para kioscos | PCLAF Control',
    description: 'Sistema para kioscos con ventas, caja, stock, precios y control rapido desde navegador.',
    kicker: 'Rubros',
    h1: 'Sistema para kioscos que necesitan vender rapido y controlar stock en serio',
    lead: 'Ideal para kioscos con productos de alta rotacion, cobros rapidos y necesidad de saber que se vendio, que falta y cuanto quedo en caja.',
    image: '/pantalla-ventas-pclaf-control.svg',
    imageAlt: 'Sistema para kioscos con ventas y stock en PCLAF Control',
    whatsAppPrompt: 'Hola PCLAF, quiero probar PCLAF Control para mi kiosco.',
    sections: [
      { title: 'Mostrador rapido', body: 'Cobros agiles para productos de paso, con caja clara y seguimiento diario.' },
      { title: 'Reposicion simple', body: 'Control de faltantes, compras y proveedores sin cargar pantallas tecnicas innecesarias.' },
      { title: 'Acceso desde celular', body: 'Consulta ventas o stock rapido desde tu telefono cuando no estas en el local.' },
    ],
    featureList: ['Kioscos', 'Caja', 'Stock', 'Compras', 'Precios'],
  },
  {
    slug: 'software-para-tiendas',
    seoTitle: 'Software para tiendas y locales | PCLAF Control',
    description: 'Software para tiendas y locales con ventas, clientes, stock, compras y sucursales desde la web.',
    kicker: 'Rubros',
    h1: 'Software para tiendas y locales que necesitan vender, cobrar y ordenar su operacion',
    lead: 'PCLAF Control ayuda a tiendas y locales a trabajar mejor con productos, clientes, historial comercial, caja y reportes desde una sola plataforma.',
    image: '/control-stock-por-sucursal.svg',
    imageAlt: 'Software para tiendas y locales con control de stock',
    whatsAppPrompt: 'Hola PCLAF, quiero probar PCLAF Control para mi tienda o local.',
    sections: [
      { title: 'Clientes y cuentas', body: 'Lleva historial, saldo y seguimiento comercial para ventas de mostrador o atencion recurrente.' },
      { title: 'Productos y precios', body: 'Ordena catalogo, categorias, stock y reposicion sin depender de planillas separadas.' },
      { title: 'Cajas y sucursales', body: 'Si creces, puedes sumar mas locales, usuarios y puestos de cobro sin cambiar de sistema.' },
    ],
    featureList: ['Tiendas', 'Clientes', 'Precios', 'Ventas', 'Sucursales'],
  },
  {
    slug: 'software-para-servicio-tecnico',
    seoTitle: 'Software para servicio tecnico | PCLAF Control',
    description: 'Software para servicio tecnico con tickets, clientes, caja, ventas de repuestos y seguimiento operativo.',
    kicker: 'Rubros',
    h1: 'Software para servicio tecnico con tickets, clientes, caja y control operativo',
    lead: 'Si trabajas con equipos, reparaciones, repuestos y cobros, puedes combinar tickets activos con ventas, stock y caja en el mismo sistema.',
    image: '/cierre-caja-comercio.svg',
    imageAlt: 'Software para servicio tecnico con tickets y caja',
    whatsAppPrompt: 'Hola PCLAF, quiero ver PCLAF Control para servicio tecnico.',
    sections: [
      { title: 'Tickets y estados', body: 'Recibe equipos, registra detalle, cambia estado y sigue trabajos por sucursal.' },
      { title: 'Clientes y repuestos', body: 'Relaciona cliente, trabajo, ventas y productos sin duplicar datos.' },
      { title: 'Operacion diaria', body: 'Caja, compras y stock quedan en la misma base para ordenar mejor el taller.' },
    ],
    featureList: ['Tickets', 'Servicio tecnico', 'Clientes', 'Caja', 'Stock'],
  },
  {
    slug: 'gestion-de-clientes',
    seoTitle: 'Gestion de clientes y compras | PCLAF Control',
    description: 'Gestiona clientes, compras, cuentas corrientes, historial comercial y proveedores desde una sola web.',
    kicker: 'Clientes',
    h1: 'Gestion de clientes, compras y proveedores para comercios que quieren trabajar mas ordenados',
    lead: 'Centraliza tu base comercial y evita datos sueltos para poder vender, cobrar y comprar con mejor seguimiento.',
    image: '/control-stock-por-sucursal.svg',
    imageAlt: 'Gestion de clientes, compras y proveedores de PCLAF Control',
    whatsAppPrompt: 'Hola PCLAF, quiero ordenar clientes y compras en mi comercio.',
    sections: [
      { title: 'Base comercial', body: 'Crea clientes, historiales y saldos sin obligar a pedir datos innecesarios.' },
      { title: 'Compras y proveedores', body: 'Registra recepciones, costos, categorias y saldo comercial con cada proveedor.' },
      { title: 'Mas control del negocio', body: 'Clientes y compras alimentan ventas, caja y reportes para ver el negocio completo.' },
    ],
    featureList: ['Clientes', 'Compras', 'Proveedores', 'Saldos', 'Historial'],
  },
  {
    slug: 'multi-sucursal',
    seoTitle: 'Sistema multi sucursal | PCLAF Control',
    description: 'Gestiona sucursales, cajas, usuarios, permisos y transferencias de stock desde una sola plataforma.',
    kicker: 'Escala',
    h1: 'Sistema multi sucursal con usuarios, cajas y transferencias bajo control',
    lead: 'Cuando el comercio crece, PCLAF Control permite separar resultados por sucursal, ligar cajas a locales y transferir mercaderia con trazabilidad.',
    image: '/control-stock-por-sucursal.svg',
    imageAlt: 'Control multi sucursal de PCLAF Control',
    whatsAppPrompt: 'Hola PCLAF, necesito varias sucursales y cajas en el sistema.',
    sections: [
      { title: 'Sucursales y cajas', body: 'Cada local puede tener su caja, numeracion, operadores y reportes propios.' },
      { title: 'Permisos por usuario', body: 'Un administrador decide que puede ver o tocar cada empleado segun su rol.' },
      { title: 'Transferencias de stock', body: 'Mueve productos entre sucursales y conserva historial de origen y destino.' },
    ],
    featureList: ['Multi sucursal', 'Usuarios', 'Permisos', 'Transferencias', 'Cajas'],
  },
  {
    slug: 'preguntas-frecuentes',
    seoTitle: 'Preguntas frecuentes | PCLAF Control',
    description: 'Respuestas sobre instalacion, celulares, lector de codigos, varias cajas, importacion de productos y prueba gratis.',
    kicker: 'FAQ',
    h1: 'Preguntas frecuentes sobre PCLAF Control',
    lead: 'Resolvemos las dudas mas comunes de comercios que quieren probar una web para ventas, caja y stock sin perder tiempo.',
    image: '/og-pclaf-control.svg',
    imageAlt: 'Preguntas frecuentes y acceso a PCLAF Control',
    whatsAppPrompt: 'Hola PCLAF, tengo dudas antes de probar PCLAF Control.',
    faq: [
      ['Necesito instalar algo?', 'No en la version web. Entras desde navegador en PC o celular.'],
      ['Funciona desde celular?', 'Si. La interfaz esta pensada para operar y consultar desde distintos dispositivos.'],
      ['Puedo usar lector de codigos?', 'Si. El sistema acepta lectores USB tipo teclado y busqueda manual.'],
      ['Permite varias cajas?', 'Si. Puedes ligar ventas y caja a una caja especifica y separar reportes por puesto de cobro.'],
      ['Como cargo una planilla de productos?', 'Habla con soporte y envianos el archivo. Revisamos sus columnas y hacemos una carga controlada para evitar duplicados o datos mal interpretados.'],
      ['El sistema es gratis?', 'Si. PCLAF Control esta gratis hasta nuevo aviso. No cobramos de forma retroactiva: si la modalidad cambia, avisaremos antes al titular de la cuenta.'],
    ],
    featureList: ['FAQ', 'Prueba gratis', 'Soporte', 'Carga asistida', 'Caja'],
  },
  {
    slug: 'blog/como-controlar-stock',
    seoTitle: 'Como controlar stock en un comercio | PCLAF Control',
    description: 'Aprende como controlar stock en un comercio, detectar faltantes y evitar vender sin mercaderia disponible.',
    kicker: 'Blog',
    h1: 'Como controlar stock en un comercio sin depender de Excel',
    lead: 'Controlar stock no es solo saber cuantas unidades quedan. Tambien es conocer que se vendio, que falta comprar y entre que sucursales se movio cada articulo.',
    image: '/control-stock-por-sucursal.svg',
    imageAlt: 'Articulo sobre como controlar stock con PCLAF Control',
    whatsAppPrompt: 'Hola PCLAF, vi el articulo de stock y quiero una demo.',
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
    seoTitle: 'Como hacer un cierre de caja correctamente | PCLAF Control',
    description: 'Guia para abrir y cerrar caja correctamente, controlar diferencias y ordenar medios de pago.',
    kicker: 'Blog',
    h1: 'Como hacer un cierre de caja correctamente en un negocio',
    lead: 'Un buen cierre de caja no solo compara efectivo. Tambien separa cobros, diferencias y movimientos para que el negocio tenga trazabilidad real.',
    image: '/cierre-caja-comercio.svg',
    imageAlt: 'Articulo sobre cierre de caja con PCLAF Control',
    whatsAppPrompt: 'Hola PCLAF, quiero una demo para ordenar la caja de mi negocio.',
    sections: [
      { title: 'Apertura clara', body: 'Define el monto inicial y quien opera la caja para arrancar el turno sin dudas.' },
      { title: 'Cobros bien clasificados', body: 'Separa efectivo, transferencia, billeteras y cuenta corriente dentro del mismo turno.' },
      { title: 'Diferencia final', body: 'El cierre debe comparar lo esperado contra lo contado y dejar observaciones si hubo diferencia.' },
    ],
    featureList: ['Apertura de caja', 'Cierre', 'Diferencias', 'Medios de pago'],
  },
  {
    slug: 'blog/importar-productos-desde-excel',
    seoTitle: 'Como importar productos desde Excel | PCLAF Control',
    description: 'Migra productos desde Excel o CSV a PCLAF Control con revision y carga asistida para evitar errores de stock y precios.',
    kicker: 'Blog',
    h1: 'Como pasar tus productos desde Excel a PCLAF Control',
    lead: 'Cada comercio organiza sus planillas de una forma distinta. Por eso revisamos tu archivo y hacemos la migracion contigo, sin obligarte a adaptar columnas a ciegas.',
    image: '/control-stock-por-sucursal.svg',
    imageAlt: 'Importacion masiva de productos desde Excel en PCLAF Control',
    whatsAppPrompt: 'Hola PCLAF, quiero importar mis productos desde Excel.',
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
    seoTitle: 'Politica de privacidad | PCLAF Control',
    description: 'Conoce como PCLAF Control trata datos comerciales, accesos, comunicaciones y soporte.',
    kicker: 'Legal',
    h1: 'Politica de privacidad de PCLAF Control',
    lead: 'Esta pagina resume como tratamos datos de acceso, datos comerciales y consultas enviadas por formularios o WhatsApp.',
    image: '/og-pclaf-control.svg',
    imageAlt: 'Politica de privacidad de PCLAF Control',
    whatsAppPrompt: 'Hola PCLAF, quiero consultar sobre privacidad y datos.',
    sections: [
      { title: 'Datos de acceso', body: 'Los accesos se usan para identificar usuarios y proteger la operacion de cada comercio.' },
      { title: 'Datos operativos', body: 'La informacion de ventas, caja, stock y clientes pertenece al comercio que usa la plataforma.' },
      { title: 'Soporte y contacto', body: 'Los mensajes enviados por WhatsApp o formularios se usan para responder consultas comerciales o tecnicas.' },
    ],
    featureList: ['Privacidad', 'Accesos', 'Datos comerciales', 'Soporte'],
  },
  {
    slug: 'terminos',
    seoTitle: 'Terminos de uso | PCLAF Control',
    description: 'Terminos de uso, oferta gratuita vigente, soporte y operacion responsable de PCLAF Control.',
    kicker: 'Legal',
    h1: 'Terminos de uso de PCLAF Control',
    lead: 'El uso de PCLAF Control se presta bajo condiciones claras de acceso, soporte, seguridad y operacion responsable.',
    image: '/og-pclaf-control.svg',
    imageAlt: 'Terminos de uso de PCLAF Control',
    whatsAppPrompt: 'Hola PCLAF, quiero consultar los terminos de uso del sistema.',
    sections: [
      { title: 'Oferta gratuita vigente', body: 'PCLAF Control esta disponible sin costo hasta nuevo aviso. La creacion y el uso de la cuenta durante esta etapa no generan cargos retroactivos.' },
      { title: 'Cambios de modalidad', body: 'Si en el futuro se modifica la modalidad gratuita, avisaremos antes al titular de la cuenta por los canales de contacto disponibles. Podra decidir si continua bajo las nuevas condiciones.' },
      { title: 'Alcance del acceso', body: 'Las funciones habilitadas dependen de la configuracion de cada comercio y de la disponibilidad operativa del servicio. La oferta gratuita no garantiza una duracion permanente.' },
      { title: 'Uso responsable', body: 'Cada comercio administra sus usuarios, roles y claves para operar de manera segura.' },
      { title: 'Soporte y datos', body: 'El soporte acompana configuracion y dudas operativas. La informacion comercial pertenece al comercio; ante una consulta de acceso o continuidad, el titular puede contactar a soporte.' },
    ],
    featureList: ['Terminos', 'Prueba', 'Soporte', 'Uso comercial'],
  },
]

const marketingPageMap = Object.fromEntries(marketingPages.map((page) => [page.slug, page]))

const buildSoftwareJsonLd = (page) => ({
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'PCLAF Control',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: pageUrl(page.slug),
  image: `${siteOrigin}/og-pclaf-control.svg`,
  screenshot: [
    `${siteOrigin}/pclaf-control-punto-venta-real.png`,
    `${siteOrigin}/pclaf-control-stock-real.png`,
    `${siteOrigin}/pclaf-control-mobile-devices.png`,
  ],
  softwareVersion: assetVersion,
  description: page.description,
  featureList: page.featureList || [],
  offers: {
    '@type': 'Offer',
    availability: 'https://schema.org/InStock',
    description: 'PCLAF Control esta gratis hasta nuevo aviso.',
    url: `${siteOrigin}/precios/`,
  },
})

const buildOrganizationJsonLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'PCLAF Control',
  url: siteOrigin,
  logo: `${siteOrigin}/pclaf-logo.png`,
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

const renderTopbar = () => `
  <header class="marketing-topbar">
    <a class="marketing-brand" href="/">
      <img src="/pclaf-logo.png" alt="PCLAF Control" width="48" height="46" />
      <div>
        <strong>PCLAF Control</strong>
        <p>Ventas, caja y stock en una sola web</p>
      </div>
    </a>
    <nav class="marketing-nav" aria-label="Navegacion principal">
      ${topLinks.map((link) => `<a href="${link.href}" data-analytics="nav_${escapeHtml(link.label).toLowerCase().replaceAll(' ', '_')}">${escapeHtml(link.label)}</a>`).join('')}
    </nav>
    <div class="marketing-auth-links">
      <a href="${appPath}?view=login" data-analytics="header_login">Iniciar sesion</a>
      <a class="is-primary" href="${appPath}?view=signup" data-analytics="header_signup">Probar gratis</a>
    </div>
  </header>
  <p class="marketing-free-notice" role="status"><strong>Gratis hasta nuevo aviso.</strong> Crea tu cuenta y empieza a usar PCLAF Control sin costo.</p>
`

const renderFooter = () => `
  <footer class="marketing-footer">
    <div class="marketing-footer-brand">
      <strong>PCLAF Control</strong>
      <p>Software comercial web para ventas, caja, stock, clientes, compras, tickets y sucursales.</p>
    </div>
    <div class="marketing-footer-links">
      <p class="marketing-footer-title">Accesos</p>
      <nav>
        <a href="${appPath}?view=login" data-analytics="footer_login">Iniciar sesion</a>
        <a href="${appPath}?view=signup" data-analytics="footer_signup_primary">Crear cuenta</a>
      </nav>
    </div>
    <div class="marketing-footer-links">
      <p class="marketing-footer-title">Soluciones</p>
      <nav>
        <a href="/sistema-de-ventas/" data-analytics="footer_sales">Ventas y caja</a>
        <a href="/control-de-stock/" data-analytics="footer_stock">Stock</a>
        <a href="/sistema-de-compras/" data-analytics="footer_purchases">Compras</a>
        <a href="/facturacion/" data-analytics="footer_invoices">Facturacion</a>
        <a href="/sistema-de-tickets/" data-analytics="footer_tickets">Tickets</a>
        <a href="/reportes/" data-analytics="footer_reports">Reportes</a>
      </nav>
    </div>
    <div class="marketing-footer-links">
      <p class="marketing-footer-title">Mas informacion</p>
      <nav>
        <a href="/funciones/" data-analytics="footer_funciones">Funciones</a>
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
      </article>
    `).join('')}
  </section>
`

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

const renderHomeExtras = (page) => page.slug ? '' : `
  <section class="marketing-home-rows">
    ${homeFeatureRows.map((row) => `
      <article class="marketing-story ${row.reverse ? 'is-reverse' : ''}">
        <div class="marketing-story-media">
          <img src="${row.image}" alt="${escapeHtml(row.alt)}" width="1200" height="800" loading="lazy" />
        </div>
        <div class="marketing-story-copy">
          <p class="marketing-kicker">${escapeHtml(row.eyebrow || 'PCLAF Control')}</p>
          <h2>${escapeHtml(row.title)}</h2>
          <p>${escapeHtml(row.body)}</p>
        </div>
      </article>
    `).join('')}
  </section>
  <section class="marketing-home-cta marketing-card">
    <div>
      <p class="marketing-kicker">Empieza hoy</p>
      <h2>Prueba PCLAF Control en tu propio negocio</h2>
      <p>Crea tu cuenta en minutos y conoce la herramienta trabajando con tus productos y tus ventas.</p>
    </div>
    <div class="marketing-cta-row">
      <a class="is-primary" href="${appPath}?view=signup" data-analytics="home_cta_signup">Crear cuenta</a>
      <a href="${appPath}?view=login" data-analytics="home_cta_login">Iniciar sesion</a>
    </div>
  </section>
`

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
      .marketing-story-media img {
        width: 100%;
        height: auto;
        display: block;
        border-radius: 18px;
        border: 1px solid rgba(255,255,255,0.08);
        background: rgba(255,255,255,0.02);
      }
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
      .marketing-card-link a {
        margin-top: 14px;
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
        background: #f5f2ec;
      }
      body {
        color: #181818;
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
        border-bottom: 1px solid #ded9d0;
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
        color: #6f6a62;
        font-size: 0.82rem;
      }
      .marketing-free-notice {
        margin: 0;
        padding: 10px 16px;
        border-bottom: 1px solid #ded9d0;
        background: #fff3cd;
        color: #5c3f00;
        text-align: center;
        font-size: 0.92rem;
      }
      .marketing-nav a,
      .marketing-auth-links a:not(.is-primary) {
        color: #4f4b45;
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
        background: #e52329;
        color: #fff;
        box-shadow: 0 10px 24px rgba(213, 29, 34, 0.2);
        font-weight: 700;
      }
      .marketing-auth-links .is-primary:hover,
      .marketing-cta-row .is-primary:hover {
        background: #c8171d;
        transform: translateY(-1px);
      }
      .marketing-hero {
        min-height: 620px;
        grid-template-columns: minmax(0, 0.86fr) minmax(480px, 1.14fr);
        gap: clamp(36px, 6vw, 88px);
        align-items: center;
        margin-top: 0;
        padding: clamp(58px, 8vw, 104px) 0;
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
        max-width: 12ch;
        margin: 0 0 24px;
        color: #171717;
        font-size: clamp(3rem, 5.8vw, 5.7rem);
        font-weight: 780;
        letter-spacing: -0.055em;
        line-height: 0.98;
      }
      .marketing-lead {
        max-width: 54ch;
        color: #5e5a54;
        font-size: clamp(1.05rem, 1.5vw, 1.25rem);
        line-height: 1.65;
      }
      .marketing-cta-row {
        margin-top: 30px;
      }
      .marketing-hero-helper {
        margin-top: 16px;
        color: #6f6a62;
      }
      .marketing-hero-media {
        position: relative;
        padding: 22px;
        border-radius: 28px;
        background: #181818;
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
        background: #e52329;
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
        color: #aaa39a;
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
        color: #aaa39a;
        font-size: 0.78rem;
      }
      .marketing-home-rows {
        gap: 0;
        margin-top: 0;
        border-top: 1px solid #ded9d0;
      }
      .marketing-story,
      .marketing-story.is-reverse {
        min-height: 540px;
        grid-template-columns: minmax(0, 1fr) minmax(0, 0.82fr);
        gap: clamp(42px, 8vw, 108px);
        padding: clamp(58px, 8vw, 100px) 0;
        border: 0;
        border-bottom: 1px solid #ded9d0;
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
        color: #181818;
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
        color: #171717;
      }
      .marketing-home-cta {
        margin-top: 0;
        padding: clamp(54px, 7vw, 86px);
        border-radius: 0;
        background: #181818;
        color: #fff;
      }
      .marketing-home-cta.marketing-card h2 {
        max-width: 18ch;
        color: #ffffff;
        font-size: clamp(2rem, 3.5vw, 3.5rem);
        letter-spacing: -0.04em;
      }
      .marketing-home-cta .marketing-kicker {
        color: #ffaaa5;
      }
      .marketing-home-cta p:not(.marketing-kicker) {
        max-width: 55ch;
        color: #bcb5ab;
        line-height: 1.65;
      }
      .marketing-footer {
        margin-top: 0;
        padding: 48px 0;
        border-top: 1px solid #ded9d0;
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
        color: #181818;
      }
      .marketing-card p,
      .marketing-faq p,
      .marketing-compare-row,
      .marketing-compare-copy p {
        color: #625e57;
      }
      body:not([data-page="home"]) .marketing-grid .marketing-card,
      body:not([data-page="home"]) .marketing-faq,
      body:not([data-page="home"]) .marketing-compare-copy,
      body:not([data-page="home"]) .marketing-compare-table {
        border: 1px solid #ded9d0;
        background: rgba(255, 255, 255, 0.56);
      }
      .marketing-compare-head {
        color: #777169;
        border-bottom-color: #ded9d0;
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
          display: none;
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
        .marketing-free-notice {
          padding: 9px 12px;
          font-size: 0.83rem;
          line-height: 1.4;
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
          gap: 26px;
          padding: 44px 0;
        }
        /* The hero already presents sales and cash. On mobile, skip the
           repeated image and move directly to the benefit. */
        .marketing-home-rows .marketing-story:first-child {
          gap: 0;
        }
        .marketing-home-rows .marketing-story:first-child .marketing-story-media {
          display: none;
        }
        .marketing-story-media {
          padding: 10px;
          border-radius: 16px;
        }
        .marketing-story-copy h2 {
          font-size: clamp(2rem, 9vw, 2.45rem);
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
`

const renderMarketingPage = (page) => {
  const structuredData = JSON.stringify(buildSoftwareJsonLd(page))
  const organizationData = JSON.stringify(buildOrganizationJsonLd())
  const faqData = buildFaqJsonLd(page)
  const breadcrumbData = buildBreadcrumbJsonLd(page)
  const articleData = buildArticleJsonLd(page)
  const pageSupportUrl = `https://wa.me/5491135708345?text=${encodeURIComponent(page.whatsAppPrompt || 'Hola PCLAF, quiero informacion de PCLAF Control.')}`
  const faqSection = renderFaq(page.faq || [])
  const downloadSection = page.slug ? renderDownloads(page.downloads || []) : ''
  const sections = page.slug ? renderSectionCards(page.sections || []) : ''
  const homeExtras = renderHomeExtras(page)
  const canonical = pageUrl(page.slug)
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="${escapeHtml(page.description)}" />
    <meta name="keywords" content="sistema de ventas, control de stock, sistema de caja, software para comercios, sistema para kioscos, software para tiendas, PCLAF Control" />
    <meta name="robots" content="index,follow" />
    <link rel="canonical" href="${canonical}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(page.seoTitle)}" />
    <meta property="og:description" content="${escapeHtml(page.description)}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${siteOrigin}/og-pclaf-control.svg" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(page.seoTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(page.description)}" />
    <meta name="twitter:image" content="${siteOrigin}/og-pclaf-control.svg" />
    <link rel="icon" type="image/png" href="/favicon.png?v=pclaf-logo-20260724" />
    <link rel="shortcut icon" type="image/png" href="/favicon.png?v=pclaf-logo-20260724" />
    <title>${escapeHtml(page.seoTitle)}</title>
    <style>${marketingStyles}</style>
    ${gaMeasurementId ? `
    <script async src="https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${gaMeasurementId}');
    </script>` : ''}
    <script type="application/ld+json">${structuredData}</script>
    <script type="application/ld+json">${organizationData}</script>
    ${faqData ? `<script type="application/ld+json">${JSON.stringify(faqData)}</script>` : ''}
    ${breadcrumbData ? `<script type="application/ld+json">${JSON.stringify(breadcrumbData)}</script>` : ''}
    ${articleData ? `<script type="application/ld+json">${JSON.stringify(articleData)}</script>` : ''}
  </head>
  <body data-page="${page.slug ? escapeHtml(page.slug) : 'home'}">
    <div class="marketing-shell">
      ${renderTopbar()}
      <main>
        <section class="marketing-hero">
          <div class="marketing-hero-copy">
            <p class="marketing-kicker">${escapeHtml(page.kicker)}</p>
            <h1>${escapeHtml(page.h1)}</h1>
            <p class="marketing-lead">${escapeHtml(page.lead)}</p>
            ${page.slug ? `
            <div class="marketing-cta-row">
              <a class="is-primary" data-analytics="hero_start_trial" href="${page.primaryCta?.href || `${appPath}?view=signup`}">${escapeHtml(page.primaryCta?.label || 'Probar gratis')}</a>
              <a data-analytics="header_login" href="${page.secondaryCta?.href || `${appPath}?view=login`}">${escapeHtml(page.secondaryCta?.label || 'Iniciar sesion')}</a>
              ${page.tertiaryCta ? `<a data-analytics="hero_demo" href="${page.tertiaryCta.href}" target="_blank" rel="noreferrer">${escapeHtml(page.tertiaryCta.label)}</a>` : ''}
            </div>
            <ul class="marketing-badges">
              ${(page.featureList || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
            </ul>` : `
            <div class="marketing-cta-row">
              <a class="is-primary" data-analytics="hero_start_trial" href="${page.primaryCta?.href || `${appPath}?view=signup`}">${escapeHtml(page.primaryCta?.label || 'Probar gratis')}</a>
            </div>
            <p class="marketing-hero-helper">Si ya tienes cuenta, <a data-analytics="hero_login_inline" href="${page.secondaryCta?.href || `${appPath}?view=login`}">entra aquí</a>.</p>`}
          </div>
          <aside class="marketing-hero-media">
            <img src="${page.image}" alt="${escapeHtml(page.imageAlt || page.h1)}" width="1200" height="630" loading="eager" fetchpriority="high" />
            <p class="marketing-image-caption">${escapeHtml(page.imageCaption || 'Vista real del sistema con ventas, stock, caja y control comercial desde una sola web.')}</p>
            ${!page.slug ? renderHeroStats(page.stats || []) : ''}
          </aside>
        </section>
        ${homeExtras}
        ${sections}
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
            'Hola PCLAF, quiero solicitar una demo de PCLAF Control.',
            data.get('nombre') ? 'Nombre: ' + data.get('nombre') : '',
            data.get('comercio') ? 'Comercio: ' + data.get('comercio') : '',
            data.get('whatsapp') ? 'WhatsApp: ' + data.get('whatsapp') : '',
            data.get('rubro') ? 'Rubro: ' + data.get('rubro') : '',
            data.get('cajas') ? 'Cajas: ' + data.get('cajas') : ''
          ].filter(Boolean);
          const href = 'https://wa.me/5491135708345?text=' + encodeURIComponent(parts.join('\\n'));
          if (typeof window.gtag === 'function') {
            window.gtag('event', 'generate_lead', {
              page_title: document.title,
              page_location: window.location.href
            });
          }
          window.open(href, '_blank', 'noopener,noreferrer');
        });
      }
      document.querySelectorAll('[data-analytics]').forEach(function (element) {
        element.addEventListener('click', function () {
          if (typeof window.gtag === 'function') {
            window.gtag('event', element.getAttribute('data-analytics'), {
              page_title: document.title,
              page_location: window.location.href
            });
          }
        });
      });
    </script>
  </body>
</html>
`
}

const appHtml = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Acceso a PCLAF Control para operar ventas, caja, stock, clientes, compras y comprobantes." />
    <meta name="robots" content="noindex,nofollow" />
    <meta name="referrer" content="strict-origin-when-cross-origin" />
    <meta http-equiv="Permissions-Policy" content="camera=(), microphone=(), geolocation=(), interest-cohort=()" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' https://esm.sh https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://rfwsnqmjkclxhbmidbkm.supabase.co wss://rfwsnqmjkclxhbmidbkm.supabase.co; frame-src https://challenges.cloudflare.com https://www.google.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none';" />
    <link rel="canonical" href="${siteOrigin}${appPath}" />
    <link rel="icon" type="image/png" href="/favicon.png?v=pclaf-logo-20260724" />
    <link rel="shortcut icon" type="image/png" href="/favicon.png?v=pclaf-logo-20260724" />
    <link rel="stylesheet" href="/app.css?v=${assetVersion}" />
    <title>Acceso al sistema | PCLAF Control</title>
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
    <div id="app"></div>
    <div id="boot-status">
      <div class="boot-card">
        <strong>PCLAF Control</strong>
        <p>Cargando sistema...</p>
      </div>
    </div>
    <script>
      window.__pclafAppEntry = true;
      window.__pclafBooted = false;
      window.__pclafBootError = null;
      try {
        if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
      } catch (error) {}
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      window.addEventListener('error', function (event) {
        window.__pclafBootError = event && event.message ? event.message : 'Error inesperado al iniciar la aplicacion.';
      });
      window.addEventListener('unhandledrejection', function (event) {
        var reason = event && event.reason;
        window.__pclafBootError = reason && reason.message ? reason.message : 'Fallo una promesa al iniciar la aplicacion.';
      });
      window.addEventListener('pageshow', function () {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      });
      window.setTimeout(function () {
        if (window.__pclafBooted) return;
        var shell = document.getElementById('boot-status');
        if (!shell) return;
        var message = window.__pclafBootError || 'La aplicacion no termino de cargar. Proba recargar con Ctrl + F5.';
        shell.innerHTML = '<div class="boot-card is-error"><strong>No se pudo iniciar</strong><p>' + message + '</p><p>Si sigue igual, avisame y reviso el error puntual.</p></div>';
      }, 4000);
    </script>
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
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

pageEntries.push({
  pathname: appPath,
  html: appHtml,
  filePath: 'app/index.html',
  cacheControl: 'no-store',
})
const appModuleRoutes = ['clientes', 'ventas', 'caja-diaria', 'productos', 'compras', 'facturacion', 'tickets', 'reportes', 'auditoria', 'ajustes', 'mi-admin', 'sucursales', 'cajeros']
for (const route of appModuleRoutes) pageEntries.push({ pathname: `${appPath}${route}/`, html: appHtml, filePath: `app/${route}/index.html`, cacheControl: 'no-store' })

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pageEntries.filter((entry) => !entry.pathname.startsWith(appPath)).map((entry) => `  <url>
    <loc>${siteOrigin}${entry.pathname}</loc>
    <changefreq>${entry.pathname === '/' ? 'weekly' : 'monthly'}</changefreq>
    <priority>${entry.pathname === '/' ? '1.0' : '0.8'}</priority>
  </url>`).join('\n')}
</urlset>
`

const robotsTxt = `User-agent: *
Allow: /
Disallow: /app/
Disallow: /admin/

Sitemap: ${siteOrigin}/sitemap.xml
`

const htmlIndex = Object.fromEntries(pageEntries.map((entry) => [entry.pathname, entry]))

const serverCode = `const appCss = ${JSON.stringify(stylesCss)};
const appJs = ${JSON.stringify(builtClientJs)};
const dataStore = ${JSON.stringify(dataStoreJs)};
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
await writeFile(path.join(dist, 'data-store.js'), dataStoreJs)
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
  await writeFile(path.join(root, 'data-store.js'), dataStoreJs)
  await writeFile(path.join(root, 'cloud-sync.js'), cloudSyncJs)
  await writeFile(path.join(root, 'cloud-auth.js'), cloudAuthJs)
  await writeFile(path.join(root, 'cloud-core.js'), cloudCoreJs)
  await writeFile(path.join(root, 'cloud-config.json'), cloudConfigJson)
  await writeFile(path.join(root, 'robots.txt'), robotsTxt)
  await writeFile(path.join(root, 'sitemap.xml'), sitemapXml)
  await writeFile(path.join(root, 'CNAME'), cnameFile)
  await copyDirectory(path.join(root, 'public'), root)
}
