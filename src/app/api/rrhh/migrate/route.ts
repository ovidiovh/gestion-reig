import { db } from "@/lib/db";
import { NextResponse } from "next/server";

const FESTIVOS_2026 = [
  { fecha: "2026-01-01", nombre: "Año Nuevo", tipo: "nacional" },
  { fecha: "2026-01-06", nombre: "Epifanía del Señor", tipo: "nacional" },
  { fecha: "2026-02-17", nombre: "Martes de Carnaval", tipo: "local" },
  { fecha: "2026-04-02", nombre: "Jueves Santo", tipo: "nacional" },
  { fecha: "2026-04-03", nombre: "Viernes Santo", tipo: "nacional" },
  { fecha: "2026-05-01", nombre: "Día del Trabajo", tipo: "nacional" },
  { fecha: "2026-05-30", nombre: "Día de Canarias", tipo: "autonomico" },
  { fecha: "2026-08-15", nombre: "Asunción de la Virgen", tipo: "nacional" },
  { fecha: "2026-09-08", nombre: "Nuestra Señora del Pino", tipo: "insular" },
  { fecha: "2026-10-12", nombre: "Fiesta Nacional de España", tipo: "nacional" },
  { fecha: "2026-10-24", nombre: "Festividad de San Rafael", tipo: "local" },
  { fecha: "2026-11-02", nombre: "Todos los Santos (trasladado)", tipo: "autonomico" },
  { fecha: "2026-12-08", nombre: "Inmaculada Concepción", tipo: "autonomico" },
  { fecha: "2026-12-25", nombre: "Natividad del Señor", tipo: "nacional" },
];

// Horarios en media-horas: 8:30=17, 9:00=18, 11:30=23, 12:30=25, 13:00=26,
//   14:00=28, 15:00=30, 15:30=31, 17:00=34, 18:30=37, 20:30=41
//
// IMPORTANTE — semántica de los complementos:
//   complemento_mensual_eur   = € fijos al mes (NO depende de cuántas guardias se hagan).
//   h_lab_complemento_mensual = horas laborables/mes asociadas a ese complemento mensual
//                               (Julio/Celia: 19 h; Ani/Noelia/Dulce/Leti/Javier: 9 h).
// Ver REIG-BASE → 06-OPERATIVA-FARMACIA/nominas-rrhh.md §4.
//
// Campos nuevos (sesión 5 — módulo de nóminas):
//   nombre_formal_nomina       = nombre con el que la gestoría registra a la persona
//                                (ej. "REYES Gregoria" ↔ Yoli).
//   tipo_calculo               = enum que dice qué función del engine usar. Ver nominas-rrhh.md §5.
//   h_extras_fijas_mes         = horas extras fijas al mes (auxiliares: 4; el resto: 0).
//   h_extras_fijas_semana      = horas extras fijas por semana cuando trabaja esa semana (Zule: 4 los viernes).
//   h_extra_diaria             = horas extras por día trabajado (María: 0.5; Javier: 0.5; el resto: 0).
//   descuenta_media_en_guardia = flag: los días de guardia no se paga la h_extra_diaria (solo María).
//   incluir_en_nomina          = flag: aparece en el PDF mensual de la gestoría.
//   incluir_vacaciones         = flag: aparece en el módulo de vacaciones (distinto de `activo` que es planning).
//
// Ver REIG-BASE → 06-OPERATIVA-FARMACIA/nominas-rrhh.md §3–§5 y §9.
//   tipo_horario               = "continuo" | "partido_lv" | "lj_distinto_v".
//                                Ver rrhh/types.ts (TipoHorario) y nominas-rrhh.md §5.
//                                Paso 1.4 (2026-04-06): introducido para que el form de
//                                /rrhh/equipo pueda distinguir los 3 patrones reales sin
//                                que la lógica del V "distinto" se contamine con los que
//                                tienen un partido L-V normal (Julio, Noelia).
type EmpleadoSeed = {
  id: string; nombre: string; nombre_formal_nomina: string | null;
  categoria: string; empresa: string; farmaceutico: number; hace_guardia: number;
  complemento_mensual_eur: number; h_lab_complemento_mensual: number;
  tipo_calculo: string | null;
  h_extras_fijas_mes: number; h_extras_fijas_semana: number; h_extra_diaria: number;
  descuenta_media_en_guardia: number;
  incluir_en_nomina: number; incluir_vacaciones: number;
  orden: number; departamento: string;
  ia: number | null; fa: number | null; ib: number | null; fb: number | null;
  tipo_horario: "continuo" | "partido_lv" | "lj_distinto_v";
};

