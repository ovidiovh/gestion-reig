/**
 * ============================================================
 * Google Apps Script — Ingesta Descuadres de Caja
 * ============================================================
 *
 * Este script corre en Google Apps Script (NO en Cowork ni en el PC).
 * Lee los emails de cierre de caja enviados por Farmatic (info@farmatic.es),
 * parsea los datos y los envía al webhook de gestion.vidalreig.com.
 *
 * INSTALACIÓN:
 * 1. Ir a https://script.google.com → Nuevo proyecto
 * 2. Pegar este código
 * 3. Configurar las constantes WEBHOOK_URL y API_KEY (líneas 20-21)
 * 4. Ejecutar manualmente `procesarEmailsDescuadres()` una vez para dar permisos
 * 5. Añadir trigger temporal:
 *    Editar → Activadores del proyecto actual → Añadir activador
 *    - Función: procesarEmailsDescuadres
 *    - Tipo: Basado en tiempo
 *    - Intervalo: Cada día, 8:00–9:00 AM
 *
 * El script es idempotente: usa etiquetas de Gmail para no reprocesar emails.
 * ============================================================
 */

// ── Configuración ──────────────────────────────────────────
const WEBHOOK_URL = "https://gestion.vidalreig.com/api/descuadres/ingestar";
const API_KEY = "PEGAR_AQUI_LA_DESCUADRES_WEBHOOK_KEY"; // Mismo valor que en Vercel

const GMAIL_QUERY = 'from:info@farmatic.es subject:"Cierre de caja" -label:descuadres-procesado';
const LABEL_PROCESADO = "descuadres-procesado";

// Orden de cajas: la primera en cerrarse es Caja 0 (cambio), luego 1-9, última 11 (ortopedia). La 10 no existe. La 12 (óptica) va aparte.
const CAJAS_ORDEN = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11];

// ── Meses en español ──
const MESES = {
  ene: "01", feb: "02", mar: "03", abr: "04",
  may: "05", jun: "06", jul: "07", ago: "08",
  sep: "09", oct: "10", nov: "11", dic: "12"
};


/**
 * Función principal — ejecutar desde trigger o manualmente.
 */
