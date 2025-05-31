// Variables globales
let ventas = [];
let entradas = [];
let salidas = [];
let productos = [];
let clientes = [];
let productosPuntos = [];
let carrito = [];
let configTicket = {
    nombreTienda: 'Mi Tienda',
    encabezado: '',
    pie: '',
    fuente: 'monospace',
    tamanoFuente: '11',
    negrita: false
};
let clienteSeleccionado = null;
let db;

// Agregar variables para el manejo de cortes
let cortesDiarios = [];
let corteActual = {
    fecha: new Date(),
    ventas: [],
    entradas: [],
    salidas: [],
    totales: {
        ventas: 0,
        entradas: 0,
        salidas: 0,
        caja: 0
    }
};

// Funciones de utilidad
function formatearTamano(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatearMoneda(valor) {
    return new Intl.NumberFormat('es-MX', { 
        style: 'currency', 
        currency: 'MXN',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(valor);
}

function formatearFecha(fecha) {
    if (fecha instanceof Date) {
        return fecha.toLocaleString();
    }
    return fecha;
}

// Funciones de almacenamiento
async function verificarEspacioAlmacenamiento() {
    try {
        const info = await navigator.storage.estimate();
        const usado = formatearTamano(info.usage);
        const disponible = formatearTamano(info.quota);
        const porcentaje = ((info.usage / info.quota) * 100).toFixed(2);

        return {
            usado,
            disponible,
            porcentaje,
            ventas: ventas.length,
            entradas: entradas.length,
            salidas: salidas.length,
            productos: productos.length,
            clientes: clientes.length,
            productosPuntos: productosPuntos.length
        };
    } catch (error) {
        console.error('Error al verificar espacio:', error);
        return null;
    }
}

// Inicialización de IndexedDB
function inicializarDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('SistemaPOS', 2);

        request.onerror = (event) => {
            console.error('Error al abrir la base de datos:', event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('Base de datos abierta correctamente');
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // Crear object stores
            if (!db.objectStoreNames.contains('ventas')) {
                db.createObjectStore('ventas', { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('entradas')) {
                db.createObjectStore('entradas', { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('salidas')) {
                db.createObjectStore('salidas', { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('productos')) {
                db.createObjectStore('productos', { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('clientes')) {
                db.createObjectStore('clientes', { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('productosPuntos')) {
                db.createObjectStore('productosPuntos', { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('configTicket')) {
                db.createObjectStore('configTicket', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('cortesDiarios')) {
                db.createObjectStore('cortesDiarios', { keyPath: 'fecha' });
            }
        };
    });
}

// Funciones para guardar y cargar datos
async function guardarEnDB(tipo, datos) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([tipo], 'readwrite');
        const store = transaction.objectStore(tipo);
        
        if (Array.isArray(datos)) {
            const promises = datos.map(item => {
                return new Promise((resolveItem, rejectItem) => {
                    const request = store.put(item);
                    request.onsuccess = () => resolveItem();
                    request.onerror = () => rejectItem(request.error);
                });
            });
            Promise.all(promises).then(resolve).catch(reject);
        } else {
            const request = store.put(datos);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        }
    });
}

async function cargarDeDB(tipo) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([tipo], 'readonly');
        const store = transaction.objectStore(tipo);
        const request = store.getAll();

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

async function guardarEnLocal() {
    try {
        await guardarEnDB('ventas', ventas);
        await guardarEnDB('entradas', entradas);
        await guardarEnDB('salidas', salidas);
        await guardarEnDB('productos', productos);
        await guardarEnDB('clientes', clientes);
        await guardarEnDB('productosPuntos', productosPuntos);
        await guardarEnDB('configTicket', { id: 1, ...configTicket });
        console.log('Datos guardados correctamente en IndexedDB');
    } catch (error) {
        console.error('Error al guardar en IndexedDB:', error);
        alert('Error al guardar los datos. Por favor, intente nuevamente.');
    }
}

async function cargarDeLocal() {
    try {
        ventas = await cargarDeDB('ventas');
        entradas = await cargarDeDB('entradas');
        salidas = await cargarDeDB('salidas');
        productos = await cargarDeDB('productos');
        clientes = await cargarDeDB('clientes');
        productosPuntos = await cargarDeDB('productosPuntos');
        cortesDiarios = await cargarDeDB('cortesDiarios') || [];
        const config = await cargarDeDB('configTicket');
        if (config && config.length > 0) {
            configTicket = config[0];
        }
        console.log('Datos cargados correctamente de IndexedDB');
    } catch (error) {
        console.error('Error al cargar de IndexedDB:', error);
        alert('Error al cargar los datos. Por favor, recargue la página.');
    }
}

// Función para cargar la configuración del ticket
async function cargarConfigTicket() {
    try {
        // Leer SIEMPRE de IndexedDB
        if (!db) {
            await inicializarDB();
        }
        const configArr = await cargarDeDB('configTicket');
        const config = (configArr && configArr.length > 0) ? configArr[0] : configTicket;
        document.getElementById('ticketNombreTienda').value = config.nombreTienda || '';
        document.getElementById('ticketEncabezado').value = config.encabezado || '';
        document.getElementById('ticketPie').value = config.pie || '';
        document.getElementById('ticketFuente').value = config.fuente || 'monospace';
        document.getElementById('ticketTamanoFuente').value = config.tamanoFuente || '11';
        document.getElementById('ticketNegrita').checked = !!config.negrita;
        actualizarVistaPrevia();

        // Mostrar información de almacenamiento
        const info = await verificarEspacioAlmacenamiento();
        if (info) {
            const alertDiv = document.createElement('div');
            alertDiv.className = 'alert alert-info mt-3';
            alertDiv.innerHTML = `
                <h5>Uso actual de almacenamiento</h5>
                <p>Espacio usado: ${info.usado}</p>
                <p>Espacio disponible: ${info.disponible}</p>
                <p>Porcentaje usado: ${info.porcentaje}%</p>
                <h6>Detalle por colección:</h6>
                <p>Ventas: ${info.ventas} registros</p>
                <p>Entradas: ${info.entradas} registros</p>
                <p>Salidas: ${info.salidas} registros</p>
                <p>Productos: ${info.productos} registros</p>
                <p>Clientes: ${info.clientes} registros</p>
                <p>Productos Puntos: ${info.productosPuntos} registros</p>
            `;
            const configContainer = document.querySelector('#v-pills-config .card-body');
            if (configContainer) {
                const oldAlert = configContainer.querySelector('.alert-info');
                if (oldAlert) {
                    oldAlert.remove();
                }
                configContainer.insertBefore(alertDiv, configContainer.firstChild);
            }
        }
    } catch (error) {
        console.error('Error al cargar configuración:', error);
    }
}

async function guardarConfigTicket() {
    console.log('¡Botón Guardar Cambios presionado!');
    try {
        if (!db) {
            await inicializarDB();
        }
        // Limpiar el store antes de guardar (evita duplicados)
        const tx = db.transaction(['configTicket'], 'readwrite');
        const store = tx.objectStore('configTicket');
        await new Promise((resolve, reject) => {
            const clearReq = store.clear();
            clearReq.onsuccess = resolve;
            clearReq.onerror = reject;
        });

        const nuevaConfig = {
            id: 1,
            nombreTienda: document.getElementById('ticketNombreTienda').value,
            encabezado: document.getElementById('ticketEncabezado').value,
            pie: document.getElementById('ticketPie').value,
            fuente: document.getElementById('ticketFuente').value,
            tamanoFuente: document.getElementById('ticketTamanoFuente').value,
            negrita: document.getElementById('ticketNegrita').checked
        };

        await guardarEnDB('configTicket', nuevaConfig);
        configTicket = nuevaConfig;
        await cargarConfigTicket();
        alert('Configuración guardada correctamente');
    } catch (error) {
        console.error('Error al guardar la configuración:', error);
        alert('Error al guardar la configuración. Por favor, intente nuevamente.');
    }
}

// Asegura que la función esté en el ámbito global
window.guardarConfigTicket = guardarConfigTicket;

function actualizarVistaPrevia() {
    const preview = document.getElementById('ticketPreview');
    const config = {
        nombreTienda: document.getElementById('ticketNombreTienda').value,
        encabezado: document.getElementById('ticketEncabezado').value,
        pie: document.getElementById('ticketPie').value,
        fuente: document.getElementById('ticketFuente').value,
        tamanoFuente: document.getElementById('ticketTamanoFuente').value,
        negrita: document.getElementById('ticketNegrita').checked
    };

    preview.style.fontFamily = config.fuente;
    preview.style.fontSize = config.tamanoFuente + 'px';
    preview.style.fontWeight = config.negrita ? 'bold' : 'normal';

    let html = `
        <div style="text-align: center; margin-bottom: 10px;">
            <h3 style="margin: 0; font-size: ${parseInt(config.tamanoFuente) + 2}px; font-weight: ${config.negrita ? 'bold' : 'normal'};">${config.nombreTienda}</h3>
            <p style="margin: 3px 0; font-weight: ${config.negrita ? 'bold' : 'normal'};">Ticket de Venta</p>
            <p style="margin: 3px 0; font-weight: ${config.negrita ? 'bold' : 'normal'};">${new Date().toLocaleString()}</p>
            <p style="margin: 3px 0;">--------------------------------</p>
        </div>
    `;

    if (config.encabezado) {
        html += config.encabezado.split('\n').map(line => 
            `<p style="margin: 2px 0; font-weight: ${config.negrita ? 'bold' : 'normal'};">${line}</p>`
        ).join('');
        html += '<p style="margin: 2px 0;">--------------------------------</p>';
    }

    html += `
        <div style="margin-bottom: 10px;">
            <p style="margin: 2px 0; font-weight: ${config.negrita ? 'bold' : 'normal'};">PRODUCTOS:</p>
            <p style="margin: 2px 0; font-weight: ${config.negrita ? 'bold' : 'normal'};">Producto de ejemplo<br>1 x $100.00 = $100.00</p>
        </div>
        <div style="margin-top: 10px;">
            <p style="margin: 2px 0;">--------------------------------</p>
            <p style="margin: 2px 0; font-weight: ${config.negrita ? 'bold' : 'normal'};">Subtotal: $100.00</p>
            <p style="margin: 2px 0; font-weight: ${config.negrita ? 'bold' : 'normal'};">Total: $100.00</p>
            <p style="margin: 2px 0; font-weight: ${config.negrita ? 'bold' : 'normal'};">Efectivo: $150.00</p>
            <p style="margin: 2px 0; font-weight: ${config.negrita ? 'bold' : 'normal'};">Cambio: $50.00</p>
            <p style="margin: 2px 0;">--------------------------------</p>
        </div>
    `;

    if (config.pie) {
        html += config.pie.split('\n').map(line => 
            `<p style="margin: 2px 0; font-weight: ${config.negrita ? 'bold' : 'normal'};">${line}</p>`
        ).join('');
        html += '<p style="margin: 2px 0;">--------------------------------</p>';
    }

    html += `
        <div style="text-align: center; margin-top: 10px;">
            <p style="margin: 2px 0; font-weight: ${config.negrita ? 'bold' : 'normal'};">¡Gracias por su compra!</p>
            <p style="margin: 2px 0; font-weight: ${config.negrita ? 'bold' : 'normal'};">Vuelva pronto</p>
        </div>
    `;

    preview.innerHTML = html;
}

function imprimirTicket(venta) {
    console.log('Iniciando impresión de ticket:', venta);
    
    // Crear ventana de impresión
    const ventanaImpresion = window.open('', '_blank');
    if (!ventanaImpresion) {
        alert('No se pudo abrir la ventana de impresión. Por favor, permite las ventanas emergentes para este sitio.');
        return;
    }

    const estilos = `
        <style>
            @page {
                size: 80mm auto;
                margin: 0;
            }
            body { 
                margin: 0;
                padding: 0;
                width: 80mm;
                font-family: ${configTicket.fuente};
                font-size: ${configTicket.tamanoFuente}px;
                font-weight: ${configTicket.negrita ? 'bold' : 'normal'};
                line-height: 1.2;
            }
            .ticket {
                width: 80mm;
                padding: 5mm;
                margin: 0;
                box-sizing: border-box;
            }
            .ticket-header {
                text-align: center;
                margin-bottom: 5mm;
            }
            .ticket-header h3 {
                margin: 0;
                font-size: ${parseInt(configTicket.tamanoFuente) + 2}px;
                font-weight: ${configTicket.negrita ? 'bold' : 'normal'};
            }
            .ticket-content p {
                margin: 1mm 0;
                font-weight: ${configTicket.negrita ? 'bold' : 'normal'};
                font-size: ${configTicket.tamanoFuente}px;
            }
            .ticket-divider {
                margin: 2mm 0;
                border-top: 1px dashed #000;
            }
            .ticket-total {
                font-weight: bold;
                text-align: right;
                margin: 2mm 0;
            }
            .ticket-section {
                margin: 3mm 0;
            }
            .ticket-section-title {
                font-weight: bold;
                text-align: center;
                margin: 2mm 0;
            }
            .ticket-item {
                margin: 1mm 0;
                font-size: ${parseInt(configTicket.tamanoFuente) - 1}px;
            }
            @media print {
                html, body {
                    width: 80mm;
                    margin: 0;
                    padding: 0;
                }
                .ticket {
                    width: 80mm;
                    margin: 0;
                    padding: 5mm;
                }
            }
        </style>
    `;

    let contenido = '';
    const tipo = venta.tipo || 'venta';
    
    if (tipo === 'corte' || tipo === 'cierre') {
        contenido = `
            <div class="ticket">
                <div class="ticket-header">
                    <h3>${configTicket.nombreTienda}</h3>
                    <p>${tipo === 'corte' ? 'CORTE DE CAJA' : 'CIERRE DE DÍA'}</p>
                    <p>${formatearFecha(venta.fecha)}</p>
                    <div class="ticket-divider"></div>
                </div>
                <div class="ticket-content">
                    <div class="ticket-section">
                        <p class="ticket-section-title">RESUMEN DE VENTAS</p>
                        ${venta.ventas.map((v, i) => `
                            <p class="ticket-item">
                                ${i + 1}. ${formatearFecha(v.fecha)} - ${v.tipo}<br>
                                ${v.cliente ? v.cliente.nombre : '-'} - ${formatearMoneda(v.total || 0)}
                            </p>
                        `).join('')}
                        <p class="ticket-total">Total Ventas: ${formatearMoneda(venta.totales.ventas)}</p>
                        <div class="ticket-divider"></div>
                    </div>

                    <div class="ticket-section">
                        <p class="ticket-section-title">ENTRADAS DE EFECTIVO</p>
                        ${venta.entradas.map((e, i) => `
                            <p class="ticket-item">
                                ${i + 1}. ${formatearFecha(e.fecha)}<br>
                                ${e.motivo} - ${formatearMoneda(e.cantidad)}
                            </p>
                        `).join('')}
                        <p class="ticket-total">Total Entradas: ${formatearMoneda(venta.totales.entradas)}</p>
                        <div class="ticket-divider"></div>
                    </div>

                    <div class="ticket-section">
                        <p class="ticket-section-title">SALIDAS DE EFECTIVO</p>
                        ${venta.salidas.map((s, i) => `
                            <p class="ticket-item">
                                ${i + 1}. ${formatearFecha(s.fecha)}<br>
                                ${s.motivo} - ${formatearMoneda(s.cantidad)}
                            </p>
                        `).join('')}
                        <p class="ticket-total">Total Salidas: ${formatearMoneda(venta.totales.salidas)}</p>
                        <div class="ticket-divider"></div>
                    </div>

                    <div class="ticket-section">
                        <p class="ticket-total" style="font-size: ${parseInt(configTicket.tamanoFuente) + 2}px;">
                            TOTAL EN CAJA: ${formatearMoneda(venta.totales.caja)}
                        </p>
                        <div class="ticket-divider"></div>
                    </div>

                    <div class="ticket-header">
                        <p>${tipo === 'corte' ? 'Fin del Corte de Caja' : 'Fin del Día'}</p>
                        ${tipo === 'cierre' ? '<p>La caja ha sido reiniciada</p>' : ''}
                        <p>&nbsp;</p>
                        <p>&nbsp;</p>
                    </div>
                </div>
            </div>
        `;
    } else if (tipo === 'canje') {
        contenido = `
            <div class="ticket">
                <div class="ticket-header">
                    <h3>${configTicket.nombreTienda}</h3>
                    <p>Ticket de Canje</p>
                    <p>${formatearFecha(venta.fecha)}</p>
                    <div class="ticket-divider"></div>
                </div>
                <div class="ticket-content">
                    ${configTicket.encabezado ? `
                        ${configTicket.encabezado.split('\n').map(line => 
                            `<p>${line}</p>`
                        ).join('')}
                        <div class="ticket-divider"></div>
                    ` : ''}
                    
                    <p>Cliente: ${venta.cliente.nombre}</p>
                    <div class="ticket-divider"></div>
                    
                    <p>PRODUCTO CANJEADO:</p>
                    <p>${venta.producto.nombre}</p>
                    <div class="ticket-divider"></div>
                    
                    <p>Puntos anteriores: ${venta.puntosAnteriores}</p>
                    <p>Puntos gastados: ${venta.puntosGastados}</p>
                    <p>Puntos restantes: ${venta.puntosRestantes}</p>
                    <div class="ticket-divider"></div>
                    
                    ${configTicket.pie ? `
                        ${configTicket.pie.split('\n').map(line => 
                            `<p>${line}</p>`
                        ).join('')}
                        <div class="ticket-divider"></div>
                    ` : ''}
                    
                    <div class="ticket-header">
                        <p>¡Gracias por su canje!</p>
                        <p>Vuelva pronto</p>
                        <p>&nbsp;</p>
                        <p>&nbsp;</p>
                    </div>
                </div>
            </div>
        `;
    } else {
        // Ticket de venta normal
        contenido = `
            <div class="ticket">
                <div class="ticket-header">
                    <h3>${configTicket.nombreTienda}</h3>
                    <p>Ticket de Venta</p>
                    <p>${formatearFecha(venta.fecha)}</p>
                    <div class="ticket-divider"></div>
                </div>
                <div class="ticket-content">
                    ${configTicket.encabezado ? `
                        ${configTicket.encabezado.split('\n').map(line => 
                            `<p>${line}</p>`
                        ).join('')}
                        <div class="ticket-divider"></div>
                    ` : ''}
                    
                    ${venta.cliente ? `
                        <p>Cliente: ${venta.cliente.nombre}</p>
                        <div class="ticket-divider"></div>
                    ` : ''}
                    
                    <p>PRODUCTOS:</p>
                    ${venta.productos ? venta.productos.map(item => {
                        const nombre = item.nombre.length > 20 ? item.nombre.substring(0, 17) + '...' : item.nombre;
                        return `
                            <p>
                                ${nombre}<br>
                                ${item.cantidad} x $${item.precio.toFixed(2)} = $${(item.cantidad * item.precio).toFixed(2)}
                            </p>
                        `;
                    }).join('') : ''}
                    
                    <div class="ticket-divider"></div>
                    <p>Subtotal: $${(venta.subtotal || 0).toFixed(2)}</p>
                    <p>Total: $${(venta.total || 0).toFixed(2)}</p>
                    <p>Efectivo: $${(venta.efectivo || 0).toFixed(2)}</p>
                    <p>Cambio: $${(venta.cambio || 0).toFixed(2)}</p>
                    <div class="ticket-divider"></div>
                    
                    ${configTicket.pie ? `
                        ${configTicket.pie.split('\n').map(line => 
                            `<p>${line}</p>`
                        ).join('')}
                        <div class="ticket-divider"></div>
                    ` : ''}
                    
                    <div class="ticket-header">
                        <p>¡Gracias por su compra!</p>
                        <p>Vuelva pronto</p>
                        <p>&nbsp;</p>
                        <p>&nbsp;</p>
                    </div>
                </div>
            </div>
        `;
    }

    try {
        ventanaImpresion.document.write(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>${tipo === 'canje' ? 'Ticket de Canje' : tipo === 'corte' ? 'Corte de Caja' : tipo === 'cierre' ? 'Cierre de Día' : 'Ticket de Venta'}</title>
                    <meta charset="UTF-8">
                    ${estilos}
                </head>
                <body>
                    ${contenido}
                    <script>
                        window.onload = function() {
                            try {
                                window.print();
                                setTimeout(function() {
                                    window.close();
                                }, 1000);
                            } catch (error) {
                                console.error('Error al imprimir:', error);
                                alert('Error al imprimir el ticket. Por favor, intenta nuevamente.');
                            }
                        };
                    </script>
                </body>
            </html>
        `);
        ventanaImpresion.document.close();
    } catch (error) {
        console.error('Error al generar el ticket:', error);
        alert('Error al generar el ticket. Por favor, intenta nuevamente.');
        ventanaImpresion.close();
    }
}

function procesarVentaComun() {
    console.log('Iniciando procesamiento de venta común');
    const montoRecibido = parseFloat(document.getElementById('montoRecibidoComun').value);
    const total = calcularTotal();
    const cambio = montoRecibido - total;
    const puntosGanados = calcularPuntos(total);

    console.log('Monto recibido:', montoRecibido);
    console.log('Total:', total);
    console.log('Cambio:', cambio);
    console.log('Puntos ganados:', puntosGanados);
    console.log('Carrito:', carrito);

    if (!montoRecibido || montoRecibido < total) {
        alert('El monto recibido es insuficiente');
        return;
    }

    const venta = {
        fecha: new Date(),
        tipo: 'comun',
        productos: [...carrito],
        subtotal: total,
        total: total,
        efectivo: montoRecibido,
        cambio: cambio,
        puntosGanados: puntosGanados
    };

    console.log('Objeto venta:', venta);

    ventas.push(venta);
    guardarEnLocal();
    imprimirTicket(venta);
    carrito = [];
    actualizarCarrito();
    const modal = bootstrap.Modal.getInstance(document.getElementById('modalVentaComun'));
    modal.hide();
}

function procesarVentaCliente() {
    console.log('Iniciando procesamiento de venta a cliente');
    const clienteId = parseInt(document.getElementById('selectClienteVenta').value);
    if (!clienteId) {
        alert('Por favor, seleccione un cliente');
        return;
    }

    const montoRecibido = parseFloat(document.getElementById('montoRecibidoCliente').value);
    const total = calcularTotal();
    const cambio = montoRecibido - total;
    const puntosAGanar = Math.floor(total);

    console.log('Cliente ID:', clienteId);
    console.log('Monto recibido:', montoRecibido);
    console.log('Total:', total);
    console.log('Cambio:', cambio);
    console.log('Puntos a ganar:', puntosAGanar);
    console.log('Carrito:', carrito);

    if (!montoRecibido || montoRecibido < total) {
        alert('El monto recibido es insuficiente');
        return;
    }

    const cliente = clientes.find(c => c.id === clienteId);
    if (!cliente) {
        alert('Cliente no encontrado');
        return;
    }

    cliente.puntos += puntosAGanar;

    const venta = {
        fecha: new Date(),
        tipo: 'cliente',
        cliente: {...cliente},
        productos: [...carrito],
        subtotal: total,
        total: total,
        efectivo: montoRecibido,
        cambio: cambio,
        puntosGanados: puntosAGanar
    };

    console.log('Objeto venta:', venta);

    ventas.push(venta);
    guardarEnLocal();
    imprimirTicket(venta);
    carrito = [];
    actualizarCarrito();
    cargarClientes();
    const modal = bootstrap.Modal.getInstance(document.getElementById('modalVentaCliente'));
    modal.hide();
}

function imprimirTicketPrueba() {
    const ventaPrueba = {
        fecha: new Date(),
        tipo: 'prueba',
        cliente: {
            nombre: 'Cliente de Prueba',
            puntos: 100
        },
        productos: [
            {
                nombre: 'Producto de Prueba 1',
                cantidad: 2,
                precio: 50.00
            },
            {
                nombre: 'Producto de Prueba 2 con nombre muy largo para probar el truncamiento',
                cantidad: 1,
                precio: 75.50
            }
        ],
        subtotal: 175.50,
        total: 175.50,
        efectivo: 200.00,
        cambio: 24.50,
        puntosGanados: 17
    };

    imprimirTicket(ventaPrueba);
}

// Agregar después de la función cargarProductosPuntos
function mostrarHistorialCanjes() {
    const modal = new bootstrap.Modal(document.getElementById('modalHistorialCanjes'));
    
    // Filtrar solo las ventas de tipo canje
    const canjes = ventas.filter(v => v.tipo === 'canje');
    console.log('Canjes encontrados:', canjes);
    
    const tbody = document.getElementById('historialCanjesBody');
    tbody.innerHTML = '';
    
    if (canjes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay canjes registrados</td></tr>';
    } else {
        canjes.forEach((canje, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${index + 1}</td>
                <td>${canje.fecha}</td>
                <td>${canje.cliente.nombre}</td>
                <td>${canje.producto.nombre}</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="reimprimirTicketCanje(${index})">
                        <i class="bi bi-printer"></i> Reimprimir
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
    
    modal.show();
}

function reimprimirTicketCanje(index) {
    const canjes = ventas.filter(v => v.tipo === 'canje');
    if (index >= 0 && index < canjes.length) {
        const canje = canjes[index];
        console.log('Reimprimiendo ticket de canje:', canje);
        imprimirTicket(canje);
    }
}

// Funciones de gestión de productos
function cargarProductos() {
    const tbody = document.getElementById('productos-lista');
    tbody.innerHTML = '';
    
    productos.forEach((producto, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                ${producto.imagen ? 
                    `<img src="${producto.imagen}" alt="${producto.nombre}" style="width: 50px; height: 50px; object-fit: cover;">` :
                    '<i class="bi bi-image" style="font-size: 2rem;"></i>'
                }
            </td>
            <td>${producto.nombre}</td>
            <td>${formatearMoneda(producto.precio)}</td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="eliminarProducto(${index})">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function guardarProducto() {
    const nombre = document.getElementById('nombreProducto').value;
    const precio = parseFloat(document.getElementById('precioProducto').value);
    const imagenInput = document.getElementById('imagenProducto');
    
    if (!nombre || !precio) {
        alert('Por favor, complete todos los campos');
        return;
    }

    const producto = {
        nombre,
        precio,
        imagen: null
    };

    if (imagenInput.files && imagenInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            producto.imagen = e.target.result;
            agregarProducto(producto);
        };
        reader.readAsDataURL(imagenInput.files[0]);
    } else {
        agregarProducto(producto);
    }
}

function agregarProducto(producto) {
    productos.push(producto);
    guardarEnLocal();
    cargarProductos();
    mostrarProductosDisponibles();
    
    // Limpiar formulario
    document.getElementById('nombreProducto').value = '';
    document.getElementById('precioProducto').value = '';
    document.getElementById('imagenProducto').value = '';
    document.getElementById('previewImagen').style.display = 'none';
    
    // Cerrar modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('modalProducto'));
    modal.hide();
}

function eliminarProducto(index) {
    if (confirm('¿Está seguro de eliminar este producto?')) {
        productos.splice(index, 1);
        guardarEnLocal();
        cargarProductos();
        mostrarProductosDisponibles();
    }
}

function previsualizarImagen(input) {
    const preview = document.getElementById('previewImagen');
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(input.files[0]);
    } else {
        preview.style.display = 'none';
    }
}

function mostrarProductosDisponibles() {
    const contenedor = document.getElementById('productos-disponibles');
    contenedor.innerHTML = '';
    productos.forEach((producto, index) => {
        const fila = document.createElement('div');
        fila.className = 'd-flex align-items-center justify-content-between mb-3 p-2 rounded shadow-sm';
        fila.style.background = '#23264a';
        fila.innerHTML = `
            <div class="d-flex align-items-center" style="gap: 16px;">
                <div style="width: 80px; height: 80px; background: #181c2f; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                    ${producto.imagen ?
                        `<img src="${producto.imagen}" alt="${producto.nombre}" style="max-width: 76px; max-height: 76px; object-fit: contain; border-radius: 6px;">` :
                        '<i class="bi bi-image" style="font-size: 2.5rem; color: #dee2e6;"></i>'
                    }
                </div>
                <div>
                    <div style="font-weight: bold; color: #fff; font-size: 1.1rem;">${producto.nombre}</div>
                    <div class="text-primary fw-bold" style="font-size: 1.1rem;">${formatearMoneda(producto.precio)}</div>
                </div>
            </div>
            <button class="btn btn-primary btn-sm d-flex align-items-center justify-content-center" style="width: 36px; height: 36px; padding: 0;" onclick="agregarAlCarrito(${index})">
                <i class="bi bi-cart-plus" style="font-size: 1.2rem;"></i>
            </button>
        `;
        contenedor.appendChild(fila);
    });
}

function agregarAlCarrito(index) {
    const producto = productos[index];
    const itemExistente = carrito.find(item => item.nombre === producto.nombre);
    
    if (itemExistente) {
        itemExistente.cantidad++;
    } else {
        carrito.push({
            nombre: producto.nombre,
            precio: producto.precio,
            cantidad: 1
        });
    }
    
    actualizarCarrito();
}

function actualizarCarrito() {
    const tbody = document.getElementById('carrito-items');
    tbody.innerHTML = '';
    
    let total = 0;
    
    carrito.forEach((item, index) => {
        const subtotal = item.precio * item.cantidad;
        total += subtotal;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.nombre}</td>
            <td>
                <div class="input-group input-group-sm">
                    <button class="btn btn-outline-secondary" onclick="actualizarCantidad(${index}, -1)">-</button>
                    <input type="number" class="form-control text-center" value="${item.cantidad}" 
                           onchange="actualizarCantidadDirecta(${index}, this.value)" min="1">
                    <button class="btn btn-outline-secondary" onclick="actualizarCantidad(${index}, 1)">+</button>
                </div>
            </td>
            <td>${formatearMoneda(item.precio)}</td>
            <td>${formatearMoneda(subtotal)}</td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="eliminarDelCarrito(${index})">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    document.querySelector('#v-pills-caja .card-body h3').textContent = formatearMoneda(total);
    document.getElementById('puntosAGanar').textContent = Math.floor(total);
    document.getElementById('totalVentaComun').textContent = formatearMoneda(total);
    document.getElementById('totalVentaCliente').textContent = formatearMoneda(total);
}

function actualizarCantidad(index, cambio) {
    const item = carrito[index];
    const nuevaCantidad = item.cantidad + cambio;
    
    if (nuevaCantidad > 0) {
        item.cantidad = nuevaCantidad;
        actualizarCarrito();
    }
}

function actualizarCantidadDirecta(index, valor) {
    const cantidad = parseInt(valor);
    if (cantidad > 0) {
        carrito[index].cantidad = cantidad;
        actualizarCarrito();
    }
}

function eliminarDelCarrito(index) {
    carrito.splice(index, 1);
    actualizarCarrito();
}

function calcularTotal() {
    return carrito.reduce((total, item) => total + (item.precio * item.cantidad), 0);
}

function calcularPuntos(total) {
    return Math.floor(total);
}

// Funciones de gestión de clientes
function cargarClientes() {
    const tbody = document.getElementById('clientes-lista');
    const selectCliente = document.getElementById('selectCliente');
    const selectClienteVenta = document.getElementById('selectClienteVenta');
    const selectClienteCanje = document.getElementById('selectClienteCanje');
    
    // Limpiar las listas
    tbody.innerHTML = '';
    selectCliente.innerHTML = '<option value="">Seleccione un cliente</option>';
    selectClienteVenta.innerHTML = '<option value="">Seleccione un cliente</option>';
    selectClienteCanje.innerHTML = '<option value="">Seleccione un cliente</option>';
    
    clientes.forEach((cliente, index) => {
        // Agregar a la tabla
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${cliente.id}</td>
            <td>${cliente.nombre}</td>
            <td>${cliente.email}</td>
            <td>${cliente.telefono}</td>
            <td>${cliente.puntos}</td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="eliminarCliente(${index})">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
        
        // Agregar a los selectores
        const option = `<option value="${cliente.id}">${cliente.nombre}</option>`;
        selectCliente.insertAdjacentHTML('beforeend', option);
        selectClienteVenta.insertAdjacentHTML('beforeend', option);
        selectClienteCanje.insertAdjacentHTML('beforeend', option);
    });
}

function guardarCliente() {
    const nombre = document.getElementById('nombreCliente').value;
    const email = document.getElementById('emailCliente').value;
    const telefono = document.getElementById('telefonoCliente').value;
    
    if (!nombre || !email || !telefono) {
        alert('Por favor, complete todos los campos');
        return;
    }
    
    const cliente = {
        id: clientes.length + 1,
        nombre,
        email,
        telefono,
        puntos: 0
    };
    
    clientes.push(cliente);
    guardarEnLocal();
    cargarClientes();
    
    // Limpiar formulario
    document.getElementById('nombreCliente').value = '';
    document.getElementById('emailCliente').value = '';
    document.getElementById('telefonoCliente').value = '';
    
    // Cerrar modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('modalCliente'));
    modal.hide();
}

function eliminarCliente(index) {
    if (confirm('¿Está seguro de eliminar este cliente?')) {
        clientes.splice(index, 1);
        guardarEnLocal();
        cargarClientes();
    }
}

function seleccionarCliente(id) {
    if (!id) {
        clienteSeleccionado = null;
        document.getElementById('clienteSeleccionado').textContent = 'Ninguno';
        document.getElementById('puntosCliente').textContent = '0';
        return;
    }
    
    const cliente = clientes.find(c => c.id === parseInt(id));
    if (cliente) {
        clienteSeleccionado = cliente;
        document.getElementById('clienteSeleccionado').textContent = cliente.nombre;
        document.getElementById('puntosCliente').textContent = cliente.puntos;
    }
}

function actualizarInfoCliente() {
    const clienteId = parseInt(document.getElementById('selectClienteVenta').value);
    if (!clienteId) {
        document.getElementById('puntosClienteVenta').textContent = '0';
        document.getElementById('puntosAGanarVenta').textContent = '0';
        return;
    }
    
    const cliente = clientes.find(c => c.id === clienteId);
    if (cliente) {
        document.getElementById('puntosClienteVenta').textContent = cliente.puntos;
        const total = calcularTotal();
        document.getElementById('puntosAGanarVenta').textContent = Math.floor(total);
    }
}

// Funciones de gestión de productos para canje por puntos
function cargarProductosPuntos() {
    const contenedor = document.getElementById('productos-puntos');
    contenedor.innerHTML = '';
    productosPuntos.forEach((producto, index) => {
        const fila = document.createElement('div');
        fila.className = 'd-flex align-items-center justify-content-between mb-3 p-2 rounded shadow-sm';
        fila.style.background = '#23264a';
        fila.innerHTML = `
            <div class="d-flex align-items-center" style="gap: 16px;">
                <div style="width: 80px; height: 80px; background: #181c2f; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                    ${producto.imagen ?
                        `<img src="${producto.imagen}" alt="${producto.nombre}" style="max-width: 76px; max-height: 76px; object-fit: contain; border-radius: 6px;">` :
                        '<i class="bi bi-image" style="font-size: 2.5rem; color: #dee2e6;"></i>'
                    }
                </div>
                <div>
                    <div style="font-weight: bold; color: #fff; font-size: 1.1rem;">${producto.nombre}</div>
                    <div class="fw-bold" style="color: #21c87a; font-size: 1.1rem;">${producto.puntos} pts</div>
                    <div class="badge ${producto.stock > 0 ? 'bg-info' : 'bg-danger'} mt-1">Stock: ${producto.stock}</div>
                </div>
            </div>
            <button class="btn btn-success btn-sm ${producto.stock <= 0 ? 'disabled' : ''}" style="min-width: 100px;" onclick="mostrarModalSeleccionarCliente(${index})" ${producto.stock <= 0 ? 'disabled' : ''}>
                <i class="bi bi-gift"></i> Canjear
            </button>
        `;
        contenedor.appendChild(fila);
    });
}

function guardarProductoPuntos() {
    const nombre = document.getElementById('nombreProductoPuntos').value;
    const puntos = parseInt(document.getElementById('puntosProductoPuntos').value);
    const stock = parseInt(document.getElementById('stockProductoPuntos').value);
    const imagenInput = document.getElementById('imagenProductoPuntos');
    
    if (!nombre || !puntos || !stock) {
        alert('Por favor, complete todos los campos');
        return;
    }
    
    const producto = {
        nombre,
        puntos,
        stock,
        imagen: null
    };
    
    if (imagenInput.files && imagenInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            producto.imagen = e.target.result;
            agregarProductoPuntos(producto);
        };
        reader.readAsDataURL(imagenInput.files[0]);
    } else {
        agregarProductoPuntos(producto);
    }
}

function agregarProductoPuntos(producto) {
    productosPuntos.push(producto);
    guardarEnLocal();
    cargarProductosPuntos();
    
    // Limpiar formulario
    document.getElementById('nombreProductoPuntos').value = '';
    document.getElementById('puntosProductoPuntos').value = '';
    document.getElementById('stockProductoPuntos').value = '';
    document.getElementById('imagenProductoPuntos').value = '';
    document.getElementById('previewImagenPuntos').style.display = 'none';
    
    // Cerrar modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('modalPuntos'));
    modal.hide();
}

function previsualizarImagenPuntos(input) {
    const preview = document.getElementById('previewImagenPuntos');
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(input.files[0]);
    } else {
        preview.style.display = 'none';
    }
}

function mostrarModalSeleccionarCliente(index) {
    const producto = productosPuntos[index];
    document.getElementById('productoCanjeNombre').textContent = producto.nombre;
    document.getElementById('productoCanjePuntos').textContent = producto.puntos;
    
    const modal = new bootstrap.Modal(document.getElementById('modalSeleccionarCliente'));
    modal.show();
}

function realizarCanje() {
    const clienteId = parseInt(document.getElementById('selectClienteCanje').value);
    if (!clienteId) {
        alert('Por favor, seleccione un cliente');
        return;
    }
    
    const cliente = clientes.find(c => c.id === clienteId);
    const productoIndex = productosPuntos.findIndex(p => p.nombre === document.getElementById('productoCanjeNombre').textContent);
    
    if (!cliente || productoIndex === -1) {
        alert('Error al procesar el canje');
        return;
    }
    
    const producto = productosPuntos[productoIndex];
    
    if (cliente.puntos < producto.puntos) {
        alert('El cliente no tiene suficientes puntos');
        return;
    }
    
    if (producto.stock <= 0) {
        alert('No hay stock disponible de este producto');
        return;
    }
    
    // Realizar el canje
    cliente.puntos -= producto.puntos;
    producto.stock--;
    
    // Registrar la transacción
    const canje = {
        fecha: new Date(),
        tipo: 'canje',
        cliente: {...cliente},
        producto: {...producto},
        puntosAnteriores: cliente.puntos + producto.puntos,
        puntosGastados: producto.puntos,
        puntosRestantes: cliente.puntos
    };
    
    ventas.push(canje);
    guardarEnLocal();
    cargarClientes();
    cargarProductosPuntos();
    
    // Imprimir ticket
    imprimirTicket(canje);
    
    // Cerrar modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('modalSeleccionarCliente'));
    modal.hide();
}

function compartirProductosCanje() {
    const titulo = 'Acumula puntos con tus compras y gana';
    const productosHtml = productosPuntos.map(p => `
        <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 18px; background: #f8f9fa; border-radius: 8px; padding: 10px; box-shadow: 0 2px 8px #0001;">
            <div style="width: 80px; height: 80px; background: #fff; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                ${p.imagen ? `<img src='${p.imagen}' alt='${p.nombre}' style='max-width: 76px; max-height: 76px; object-fit: contain; border-radius: 6px;'>` : `<i style='font-size:2.5rem; color:#ccc;' class='bi bi-image'></i>`}
            </div>
            <div>
                <div style="font-weight: bold; font-size: 1.1rem; color: #222;">${p.nombre}</div>
                <div style="color: #21c87a; font-weight: bold;">${p.puntos} puntos</div>
            </div>
        </div>
    `).join('');
    const html = `<!DOCTYPE html>
<html lang='es'>
<head>
    <meta charset='UTF-8'>
    <title>Acumula puntos con tus compras y gana</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.7.2/font/bootstrap-icons.css">
    <style>
        body { font-family: Arial, sans-serif; background: #f4f6fb; color: #222; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; box-shadow: 0 4px 24px #0002; padding: 32px 24px; }
        h1 { text-align: center; color: #21c87a; margin-bottom: 32px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>${titulo}</h1>
        ${productosHtml}
    </div>
</body>
</html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'productos_canje.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Funciones de corte de caja
function actualizarCorte() {
    const tbodyVentas = document.getElementById('tabla-ventas-corte');
    const tbodyEntradas = document.getElementById('tabla-entradas-corte');
    const tbodySalidas = document.getElementById('tabla-salidas-corte');
    
    // Limpiar tablas
    tbodyVentas.innerHTML = '';
    tbodyEntradas.innerHTML = '';
    tbodySalidas.innerHTML = '';
    
    // Filtrar transacciones del día actual
    const hoy = new Date().toDateString();
    const ventasHoy = ventas.filter(v => new Date(v.fecha).toDateString() === hoy);
    const entradasHoy = entradas.filter(e => new Date(e.fecha).toDateString() === hoy);
    const salidasHoy = salidas.filter(s => new Date(s.fecha).toDateString() === hoy);
    
    // Actualizar corte actual
    corteActual = {
        fecha: new Date(),
        ventas: ventasHoy,
        entradas: entradasHoy,
        salidas: salidasHoy,
        totales: {
            ventas: ventasHoy.reduce((sum, v) => sum + (v.total || 0), 0),
            entradas: entradasHoy.reduce((sum, e) => sum + e.cantidad, 0),
            salidas: salidasHoy.reduce((sum, s) => sum + s.cantidad, 0),
            caja: 0
        }
    };
    
    // Calcular total en caja
    corteActual.totales.caja = corteActual.totales.ventas + 
                              corteActual.totales.entradas - 
                              corteActual.totales.salidas;
    
    // Cargar ventas
    ventasHoy.forEach((venta, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${formatearFecha(venta.fecha)}</td>
            <td>${venta.tipo}</td>
            <td>${venta.cliente ? venta.cliente.nombre : '-'}</td>
            <td>${formatearMoneda(venta.total || 0)}</td>
        `;
        tbodyVentas.appendChild(tr);
    });
    
    // Cargar entradas
    entradasHoy.forEach((entrada, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${formatearFecha(entrada.fecha)}</td>
            <td>${entrada.motivo}</td>
            <td>${formatearMoneda(entrada.cantidad)}</td>
        `;
        tbodyEntradas.appendChild(tr);
    });
    
    // Cargar salidas
    salidasHoy.forEach((salida, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${formatearFecha(salida.fecha)}</td>
            <td>${salida.motivo}</td>
            <td>${formatearMoneda(salida.cantidad)}</td>
        `;
        tbodySalidas.appendChild(tr);
    });
    
    // Actualizar total en caja
    document.getElementById('total-en-caja-corte').textContent = formatearMoneda(corteActual.totales.caja);
}

function mostrarModalCorte() {
    const modal = new bootstrap.Modal(document.getElementById('modalCorte'));
    document.getElementById('fechaCorte').value = new Date().toISOString().split('T')[0];
    actualizarCorte();
    modal.show();
}

async function realizarCorte() {
    try {
        const fechaCorte = new Date(document.getElementById('fechaCorte').value);
        const fechaInicio = new Date(fechaCorte.setHours(0, 0, 0, 0));
        const fechaFin = new Date(fechaCorte.setHours(23, 59, 59, 999));

        // Filtrar transacciones del día seleccionado
        const ventasDia = ventas.filter(v => {
            const fechaVenta = new Date(v.fecha);
            return fechaVenta >= fechaInicio && fechaVenta <= fechaFin;
        });

        const entradasDia = entradas.filter(e => {
            const fechaEntrada = new Date(e.fecha);
            return fechaEntrada >= fechaInicio && fechaEntrada <= fechaFin;
        });

        const salidasDia = salidas.filter(s => {
            const fechaSalida = new Date(s.fecha);
            return fechaSalida >= fechaInicio && fechaSalida <= fechaFin;
        });

        // Crear el objeto de corte
        const corte = {
            fecha: fechaCorte,
            tipo: 'corte',
            ventas: ventasDia,
            entradas: entradasDia,
            salidas: salidasDia,
            totales: {
                ventas: ventasDia.reduce((sum, v) => sum + (v.total || 0), 0),
                entradas: entradasDia.reduce((sum, e) => sum + e.cantidad, 0),
                salidas: salidasDia.reduce((sum, s) => sum + s.cantidad, 0),
                caja: 0
            }
        };

        // Calcular el total en caja
        corte.totales.caja = corte.totales.ventas + 
                           corte.totales.entradas - 
                           corte.totales.salidas;

        // Guardar el corte en el historial
        cortesDiarios.push(corte);
        await guardarEnDB('cortesDiarios', cortesDiarios);

        // Imprimir ticket
        imprimirTicket(corte);

        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalCorte'));
        modal.hide();

        alert('Corte realizado correctamente');
    } catch (error) {
        console.error('Error al realizar el corte:', error);
        alert('Error al realizar el corte. Por favor, intente nuevamente.');
    }
}

// Funciones de modales de venta
function mostrarModalVentaComun() {
    if (carrito.length === 0) {
        alert('El carrito está vacío');
        return;
    }
    
    const total = calcularTotal();
    document.getElementById('totalVentaComun').textContent = formatearMoneda(total);
    document.getElementById('montoRecibidoComun').value = '';
    document.getElementById('cambioVentaComun').textContent = formatearMoneda(0);
    
    const modal = new bootstrap.Modal(document.getElementById('modalVentaComun'));
    modal.show();
}

function mostrarModalVentaCliente() {
    if (carrito.length === 0) {
        alert('El carrito está vacío');
        return;
    }
    
    const total = calcularTotal();
    document.getElementById('totalVentaCliente').textContent = formatearMoneda(total);
    document.getElementById('montoRecibidoCliente').value = '';
    document.getElementById('cambioVentaCliente').textContent = formatearMoneda(0);
    
    const modal = new bootstrap.Modal(document.getElementById('modalVentaCliente'));
    modal.show();
}

function mostrarModalEntrada() {
    document.getElementById('motivoEntrada').value = '';
    document.getElementById('cantidadEntrada').value = '';
    
    const modal = new bootstrap.Modal(document.getElementById('modalEntrada'));
    modal.show();
}

function mostrarModalSalida() {
    document.getElementById('motivoSalida').value = '';
    document.getElementById('cantidadSalida').value = '';
    
    const modal = new bootstrap.Modal(document.getElementById('modalSalida'));
    modal.show();
}

function registrarEntrada() {
    const motivo = document.getElementById('motivoEntrada').value;
    const cantidad = parseFloat(document.getElementById('cantidadEntrada').value);
    
    if (!motivo || !cantidad) {
        alert('Por favor, complete todos los campos');
        return;
    }
    
    const entrada = {
        fecha: new Date(),
        motivo,
        cantidad
    };
    
    entradas.push(entrada);
    guardarEnLocal();
    actualizarCorte();
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('modalEntrada'));
    modal.hide();
}

function registrarSalida() {
    const motivo = document.getElementById('motivoSalida').value;
    const cantidad = parseFloat(document.getElementById('cantidadSalida').value);
    
    if (!motivo || !cantidad) {
        alert('Por favor, complete todos los campos');
        return;
    }
    
    const salida = {
        fecha: new Date(),
        motivo,
        cantidad
    };
    
    salidas.push(salida);
    guardarEnLocal();
    actualizarCorte();
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('modalSalida'));
    modal.hide();
}

function calcularCambioComun() {
    const montoRecibido = parseFloat(document.getElementById('montoRecibidoComun').value) || 0;
    const total = calcularTotal();
    const cambio = montoRecibido - total;
    
    document.getElementById('cambioVentaComun').textContent = formatearMoneda(cambio);
}

function calcularCambioCliente() {
    const montoRecibido = parseFloat(document.getElementById('montoRecibidoCliente').value) || 0;
    const total = calcularTotal();
    const cambio = montoRecibido - total;
    
    document.getElementById('cambioVentaCliente').textContent = formatearMoneda(cambio);
}

async function exportarDatos() {
    try {
        // Cargar todos los datos de IndexedDB
        const ventasData = await cargarDeDB('ventas');
        const entradasData = await cargarDeDB('entradas');
        const salidasData = await cargarDeDB('salidas');
        const productosData = await cargarDeDB('productos');
        const clientesData = await cargarDeDB('clientes');
        const productosPuntosData = await cargarDeDB('productosPuntos');
        const cortesDiariosData = await cargarDeDB('cortesDiarios');
        const configTicketData = await cargarDeDB('configTicket');

        const respaldo = {
            ventas: ventasData,
            entradas: entradasData,
            salidas: salidasData,
            productos: productosData,
            clientes: clientesData,
            productosPuntos: productosPuntosData,
            cortesDiarios: cortesDiariosData,
            configTicket: configTicketData
        };

        const blob = new Blob([JSON.stringify(respaldo, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `respaldo_POS_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error al exportar datos:', error);
        alert('Error al exportar los datos. Por favor, intente nuevamente.');
    }
}

// --- Inicialización ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await inicializarDB();
        await cargarDeLocal();
        cargarProductos();
        cargarClientes();
        cargarProductosPuntos();
        mostrarProductosDisponibles();
        actualizarCorte();
        cargarConfigTicket();
    } catch (error) {
        console.error('Error en la inicialización:', error);
        alert('Error al inicializar la aplicación. Por favor, recargue la página.');
    }
}); 