const EMPLEADOS: EmpleadoSeed[] = [
  // ── Propietarios y prácticas (no van a nómina gestoría)
  { id: "ovidio",  nombre: "Ovidio",    nombre_formal_nomina: null,              categoria: "farmaceutico", empresa: "reig",    farmaceutico: 1, hace_guardia: 1, complemento_mensual_eur: 0,   h_lab_complemento_mensual: 0,  tipo_calculo: null,                     h_extras_fijas_mes: 0, h_extras_fijas_semana: 0, h_extra_diaria: 0,   descuenta_media_en_guardia: 0, incluir_en_nomina: 0, incluir_vacaciones: 1, orden: 1,  departamento: "farmacia",  ia: 23,   fa: 41,   ib: null, fb: null, tipo_horario: "continuo" },
  { id: "bea",     nombre: "Bea",       nombre_formal_nomina: null,              categoria: "farmaceutico", empresa: "reig",    farmaceutico: 1, hace_guardia: 0, complemento_mensual_eur: 0,   h_lab_complemento_mensual: 0,  tipo_calculo: null,                     h_extras_fijas_mes: 0, h_extras_fijas_semana: 0, h_extra_diaria: 0,   descuenta_media_en_guardia: 0, incluir_en_nomina: 0, incluir_vacaciones: 1, orden: 2,  departamento: "farmacia",  ia: 14,   fa: 31,   ib: null, fb: null, tipo_horario: "continuo" },

  // ── Farmacéuticos adjuntos con nómina
  { id: "maria",   nombre: "María N.",  nombre_formal_nomina: "NARANJO María",   categoria: "farmaceutico", empresa: "reig",    farmaceutico: 1, hace_guardia: 1, complemento_mensual_eur: 180, h_lab_complemento_mensual: 0,  tipo_calculo: "farmaceutico_nocturno",  h_extras_fijas_mes: 0, h_extras_fijas_semana: 0, h_extra_diaria: 0.5, descuenta_media_en_guardia: 1, incluir_en_nomina: 1, incluir_vacaciones: 1, orden: 3,  departamento: "farmacia",  ia: 25,   fa: 41,   ib: null, fb: null, tipo_horario: "continuo" },
  { id: "julio",   nombre: "Julio",     nombre_formal_nomina: "AUYANET Julio",   categoria: "farmaceutico", empresa: "reig",    farmaceutico: 1, hace_guardia: 1, complemento_mensual_eur: 280, h_lab_complemento_mensual: 19, tipo_calculo: "farmaceutico_diurno",    h_extras_fijas_mes: 0, h_extras_fijas_semana: 0, h_extra_diaria: 0,   descuenta_media_en_guardia: 0, incluir_en_nomina: 1, incluir_vacaciones: 1, orden: 4,  departamento: "farmacia",  ia: 18,   fa: 28,   ib: 34,   fb: 40,   tipo_horario: "partido_lv" },
  { id: "celia",   nombre: "Celia",     nombre_formal_nomina: "BAUBY, Celia",    categoria: "farmaceutico", empresa: "reig",    farmaceutico: 1, hace_guardia: 1, complemento_mensual_eur: 280, h_lab_complemento_mensual: 19, tipo_calculo: "farmaceutico_diurno",    h_extras_fijas_mes: 0, h_extras_fijas_semana: 0, h_extra_diaria: 0,   descuenta_media_en_guardia: 0, incluir_en_nomina: 1, incluir_vacaciones: 1, orden: 5,  departamento: "farmacia",  ia: 18,   fa: 34,   ib: null, fb: null, tipo_horario: "continuo" },

  // ── Auxiliares de farmacia con nómina
  { id: "ani",     nombre: "Ani",       nombre_formal_nomina: "LORENZO Ana",     categoria: "auxiliar",     empresa: "reig",    farmaceutico: 0, hace_guardia: 1, complemento_mensual_eur: 30,  h_lab_complemento_mensual: 9,  tipo_calculo: "auxiliar_rotativo",      h_extras_fijas_mes: 4, h_extras_fijas_semana: 0, h_extra_diaria: 0,   descuenta_media_en_guardia: 0, incluir_en_nomina: 1, incluir_vacaciones: 1, orden: 6,  departamento: "farmacia",  ia: null, fa: null, ib: null, fb: null, tipo_horario: "continuo" },
  { id: "noelia",  nombre: "Noelia",    nombre_formal_nomina: "LORENZO Noelia",  categoria: "auxiliar",     empresa: "reig",    farmaceutico: 0, hace_guardia: 1, complemento_mensual_eur: 30,  h_lab_complemento_mensual: 9,  tipo_calculo: "auxiliar_fijo_partido",  h_extras_fijas_mes: 4, h_extras_fijas_semana: 0, h_extra_diaria: 0,   descuenta_media_en_guardia: 0, incluir_en_nomina: 1, incluir_vacaciones: 1, orden: 7,  departamento: "farmacia",  ia: 18,   fa: 26,   ib: 30,   fb: 37,   tipo_horario: "partido_lv" },
  { id: "dulce",   nombre: "Dulce",     nombre_formal_nomina: "MORALES Dulce",   categoria: "auxiliar",     empresa: "reig",    farmaceutico: 0, hace_guardia: 1, complemento_mensual_eur: 30,  h_lab_complemento_mensual: 9,  tipo_calculo: "auxiliar_rotativo",      h_extras_fijas_mes: 4, h_extras_fijas_semana: 0, h_extra_diaria: 0,   descuenta_media_en_guardia: 0, incluir_en_nomina: 1, incluir_vacaciones: 1, orden: 8,  departamento: "farmacia",  ia: null, fa: null, ib: null, fb: null, tipo_horario: "continuo" },
  { id: "leti",    nombre: "Leti",      nombre_formal_nomina: "Ruiz, Leticia",   categoria: "auxiliar",     empresa: "reig",    farmaceutico: 0, hace_guardia: 1, complemento_mensual_eur: 30,  h_lab_complemento_mensual: 9,  tipo_calculo: "auxiliar_rotativo",      h_extras_fijas_mes: 4, h_extras_fijas_semana: 0, h_extra_diaria: 0,   descuenta_media_en_guardia: 0, incluir_en_nomina: 1, incluir_vacaciones: 1, orden: 9,  departamento: "farmacia",  ia: null, fa: null, ib: null, fb: null, tipo_horario: "continuo" },
  { id: "yoli",    nombre: "Yoli",      nombre_formal_nomina: "REYES Gregoria",  categoria: "auxiliar",     empresa: "reig",    farmaceutico: 0, hace_guardia: 0, complemento_mensual_eur: 0,   h_lab_complemento_mensual: 0,  tipo_calculo: "auxiliar_rotativo",      h_extras_fijas_mes: 0, h_extras_fijas_semana: 0, h_extra_diaria: 0,   descuenta_media_en_guardia: 0, incluir_en_nomina: 1, incluir_vacaciones: 1, orden: 10, departamento: "farmacia",  ia: null, fa: null, ib: null, fb: null, tipo_horario: "continuo" },

  // ── Prácticas (sin nómina)
  { id: "davinia", nombre: "Davinia",   nombre_formal_nomina: null,              categoria: "practicas",    empresa: "reig",    farmaceutico: 0, hace_guardia: 0, complemento_mensual_eur: 0,   h_lab_complemento_mensual: 0,  tipo_calculo: null,                     h_extras_fijas_mes: 0, h_extras_fijas_semana: 0, h_extra_diaria: 0,   descuenta_media_en_guardia: 0, incluir_en_nomina: 0, incluir_vacaciones: 1, orden: 11, departamento: "farmacia",  ia: 18,   fa: 28,   ib: null, fb: null, tipo_horario: "continuo" },

  // ── Zule / Zuleica: misma persona. Contrato media jornada.
  //    L-J 16:30-20:30 (16 h base) + V 9:00-17:30 (4 h base + 4 h extras).
  //    Ver nominas-rrhh.md §5.6. tipo_horario = "lj_distinto_v" porque el V es un bloque
  //    completamente distinto (no es la misma forma L-V). Las horas de V se guardan en _b.
  { id: "zuleica", nombre: "Zuleica",   nombre_formal_nomina: "Cruz, Zule",      categoria: "auxiliar",     empresa: "reig",    farmaceutico: 0, hace_guardia: 0, complemento_mensual_eur: 0,   h_lab_complemento_mensual: 0,  tipo_calculo: "apoyo_estudiante_optica", h_extras_fijas_mes: 0, h_extras_fijas_semana: 4, h_extra_diaria: 0,   descuenta_media_en_guardia: 0, incluir_en_nomina: 1, incluir_vacaciones: 1, orden: 12, departamento: "optica",    ia: 33,   fa: 41,   ib: null, fb: null, tipo_horario: "lj_distinto_v" },

  // ── Óptica / ortopedia (nómina fija Reig — sin variables)
  //    Miriam y Mónica: auxiliares no farmacéuticas (óptica / ortopedia), turno fijo
  //    continuo de mañana. Van al PDF de nómina de Reig pero SIN variables: la gestoría
  //    ya conoce los valores fijos, el motor devuelve hardcodeados (igual que Luisa con
  //    mirelus_fija_gestoria). Ver nominas-rrhh.md §5.8. Paso 1.5 sesión 5 2026-04-06.
  { id: "miriam",  nombre: "Miriam",    nombre_formal_nomina: null,              categoria: "auxiliar",     empresa: "reig",    farmaceutico: 0, hace_guardia: 0, complemento_mensual_eur: 0,   h_lab_complemento_mensual: 0,  tipo_calculo: "reig_fija_gestoria",     h_extras_fijas_mes: 0, h_extras_fijas_semana: 0, h_extra_diaria: 0,   descuenta_media_en_guardia: 0, incluir_en_nomina: 1, incluir_vacaciones: 1, orden: 13, departamento: "optica",    ia: 18,   fa: 34,   ib: null, fb: null, tipo_horario: "continuo" },
  { id: "monica",  nombre: "Mónica",    nombre_formal_nomina: null,              categoria: "auxiliar",     empresa: "reig",    farmaceutico: 0, hace_guardia: 0, complemento_mensual_eur: 0,   h_lab_complemento_mensual: 0,  tipo_calculo: "reig_fija_gestoria",     h_extras_fijas_mes: 0, h_extras_fijas_semana: 0, h_extra_diaria: 0,   descuenta_media_en_guardia: 0, incluir_en_nomina: 1, incluir_vacaciones: 1, orden: 15, departamento: "ortopedia", ia: 18,   fa: 34,   ib: null, fb: null, tipo_horario: "continuo" },

  // ── Personal Mirelus
  //    Javi: único activo en horarios. Mantenimiento. h_extra_diaria = 0.5 h (ver §5.5).
  { id: "javier",  nombre: "Javier M.", nombre_formal_nomina: "Martel, Javier",  categoria: "mantenimiento", empresa: "mirelus", farmaceutico: 0, hace_guardia: 1, complemento_mensual_eur: 60,  h_lab_complemento_mensual: 9,  tipo_calculo: "mirelus_mantenimiento",  h_extras_fijas_mes: 4, h_extras_fijas_semana: 0, h_extra_diaria: 0.5, descuenta_media_en_guardia: 0, incluir_en_nomina: 1, incluir_vacaciones: 1, orden: 14, departamento: "optica",    ia: 18,   fa: 34,   ib: null, fb: null, tipo_horario: "continuo" },
  //    Tere: limpieza fija 8 h extras al mes. NO aparece en planning (activo=0) pero SÍ en vacaciones y nómina.
  //    Confirmado por Beatriz 2026-04-07: son 8 horas extras fijas al mes → h_extras_fijas_mes=8.
  { id: "teresa",  nombre: "M. Teresa", nombre_formal_nomina: "Santana, M Teresa", categoria: "limpieza",   empresa: "mirelus", farmaceutico: 0, hace_guardia: 0, complemento_mensual_eur: 0,   h_lab_complemento_mensual: 0,  tipo_calculo: "mirelus_limpieza_fija",  h_extras_fijas_mes: 8, h_extras_fijas_semana: 0, h_extra_diaria: 0,   descuenta_media_en_guardia: 0, incluir_en_nomina: 1, incluir_vacaciones: 1, orden: 16, departamento: "otro",      ia: 17,   fa: 24,   ib: null, fb: null, tipo_horario: "continuo" },
  //    Dolores: suplente de Tere en sus vacaciones. Creada en sesión 5. Los meses que no sustituye aparece con 0 h.
  { id: "dolores", nombre: "Dolores",   nombre_formal_nomina: "Estupiñán, Dolores", categoria: "limpieza", empresa: "mirelus", farmaceutico: 0, hace_guardia: 0, complemento_mensual_eur: 0,   h_lab_complemento_mensual: 0,  tipo_calculo: "mirelus_suplente",       h_extras_fijas_mes: 0, h_extras_fijas_semana: 0, h_extra_diaria: 0,   descuenta_media_en_guardia: 0, incluir_en_nomina: 1, incluir_vacaciones: 1, orden: 17, departamento: "otro",      ia: null, fa: null, ib: null, fb: null, tipo_horario: "continuo" },
  //    Luisa: nómina fija ya conocida por la gestoría. Solo archivar — el motor devuelve valores fijos.
  { id: "luisa",   nombre: "Luisa",     nombre_formal_nomina: "Schmidt, Luisa",  categoria: "otro",         empresa: "mirelus", farmaceutico: 0, hace_guardia: 0, complemento_mensual_eur: 0,   h_lab_complemento_mensual: 0,  tipo_calculo: "mirelus_fija_gestoria",  h_extras_fijas_mes: 0, h_extras_fijas_semana: 0, h_extra_diaria: 0,   descuenta_media_en_guardia: 0, incluir_en_nomina: 1, incluir_vacaciones: 0, orden: 18, departamento: "otro",      ia: 17,   fa: 24,   ib: null, fb: null, tipo_horario: "continuo" },

  // ── Jenny: Ovidio confirmó 2026-04-06 sesión 5 que no sabe quién es. Fuera de nómina y vacaciones.
  { id: "jenny",   nombre: "Jenny",     nombre_formal_nomina: null,              categoria: "auxiliar",     empresa: "reig",    farmaceutico: 0, hace_guardia: 0, complemento_mensual_eur: 0,   h_lab_complemento_mensual: 0,  tipo_calculo: null,                     h_extras_fijas_mes: 0, h_extras_fijas_semana: 0, h_extra_diaria: 0,   descuenta_media_en_guardia: 0, incluir_en_nomina: 0, incluir_vacaciones: 0, orden: 19, departamento: "farmacia",  ia: 18,   fa: 34,   ib: null, fb: null, tipo_horario: "continuo" },
];