function procesarEmailsDescuadres() {
  Logger.log("=== Inicio ingesta descuadres ===");

  // Asegurar que existe la etiqueta
  let label = GmailApp.getUserLabelByName(LABEL_PROCESADO);
  if (!label) {
    label = GmailApp.createLabel(LABEL_PROCESADO);
    Logger.log("Etiqueta creada: " + LABEL_PROCESADO);
  }

  // Buscar emails no procesados
  const threads = GmailApp.search(GMAIL_QUERY, 0, 50);
  Logger.log("Threads encontrados: " + threads.length);

  if (threads.length === 0) {
    Logger.log("Sin emails nuevos. Fin.");
    return;
  }

  const cierresParsed = [];

  for (const thread of threads) {
    const messages = thread.getMessages();

    for (const msg of messages) {
      const messageId = msg.getId();
      const body = msg.getPlainBody() || msg.getBody().replace(/<[^>]+>/g, " ");
      const emailDate = msg.getDate().toISOString();

      const datos = parsearEmailCierre(body);

      if (!datos) {
        Logger.log("⚠ No se pudo parsear email " + messageId);
        continue;
      }

      cierresParsed.push({
        email_id: messageId,
        fecha_cierre: datos.fecha,
        hora_cierre: datos.hora,
        saldo: datos.saldo,
        tarjetas_dia_anterior: datos.retirado,
        descuadre: datos.diferencias,
        importe_apertura: datos.importe_apertura,
        email_fecha_envio: emailDate,
        caja: -1 // se asigna después
      });
    }

    // Marcar thread como procesado
    thread.addLabel(label);
  }

  Logger.log("Cierres parseados: " + cierresParsed.length);

  if (cierresParsed.length === 0) {
    Logger.log("Ningún cierre válido. Fin.");
    return;
  }

  // Agrupar por fecha y asignar caja por orden de hora
  const porFecha = {};
  for (const c of cierresParsed) {
    if (!porFecha[c.fecha_cierre]) porFecha[c.fecha_cierre] = [];
    porFecha[c.fecha_cierre].push(c);
  }

  const cierresFinales = [];
  for (const fecha in porFecha) {
    const grupo = porFecha[fecha];
    // Ordenar por hora de cierre
    grupo.sort(function(a, b) { return a.hora_cierre.localeCompare(b.hora_cierre); });
    // Asignar caja por posición
    for (let i = 0; i < grupo.length; i++) {
      grupo[i].caja = i < CAJAS_ORDEN.length ? CAJAS_ORDEN[i] : 99;
      cierresFinales.push(grupo[i]);
    }
  }

  Logger.log("Enviando " + cierresFinales.length + " cierres al webhook...");

  // Enviar al webhook
  const response = UrlFetchApp.fetch(WEBHOOK_URL, {
    method: "post",
    contentType: "application/json",
    headers: {
      "x-api-key": API_KEY
    },
    payload: JSON.stringify({ cierres: cierresFinales }),
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();
  const respBody = response.getContentText();

  Logger.log("Webhook response [" + status + "]: " + respBody);

  if (status !== 200) {
    Logger.log("❌ Error en webhook. Los emails se han etiquetado pero los datos no se grabaron.");
    // Nota: NO des-etiquetamos para evitar reprocesar emails rotos.
    // El admin revisará el log y puede re-ejecutar tras corregir.
  } else {
    Logger.log("✅ Ingesta completada con éxito.");
  }
}


/**
 * Parsea el body de un email de cierre de caja de Farmatic.
 * Formato: "Cierre de caja al DD/Mes./AA HH:MM. Saldo: X € Retirado: Y € Diferencias: Z € Importe apertura: W €"
 */
function parsearEmailCierre(body) {
  try {
    // Buscar "Cierre de caja al DD/Mes./AA HH:MM"
    var matchCierre = body.match(
      /Cierre de caja al\s+(\d{1,2})\/([\wáéíóúÁÉÍÓÚ.]+)\/(\d{2,4})\s+(\d{1,2}):(\d{2})/i
    );
    if (!matchCierre) return null;

    var dia = matchCierre[1].length === 1 ? "0" + matchCierre[1] : matchCierre[1];
    var mesRaw = matchCierre[2].replace(/\./g, "").toLowerCase();
    var yearRaw = matchCierre[3];
    var hora = (matchCierre[4].length === 1 ? "0" + matchCierre[4] : matchCierre[4]) + ":" + matchCierre[5];

    var mesKey = mesRaw.substring(0, 3);
    var mes = MESES[mesKey] || "01";
    var year = yearRaw.length === 2 ? "20" + yearRaw : yearRaw;
    var fecha = year + "-" + mes + "-" + dia;

    // Extraer valores
    function parseNum(label) {
      var re = new RegExp(label + ":\\s*(-?[\\d.,]+)\\s*€", "i");
      var m = body.match(re);
      if (!m) return 0;
      // Formato español: 1.234,56 → 1234.56
      return parseFloat(m[1].replace(/\./g, "").replace(",", "."));
    }

    var saldo = parseNum("Saldo");
    var retirado = parseNum("Retirado");
    var diferencias = parseNum("Diferencias");
    var importe_apertura = parseNum("Importe apertura");

    return {
      fecha: fecha,
      hora: hora,
      saldo: saldo,
      retirado: retirado,
      diferencias: diferencias,
      importe_apertura: importe_apertura
    };
  } catch (e) {
    Logger.log("Error parseando email: " + e);
    return null;
  }
}


/**
 * Función auxiliar para testear el parseo con un email de ejemplo.
 * Ejecutar manualmente desde el editor de Apps Script.
 */
function testParseo() {
  var ejemplo = "Cierre de caja al 9/Abr./26 11:19. Saldo: 194,20 € Retirado: 0,00 € Diferencias: 0,05 € Importe apertura: 194,15 €";
  var result = parsearEmailCierre(ejemplo);
  Logger.log(JSON.stringify(result));
  // Esperado: { fecha: "2026-04-09", hora: "11:19", saldo: 194.20, retirado: 0, diferencias: 0.05, importe_apertura: 194.15 }
}


/**
 * Función para reprocesar: quita la etiqueta de todos los threads
 * y vuelve a ejecutar. Útil si hubo un error en el webhook.
 * ⚠ CUIDADO: solo usar si se ha hecho un reset en la BD primero.
 */
function resetEtiquetas() {
  var label = GmailApp.getUserLabelByName(LABEL_PROCESADO);
  if (!label) {
    Logger.log("No existe la etiqueta " + LABEL_PROCESADO);
    return;
  }

  var threads = label.getThreads();
  Logger.log("Quitando etiqueta de " + threads.length + " threads...");

  for (var i = 0; i < threads.length; i++) {
    threads[i].removeLabel(label);
  }

  Logger.log("Listo. Ahora ejecuta procesarEmailsDescuadres() para reprocesar.");
}