// Slots de guardia por defecto
// Javier: turno partido 9:00-14:00 y 20:00-23:00 (hora_inicio2 / hora_fin2)
const GUARD_DEFAULTS = [
  { empleado_id: "ani",    hora_inicio: 9,  hora_fin: 14, hora_inicio2: null, hora_fin2: null },
  { empleado_id: "dulce",  hora_inicio: 10, hora_fin: 14, hora_inicio2: null, hora_fin2: null },
  { empleado_id: "ovidio", hora_inicio: 9,  hora_fin: 16, hora_inicio2: null, hora_fin2: null },
  { empleado_id: "noelia", hora_inicio: 14, hora_fin: 18, hora_inicio2: null, hora_fin2: null },
  { empleado_id: "leti",   hora_inicio: 16, hora_fin: 21, hora_inicio2: null, hora_fin2: null },
  { empleado_id: "celia",  hora_inicio: 16, hora_fin: 20, hora_inicio2: null, hora_fin2: null },
  { empleado_id: "julio",  hora_inicio: 19, hora_fin: 21, hora_inicio2: null, hora_fin2: null },
  { empleado_id: "javier", hora_inicio: 9,  hora_fin: 14, hora_inicio2: 20,   hora_fin2: 23   },
  { empleado_id: "maria",  hora_inicio: 21, hora_fin: 33, hora_inicio2: null, hora_fin2: null },
];

export async function POST() {
  try {
    // ─── Sesión 10 (2026-04-08) — Paso 3.0: Ausencias unificadas ───
    // La tabla `rrhh_ausencias` nació en una migración anterior como esqueleto
    // mínimo (fecha / tipo / nota) pero NADIE la llegó a consumir — grep
    // confirmado sobre todo el árbol src/. En esta sesión la redefinimos
    // como el modelo unificado de ausencias (vacaciones + IT + permisos +
    // horas sueltas) definido en REIG-BASE → 06-OPERATIVA-FARMACIA/
    // ausencias-y-permisos.md §6.
    //
    // Como el schema viejo es incompatible con el nuevo y la tabla no tiene
    // consumidores, la borramos SÓLO si detectamos el schema v1 (tiene
    // columna `fecha` pero no `fecha_inicio`). Idempotente: si ya se ha
    // migrado a v2 o la tabla no existe, no hace nada.
    try {
      const info = await db.execute(`PRAGMA table_info(rrhh_ausencias)`);
      const rows = ((info as unknown) as { rows: Array<{ name: string }> }).rows ?? [];
      const tieneFechaInicio = rows.some((r) => r.name === "fecha_inicio");
      const tieneFecha = rows.some((r) => r.name === "fecha");
      if (rows.length > 0 && tieneFecha && !tieneFechaInicio) {
        await db.execute(`DROP TABLE rrhh_ausencias`);
      }
    } catch {
      /* PRAGMA o DROP fallando significa base nueva — seguimos */
    }

    // 1. Crear tablas base
    await db.executeMultiple(`
      CREATE TABLE IF NOT EXISTS rrhh_empleados (
        id                  TEXT PRIMARY KEY,
        nombre              TEXT NOT NULL,
        categoria           TEXT NOT NULL DEFAULT 'auxiliar',
        empresa             TEXT NOT NULL DEFAULT 'reig',
        farmaceutico        INTEGER NOT NULL DEFAULT 0,
        hace_guardia        INTEGER NOT NULL DEFAULT 0,
        complemento_mensual_eur     INTEGER NOT NULL DEFAULT 0,
        h_lab_complemento_mensual   INTEGER NOT NULL DEFAULT 0,
        activo              INTEGER NOT NULL DEFAULT 1,
        orden               INTEGER NOT NULL DEFAULT 99
      );

      CREATE TABLE IF NOT EXISTS rrhh_festivos (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha     TEXT NOT NULL UNIQUE,
        nombre    TEXT NOT NULL,
        tipo      TEXT NOT NULL DEFAULT 'nacional',
        override  INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS rrhh_guardias (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha      TEXT NOT NULL UNIQUE,
        tipo       TEXT NOT NULL DEFAULT 'lab',
        publicada  INTEGER NOT NULL DEFAULT 0,
        notas      TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS rrhh_guardia_slots (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        guardia_id   INTEGER NOT NULL REFERENCES rrhh_guardias(id) ON DELETE CASCADE,
        empleado_id  TEXT NOT NULL REFERENCES rrhh_empleados(id),
        hora_inicio  INTEGER NOT NULL DEFAULT 9,
        hora_fin     INTEGER NOT NULL DEFAULT 14,
        hora_inicio2 INTEGER,
        hora_fin2    INTEGER,
        UNIQUE(guardia_id, empleado_id)
      );

      CREATE TABLE IF NOT EXISTS rrhh_guardia_defaults (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        empleado_id  TEXT NOT NULL UNIQUE REFERENCES rrhh_empleados(id),
        hora_inicio  INTEGER NOT NULL DEFAULT 9,
        hora_fin     INTEGER NOT NULL DEFAULT 14,
        hora_inicio2 INTEGER,
        hora_fin2    INTEGER
      );

      CREATE TABLE IF NOT EXISTS rrhh_vacaciones (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        empleado_id  TEXT NOT NULL REFERENCES rrhh_empleados(id),
        fecha_inicio TEXT NOT NULL,
        fecha_fin    TEXT NOT NULL,
        estado       TEXT NOT NULL DEFAULT 'pend',
        tipo         TEXT NOT NULL DEFAULT 'vac',
        created_at   TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- ─── Modelo unificado de ausencias (sesión 10, 2026-04-08) ───
      -- Reemplaza a rrhh_vacaciones (que queda viva como red de seguridad
      -- durante la transición). Cubre vacaciones, asuntos propios,
      -- compensatorios, IT, y los 20+ permisos del Convenio XXV + Estatuto
      -- de los Trabajadores. Ver REIG-BASE → ausencias-y-permisos.md §6.
      --
      -- Campos clave:
      --   tipo              TEXT libre validado en TypeScript (no enum SQL
      --                     para que añadir un tipo nuevo no requiera ALTER).
      --                     Valores típicos: vac, ap, comp, it_enf, it_acc,
      --                     it_acc_laboral, matrimonio, fallecimiento,
      --                     hospitalizacion, intervencion_reposo, mudanza,
      --                     deber_publico, lactancia, lactancia_acumulada,
      --                     permiso_parental, fuerza_mayor, catastrofe,
      --                     cuidado_menor_grave, embarazo_riesgo, examenes,
      --                     medico_propio, medico_acompanante, otros.
      --   hora_inicio/fin   NULLABLE en media-horas desde medianoche (mismo
      --                     sistema que rrhh_guardia_slots). NULL = día
      --                     completo. Permite permisos de horas sueltas.
      --   retribuida        1 = cuenta como trabajada a efectos de salario.
      --                     0 = permiso no retribuido (ej. permiso parental).
      --   bolsa_id          FK opcional a rrhh_bolsa_vacaciones. Si está
      --                     informado, esta ausencia consume días de esa
      --                     bolsa arrastrada en vez del saldo del año.
      --   banco_horas_id    FK opcional a rrhh_banco_horas. Si está
      --                     informado, esta ausencia de horas sueltas se
      --                     compensa contra el banco de horas (caso
      --                     acompañamiento médico, llegada tarde, etc.).
      CREATE TABLE IF NOT EXISTS rrhh_ausencias (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        empleado_id     TEXT NOT NULL REFERENCES rrhh_empleados(id),
        fecha_inicio    TEXT NOT NULL,
        fecha_fin       TEXT NOT NULL,
        hora_inicio     INTEGER,
        hora_fin        INTEGER,
        tipo            TEXT NOT NULL DEFAULT 'vac',
        estado          TEXT NOT NULL DEFAULT 'pend',
        retribuida      INTEGER NOT NULL DEFAULT 1,
        bolsa_id        INTEGER REFERENCES rrhh_bolsa_vacaciones(id),
        banco_horas_id  INTEGER REFERENCES rrhh_banco_horas(id),
        notas           TEXT,
        created_at      TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_ausencias_empleado
        ON rrhh_ausencias(empleado_id);
      CREATE INDEX IF NOT EXISTS idx_ausencias_fechas
        ON rrhh_ausencias(fecha_inicio, fecha_fin);

      -- ─── Bolsa de vacaciones arrastradas (sesión 10, 2026-04-08) ───
      -- Excepción del art. 38.3 ET: las vacaciones no disfrutadas en el año
      -- natural por coincidir con IT, riesgo de embarazo, parto o cuidado
      -- de menor, se arrastran al año siguiente hasta 18 meses desde el fin
      -- del año de origen. El resto de casos NO se arrastran (imperativo
      -- legal). Cada fila de esta tabla es UNA bolsa que el empleado puede
      -- consumir creando ausencias con bolsa_id apuntando aquí.
      CREATE TABLE IF NOT EXISTS rrhh_bolsa_vacaciones (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        empleado_id  TEXT NOT NULL REFERENCES rrhh_empleados(id),
        anio_origen  INTEGER NOT NULL,
        dias         REAL NOT NULL,
        dias_usados  REAL NOT NULL DEFAULT 0,
        motivo       TEXT NOT NULL DEFAULT 'manual',
        estado       TEXT NOT NULL DEFAULT 'disponible',
        caduca_en    TEXT,
        notas        TEXT,
        created_at   TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_bolsa_empleado
        ON rrhh_bolsa_vacaciones(empleado_id);

      CREATE TABLE IF NOT EXISTS rrhh_horarios_asignacion (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        week_start   TEXT NOT NULL,
        empleado_id  TEXT NOT NULL REFERENCES rrhh_empleados(id),
        turno        INTEGER NOT NULL DEFAULT 1,
        notas        TEXT,
        UNIQUE(week_start, empleado_id)
      );

      CREATE TABLE IF NOT EXISTS rrhh_banco_horas (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        empleado_id  TEXT NOT NULL REFERENCES rrhh_empleados(id),
        fecha        TEXT NOT NULL,
        concepto     TEXT NOT NULL DEFAULT 'deuda',
        minutos      INTEGER NOT NULL,
        notas        TEXT,
        created_at   TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS rrhh_turnos_config (
        turno        INTEGER PRIMARY KEY,  -- 0=Esp, 1=T1, 2=T2, 3=T3
        inicio_a     INTEGER NOT NULL,
        fin_a        INTEGER NOT NULL,
        inicio_b     INTEGER,
        fin_b        INTEGER
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_email  TEXT NOT NULL,
        usuario_nombre TEXT NOT NULL DEFAULT '',
        accion         TEXT NOT NULL,
        modulo         TEXT NOT NULL,
        detalle        TEXT,
        fecha          TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- ─── Sesión 9 (2026-04-07) — Paso 2.1: Histórico de PDFs de nóminas ───
      -- Una fila por (mes, empresa, version). Cada vez que Beatriz/Ovidio
      -- pulsan "Cerrar mes" en /rrhh/nominas se incrementa la version y se
      -- crea una nueva fila — NUNCA se sobrescribe ni se borra. La auditoría
      -- depende de poder volver a cualquier versión histórica.
      --
      -- El campo resumen_json es el snapshot completo del ResumenMes del motor en el
      -- momento del cierre, lo que permite regenerar el PDF determinísticamente
      -- y verificar que el hash coincide con el almacenado en Drive.
      --
      -- Storage físico de los PDFs: Google Drive (carpeta compartida del
      -- propietario), implementado en src/lib/nomina/storage/google-drive.ts.
      -- La interfaz NominaStorageAdapter permite migrar a OneDrive sin tocar
      -- nada de esta tabla.
      --
      -- Ver REIG-BASE → 06-OPERATIVA-FARMACIA/nominas-rrhh.md §9.1.
      CREATE TABLE IF NOT EXISTS rrhh_nominas_historial (
        id                  TEXT PRIMARY KEY,
        mes                 TEXT NOT NULL,
        empresa             TEXT NOT NULL,
        version             INTEGER NOT NULL,
        cerrado_at          TEXT NOT NULL,
        cerrado_por_email   TEXT NOT NULL,
        hash_pdf            TEXT NOT NULL,
        bytes_pdf           INTEGER NOT NULL,
        drive_file_id       TEXT NOT NULL,
        drive_web_view_link TEXT NOT NULL,
        drive_folder_id     TEXT NOT NULL,
        resumen_json        TEXT NOT NULL,
        notas               TEXT,
        obsoleto            INTEGER NOT NULL DEFAULT 0,
        UNIQUE (mes, empresa, version)
      );
      CREATE INDEX IF NOT EXISTS idx_historial_mes
        ON rrhh_nominas_historial(mes);
      CREATE INDEX IF NOT EXISTS idx_historial_empresa_mes
        ON rrhh_nominas_historial(empresa, mes);
    `);

    // 1b. Migraciones idempotentes (añadir columnas si no existen)
    const alterations = [
      `ALTER TABLE rrhh_vacaciones ADD COLUMN tipo TEXT NOT NULL DEFAULT 'vac'`,
      `ALTER TABLE rrhh_guardia_slots ADD COLUMN hora_inicio2 INTEGER`,
      `ALTER TABLE rrhh_guardia_slots ADD COLUMN hora_fin2 INTEGER`,
      `ALTER TABLE rrhh_guardia_defaults ADD COLUMN hora_inicio2 INTEGER`,
      `ALTER TABLE rrhh_guardia_defaults ADD COLUMN hora_fin2 INTEGER`,
      // Ajuste manual del contador de guardias realizadas (nullable = usar valor calculado)
      `ALTER TABLE rrhh_empleados ADD COLUMN guardias_manual INTEGER`,
      // Departamento del empleado (farmacia, optica, ortopedia, otro)
      `ALTER TABLE rrhh_empleados ADD COLUMN departamento TEXT NOT NULL DEFAULT 'farmacia'`,
      // Horario fijo en media-horas (null = usar horario por defecto del código)
      `ALTER TABLE rrhh_empleados ADD COLUMN horario_inicio_a INTEGER`,
      `ALTER TABLE rrhh_empleados ADD COLUMN horario_fin_a INTEGER`,
      `ALTER TABLE rrhh_empleados ADD COLUMN horario_inicio_b INTEGER`,
      `ALTER TABLE rrhh_empleados ADD COLUMN horario_fin_b INTEGER`,
      // Cubre franja nocturna en guardias (genera 0,5 día compensatorio por guardia)
      `ALTER TABLE rrhh_empleados ADD COLUMN cubre_nocturna INTEGER NOT NULL DEFAULT 0`,
      // Rename: los antiguos nombres "complemento_eur" y "h_lab_complemento" daban
      // a entender que el dinero era POR guardia. En realidad son complementos
      // SALARIALES MENSUALES FIJOS, independientes de las guardias hechas.
      // Ver REIG-BASE → 06-OPERATIVA-FARMACIA/nominas-rrhh.md §4.
      `ALTER TABLE rrhh_empleados RENAME COLUMN complemento_eur TO complemento_mensual_eur`,
      `ALTER TABLE rrhh_empleados RENAME COLUMN h_lab_complemento TO h_lab_complemento_mensual`,

      // ─── Sesión 5 (2026-04-06) — campos del módulo de nóminas ───
      // Ver REIG-BASE → 06-OPERATIVA-FARMACIA/nominas-rrhh.md §3–§5 y §9.
      //
      // Nombre con el que la gestoría registra a la persona (ej. "REYES Gregoria" ↔ Yoli).
      `ALTER TABLE rrhh_empleados ADD COLUMN nombre_formal_nomina TEXT`,
      // Enum que dice qué función del engine de nóminas usar.
      // Valores: 'auxiliar_rotativo' | 'auxiliar_fijo_partido' | 'farmaceutico_diurno' |
      //          'farmaceutico_nocturno' | 'apoyo_estudiante_optica' | 'mirelus_mantenimiento' |
      //          'mirelus_limpieza_fija' | 'mirelus_suplente' | 'mirelus_fija_gestoria' | null
      `ALTER TABLE rrhh_empleados ADD COLUMN tipo_calculo TEXT`,
      // Horas extras fijas al mes (auxiliares farmacia: 4; Javier: 4; el resto: 0).
      `ALTER TABLE rrhh_empleados ADD COLUMN h_extras_fijas_mes INTEGER NOT NULL DEFAULT 0`,
      // Horas extras fijas por semana cuando trabaja (Zule: 4 los viernes que cubre).
      `ALTER TABLE rrhh_empleados ADD COLUMN h_extras_fijas_semana INTEGER NOT NULL DEFAULT 0`,
      // Horas extras por día laborable trabajado (María: 0.5; Javier: 0.5; el resto: 0).
      // REAL porque admite decimales.
      `ALTER TABLE rrhh_empleados ADD COLUMN h_extra_diaria REAL NOT NULL DEFAULT 0`,
      // Flag: los días de guardia no se paga la h_extra_diaria (solo María — ver §5.4 y §7).
      `ALTER TABLE rrhh_empleados ADD COLUMN descuenta_media_en_guardia INTEGER NOT NULL DEFAULT 0`,
      // Flag: aparece en el PDF mensual de la gestoría. Distinto de `activo` (que es planning).
      `ALTER TABLE rrhh_empleados ADD COLUMN incluir_en_nomina INTEGER NOT NULL DEFAULT 0`,
      // Flag: aparece en el módulo de vacaciones. Distinto de `activo` (que es planning).
      // Necesario porque Tere/Dolores no están en el planning pero sí deben poder tener vacaciones.
      `ALTER TABLE rrhh_empleados ADD COLUMN incluir_vacaciones INTEGER NOT NULL DEFAULT 1`,

      // ─── Sesión 5 — Paso 1.4 (2026-04-06) ───
      // Tipo de horario base del empleado. Ver rrhh/types.ts (TipoHorario).
      // Valores: 'continuo' | 'partido_lv' | 'lj_distinto_v'.
      // Default 'continuo' — cubre el caso más común (un único bloque L-V).
      // Motivación: el form anterior usaba el flag _b como "viernes distinto",
      // lo que impedía registrar partidos L-V reales (Julio, Noelia).
      // Ver nominas-rrhh.md §5 y diseno-modulo-nominas.md.
      `ALTER TABLE rrhh_empleados ADD COLUMN tipo_horario TEXT NOT NULL DEFAULT 'continuo'`,
    ];
    for (const sql of alterations) {
      try { await db.execute(sql); } catch { /* columna ya existe — ignorar */ }
    }

    // 1d. Migración idempotente de rrhh_vacaciones → rrhh_ausencias
    //
    // Mientras vivamos en paralelo las dos tablas (rrhh_vacaciones como red
    // de seguridad, rrhh_ausencias como modelo nuevo), esta pasada copia a
    // rrhh_ausencias las filas de rrhh_vacaciones que todavía no estén
    // replicadas. Es idempotente: detecta la colisión por la tupla
    // (empleado_id, fecha_inicio, fecha_fin, tipo).
    //
    // Tipos existentes en rrhh_vacaciones (vac, ap, comp) se mapean 1:1 y
    // todos son retribuidos. Los tipos nuevos (it_*, matrimonio, etc.) no
    // existen en rrhh_vacaciones → no hay nada que mapear.
    //
    // Cuando el motor de nómina esté probado leyendo ya rrhh_ausencias
    // durante un par de cierres de mes, se podrá dejar de escribir en
    // rrhh_vacaciones y eventualmente deprecarla — en una sesión futura.
    try {
      await db.execute({
        sql: `INSERT INTO rrhh_ausencias
                (empleado_id, fecha_inicio, fecha_fin, tipo, estado, retribuida, notas)
              SELECT v.empleado_id, v.fecha_inicio, v.fecha_fin,
                     COALESCE(v.tipo, 'vac'),
                     COALESCE(v.estado, 'pend'),
                     1,
                     NULL
              FROM rrhh_vacaciones v
              WHERE NOT EXISTS (
                SELECT 1 FROM rrhh_ausencias a
                WHERE a.empleado_id = v.empleado_id
                  AND a.fecha_inicio = v.fecha_inicio
                  AND a.fecha_fin   = v.fecha_fin
                  AND a.tipo        = COALESCE(v.tipo, 'vac')
              )`,
        args: [],
      });
    } catch (e) {
      console.warn("[rrhh/migrate] Migración vacaciones→ausencias:", e);
    }

    // 2. Seed empleados (upsert)
    //
    // Estrategia:
    //   - INSERT crea la fila con TODOS los campos (incluidos los nuevos de nóminas).
    //   - ON CONFLICT solo fuerza los campos maestros que queremos alinear con el seed
    //     en cada despliegue (nombre, departamento, y los campos nuevos del módulo de nóminas).
    //   - NO se tocan en el ON CONFLICT: complemento_mensual_eur, h_lab_complemento_mensual,
    //     hace_guardia, activo, orden, ni los horarios — porque pueden haber sido editados
    //     desde la UI y no queremos pisarlos. Los valores del seed son la semilla inicial.
    //   - EXCEPCIÓN: los campos nuevos del módulo de nóminas SÍ se fuerzan en esta primera
    //     migración para garantizar un estado conocido. Cuando haya UI de edición, se quitará
    //     el forzado de los campos que el usuario pueda tocar desde /rrhh/equipo.
    for (const e of EMPLEADOS) {
      await db.execute({
        sql: `INSERT INTO rrhh_empleados
              (id, nombre, categoria, empresa, farmaceutico, hace_guardia,
               complemento_mensual_eur, h_lab_complemento_mensual, orden, departamento,
               horario_inicio_a, horario_fin_a, horario_inicio_b, horario_fin_b,
               nombre_formal_nomina, tipo_calculo,
               h_extras_fijas_mes, h_extras_fijas_semana, h_extra_diaria,
               descuenta_media_en_guardia, incluir_en_nomina, incluir_vacaciones,
               tipo_horario)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                nombre                     = excluded.nombre,
                departamento               = excluded.departamento,
                nombre_formal_nomina       = excluded.nombre_formal_nomina,
                tipo_calculo               = excluded.tipo_calculo,
                h_extras_fijas_mes         = excluded.h_extras_fijas_mes,
                h_extras_fijas_semana      = excluded.h_extras_fijas_semana,
                h_extra_diaria             = excluded.h_extra_diaria,
                descuenta_media_en_guardia = excluded.descuenta_media_en_guardia,
                incluir_en_nomina          = excluded.incluir_en_nomina,
                incluir_vacaciones         = excluded.incluir_vacaciones,
                tipo_horario               = excluded.tipo_horario`,
        args: [
          e.id, e.nombre, e.categoria, e.empresa, e.farmaceutico, e.hace_guardia,
          e.complemento_mensual_eur, e.h_lab_complemento_mensual, e.orden, e.departamento,
          e.ia, e.fa, e.ib, e.fb,
          e.nombre_formal_nomina, e.tipo_calculo,
          e.h_extras_fijas_mes, e.h_extras_fijas_semana, e.h_extra_diaria,
          e.descuenta_media_en_guardia, e.incluir_en_nomina, e.incluir_vacaciones,
          e.tipo_horario,
        ],
      });
    }

    // 1c. Seed turnos_config (upsert — usa TURNO_HORARIO como valores por defecto)
    const TURNOS_SEED = [
      { turno: 0, inicio_a: 17, fin_a: 25, inicio_b: null, fin_b: null },  // Esp: 8:30–12:30
      { turno: 1, inicio_a: 17, fin_a: 33, inicio_b: null, fin_b: null },  // T1:  8:30–16:30
      { turno: 2, inicio_a: 18, fin_a: 26, inicio_b: 32,   fin_b: 40   },  // T2:  9–13 / 16–20
      { turno: 3, inicio_a: 25, fin_a: 41, inicio_b: null, fin_b: null },  // T3:  12:30–20:30
    ];
    for (const t of TURNOS_SEED) {
      await db.execute({
        sql: `INSERT INTO rrhh_turnos_config (turno, inicio_a, fin_a, inicio_b, fin_b)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(turno) DO NOTHING`,
        args: [t.turno, t.inicio_a, t.fin_a, t.inicio_b, t.fin_b],
      });
    }

    // 2b. Desactivar empleados que no deben aparecer en el planning.
    // Nota (sesión 5): `activo = 0` solo controla la visibilidad en el planning de horarios.
    // Tere y Dolores tienen `incluir_vacaciones = 1` en el seed, así que cuando el módulo de
    // vacaciones amplíe su query a `(activo = 1 OR incluir_vacaciones = 1)` seguirán apareciendo.
    await db.execute({ sql: `UPDATE rrhh_empleados SET activo = 0 WHERE id IN ('luisa', 'teresa', 'dolores', 'jenny', 'mirelus')`, args: [] });

    // 2c. Marcar quién cubre la franja nocturna de la guardia.
    // Sólo quien hace la franja nocturna acumula 0,5 días de descanso compensatorio
    // por guardia (regla XXV Convenio + práctica histórica de la farmacia).
    // Hoy: sólo María. El campo es editable desde la página de Equipo.
    await db.execute({ sql: `UPDATE rrhh_empleados SET cubre_nocturna = 1 WHERE id = 'maria'`, args: [] });

    // 3. Seed festivos 2026
    for (const f of FESTIVOS_2026) {
      await db.execute({
        sql: `INSERT OR IGNORE INTO rrhh_festivos (fecha, nombre, tipo) VALUES (?, ?, ?)`,
        args: [f.fecha, f.nombre, f.tipo],
      });
    }

    // 4. Seed guardia defaults (upsert)
    for (const g of GUARD_DEFAULTS) {
      await db.execute({
        sql: `INSERT INTO rrhh_guardia_defaults (empleado_id, hora_inicio, hora_fin, hora_inicio2, hora_fin2)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(empleado_id) DO UPDATE SET
                hora_inicio  = excluded.hora_inicio,
                hora_fin     = excluded.hora_fin,
                hora_inicio2 = excluded.hora_inicio2,
                hora_fin2    = excluded.hora_fin2`,
        args: [g.empleado_id, g.hora_inicio, g.hora_fin, g.hora_inicio2, g.hora_fin2],
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Tablas RRHH creadas y datos precargados correctamente",
      tablas: [
        "rrhh_empleados", "rrhh_festivos", "rrhh_guardias",
        "rrhh_guardia_slots", "rrhh_guardia_defaults",
        "rrhh_vacaciones", "rrhh_ausencias", "rrhh_bolsa_vacaciones",
        "rrhh_horarios_asignacion",
        "rrhh_banco_horas", "rrhh_turnos_config",
        "rrhh_nominas_historial",
      ],
      empleados: EMPLEADOS.length,
      festivos: FESTIVOS_2026.length,
    });
  } catch (error) {
    console.error("[rrhh/migrate]", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
