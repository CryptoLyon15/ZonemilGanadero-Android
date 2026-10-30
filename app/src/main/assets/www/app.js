"use strict";
/* ZONEMIL GANADERO · versión móvil (Android)
   Misma lógica que el programa de escritorio. Los datos se guardan en el teléfono
   (archivo interno de la app, mediante el puente nativo "Android"). */

const APP = { nombre: "ZONEMIL GANADERO", lema: "Gestión inteligente, producción eficiente", version: "1.0.0" };
const DIAS_GEST = 283, META_DA = 110, META_SC = 2, META_IEP = 400, DPM = 30.4;
const USUARIO_OCULTO = "augusto";
const FINCA_DEF = "Mi Finca";
const TIPO_MONTA = "Monta Natural", TIPO_IA = "Inseminación Artificial";
const SUG_SANIDAD = ["Aftosa", "Brucelosis", "Rabia", "Carbón sintomático", "Edema maligno", "Mastitis", "Cojera",
  "Desparasitación", "Vitaminas", "Garrapaticida", "Neumonía", "Diarrea", "Retención de placenta"];
const CATS = [
  { k: "lact", n: "Vacas en Lactancia", i: "🐄" }, { k: "seca", n: "Vacas Secas", i: "🥛" },
  { k: "toro", n: "Toros", i: "🐂" }, { k: "novilla", n: "Novillas", i: "🌾" },
  { k: "mauta", n: "Mautes", i: "🚜" }, { k: "becerro", n: "Becerros", i: "🍼" }];
const CAT_DE_TIPO = { Toro: "toro", Novilla: "novilla", Mauta: "mauta", Becerro: "becerro" };
const CLAVE_LOCAL = "zonemil_ganadero_movil_v1";
const Nativo = window.Android || null;

/* =========================================================
   UTILIDADES
   ========================================================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const num = v => { if (v === null || v === undefined || v === "") return null; const n = parseFloat(String(v).replace(",", ".")); return isNaN(n) ? null : n; };
const pad = n => String(n).padStart(2, "0");
const isoLocal = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hoy = () => isoLocal(new Date());
const ahora = () => { const d = new Date(); return `${hoy()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
const aUTC = iso => { const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number); return Date.UTC(y, m - 1, d); };
const diasEntre = (a, b) => (a && b) ? Math.round((aUTC(b) - aUTC(a)) / 864e5) : null;
const sumarDias = (iso, n) => { const t = new Date(aUTC(iso) + n * 864e5); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`; };
const fppDe = f => sumarDias(f, DIAS_GEST);
const fmtF = iso => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—";
function fmtN(v, dec = 0, fijo = false) {
  if (v === null || v === undefined || v === "" || isNaN(v)) return "—";
  let t = Number(v).toLocaleString("es-ES", { minimumFractionDigits: fijo ? dec : 0, maximumFractionDigits: dec, useGrouping: true });
  return t;
}
const fmtKg = v => num(v) === null ? "—" : `${fmtN(num(v), 1)} kg`;
const fmtL = v => `${fmtN(num(v) || 0, 1)} L`;
const faltan = d => d === null ? "—" : d < 0 ? `Atrasado ${-d} d` : d === 0 ? "Hoy" : d === 1 ? "Mañana" : `${d} días`;
const etqDias = (d, pronto = 15) => `<span class="etq ${d === null ? "gris" : d < 0 ? "rojo" : d <= pronto ? "ambar" : "verde"}">${faltan(d)}</span>`;
const edadMeses = f => { const d = diasEntre(f, hoy()); return d === null ? null : d / DPM; };
function fmtEdad(f) {
  const m = edadMeses(f); if (m === null) return "—";
  if (m < 1) { const d = Math.max(diasEntre(f, hoy()), 0); return `${d} ${d === 1 ? "día" : "días"}`; }
  const mi = Math.floor(m); if (mi < 24) return `${mi} ${mi === 1 ? "mes" : "meses"}`;
  const a = Math.floor(mi / 12), r = mi % 12; return `${a} años${r ? ` ${r} m` : ""}`;
}
const natural = (a, b) => String(a).localeCompare(String(b), "es", { numeric: true, sensitivity: "base" });
const porFecha = (a, b) => a.fecha.localeCompare(b.fecha) || String(a.id).localeCompare(String(b.id));

/* =========================================================
   DATOS
   ========================================================= */
let D = null;
let sesion = null;
const UI = { pantalla: "acceso", pagina: "panel", filtro: "all", busq: "", modales: [], intentosCodigo: 0, sel: null };

function usuariosIniciales() {
  return [
    { id: uid(), username: "augusto", password: sha256("9310245"), nombre: "Administrador", cargo: "Administrador", rol: "master", activo: true, bloqueado: false, intentos: 0 },
    { id: uid(), username: "admin", password: sha256("admin123"), nombre: "Administrador", cargo: "Administrador", rol: "master", activo: true, bloqueado: false, intentos: 0 }];
}
function vacio() {
  return { app: "zonemil-movil", version: 1, finca: FINCA_DEF, usuarios: usuariosIniciales(), animales: [], servicios: [],
    partos: [], sanidad: [], ordeno: [], pajillas: [], movimientos: [] };
}
function normalizar(d) {
  const base = vacio();
  const r = { ...base, ...d };
  for (const k of ["animales", "servicios", "partos", "sanidad", "ordeno", "pajillas", "movimientos"]) if (!Array.isArray(r[k])) r[k] = [];
  if (!Array.isArray(r.usuarios) || !r.usuarios.length) r.usuarios = base.usuarios;
  if (!r.usuarios.some(u => u.username === "admin")) r.usuarios.push(base.usuarios[1]);
  r.finca = (r.finca || "").trim() || FINCA_DEF;
  r.animales.forEach(a => { a.id = String(a.id || uid()); a.peso = num(a.peso); if (!a.sexo && a.tipo) a.sexo = a.tipo === "Toro" ? "Macho" : "Hembra"; });
  r.servicios.forEach(s => { s.id = String(s.id || uid()); s.animalId = String(s.animalId); s.nServ = num(s.nServ); s.fpp = s.fpp || fppDe(s.fecha); s.fallido = !!s.fallido; });
  r.partos.forEach(p => { p.id = String(p.id || uid()); p.animalId = String(p.animalId); p.peso = num(p.peso); });
  r.sanidad.forEach(s => { s.id = String(s.id || uid()); s.animalId = s.animalId ? String(s.animalId) : ""; });
  r.ordeno.forEach(o => { o.id = String(o.id || uid()); o.animalId = String(o.animalId); o.am = num(o.am); o.pm = num(o.pm); });
  r.pajillas.forEach(p => { p.id = String(p.id || uid()); p.cantidad = Math.max(0, parseInt(p.cantidad) || 0); });
  return r;
}
function cargar() {
  let txt = null;
  try { txt = Nativo ? Nativo.leer() : localStorage.getItem(CLAVE_LOCAL); } catch (e) { txt = null; }
  try { D = normalizar(txt ? JSON.parse(txt) : {}); } catch (e) { D = vacio(); }
}
function guardar() {
  const txt = JSON.stringify(D);
  try { if (Nativo) Nativo.guardar(txt); else localStorage.setItem(CLAVE_LOCAL, txt); }
  catch (e) { toast("No se pudo guardar: " + e, true); }
}
function mov(tipo, tabla, animal, desc) {
  D.movimientos.push({ fecha: ahora(), tipo, tabla, animal: animal || "", usuario: sesion ? sesion.username : "", desc });
  if (D.movimientos.length > 3000) D.movimientos.splice(0, D.movimientos.length - 3000);
}
const animalPorId = id => D.animales.find(a => a.id === String(id));
const nombreAnimal = id => { const a = animalPorId(id); return a ? a.arete + (a.nombre ? " · " + a.nombre : "") : "General"; };
const puedeEditar = () => sesion && sesion.rol !== "consultor";
const esAdmin = () => sesion && (sesion.rol === "master" || sesion.rol === "admin");

/* =========================================================
   LÓGICA ZOOTÉCNICA (igual que el programa de escritorio)
   ========================================================= */
function clasificar(a, tieneParto) {
  const m = edadMeses(a.fechaNac), peso = num(a.peso) || 0;
  if (a.sexo === "Hembra" && (tieneParto || (m !== null && m >= 30) || peso >= 450)) return "Vaca";
  if ((m !== null && m < 8) || peso < 150) return "Becerro";
  if (a.sexo === "Macho") return ((m !== null && m >= 24) || peso >= 350) ? "Toro" : "Mauta";
  return peso >= 250 ? "Novilla" : "Mauta";
}
function estado(a) {
  const sv = D.servicios.filter(s => s.animalId === a.id).sort(porFecha);
  const pt = D.partos.filter(p => p.animalId === a.id).sort(porFecha);
  const tipo = clasificar(a, pt.length > 0);
  const ls = sv[sv.length - 1] || null, lp = pt[pt.length - 1] || null;
  const gest = !!ls && !ls.fallido && (!lp || ls.fecha > lp.fecha);
  const cat = tipo === "Vaca" ? (gest ? "seca" : (lp ? "lact" : "seca")) : CAT_DE_TIPO[tipo];
  const fpp = gest ? (ls.fpp || fppDe(ls.fecha)) : null;
  const dias = (tipo === "Vaca" && lp) ? diasEntre(lp.fecha, gest ? ls.fecha : hoy()) : null;
  return { tipo, cat, gest, fpp, dias, alerta: dias !== null && dias > META_DA, ls, lp, sv, pt };
}
function hato() {
  return D.animales.filter(a => !a.baja).map(a => ({ ...a, ...estado(a) })).sort((x, y) => natural(x.arete, y.arete));
}
const totalOrd = o => (num(o.am) || 0) + (num(o.pm) || 0);
function indicadores(h) {
  const conteo = Object.fromEntries(CATS.map(c => [c.k, 0]));
  h.forEach(a => conteo[a.cat]++);
  const ultima = D.ordeno.map(o => o.fecha).sort().pop() || null;
  const lecheUlt = D.ordeno.filter(o => o.fecha === ultima).reduce((s, o) => s + totalOrd(o), 0);
  const pesos = D.partos.map(p => num(p.peso)).filter(v => v !== null);
  const vientres = h.filter(a => a.tipo === "Vaca" || a.tipo === "Novilla");
  const paridas = h.filter(a => a.pt.length), gest = h.filter(a => a.gest);
  const conc = D.partos.length + gest.length, nserv = D.servicios.length;
  const natalidad = vientres.length ? paridas.length / vientres.length * 100 : 0;
  const sc = conc ? nserv / conc : 0;
  const prenez = vientres.length ? gest.length / vientres.length * 100 : 0;
  const tconc = nserv ? conc / nserv * 100 : 0;
  const conDias = h.filter(a => a.dias !== null);
  const dprom = conDias.length ? conDias.reduce((s, a) => s + a.dias, 0) / conDias.length : 0;
  const ints = [];
  h.forEach(a => { const f = a.pt.map(p => p.fecha).sort(); for (let i = 1; i < f.length; i++) ints.push(diasEntre(f[i - 1], f[i])); });
  const iep = ints.length ? ints.reduce((s, v) => s + v, 0) / ints.length : 0;
  const fuera = conDias.length ? h.filter(a => a.alerta).length / conDias.length * 100 : 0;
  const leche7 = [6, 5, 4, 3, 2, 1, 0].map(i => { const f = sumarDias(hoy(), -i); return { f, v: Math.round(D.ordeno.filter(o => o.fecha === f).reduce((s, o) => s + totalOrd(o), 0) * 10) / 10 }; });
  return {
    conteo, total: h.length, lecheVaca: conteo.lact ? lecheUlt / conteo.lact : 0, fechaLeche: ultima,
    pesoNacer: pesos.length ? pesos.reduce((s, v) => s + v, 0) / pesos.length : 0, natalidad, sc, leche7,
    dist: CATS.map(c => ({ n: c.n, v: conteo[c.k], pct: h.length ? conteo[c.k] / h.length * 100 : 0 })),
    indices: [
      { n: "Tasa de natalidad", t: fmtN(natalidad, 1, true) + " %", p: natalidad },
      { n: "Tasa de preñez (gestantes / vientres)", t: fmtN(prenez, 1, true) + " %", p: prenez },
      { n: "Tasa de concepción (concepciones / servicios)", t: fmtN(tconc, 1, true) + " %", p: tconc },
      { n: `Servicios por concepción (meta ≤ ${META_SC})`, t: fmtN(sc, 2, true), p: sc / 4 * 100, m: sc > META_SC },
      { n: `Días abiertos promedio (meta ≤ ${META_DA})`, t: fmtN(dprom, 0) + " d", p: dprom / 220 * 100, m: dprom > META_DA },
      { n: `Intervalo entre partos (meta ≤ ${META_IEP} d)`, t: iep ? fmtN(iep, 0) + " d" : "—", p: iep / 500 * 100, m: iep > META_IEP },
      { n: `Vacas fuera de meta (> ${META_DA} d abiertos)`, t: fmtN(fuera, 1, true) + " %", p: fuera, m: fuera > 20 }],
    gestantes: gest.sort((a, b) => a.fpp.localeCompare(b.fpp)), alertas: h.filter(a => a.alerta),
  };
}
function existeArete(arete, excluir) {
  const t = arete.trim().toLowerCase();
  return D.animales.some(a => !a.baja && a.id !== excluir && a.arete.trim().toLowerCase() === t);
}
function moverPajilla(codigo, delta) {
  if (!codigo) return false;
  const p = D.pajillas.find(x => x.codigo.toLowerCase() === String(codigo).trim().toLowerCase());
  if (!p) return false;
  p.cantidad = Math.max(0, p.cantidad + delta); return true;
}

/* =========================================================
   INTERFAZ BASE: toast, modales, confirmaciones
   ========================================================= */
let toastT = null;
function toast(t, error = false) {
  const el = $("#toast"); el.textContent = t; el.className = "toast" + (error ? " error" : "");
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.add("oculto"), 3800);
}
function abrirModal(titulo, html, opciones = {}) {
  const id = "m" + uid();
  const capa = document.createElement("div");
  capa.className = "capa"; capa.id = id;
  capa.innerHTML = `<div class="hoja"><div class="cab"><span class="crece">${titulo}</span>${opciones.extraCab || ""}<button data-a="cerrar-modal">✕</button></div><div class="cuerpo">${html}</div></div>`;
  capa.addEventListener("click", e => { if (e.target === capa && !opciones.fijo) cerrarModal(); });
  $("#modal-raiz").appendChild(capa);
  UI.modales.push({ id, alCerrar: opciones.alCerrar });
  return capa;
}
function cerrarModal() {
  const m = UI.modales.pop(); if (!m) return;
  const el = document.getElementById(m.id); if (el) el.remove();
  if (m.alCerrar) m.alCerrar();
}
function cerrarTodo() { while (UI.modales.length) cerrarModal(); }
function confirmar(texto, ok = "Sí, continuar", peligro = false) {
  return new Promise(res => {
    const capa = abrirModal("Confirmar", `<p style="margin:0 0 14px;line-height:1.45">${texto}</p>
      <div class="botones"><button class="btn sec" data-r="0">Cancelar</button><button class="btn ${peligro ? "pel" : ""}" data-r="1">${ok}</button></div>`,
      { alCerrar: () => res(false), fijo: true });
    $$("[data-r]", capa).forEach(b => b.addEventListener("click", ev => {
      ev.stopPropagation(); const m = UI.modales.pop(); capa.remove(); res(b.dataset.r === "1"); void m;
    }));
  });
}
function soloLectura() {
  if (puedeEditar()) return false;
  toast("Su usuario es consultor: solo puede ver la información.", true); return true;
}

/* ---------- formulario genérico (como los modales de la web) ---------- */
function opcionesHTML(f, valor) {
  const ops = typeof f.o === "function" ? f.o() : f.o;
  let h = `<option value="">${f.vacio || (f.r ? "Seleccione…" : "—")}</option>`;
  ops.forEach(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; h += `<option value="${esc(v)}" ${String(valor ?? "") === String(v) ? "selected" : ""}>${esc(t)}</option>`; });
  return h;
}
function formulario({ titulo, campos, init = {}, guardar: alGuardar, etiqueta = "Guardar", extra = "", alCambiar }) {
  let html = `<form class="form2" autocomplete="off">`;
  campos.forEach(f => {
    const v = init[f.k] ?? "";
    const lbl = `<label>${esc(f.l)}${f.r ? ' <span class="req">*</span>' : ""}</label>`;
    let control;
    if (f.t === "select") control = `<select name="${f.k}">${opcionesHTML(f, v)}</select>`;
    else {
      const tipo = f.t === "number" ? "text" : (f.t || "text");
      const modo = f.t === "number" ? 'inputmode="decimal"' : "";
      const lista = f.dl ? `list="dl-${f.k}"` : "";
      control = `<input name="${f.k}" type="${tipo}" ${modo} ${lista} value="${esc(v)}" placeholder="${esc(f.ph || "")}" ${f.max ? `max="${f.max}"` : ""}>`;
      if (f.dl) control += `<datalist id="dl-${f.k}">${f.dl.map(o => `<option value="${esc(o)}">`).join("")}</datalist>`;
    }
    html += `<div class="campo ${f.w ? "ancho" : ""}" data-campo="${f.k}">${lbl}${control}${f.nota ? `<div class="ayuda">${f.nota}</div>` : ""}</div>`;
  });
  html += `<div class="ancho" data-extra>${extra}</div><div class="ancho aviso rojo oculto" data-error></div>
    <div class="ancho botones"><button type="button" class="btn sec" data-a="cerrar-modal">Cancelar</button><button type="submit" class="btn">${etiqueta}</button></div></form>`;
  const capa = abrirModal(titulo, html);
  const form = $("form", capa);
  const leer = () => Object.fromEntries(campos.map(f => [f.k, (form.elements[f.k].value || "").trim()]));
  const visibilidad = () => {
    const v = leer();
    campos.forEach(f => { if (f.si) $(`[data-campo="${f.k}"]`, form).classList.toggle("oculto", !f.si(v)); });
    if (alCambiar) alCambiar(v, form);
  };
  form.addEventListener("input", visibilidad); form.addEventListener("change", visibilidad);
  visibilidad();
  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (soloLectura()) return;
    const v = leer(), err = $("[data-error]", form);
    for (const f of campos) {
      if (f.r && (!f.si || f.si(v)) && !v[f.k]) { err.textContent = `Complete el campo «${f.l}».`; err.classList.remove("oculto"); return; }
      if (f.t === "number" && v[f.k] && num(v[f.k]) === null) { err.textContent = `«${f.l}» debe ser un número.`; err.classList.remove("oculto"); return; }
    }
    const r = await alGuardar(v);
    if (r === true) { cerrarModalPorElemento(capa); guardar(); render(); }
    else if (typeof r === "string") { err.textContent = r; err.classList.remove("oculto"); }
  });
  return capa;
}
function cerrarModalPorElemento(el) {
  const i = UI.modales.findIndex(m => m.id === el.id);
  if (i >= 0) { const [m] = UI.modales.splice(i, 1); el.remove(); if (m.alCerrar) m.alCerrar(); }
}

/* =========================================================
   FORMULARIOS DE REGISTRO
   ========================================================= */
const opsAnimales = tipos => () => hato().filter(a => !tipos || tipos.includes(a.tipo)).map(a => [a.id, `${a.arete}${a.nombre ? " · " + a.nombre : ""} (${a.tipo})`]);
function conActual(ops, id) {
  return () => { const l = ops(); if (id && !l.some(o => o[0] === id) && animalPorId(id)) l.push([id, nombreAnimal(id) + " (actual)"]); return l; };
}

function formAnimal(id, prefill = {}, alGuardarExtra) {
  const a = id ? animalPorId(id) : null;
  const tienePartos = a ? D.partos.some(p => p.animalId === a.id) : false;
  formulario({
    titulo: (a ? "✏️ Editar · " : "Registrar · ") + "Animal",
    campos: [
      { k: "arete", l: "N° de identificación (arete)", r: 1 }, { k: "nombre", l: "Nombre" },
      { k: "sexo", l: "Sexo", t: "select", r: 1, o: ["Macho", "Hembra"] },
      { k: "fechaNac", l: "Fecha de nacimiento", t: "date", r: 1, max: hoy() },
      { k: "peso", l: "Peso actual (kg)", t: "number", r: 1 },
      { k: "origen", l: "Origen", t: "select", r: 1, o: ["Nacido en Finca", "Comprado"] },
      { k: "notas", l: "Notas (raza, color, observaciones)", w: 1 }],
    init: a || prefill, etiqueta: a ? "Guardar cambios" : "Guardar",
    extra: `<div class="aviso gris" data-clase></div>`,
    alCambiar: (v, form) => {
      const el = $("[data-clase]", form);
      if (!v.sexo) { el.textContent = "La categoría se asigna automáticamente según sexo, edad y peso."; return; }
      const t = clasificar({ sexo: v.sexo, fechaNac: v.fechaNac, peso: v.peso }, tienePartos);
      el.innerHTML = `Clasificación automática: <b>${t === "Mauta" ? "Maute / Mauta" : t}</b> · Edad: ${fmtEdad(v.fechaNac)}`;
    },
    guardar: v => {
      if (num(v.peso) <= 0) return "El peso debe ser mayor que cero.";
      if (v.fechaNac > hoy()) return "La fecha de nacimiento no puede ser futura.";
      if (existeArete(v.arete, a && a.id)) return `Ya existe un animal activo con el arete ${v.arete}.`;
      const datos = { arete: v.arete, nombre: v.nombre, sexo: v.sexo, fechaNac: v.fechaNac, peso: num(v.peso), origen: v.origen, notas: v.notas };
      let nuevo;
      if (a) { Object.assign(a, datos); mov("EDICIÓN", "animal", a.arete, `${v.sexo}, ${fmtKg(v.peso)}, ${v.origen}`); toast(`Cambios de ${a.arete} guardados.`); }
      else { nuevo = { id: uid(), ...datos, usuario: sesion.username }; D.animales.push(nuevo); mov("CREACIÓN", "animal", v.arete, `${v.sexo}, ${fmtKg(v.peso)}, nacido ${fmtF(v.fechaNac)}`); toast(`Animal ${v.arete} registrado.`); }
      if (alGuardarExtra && nuevo) alGuardarExtra(nuevo);
      return true;
    },
  });
}

function formServicio(animalId, sid) {
  const s = sid ? D.servicios.find(x => x.id === sid) : null;
  const ops = opsAnimales(["Vaca", "Novilla"]);
  if (!ops().length && !s) return toast("No hay vacas ni novillas activas. Registre primero la hembra.", true);
  const esIA = v => v.tipo === TIPO_IA;
  const enTermo = c => D.pajillas.find(p => p.codigo.toLowerCase() === String(c || "").trim().toLowerCase());
  formulario({
    titulo: (s ? "✏️ Editar · " : "Registrar · ") + "Servicio",
    campos: [
      { k: "animalId", l: "Hembra", t: "select", r: 1, w: 1, o: conActual(ops, s ? s.animalId : animalId) },
      { k: "fecha", l: "Fecha del servicio", t: "date", r: 1 },
      { k: "tipo", l: "Tipo de servicio", t: "select", r: 1, o: [TIPO_MONTA, TIPO_IA] },
      { k: "toro", l: "Toro responsable", si: v => !esIA(v), ph: "Arete o nombre" },
      { k: "pajilla", l: "Código de la Pajilla / Crio-vial", r: 1, si: esIA, dl: D.pajillas.map(p => p.codigo) },
      { k: "raza", l: "Raza/Toro del Semen", r: 1, si: esIA },
      { k: "nServ", l: "N° de servicios acumulados", t: "number", nota: "Vacío = automático" }],
    init: s ? { ...s, toro: esIA(s) ? "" : s.toro } : { animalId: animalId || "", fecha: hoy(), tipo: TIPO_MONTA },
    etiqueta: s ? "Guardar cambios" : "Guardar",
    extra: `<div class="ayuda" data-termo></div><div class="aviso verde" data-fpp></div>`,
    alCambiar: (v, form) => {
      $("[data-fpp]", form).innerHTML = v.fecha ? `Fecha probable de parto (servicio + ${DIAS_GEST} días): <b>${fmtF(fppDe(v.fecha))}</b>` : "";
      const t = $("[data-termo]", form);
      if (!esIA(v)) { t.textContent = ""; return; }
      const p = enTermo(v.pajilla);
      if (p) {
        const raza = form.elements.raza;
        if (!raza.value || D.pajillas.some(x => x.raza === raza.value)) raza.value = p.raza;
        t.textContent = `Termo: ${p.codigo} · ${p.raza} · ${p.cantidad} disponible(s). Al guardar se descuenta 1 pajilla.`;
      } else t.textContent = `Termo: ${D.pajillas.reduce((s, p) => s + p.cantidad, 0)} pajillas en total. Si el código no está en el termo no se descuenta nada.`;
    },
    guardar: async v => {
      const ia = esIA(v);
      const antes = s ? [s.tipo === TIPO_IA, (s.pajilla || "").toLowerCase()].join("|") : "false|";
      const cambia = antes !== [ia, ia ? v.pajilla.toLowerCase() : ""].join("|");
      if (ia && cambia) {
        const p = enTermo(v.pajilla);
        if (!p && !(await confirmar(`El código <b>${esc(v.pajilla)}</b> no está en el termo. ¿Guardar sin descontar existencias?`))) return false;
        if (p && p.cantidad <= 0 && !(await confirmar(`El termo no tiene existencias de <b>${esc(p.codigo)}</b>. ¿Guardar de todos modos?`))) return false;
      }
      let n = parseInt(v.nServ);
      if (!n) n = D.servicios.filter(x => x.animalId === v.animalId && (!s || (x.id !== s.id && (x.fecha < v.fecha || (x.fecha === v.fecha && x.id < s.id))))).length + 1;
      if (cambia) { if (s && s.tipo === TIPO_IA) moverPajilla(s.pajilla, +1); if (ia) moverPajilla(v.pajilla, -1); }
      const datos = { animalId: v.animalId, fecha: v.fecha, tipo: v.tipo, toro: ia ? v.raza : v.toro, pajilla: ia ? v.pajilla : "",
        raza: ia ? v.raza : "", nServ: n, fpp: fppDe(v.fecha) };
      if (s) Object.assign(s, datos); else D.servicios.push({ id: uid(), ...datos, fallido: false, usuario: sesion.username });
      const ar = animalPorId(v.animalId).arete;
      mov(s ? "EDICIÓN" : "CREACIÓN", "servicio", ar, `${v.tipo} ${fmtF(v.fecha)} · N° ${n} · ${ia ? "Pajilla " + v.pajilla : "Toro " + (v.toro || "—")}`);
      toast(`Servicio de ${ar} guardado. Parto probable: ${fmtF(fppDe(v.fecha))}.`);
      return true;
    },
  });
}

function formParto(animalId, pid) {
  const p = pid ? D.partos.find(x => x.id === pid) : null;
  const ops = opsAnimales(["Vaca", "Novilla"]);
  if (!ops().length && !p) return toast("No hay vacas ni novillas activas. Registre primero la hembra.", true);
  formulario({
    titulo: (p ? "✏️ Editar · " : "Registrar · ") + "Parto",
    campos: [
      { k: "animalId", l: "Hembra", t: "select", r: 1, w: 1, o: conActual(ops, p ? p.animalId : animalId) },
      { k: "fecha", l: "Fecha real", t: "date", r: 1, max: hoy() },
      { k: "cria", l: "Condición de la cría", t: "select", r: 1, o: ["Vivo", "Muerto"] },
      { k: "sexo", l: "Sexo", t: "select", r: 1, o: ["Macho", "Hembra"] },
      { k: "peso", l: "Peso al nacer (kg)", t: "number" }],
    init: p || { animalId: animalId || "", fecha: hoy() }, etiqueta: p ? "Guardar cambios" : "Guardar",
    guardar: async v => {
      if (v.fecha > hoy()) return "La fecha del parto no puede ser futura.";
      if (D.partos.some(x => x.animalId === v.animalId && x.fecha === v.fecha && (!p || x.id !== p.id)) &&
        !(await confirmar("Esta hembra ya tiene un parto en esa fecha (¿gemelos?). ¿Registrar otra cría?"))) return false;
      const datos = { animalId: v.animalId, fecha: v.fecha, cria: v.cria, sexo: v.sexo, peso: num(v.peso) };
      const madre = animalPorId(v.animalId);
      let nuevo = null;
      if (p) Object.assign(p, datos); else { nuevo = { id: uid(), ...datos, usuario: sesion.username }; D.partos.push(nuevo); }
      mov(p ? "EDICIÓN" : "CREACIÓN", "parto", madre.arete, `Parto ${fmtF(v.fecha)} · ${v.cria} · ${v.sexo} · ${fmtKg(v.peso)}`);
      toast(`Parto de ${madre.arete} registrado (${v.cria}, ${v.sexo}).`);
      if (nuevo && v.cria === "Vivo") setTimeout(async () => {
        if (await confirmar("La cría nació viva. ¿Desea registrarla ahora en el inventario?", "Sí, registrar"))
          formAnimal(null, { sexo: v.sexo, fechaNac: v.fecha, peso: v.peso, origen: "Nacido en Finca", notas: `Cría de ${madre.arete}` },
            cria => { nuevo.criaId = cria.id; });
      }, 150);
      return true;
    },
  });
}

function formOrdeno(animalId, oid) {
  const o = oid ? D.ordeno.find(x => x.id === oid) : null;
  const ops = opsAnimales(["Vaca"]);
  if (!ops().length && !o) return toast("No hay vacas activas en el inventario.", true);
  formulario({
    titulo: (o ? "✏️ Editar · " : "Registrar · ") + "Control de Ordeño",
    campos: [
      { k: "animalId", l: "Vaca", t: "select", r: 1, w: 1, o: conActual(ops, o ? o.animalId : animalId) },
      { k: "fecha", l: "Fecha", t: "date", r: 1, w: 1, max: hoy() },
      { k: "am", l: "Litros AM", t: "number" }, { k: "pm", l: "Litros PM", t: "number" }],
    init: o || { animalId: animalId || "", fecha: hoy() }, etiqueta: o ? "Guardar cambios" : "Guardar",
    extra: `<div class="aviso verde" data-total></div>`,
    alCambiar: (v, form) => { $("[data-total]", form).innerHTML = `Total del día: <b>${fmtL((num(v.am) || 0) + (num(v.pm) || 0))}</b>`; },
    guardar: async v => {
      if (!(num(v.am) || num(v.pm))) return "Escriba los litros de la mañana, de la tarde o ambos.";
      if (D.ordeno.some(x => x.animalId === v.animalId && x.fecha === v.fecha && (!o || x.id !== o.id)) &&
        !(await confirmar("Esta vaca ya tiene un control de ordeño en esa fecha. ¿Agregar otro?"))) return false;
      const datos = { animalId: v.animalId, fecha: v.fecha, am: num(v.am), pm: num(v.pm) };
      if (o) Object.assign(o, datos); else D.ordeno.push({ id: uid(), ...datos, usuario: sesion.username });
      const ar = animalPorId(v.animalId).arete;
      mov(o ? "EDICIÓN" : "CREACIÓN", "ordeno", ar, `${fmtF(v.fecha)} · AM ${fmtL(v.am)} · PM ${fmtL(v.pm)}`);
      toast(`Ordeño de ${ar} guardado: ${fmtL(totalOrd(datos))}.`);
      return true;
    },
  });
}

function formSanidad(animalId, sid) {
  const s = sid ? D.sanidad.find(x => x.id === sid) : null;
  formulario({
    titulo: (s ? "✏️ Editar · " : "Registrar · ") + "Registro Sanitario",
    campos: [
      { k: "tipo", l: "Tipo", t: "select", r: 1, o: ["Vacuna", "Tratamiento", "Evento sanitario"] },
      { k: "fecha", l: "Fecha", t: "date", r: 1 },
      { k: "animalId", l: "Animal (vacío = lote / general)", t: "select", w: 1, vacio: "— Lote / general —", o: conActual(opsAnimales(null), s ? s.animalId : animalId) },
      { k: "detalle", l: "Producto / evento (Aftosa, Brucelosis, Rabia, Mastitis, cojera…)", r: 1, w: 1, dl: SUG_SANIDAD },
      { k: "dosis", l: "Dosis", ph: "Ej.: 5 ml" }],
    init: s || { animalId: animalId || "", fecha: hoy() }, etiqueta: s ? "Guardar cambios" : "Guardar",
    guardar: v => {
      const datos = { tipo: v.tipo, fecha: v.fecha, animalId: v.animalId, detalle: v.detalle, dosis: v.dosis };
      if (s) Object.assign(s, datos); else D.sanidad.push({ id: uid(), ...datos, usuario: sesion.username });
      mov(s ? "EDICIÓN" : "CREACIÓN", "sanidad", v.animalId ? animalPorId(v.animalId).arete : "General", `${v.tipo}: ${v.detalle} ${v.dosis || ""}`);
      toast(`Registro sanitario guardado (${v.tipo}: ${v.detalle}).`);
      return true;
    },
  });
}

function formBaja(animalId) {
  if (!hato().length) return toast("No hay animales activos en el inventario.", true);
  formulario({
    titulo: "Registrar · Salida / Baja",
    campos: [
      { k: "animalId", l: "Animal", t: "select", r: 1, w: 1, o: opsAnimales(null) },
      { k: "motivo", l: "Motivo", t: "select", r: 1, o: ["Mortalidad", "Venta"] },
      { k: "fecha", l: "Fecha", t: "date", r: 1, max: hoy() },
      { k: "obs", l: "Observaciones", w: 1, ph: "Comprador, precio, causa de muerte…" }],
    init: { animalId: animalId || "", fecha: hoy() }, etiqueta: "Registrar salida",
    extra: `<div class="ayuda">El animal sale del inventario activo, pero conserva su récord. La salida se puede anular.</div>`,
    guardar: async v => {
      const a = animalPorId(v.animalId);
      if (!(await confirmar(`¿Registrar la salida de <b>${esc(a.arete)}</b> por ${v.motivo.toLowerCase()}?`))) return false;
      Object.assign(a, { baja: v.motivo, fechaBaja: v.fecha, obsBaja: v.obs });
      mov("SALIDA", "animal", a.arete, `${v.motivo} · ${fmtF(v.fecha)}`);
      toast(`Salida registrada: ${a.arete} (${v.motivo}).`);
      cerrarTodo();
      return true;
    },
  });
}

const FORMS = { animal: (a) => formAnimal(null), servicio: formServicio, parto: formParto, ordeno: formOrdeno, sanidad: formSanidad, baja: formBaja };

/* ---------- acciones sobre registros ---------- */
async function eliminar(col, id) {
  if (soloLectura()) return;
  const r = D[col].find(x => x.id === id); if (!r) return;
  const etiqueta = col === "animales" ? r.arete : nombreAnimal(r.animalId);
  const txt = "Este registro se borrará de forma permanente" + (col === "animales" ? ", junto con sus servicios, partos, controles sanitarios y ordeños" : "") + ". Esta acción no se puede deshacer.";
  if (!(await confirmar(txt, "🗑️ Sí, eliminar", true))) return;
  let extra = "";
  if (col === "servicios" && r.tipo === TIPO_IA && moverPajilla(r.pajilla, +1)) extra = ` La pajilla ${r.pajilla} volvió al termo.`;
  D[col] = D[col].filter(x => x.id !== id);
  if (col === "animales") ["servicios", "partos", "sanidad", "ordeno"].forEach(k => D[k] = D[k].filter(x => x.animalId !== id));
  const nombres = { animales: "Animal", servicios: "Servicio", partos: "Parto", ordeno: "Control de ordeño", sanidad: "Registro sanitario" };
  mov("ELIMINACIÓN", col, etiqueta, `${nombres[col]} eliminado${r.fecha ? " (" + fmtF(r.fecha) + ")" : ""}`);
  guardar(); toast(`${nombres[col]} eliminado.${extra}`);
  if (col === "animales") cerrarTodo();
  refrescarRecord(); render();
}
async function marcarVacia(sid, vacia) {
  if (soloLectura()) return;
  const s = D.servicios.find(x => x.id === sid); if (!s) return;
  const ar = nombreAnimal(s.animalId);
  if (vacia && !(await confirmar(`¿Marcar el servicio del ${fmtF(s.fecha)} de <b>${esc(ar)}</b> como no efectivo (repitió celo)? Saldrá de Próximos Partos.`))) return;
  s.fallido = vacia;
  mov("EDICIÓN", "servicio", ar, vacia ? "Servicio marcado como vacía (repitió celo)" : "Servicio restablecido como efectivo");
  guardar(); toast(vacia ? `${ar}: servicio marcado como vacía.` : `${ar}: servicio restablecido.`); refrescarRecord(); render();
}
async function anularBaja(id) {
  if (soloLectura()) return;
  const a = animalPorId(id); if (!a) return;
  if (existeArete(a.arete, a.id)) return toast(`Ya hay un animal activo con el arete ${a.arete}.`, true);
  if (!(await confirmar(`¿Anular la salida (${esc(a.baja)}) de <b>${esc(a.arete)}</b> y devolverlo al inventario?`))) return;
  mov("ANULACIÓN", "animal", a.arete, `Salida anulada (${a.baja})`);
  delete a.baja; delete a.fechaBaja; delete a.obsBaja;
  guardar(); toast(`${a.arete} volvió al inventario.`); refrescarRecord(); render();
}

/* =========================================================
   EXPORTACIÓN (PDF por impresión del sistema y CSV para Excel)
   ========================================================= */
const EXPORT = {};
function registrarExport(clave, titulo, columnas, filas) { EXPORT[clave] = { titulo, columnas, filas }; }
function htmlReporte(titulo, secciones) {
  const tabla = s => s.columnas ? (s.filas.length ? `<table><tr>${s.columnas.map(c => `<th>${esc(c)}</th>`).join("")}</tr>${s.filas.map(f => `<tr>${f.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</table>` : `<p class="v">Sin registros.</p>`) : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>
    body{font-family:Arial,sans-serif;padding:18px;color:#222}h1{margin:0;font-size:19px;color:#451a03}
    .s{color:#78350f;font-size:12px;border-bottom:3px solid #78350f;padding:4px 0 8px;margin-bottom:12px}
    h2{font-size:14px;color:#451a03;margin:14px 0 6px}table{width:100%;border-collapse:collapse;font-size:11px}
    th{background:#78350f;color:#fff;text-align:left;padding:5px}td{padding:4px 5px;border-bottom:1px solid #ddd}
    tr:nth-child(even) td{background:#f8f5f0}.f{margin-top:14px;font-size:10px;color:#777}.v{color:#777;font-size:12px}
    </style></head><body><h1>ZONEMIL GANADERO — ${esc(D.finca)}</h1>
    <div class="s">${esc(titulo)} · Reporte zootécnico · ${fmtF(hoy())}</div>
    ${secciones.map(s => `${s.titulo ? `<h2>${esc(s.titulo)}</h2>` : ""}${s.texto ? `<p style="font-size:12px">${esc(s.texto)}</p>` : ""}${tabla(s)}`).join("")}
    <div class="f">${APP.lema} · ${esc(D.finca)}</div></body></html>`;
}
function imprimir(titulo, secciones) {
  const html = htmlReporte(titulo, secciones);
  if (Nativo && Nativo.imprimir) Nativo.imprimir(html, titulo);
  else { const w = window.open("", "_blank"); if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 300); } }
}
function compartirArchivo(nombre, contenido, mime) {
  if (Nativo && Nativo.compartir) Nativo.compartir(nombre, contenido, mime);
  else { const url = URL.createObjectURL(new Blob([contenido], { type: mime })); const a = document.createElement("a"); a.href = url; a.download = nombre; a.click(); URL.revokeObjectURL(url); }
}
const nombreArchivo = t => t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
function exportarCSV(clave) {
  const e = EXPORT[clave]; if (!e) return;
  const celda = v => { const t = String(v ?? ""); return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const csv = "﻿" + [e.columnas, ...e.filas].map(f => f.map(celda).join(";")).join("\r\n");
  compartirArchivo(`${nombreArchivo(e.titulo)}-${hoy()}.csv`, csv, "text/csv");
}
function exportarPDF(clave) { const e = EXPORT[clave]; if (e) imprimir(e.titulo, [{ columnas: e.columnas, filas: e.filas }]); }

/* ---------- bloques de interfaz ---------- */
function seccion(titulo, cuerpo, clave) {
  const exp = clave ? `<button data-a="pdf" data-k="${clave}">PDF</button><button data-a="csv" data-k="${clave}">Excel</button>` : "";
  return `<section class="tarjeta"><div class="cab"><span class="crece">${esc(titulo)}</span>${exp}</div><div class="cuerpo">${cuerpo}</div></section>`;
}
const enlace = (id, texto) => `<button class="enlace" data-a="record" data-id="${id}">${esc(texto)}</button>`;
const botonesReg = (col, form, id, extra = "") => puedeEditar() ? `<div class="acciones">
  <button class="btn amb mini" data-a="editar" data-f="${form}" data-id="${id}">✏️ Editar</button>${extra}
  <button class="btn pel mini" data-a="eliminar" data-col="${col}" data-id="${id}">🗑️ Eliminar</button></div>` : "";
const lista = (items, vacio) => items.length ? items.join("") : `<div class="vacio">${vacio}</div>`;

function itemsProximosPartos(gest) {
  registrarExport("partos", "Próximos Partos de la Finca", ["Arete", "Nombre", "Servicio", "Toro", `FPP (${DIAS_GEST} d)`, "Faltan"],
    gest.map(a => [a.arete, a.nombre || "—", fmtF(a.ls.fecha), a.ls.toro || "—", fmtF(a.fpp), faltan(diasEntre(hoy(), a.fpp))]));
  return gest.map(a => `<div class="item"><div class="l1">${enlace(a.id, a.arete + (a.nombre ? " · " + a.nombre : ""))}${etqDias(diasEntre(hoy(), a.fpp))}</div>
    <div class="l2">Servicio ${fmtF(a.ls.fecha)} · Toro: ${esc(a.ls.toro || "—")}<br>Parto probable: <b>${fmtF(a.fpp)}</b></div></div>`);
}

/* =========================================================
   PÁGINAS
   ========================================================= */
function pgPanel() {
  const h = hato(), ind = indicadores(h);
  const max = Math.max(1, ...ind.leche7.map(x => x.v));
  let html = `<div class="grid2 cats" style="margin-bottom:14px">${CATS.map(c => `<button class="cat" data-a="filtro" data-k="${c.k}">
    <div class="n"><span>${c.n.toUpperCase()}</span><span>${c.i}</span></div><div class="v">${ind.conteo[c.k]}</div></button>`).join("")}</div>`;
  html += `<h3 class="st" style="margin-top:0">Accesos Rápidos</h3><div class="grid3" style="margin-bottom:14px">
    ${[["animal", "➕", "Registrar Animal"], ["servicio", "🧬", "Registrar Servicio"], ["parto", "🐣", "Registrar Parto"], ["ordeno", "🥛", "Control de Ordeño"], ["sanidad", "💉", "Registro Sanitario"], ["baja", "📤", "Salidas / Bajas"]]
      .map(([f, i, t]) => `<button class="acceso" data-a="nuevo" data-f="${f}"><span class="ic">${i}</span>${t}</button>`).join("")}</div>`;
  if (ind.alertas.length) html += `<div class="alerta" data-a="ir" data-p="reproduccion">⚠️ BAJA EFICIENCIA REPRODUCTIVA: ${ind.alertas.length} vaca(s) superan ${META_DA} días abiertos</div>`;
  html += seccion("Indicadores de Eficiencia de la Finca", `<div class="tiles">
    ${[[fmtN(ind.total), "Inventario Total"], [fmtN(ind.lecheVaca, 1, true), "Promedio de Leche por Vaca (Lts)"], [fmtN(ind.pesoNacer, 1, true), "Promedio de Peso al Nacer (Kg)"],
      [fmtN(ind.natalidad, 1, true), "Tasa de Natalidad (%)"], [fmtN(ind.sc, 2, true), "Eficiencia de Servicios (S/C)"]]
      .map(([v, e]) => `<div class="tile"><div class="v">${v}</div><div class="e">${e}</div></div>`).join("")}</div>
    <div class="ayuda">${ind.fechaLeche ? `Leche por vaca: total del último día con pesaje (${fmtF(ind.fechaLeche)}) entre las vacas en lactancia.` : "Aún no hay controles de ordeño registrados."}</div>`);
  html += seccion("Analítica Visual de la Finca", `<h3 class="st" style="margin-top:0">Producción de leche · últimos 7 días (L)</h3>
    <div class="barras">${ind.leche7.map((x, i) => `<button class="col ${UI.sel === i ? "sel" : ""}" data-a="barra" data-i="${i}"><span>${fmtN(x.v, 1)}</span><div style="height:${x.v / max * 80}%"></div></button>`).join("")}</div>
    <div class="fechas">${ind.leche7.map(x => `<span>${x.f.slice(8)}/${x.f.slice(5, 7)}</span>`).join("")}</div>
    <div class="ayuda">${UI.sel !== null && ind.leche7[UI.sel] ? `Día <b>${fmtF(ind.leche7[UI.sel].f)}</b>: <b>${fmtL(ind.leche7[UI.sel].v)}</b>` : "Toque una barra para ver el detalle del día."}</div>
    <h3 class="st">Distribución porcentual por categoría</h3>
    ${ind.dist.map(x => `<div class="indice dist"><div class="f"><span>${x.n.toUpperCase()}</span><b>${x.v} · ${fmtN(x.pct, 1, true)} %</b></div><div class="bar"><div style="width:${Math.min(100, x.pct)}%"></div></div></div>`).join("")}
    <h3 class="st">Índices de eficiencia reproductiva</h3>
    ${ind.indices.map(x => `<div class="indice ${x.m ? "malo" : ""}"><div class="f"><span>${x.n}</span><b>${x.t}</b></div><div class="bar"><div style="width:${Math.min(100, Math.max(0, x.p))}%"></div></div></div>`).join("")}`);
  html += seccion("Próximos Partos de la Finca", lista(itemsProximosPartos(ind.gestantes), "No hay hembras gestantes."), "partos");
  return html;
}

function pgInventario() {
  const h = hato();
  let l = h.filter(a => UI.filtro === "all" || a.cat === UI.filtro);
  const q = UI.busq.toLowerCase();
  if (q) l = l.filter(a => a.arete.toLowerCase().includes(q) || (a.nombre || "").toLowerCase().includes(q));
  const catN = k => (CATS.find(c => c.k === k) || {}).n;
  const est = a => a.gest ? `<span class="etq verde">Gestante · FPP ${fmtF(a.fpp)}</span>` : a.alerta ? `<span class="etq rojo">⚠️ ${a.dias} d abiertos</span>` : a.dias !== null ? `<span class="etq gris">${a.dias} d abiertos</span>` : "";
  registrarExport("inventario", "Inventario · " + (UI.filtro === "all" ? "Todos" : catN(UI.filtro)), ["Arete", "Nombre", "Categoría", "Sexo", "Edad", "Peso", "Origen", "Estado"],
    l.map(a => [a.arete, a.nombre || "—", catN(a.cat), a.sexo, fmtEdad(a.fechaNac), fmtKg(a.peso), a.origen || "—", a.gest ? "Gestante · FPP " + fmtF(a.fpp) : a.dias !== null ? a.dias + " d abiertos" : "—"]));
  return `<h2 class="titulo">Inventario</h2><p class="sub">La categoría se calcula sola según sexo, edad, peso y partos. Toque el arete para ver el récord.</p>
    <div class="chips">${[{ k: "all", n: "Todos" }, ...CATS].map(c => `<button class="chip ${UI.filtro === c.k ? "activo" : ""}" data-a="filtro" data-k="${c.k}">${c.n}</button>`).join("")}</div>
    <input class="buscar" id="buscar" placeholder="🔍 Buscar arete o nombre" value="${esc(UI.busq)}">
    ${seccion(EXPORT.inventario.titulo + ` (${l.length})`, lista(l.map(a => `<div class="item"><div class="l1">${enlace(a.id, a.arete + (a.nombre ? " · " + a.nombre : ""))}<span class="etq ambar">${catN(a.cat)}</span></div>
      <div class="l2">${a.sexo} · ${fmtEdad(a.fechaNac)} · ${fmtKg(a.peso)} · ${esc(a.origen || "—")}</div>${est(a) ? `<div style="margin-top:5px">${est(a)}</div>` : ""}</div>`), "No hay animales en esta categoría."), "inventario")}
    ${puedeEditar() ? `<button class="fab" data-a="nuevo" data-f="animal">+ Animal</button>` : ""}`;
}

function pgReproduccion() {
  const h = hato(), ind = indicadores(h), act = Object.fromEntries(h.map(a => [a.id, a]));
  registrarExport("alertas", "Alertas de Días Abiertos", ["Arete", "Nombre", "Último parto", "Días abiertos", "Alerta"],
    ind.alertas.map(a => [a.arete, a.nombre || "—", fmtF(a.lp.fecha), a.dias + " días", "BAJA EFICIENCIA REPRODUCTIVA"]));
  const serv = [...D.servicios].sort(porFecha).reverse();
  const estadoS = s => { const a = act[s.animalId];
    if (s.fallido) return `<span class="etq rojo">Vacía (repitió celo)</span>`;
    if (a && a.gest && a.ls.id === s.id) return `<span class="etq verde">Gestante</span>`;
    if (D.partos.some(p => p.animalId === s.animalId && p.fecha > s.fecha)) return `<span class="etq gris">Con parto posterior</span>`;
    return ""; };
  registrarExport("servicios", "Historial de Servicios", ["Arete", "Fecha", "Tipo", "N°", "Toro / Semen", "Pajilla", "FPP", "Estado"],
    serv.map(s => [nombreAnimal(s.animalId), fmtF(s.fecha), s.tipo, s.nServ || "—", s.toro || "—", s.pajilla || "—", fmtF(s.fpp), estadoS(s).replace(/<[^>]+>/g, "") || "—"]));
  const partos = [...D.partos].sort(porFecha).reverse();
  registrarExport("hpartos", "Historial de Partos", ["Arete", "Fecha", "Cría", "Sexo", "Peso (kg)"],
    partos.map(p => [nombreAnimal(p.animalId), fmtF(p.fecha), p.cria, p.sexo, p.peso ?? "—"]));
  return `<h2 class="titulo">Reproducción</h2><p class="sub">Parto probable = servicio + ${DIAS_GEST} días.</p>
    <div class="fila" style="margin-bottom:12px"><button class="btn crece" data-a="nuevo" data-f="servicio">Registrar Servicio</button><button class="btn crece" data-a="nuevo" data-f="parto">Registrar Parto</button></div>
    ${seccion("Próximos Partos", lista(itemsProximosPartos(ind.gestantes), "No hay hembras gestantes."), "partos")}
    ${seccion(`Alertas de Días Abiertos (> ${META_DA})`, lista(ind.alertas.map(a => `<div class="item"><div class="l1">${enlace(a.id, a.arete + (a.nombre ? " · " + a.nombre : ""))}<span class="etq rojo">${a.dias} días</span></div>
      <div class="l2">Último parto: ${fmtF(a.lp.fecha)} · <b style="color:#dc2626">⚠️ BAJA EFICIENCIA REPRODUCTIVA</b></div></div>`), "Sin alertas reproductivas."), "alertas")}
    ${seccion("Historial de Servicios", lista(serv.map(s => `<div class="item"><div class="l1">${enlace(s.animalId, nombreAnimal(s.animalId))}<span>${fmtF(s.fecha)}</span></div>
      <div class="l2">${esc(s.tipo)} · N° ${s.nServ || "—"} · ${esc(s.toro || "—")}${s.pajilla ? " · Pajilla " + esc(s.pajilla) : ""}<br>FPP ${fmtF(s.fpp)} ${estadoS(s)}</div>
      ${botonesReg("servicios", "servicio", s.id, s.fallido ? `<button class="btn amb mini" data-a="vacia" data-id="${s.id}" data-v="0">↩ Efectivo</button>` : `<button class="btn amb mini" data-a="vacia" data-id="${s.id}" data-v="1">Vacía</button>`)}</div>`), "Sin servicios registrados."), "servicios")}
    ${seccion("Historial de Partos", lista(partos.map(p => `<div class="item"><div class="l1">${enlace(p.animalId, nombreAnimal(p.animalId))}<span>${fmtF(p.fecha)}</span></div>
      <div class="l2">Cría: <b style="color:${p.cria === "Muerto" ? "#dc2626" : "inherit"}">${esc(p.cria)}</b> · ${esc(p.sexo)} · ${fmtKg(p.peso)}</div>${botonesReg("partos", "parto", p.id)}</div>`), "Sin partos registrados."), "hpartos")}`;
}

function pgSanidad() {
  const q = UI.busq.toLowerCase();
  const regs = [...D.sanidad].sort(porFecha).reverse().filter(s => (UI.filtro === "all" || s.tipo === UI.filtro) &&
    (!q || nombreAnimal(s.animalId).toLowerCase().includes(q) || s.detalle.toLowerCase().includes(q)));
  registrarExport("sanidad", "Fichas Sanitarias", ["Fecha", "Tipo", "Animal", "Detalle", "Dosis"],
    regs.map(s => [fmtF(s.fecha), s.tipo, s.animalId ? nombreAnimal(s.animalId) : "General", s.detalle, s.dosis || "—"]));
  return `<h2 class="titulo">Sanidad</h2><p class="sub">Vacunas, tratamientos y eventos por animal o por lote.</p>
    <div class="chips">${["all", "Vacuna", "Tratamiento", "Evento sanitario"].map(k => `<button class="chip ${UI.filtro === k ? "activo" : ""}" data-a="filtro" data-k="${k}">${k === "all" ? "Todos" : k}</button>`).join("")}</div>
    <input class="buscar" id="buscar" placeholder="🔍 Buscar animal o producto" value="${esc(UI.busq)}">
    ${seccion("Fichas Sanitarias", lista(regs.map(s => `<div class="item"><div class="l1"><b>${esc(s.detalle)}</b><span>${fmtF(s.fecha)}</span></div>
      <div class="l2">${esc(s.tipo)} · ${s.animalId ? enlace(s.animalId, nombreAnimal(s.animalId)) : "Lote / general"}${s.dosis ? " · Dosis: " + esc(s.dosis) : ""}</div>${botonesReg("sanidad", "sanidad", s.id)}</div>`), "Sin registros sanitarios."), "sanidad")}
    ${puedeEditar() ? `<button class="fab" data-a="nuevo" data-f="sanidad">+ Sanidad</button>` : ""}`;
}

function pgOrdeno() {
  const regs = [...D.ordeno].sort(porFecha).reverse();
  const ultima = regs[0] ? regs[0].fecha : null;
  const delDia = regs.filter(o => o.fecha === ultima), totDia = delDia.reduce((s, o) => s + totalOrd(o), 0);
  const vacas = new Set(delDia.map(o => o.animalId)).size;
  const h7 = sumarDias(hoy(), -6), mes = hoy().slice(0, 7);
  const ids = [...new Set(regs.map(o => o.animalId))].sort((a, b) => natural(nombreAnimal(a), nombreAnimal(b)));
  if (UI.filtro !== "all" && !ids.includes(UI.filtro)) UI.filtro = "all";
  const l = regs.filter(o => UI.filtro === "all" || o.animalId === UI.filtro);
  registrarExport("ordeno", "Historial de Pesaje de Leche", ["Fecha", "Vaca", "Litros AM", "Litros PM", "Total (L)"],
    l.map(o => [fmtF(o.fecha), nombreAnimal(o.animalId), o.am || 0, o.pm || 0, Math.round(totalOrd(o) * 10) / 10]));
  return `<h2 class="titulo">Ordeño</h2><p class="sub">Pesaje de leche por vaca (litros de la mañana y de la tarde).</p>
    <div class="tiles" style="margin-bottom:12px">
      <div class="tile" style="background:#fff;border:1px solid #e2e8f0"><div class="v">${fmtL(totDia)}</div><div class="e">Último día con pesaje${ultima ? " · " + fmtF(ultima) : ""}</div></div>
      <div class="tile" style="background:#fff;border:1px solid #e2e8f0"><div class="v">${vacas ? fmtL(totDia / vacas) : "—"}</div><div class="e">Promedio por vaca (último día)</div></div>
      <div class="tile" style="background:#fff;border:1px solid #e2e8f0"><div class="v">${fmtL(regs.filter(o => o.fecha >= h7).reduce((s, o) => s + totalOrd(o), 0))}</div><div class="e">Últimos 7 días</div></div>
      <div class="tile" style="background:#fff;border:1px solid #e2e8f0"><div class="v">${fmtL(regs.filter(o => o.fecha.startsWith(mes)).reduce((s, o) => s + totalOrd(o), 0))}</div><div class="e">Mes en curso</div></div></div>
    <div class="campo"><select id="filtro-vaca"><option value="all">Todas las vacas</option>${ids.map(i => `<option value="${i}" ${UI.filtro === i ? "selected" : ""}>${esc(nombreAnimal(i))}</option>`).join("")}</select></div>
    ${seccion("Historial de Pesaje de Leche", lista(l.map(o => `<div class="item"><div class="l1">${enlace(o.animalId, nombreAnimal(o.animalId))}<b>${fmtL(totalOrd(o))}</b></div>
      <div class="l2">${fmtF(o.fecha)} · AM ${fmtL(o.am)} · PM ${fmtL(o.pm)}</div>${botonesReg("ordeno", "ordeno", o.id)}</div>`), "Sin controles de ordeño."), "ordeno")}
    ${puedeEditar() ? `<button class="fab" data-a="nuevo" data-f="ordeno">+ Ordeño</button>` : ""}`;
}

function pgSalidas() {
  const bajas = D.animales.filter(a => a.baja).sort((a, b) => (b.fechaBaja || "").localeCompare(a.fechaBaja || ""));
  registrarExport("bajas", "Salidas y Bajas (Mortalidad/Venta)", ["Arete", "Nombre", "Sexo", "Motivo", "Fecha", "Observaciones"],
    bajas.map(b => [b.arete, b.nombre || "—", b.sexo, b.baja, fmtF(b.fechaBaja), b.obsBaja || "—"]));
  const anio = String(new Date().getFullYear());
  return `<h2 class="titulo">Salidas / Bajas</h2><p class="sub">Animales que salieron por mortalidad o venta. Conservan su récord.</p>
    <div class="tiles" style="margin-bottom:12px">${[[bajas.length, "Salidas registradas"], [bajas.filter(b => b.baja === "Venta").length, "Ventas"],
      [bajas.filter(b => b.baja === "Mortalidad").length, "Mortalidad"], [bajas.filter(b => (b.fechaBaja || "").startsWith(anio)).length, `Salidas en ${anio}`]]
      .map(([v, e]) => `<div class="tile" style="background:#fff;border:1px solid #e2e8f0"><div class="v">${v}</div><div class="e">${e}</div></div>`).join("")}</div>
    ${seccion("Salidas y Bajas (Mortalidad/Venta)", lista(bajas.map(b => `<div class="item"><div class="l1">${enlace(b.id, b.arete + (b.nombre ? " · " + b.nombre : ""))}
      <span class="etq ${b.baja === "Mortalidad" ? "rojo" : "verde"}">${esc(b.baja)}</span></div><div class="l2">${fmtF(b.fechaBaja)} · ${esc(b.sexo)}${b.obsBaja ? " · " + esc(b.obsBaja) : ""}</div>
      ${puedeEditar() ? `<div class="acciones"><button class="btn amb mini" data-a="anular" data-id="${b.id}">↩ Anular salida</button></div>` : ""}</div>`), "No hay salidas registradas."), "bajas")}
    ${puedeEditar() ? `<button class="fab" data-a="nuevo" data-f="baja">+ Salida</button>` : ""}`;
}

function pgMas() {
  const op = (a, i, t, d) => `<button data-a="${a}"><span class="ic">${i}</span><span><b>${t}</b><div class="d">${d}</div></span></button>`;
  return `<h2 class="titulo">Más opciones</h2><p class="sub">Sesión: <b>${esc(sesion.nombre)}</b> (${esc(sesion.rol)})</p>
    <div class="tarjeta lista-menu">
      ${op("config", "⚙️", "Configuración de la finca", "Nombre de la finca y termo de pajillas")}
      ${op("exportar-respaldo", "⬇️", "Exportar respaldo", "Guarda o envía una copia de todos los datos")}
      ${esAdmin() ? op("importar-respaldo", "⬆️", "Importar respaldo", "Restaura una copia (también acepta respaldos de la web)") : ""}
      ${op("historial", "📜", "Historial de movimientos", "Bitácora de lo registrado y quién lo hizo")}
      ${esAdmin() ? op("usuarios", "👥", "Usuarios", "Crear, editar, bloquear y restablecer contraseñas") : ""}
      ${op("cambiar-pass", "🔑", "Cambiar contraseña", "Contraseña de su usuario")}
      ${op("salir", "🚪", "Cerrar sesión", "Volver a la pantalla de inicio")}
    </div>
    <div class="aviso gris">Los datos se guardan en este teléfono y no se envían a ningún servidor. Se guarda una copia automática cada día (se conservan 10). Exporte un respaldo con regularidad.</div>
    <p class="ayuda" style="text-align:center">${APP.nombre} · versión ${APP.version}</p>`;
}

/* =========================================================
   RÉCORD HISTÓRICO
   ========================================================= */
let recordAbierto = null;
function abrirRecord(id) {
  recordAbierto = { id, tab: "servicios" };
  const capa = abrirModal("Récord histórico", `<div data-rec></div>`, { extraCab: `<button data-a="pdf-record" style="margin-right:6px">PDF</button>`, alCerrar: () => { recordAbierto = null; } });
  recordAbierto.capa = capa;
  refrescarRecord();
}
function refrescarRecord() {
  if (!recordAbierto) return;
  const a = animalPorId(recordAbierto.id);
  if (!a) { cerrarModalPorElemento(recordAbierto.capa); recordAbierto = null; return; }
  const e = estado(a), r = recordAbierto;
  const de = col => D[col].filter(x => x.animalId === a.id).sort(porFecha).reverse();
  const reg = { servicios: de("servicios"), partos: de("partos"), sanidad: de("sanidad"), ordeno: de("ordeno") };
  const leche = reg.ordeno.reduce((s, o) => s + totalOrd(o), 0);
  const catN = (CATS.find(c => c.k === e.cat) || {}).n;
  $(".cab .crece", r.capa).textContent = "Récord · " + a.arete + (a.nombre ? " · " + a.nombre : "");
  const info = [`<b>${catN}</b>${e.tipo === "Vaca" ? " (Vaca)" : ""}`, a.sexo, `Edad: <b>${fmtEdad(a.fechaNac)}</b>`, `Peso: <b>${fmtKg(a.peso)}</b>`, `Origen: ${esc(a.origen || "—")}`];
  if (e.gest) info.push(`<span style="color:#047857">Gestante · <b>FPP ${fmtF(e.fpp)}</b> (${faltan(diasEntre(hoy(), e.fpp))})</span>`);
  if (a.baja) info.push(`<b style="color:#b91c1c">SALIDA: ${esc(a.baja)} el ${fmtF(a.fechaBaja)}</b>`);
  if (a.notas) info.push("Notas: " + esc(a.notas));
  r.info = info.join(" · ");
  const filas = {
    servicios: reg.servicios.map(s => [fmtF(s.fecha), s.tipo, "N° " + (s.nServ || "—"), s.toro || "—", s.pajilla ? "Pajilla " + s.pajilla : "", "FPP " + fmtF(s.fpp), s.fallido ? "Vacía" : ""]),
    partos: reg.partos.map(p => [fmtF(p.fecha), p.cria, p.sexo, fmtKg(p.peso)]),
    sanidad: reg.sanidad.map(s => [fmtF(s.fecha), s.tipo, s.detalle, s.dosis || "—"]),
    ordeno: reg.ordeno.map(o => [fmtF(o.fecha), "AM " + fmtL(o.am), "PM " + fmtL(o.pm), "Total " + fmtL(totalOrd(o))]),
  };
  r.filas = filas;
  const editar = puedeEditar() && !a.baja;
  const btn = (f, t, sec) => `<button class="btn ${sec ? "amb" : ""} mini" data-a="nuevo-rec" data-f="${f}">${t}</button>`;
  $("[data-rec]", r.capa).innerHTML = `<p style="margin:0 0 10px;font-size:13.5px;line-height:1.5">${r.info}</p>
    ${e.alerta && !a.baja ? `<div class="alerta">⚠️ BAJA EFICIENCIA REPRODUCTIVA (más de ${META_DA} días abiertos)</div>` : ""}
    <div class="tiles" style="margin-bottom:10px">${[[reg.servicios.length, "Servicios"], [reg.partos.length, "Partos"], [e.dias === null ? "—" : e.dias + " d", "Días abiertos"],
      [fmtL(leche), "Leche registrada"], [reg.ordeno[0] ? fmtF(reg.ordeno[0].fecha) : "—", "Último ordeño"]].map(([v, t]) => `<div class="tile"><div class="v" style="font-size:18px">${v}</div><div class="e">${t}</div></div>`).join("")}</div>
    ${editar ? `<div class="acciones" style="margin-bottom:6px">
      ${a.sexo === "Hembra" && ["Vaca", "Novilla"].includes(e.tipo) ? btn("servicio", "+ Servicio") + btn("parto", "+ Parto") : ""}
      ${e.tipo === "Vaca" ? btn("ordeno", "+ Ordeño") : ""}${btn("sanidad", "+ Sanidad")}
      ${btn("editar-animal", "✏️ Editar", 1)}${btn("baja", "📤 Salida", 1)}
      <button class="btn pel mini" data-a="eliminar" data-col="animales" data-id="${a.id}">🗑️ Eliminar</button></div>` : ""}
    ${a.baja && puedeEditar() ? `<div class="acciones"><button class="btn amb mini" data-a="anular" data-id="${a.id}">↩ Anular salida</button></div>` : ""}
    <div class="tabs">${[["servicios", "Servicios"], ["partos", "Partos"], ["sanidad", "Sanidad"], ["ordeno", "Ordeño"]].map(([k, t]) => `<button class="${r.tab === k ? "activo" : ""}" data-a="tab-rec" data-k="${k}">${t} (${filas[k].length})</button>`).join("")}</div>
    ${lista(filas[r.tab].map(f => `<div class="item"><div class="l1"><b>${esc(f[0])}</b></div><div class="l2">${f.slice(1).filter(Boolean).map(esc).join(" · ")}</div></div>`), "Sin registros.")}`;
}

/* =========================================================
   CONFIGURACIÓN, USUARIOS, HISTORIAL, RESPALDOS
   ========================================================= */
function abrirConfig() {
  const capa = abrirModal("Configuración de la finca", `<div data-conf></div>`);
  const pintar = () => {
    const total = D.pajillas.reduce((s, p) => s + p.cantidad, 0);
    $("[data-conf]", capa).innerHTML = `<div class="campo"><label>Nombre de la finca</label><input id="cf-finca" value="${esc(D.finca)}" maxlength="60"></div>
      <button class="btn ancho" data-a="guardar-finca">Guardar nombre</button>
      <h3 class="st">Termo de pajillas · ${total} disponibles</h3>
      ${D.pajillas.length ? [...D.pajillas].sort((a, b) => natural(a.codigo, b.codigo)).map(p => `<div class="termo"><b>${esc(p.codigo)}</b><span>${esc(p.raza)}</span>
        <input type="number" min="0" inputmode="numeric" value="${p.cantidad}" data-cant="${p.id}"><button class="btn pel mini" data-a="borrar-pajilla" data-id="${p.id}">🗑️</button></div>`).join("")
        : `<div class="vacio">Termo vacío. Agregue pajillas abajo.</div>`}
      <div class="form2" style="margin-top:10px"><div class="campo"><label>Código</label><input id="pj-cod"></div><div class="campo"><label>Raza / Toro</label><input id="pj-raza"></div>
      <div class="campo"><label>Cantidad</label><input id="pj-cant" inputmode="numeric"></div><div class="campo"><label>&nbsp;</label><button class="btn ancho" data-a="agregar-pajilla">+ Agregar</button></div></div>
      <div class="ayuda">Al registrar una inseminación se descuenta 1 pajilla del código usado. Si agrega un código existente, se suman las cantidades.</div>`;
    $$("[data-cant]", capa).forEach(i => i.addEventListener("change", () => {
      if (soloLectura()) return pintar();
      const p = D.pajillas.find(x => x.id === i.dataset.cant), v = Math.max(0, parseInt(i.value) || 0);
      if (p && p.cantidad !== v) { mov("EDICIÓN", "pajilla", "", `Termo: ${p.codigo} de ${p.cantidad} a ${v}`); p.cantidad = v; guardar(); }
      pintar();
    }));
  };
  capa.pintar = pintar; UI.config = capa; pintar();
}
function abrirHistorial() {
  const capa = abrirModal("Historial de movimientos", `<input class="buscar" id="hist-q" placeholder="🔍 Filtrar por animal, tipo o usuario"><div data-hist></div>`);
  const pintar = () => {
    const q = $("#hist-q", capa).value.trim().toLowerCase();
    const l = D.movimientos.filter(m => m.usuario !== USUARIO_OCULTO).slice().reverse()
      .filter(m => !q || [m.animal, m.tipo, m.usuario, m.desc].join(" ").toLowerCase().includes(q)).slice(0, 500);
    registrarExport("historial", "Historial de movimientos", ["Fecha", "Tipo", "Tabla", "Animal", "Usuario", "Descripción"], l.map(m => [m.fecha, m.tipo, m.tabla || "", m.animal || "", m.usuario, m.desc]));
    $("[data-hist]", capa).innerHTML = `<div class="acciones" style="margin-bottom:8px"><button class="btn sec mini" data-a="pdf" data-k="historial">Exportar PDF</button></div>` +
      lista(l.map(m => `<div class="item"><div class="l1"><b>${esc(m.tipo)}</b><span style="font-size:12px">${esc(m.fecha)}</span></div><div class="l2">${esc(m.animal ? m.animal + " · " : "")}${esc(m.desc)}<br>Usuario: ${esc(m.usuario)}</div></div>`), "Sin movimientos.");
  };
  $("#hist-q", capa).addEventListener("input", pintar); pintar();
}
function abrirUsuarios() {
  const capa = abrirModal("Usuarios", `<div data-us></div>`);
  const pintar = () => {
    const roles = sesion.rol === "master" ? ["master", "admin", "usuario", "consultor"] : ["admin", "usuario", "consultor"];
    $("[data-us]", capa).innerHTML = `<p class="ayuda" style="margin-top:0">Master y admin administran todo; usuario registra datos; consultor solo consulta.</p>` +
      D.usuarios.filter(u => u.username !== USUARIO_OCULTO).map(u => `<div class="item"><div class="l1"><b>${esc(u.username)}</b>
        <span class="etq ${u.bloqueado ? "rojo" : u.activo ? "verde" : "gris"}">${u.bloqueado ? "Bloqueado" : u.activo ? "Activo" : "Inactivo"}</span></div>
        <div class="l2">${esc(u.nombre)} · ${esc(u.cargo || "")} · Rol: <b>${esc(u.rol)}</b>${u.ultimo ? " · Último acceso: " + esc(u.ultimo) : ""}</div>
        ${u.username !== sesion.username && !(sesion.rol === "admin" && u.rol === "master") ? `<div class="acciones">
          <select data-rol="${u.id}" style="border:1px solid #cbd5e1;border-radius:8px;padding:6px">${roles.map(r => `<option ${u.rol === r ? "selected" : ""}>${r}</option>`).join("")}</select>
          <button class="btn amb mini" data-a="us-activo" data-id="${u.id}">${u.activo ? "Desactivar" : "Activar"}</button>
          <button class="btn amb mini" data-a="us-reset" data-id="${u.id}">Desbloquear / clave</button>
          <button class="btn pel mini" data-a="us-borrar" data-id="${u.id}">Eliminar</button></div>` : ""}</div>`).join("") +
      `<button class="btn ancho" style="margin-top:12px" data-a="us-nuevo">+ Nuevo usuario</button>`;
    $$("[data-rol]", capa).forEach(s => s.addEventListener("change", () => {
      const u = D.usuarios.find(x => x.id === s.dataset.rol); u.rol = s.value;
      mov("EDICIÓN", "usuario", "", `Rol de '${u.username}': ${s.value}`); guardar(); toast("Rol actualizado."); pintar();
    }));
  };
  capa.pintar = pintar; UI.usuarios = capa; pintar();
}
function formUsuario(bienvenida = false) {
  const roles = sesion.rol === "master" ? ["admin", "master", "usuario", "consultor"] : ["admin", "usuario", "consultor"];
  formulario({
    titulo: bienvenida ? "Bienvenido · Cree su administrador" : "Nuevo usuario",
    campos: [{ k: "nombre", l: "Nombre completo", r: 1, w: 1 }, { k: "username", l: "Usuario", r: 1 }, { k: "cargo", l: "Cargo" },
      { k: "p1", l: "Contraseña", t: "password", r: 1 }, { k: "p2", l: "Confirmar", t: "password", r: 1 },
      { k: "rol", l: "Rol", t: "select", r: 1, w: 1, o: roles }],
    init: { rol: "admin" }, etiqueta: "Crear usuario",
    extra: bienvenida ? `<div class="aviso ambar">Entró con el usuario predeterminado. Cree ahora su cuenta personal y luego cambie la clave de «admin».</div>` : "",
    guardar: v => {
      if (/\s/.test(v.username)) return "El usuario no puede contener espacios.";
      if (v.p1.length < 6) return "La contraseña debe tener mínimo 6 caracteres.";
      if (v.p1 !== v.p2) return "Las contraseñas no coinciden.";
      if (D.usuarios.some(u => u.username.toLowerCase() === v.username.toLowerCase())) return "Ese usuario ya existe.";
      D.usuarios.push({ id: uid(), username: v.username, password: sha256(v.p1), nombre: v.nombre, cargo: v.cargo, rol: v.rol, activo: true, bloqueado: false, intentos: 0 });
      mov("CREACIÓN", "usuario", "", `Creación de usuario '${v.username}' (${v.rol})`);
      toast(`Usuario '${v.username}' creado.`);
      setTimeout(() => UI.usuarios && UI.usuarios.isConnected && UI.usuarios.pintar(), 50);
      return true;
    },
  });
}
function formClave(uidUsuario) {
  const propio = !uidUsuario;
  const u = propio ? D.usuarios.find(x => x.username === sesion.username) : D.usuarios.find(x => x.id === uidUsuario);
  formulario({
    titulo: propio ? "Cambiar contraseña" : `Restablecer clave · ${u.username}`,
    campos: [...(propio ? [{ k: "actual", l: "Contraseña actual", t: "password", r: 1, w: 1 }] : []),
      { k: "p1", l: "Nueva contraseña", t: "password", r: 1 }, { k: "p2", l: "Confirmar", t: "password", r: 1 }],
    etiqueta: "Guardar", extra: propio ? "" : `<div class="ayuda">También desbloquea el usuario y reinicia los intentos fallidos.</div>`,
    guardar: v => {
      if (propio && sha256(v.actual) !== u.password) return "La contraseña actual es incorrecta.";
      if (v.p1.length < 6) return "Mínimo 6 caracteres.";
      if (v.p1 !== v.p2) return "Las contraseñas no coinciden.";
      Object.assign(u, { password: sha256(v.p1), bloqueado: false, intentos: 0 });
      mov("CAMBIO_PASSWORD", "usuario", "", propio ? "Cambio de contraseña" : `Reset de contraseña de '${u.username}'`);
      toast("Contraseña actualizada."); setTimeout(() => UI.usuarios && UI.usuarios.isConnected && UI.usuarios.pintar(), 50);
      return true;
    },
  });
}
function exportarRespaldo() {
  compartirArchivo(`respaldo-ganadero-${hoy()}.json`, JSON.stringify(D, null, 1), "application/json");
  mov("RESPALDO", "", "", "Respaldo exportado"); guardar();
}
async function aplicarImportacion(texto) {
  let d;
  try { d = JSON.parse(texto); if (!d || !Array.isArray(d.animales)) throw 0; }
  catch (e) { return toast("El archivo no es un respaldo válido de ZONEMIL GANADERO.", true); }
  const deWeb = !Array.isArray(d.usuarios);
  const aviso = deWeb ? "Respaldo de la versión web: se reemplazarán los animales y registros (los usuarios de este teléfono se conservan)."
    : "Se reemplazará TODA la información de este teléfono (incluidos usuarios) por la del respaldo.";
  if (!(await confirmar(aviso + " Antes se guarda una copia automática. ¿Continuar?", "Sí, importar", true))) return;
  if (Nativo && Nativo.respaldoPrevio) Nativo.respaldoPrevio(JSON.stringify(D));
  const usuarios = D.usuarios;
  D = normalizar(deWeb ? { ...d, usuarios, movimientos: D.movimientos } : d);
  mov("RESTAURACIÓN", "", "", deWeb ? "Respaldo de la web importado" : "Respaldo restaurado");
  guardar(); cerrarTodo(); UI.pagina = "panel"; toast("Respaldo importado correctamente.");
  if (!deWeb && !D.usuarios.some(u => u.username === sesion.username && u.activo)) return salir();
  render();
}
window.onImportar = texto => { if (texto) aplicarImportacion(texto); };
function importarRespaldo() {
  if (Nativo && Nativo.importar) Nativo.importar();
  else { const i = document.createElement("input"); i.type = "file"; i.accept = ".json,application/json";
    i.onchange = () => { const f = i.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => aplicarImportacion(r.result); r.readAsText(f); }; i.click(); }
}

/* =========================================================
   ACTIVACIÓN Y SESIÓN
   ========================================================= */
function pantallaActivacion() {
  return `<div class="portada">${marca()}<h1>Activación del programa</h1>
    <p>Para usar ${APP.nombre} en este teléfono necesita el código de instalación entregado por el proveedor. Se necesita internet solo para validarlo.</p>
    <div class="caja"><h2>Código de instalación</h2><p class="sub">Formato: GAN-XXXX-XXXX-XXXX</p>
      <div class="campo"><input id="codigo" placeholder="GAN-XXXX-XXXX-XXXX" autocapitalize="characters" style="text-transform:uppercase;letter-spacing:1px"></div>
      <div id="act-msg" class="aviso rojo oculto"></div>
      <button class="btn ancho" id="btn-activar" data-a="activar">Validar y activar</button>
      <p class="ayuda">Cada código sirve para un solo equipo.</p></div>
    <div class="pie">${APP.lema} · v${APP.version}</div></div>`;
}
const marca = () => `<div class="marca"><img src="logo.png" alt=""><div><div class="a">${APP.nombre}</div><div class="b">${APP.lema}</div></div></div>`;
function activar() {
  const codigo = ($("#codigo").value || "").toUpperCase().replace(/[^A-Z0-9-]/g, "");
  const msg = $("#act-msg");
  if (!codigo) { msg.textContent = "Escriba el código de instalación entregado por el proveedor."; msg.classList.remove("oculto"); return; }
  if (UI.intentosCodigo >= 5) { msg.textContent = "Se agotaron los intentos. Cierre la app y contacte al proveedor."; msg.classList.remove("oculto"); return; }
  const b = $("#btn-activar"); b.disabled = true; b.textContent = "Validando…"; msg.classList.add("oculto");
  if (Nativo && Nativo.validarCodigo) Nativo.validarCodigo(codigo);
  else setTimeout(() => window.onValidacion("OK"), 400);
}
window.onValidacion = resp => {
  const b = $("#btn-activar"), msg = $("#act-msg");
  if (!b) return;
  b.disabled = false; b.textContent = "Validar y activar";
  const r = String(resp || "").trim();
  if (r === "OK") { toast("Programa activado en este teléfono."); UI.pantalla = "login"; render(); return; }
  let t;
  if (r === "SIN_CONEXION") t = "No se pudo contactar el servidor de validación. Verifique la conexión a internet y vuelva a intentarlo.";
  else if (r === "ERROR") t = "El servidor no pudo procesar la solicitud. Intente de nuevo en unos minutos.";
  else if (r === "USADO" || r === "INVALIDO") {
    UI.intentosCodigo++;
    t = (r === "USADO" ? "Este código ya fue utilizado en otro equipo. Cada código sirve para un solo equipo. Solicite uno nuevo al proveedor."
      : "El código ingresado no es válido. Verifique que lo escribió exactamente como se lo entregó el proveedor.")
      + (UI.intentosCodigo >= 5 ? " Se agotaron los intentos." : ` Intentos restantes: ${5 - UI.intentosCodigo}.`);
    if (UI.intentosCodigo >= 5) b.disabled = true;
  } else t = "El servidor de validación respondió de forma inesperada. Contacte al proveedor.";
  msg.textContent = t; msg.classList.remove("oculto");
};
function pantallaLogin() {
  const rec = localStorage.getItem("zg_usuario") || "";
  return `<div class="portada">${marca()}<h1>Controle su finca con claridad total.</h1>
    <p>Inventario, reproducción, ordeño, sanidad y salidas en su teléfono, sin depender de internet.</p>
    <div class="caja"><h2>Bienvenido</h2><p class="sub">Inicie sesión para continuar en su finca</p>
      <div class="campo"><label>Usuario</label><input id="lg-u" autocapitalize="none" value="${esc(rec)}"></div>
      <div class="campo"><label>Contraseña</label><input id="lg-p" type="password"></div>
      <label class="fila" style="font-size:13px;color:#475569;margin-bottom:12px"><input type="checkbox" id="lg-r" ${rec ? "checked" : ""}> Recordar mi usuario</label>
      <div id="lg-msg" class="aviso rojo oculto"></div>
      <button class="btn ancho" data-a="entrar" style="background:linear-gradient(90deg,#78350f,#a16207)">Iniciar sesión</button>
      <p class="ayuda" style="text-align:center">¿Olvidó su contraseña? Contacte a un administrador.</p></div>
    <div class="pie">${APP.nombre} · v${APP.version}</div></div>`;
}
function entrar() {
  const u = $("#lg-u").value.trim(), p = $("#lg-p").value, msg = $("#lg-msg");
  const err = t => { msg.textContent = t; msg.classList.remove("oculto"); };
  if (!u || !p) return err("Usuario y contraseña son obligatorios.");
  const us = D.usuarios.find(x => x.username === u && x.activo);
  if (!us) return err("Usuario no encontrado.");
  if (us.bloqueado) return err("Usuario bloqueado. Contacte a un administrador.");
  if (us.password !== sha256(p)) {
    us.intentos = (us.intentos || 0) + 1;
    if (us.intentos >= 3) { us.bloqueado = true; err("Usuario bloqueado por 3 intentos fallidos."); }
    else err(`Contraseña incorrecta · Intento ${us.intentos} de 3`);
    guardar(); return;
  }
  us.intentos = 0; us.ultimo = ahora();
  if ($("#lg-r").checked) localStorage.setItem("zg_usuario", u); else localStorage.removeItem("zg_usuario");
  sesion = { username: us.username, nombre: us.nombre, rol: us.rol };
  mov("LOGIN", "usuario", "", "Inicio de sesión"); guardar();
  UI.pantalla = "app"; UI.pagina = "panel"; UI.filtro = "all"; UI.busq = ""; render();
  if (us.username === "admin" && us.password === sha256("admin123")) setTimeout(() => formUsuario(true), 400);
}
function salir() {
  if (sesion) { mov("LOGOUT", "usuario", "", "Cierre de sesión"); guardar(); }
  sesion = null; cerrarTodo(); UI.pantalla = "login"; render();
}

/* =========================================================
   RENDER Y EVENTOS
   ========================================================= */
const PAGINAS = { panel: ["🏠", "Panel", pgPanel], inventario: ["📋", "Inventario", pgInventario], reproduccion: ["🧬", "Reprod.", pgReproduccion],
  ordeno: ["🥛", "Ordeño", pgOrdeno], sanidad: ["💉", "Sanidad", pgSanidad], salidas: ["📤", "Salidas", pgSalidas], mas: ["☰", "Más", pgMas] };
function render() {
  const app = $("#app");
  if (UI.pantalla === "activacion") { app.innerHTML = pantallaActivacion(); return; }
  if (UI.pantalla === "login" || !sesion) { app.innerHTML = pantallaLogin(); return; }
  const scroll = window.scrollY;
  app.innerHTML = `<header class="cabecera"><img src="logo.png" alt=""><div class="crece"><div class="t1">${esc(D.finca)}</div><div class="t2">${APP.lema}</div></div>
      <button class="btn-cab" data-a="config" title="Configuración">⚙️</button></header>
    <main class="contenido">${PAGINAS[UI.pagina][2]()}</main>
    <nav class="nav">${Object.entries(PAGINAS).map(([k, [i, t]]) => `<button class="${UI.pagina === k ? "activo" : ""}" data-a="ir" data-p="${k}"><span class="ic">${i}</span>${t}</button>`).join("")}</nav>`;
  window.scrollTo(0, UI.mantenerScroll ? scroll : 0);
  UI.mantenerScroll = false;
  const b = $("#buscar");
  if (b) {
    b.addEventListener("input", () => { UI.busq = b.value; const pos = b.selectionStart; UI.mantenerScroll = true; render(); const n = $("#buscar"); n.focus(); n.setSelectionRange(pos, pos); });
  }
  const fv = $("#filtro-vaca");
  if (fv) fv.addEventListener("change", () => { UI.filtro = fv.value; UI.mantenerScroll = true; render(); });
}
function ir(p) { UI.pagina = p; UI.filtro = "all"; UI.busq = ""; UI.sel = null; render(); }

const ACC = {
  "cerrar-modal": () => cerrarModal(),
  activar, entrar,
  ir: d => ir(d.p),
  filtro: d => { if (UI.pagina === "panel") { ir("inventario"); } UI.filtro = d.k; UI.mantenerScroll = UI.pagina !== "panel"; render(); },
  barra: d => { UI.sel = +d.i; UI.mantenerScroll = true; render(); },
  nuevo: d => { if (soloLectura()) return; FORMS[d.f](); },
  "nuevo-rec": d => {
    const id = recordAbierto.id;
    if (d.f === "editar-animal") formAnimal(id); else if (d.f === "baja") formBaja(id); else FORMS[d.f](id);
  },
  editar: d => { if (soloLectura()) return; ({ servicio: formServicio, parto: formParto, ordeno: formOrdeno, sanidad: formSanidad })[d.f](null, d.id); },
  eliminar: d => eliminar(d.col, d.id),
  vacia: d => marcarVacia(d.id, d.v === "1"),
  anular: d => anularBaja(d.id),
  record: d => abrirRecord(d.id),
  "tab-rec": d => { recordAbierto.tab = d.k; refrescarRecord(); },
  "pdf-record": () => {
    const r = recordAbierto, a = animalPorId(r.id);
    imprimir(`Récord histórico · ${a.arete}${a.nombre ? " · " + a.nombre : ""}`, [{ titulo: "Datos del animal", texto: r.info.replace(/<[^>]+>/g, "") },
      { titulo: "Servicios", columnas: ["Fecha", "Tipo", "N°", "Toro / Semen", "Pajilla", "FPP", "Estado"], filas: r.filas.servicios },
      { titulo: "Partos", columnas: ["Fecha", "Cría", "Sexo", "Peso"], filas: r.filas.partos },
      { titulo: "Sanidad", columnas: ["Fecha", "Tipo", "Detalle", "Dosis"], filas: r.filas.sanidad },
      { titulo: "Ordeño", columnas: ["Fecha", "AM", "PM", "Total"], filas: r.filas.ordeno }]);
  },
  pdf: d => exportarPDF(d.k), csv: d => exportarCSV(d.k),
  config: () => abrirConfig(),
  "guardar-finca": () => { if (soloLectura()) return; D.finca = $("#cf-finca").value.trim() || FINCA_DEF; mov("EDICIÓN", "configuracion", "", "Nombre de la finca: " + D.finca); guardar(); toast("Nombre de la finca guardado."); render(); },
  "agregar-pajilla": () => {
    if (soloLectura()) return;
    const c = $("#pj-cod").value.trim(), r = $("#pj-raza").value.trim(), n = parseInt($("#pj-cant").value);
    if (!c || !r || !(n >= 1)) return toast("Escriba código, raza/toro y cantidad (mínimo 1).", true);
    const p = D.pajillas.find(x => x.codigo.toLowerCase() === c.toLowerCase());
    if (p) { p.cantidad += n; p.raza = r; } else D.pajillas.push({ id: uid(), codigo: c, raza: r, cantidad: n });
    mov("CREACIÓN", "pajilla", "", `Termo: +${n} pajillas ${c} (${r})`); guardar(); UI.config.pintar();
  },
  "borrar-pajilla": async d => {
    if (soloLectura()) return;
    const p = D.pajillas.find(x => x.id === d.id);
    if (await confirmar(`¿Eliminar el código <b>${esc(p.codigo)}</b> del termo?`, "Eliminar", true)) {
      D.pajillas = D.pajillas.filter(x => x.id !== d.id); mov("ELIMINACIÓN", "pajilla", "", `Termo: código ${p.codigo} eliminado`); guardar(); UI.config.pintar();
    }
  },
  "exportar-respaldo": exportarRespaldo,
  "importar-respaldo": () => esAdmin() ? importarRespaldo() : toast("Solo un administrador puede importar respaldos.", true),
  historial: abrirHistorial, usuarios: abrirUsuarios,
  "us-nuevo": () => formUsuario(false),
  "us-activo": d => { const u = D.usuarios.find(x => x.id === d.id); u.activo = !u.activo; mov("EDICIÓN", "usuario", "", `Usuario '${u.username}' ${u.activo ? "activado" : "desactivado"}`); guardar(); UI.usuarios.pintar(); },
  "us-reset": d => formClave(d.id),
  "us-borrar": async d => {
    const u = D.usuarios.find(x => x.id === d.id);
    if (await confirmar(`¿ELIMINAR PERMANENTEMENTE al usuario <b>${esc(u.username)}</b>?`, "Eliminar", true)) {
      D.usuarios = D.usuarios.filter(x => x.id !== d.id); mov("ELIMINACIÓN", "usuario", "", `Eliminación de usuario '${u.username}'`); guardar(); UI.usuarios.pintar();
    }
  },
  "cambiar-pass": () => formClave(null),
  salir: async () => { if (await confirmar("¿Cerrar sesión?")) salir(); },
};
document.addEventListener("click", e => {
  const b = e.target.closest("[data-a]");
  if (!b) return;
  const f = ACC[b.dataset.a];
  if (f) { e.preventDefault(); f(b.dataset, e); }
});
document.addEventListener("keydown", e => {
  if (e.key !== "Enter") return;
  if (e.target.id === "lg-p" || e.target.id === "lg-u") entrar();
  if (e.target.id === "codigo") activar();
});
/* Botón «atrás» de Android: cierra el modal abierto o vuelve al panel. Devuelve true si lo manejó. */
window.onAtras = () => {
  if (UI.modales.length) { cerrarModal(); return true; }
  if (UI.pantalla === "app" && UI.pagina !== "panel") { ir("panel"); return true; }
  return false;
};

/* ---------- arranque ---------- */
cargar();
UI.pantalla = (Nativo && Nativo.activado && !Nativo.activado()) ? "activacion" : "login";
if (!Nativo && new URLSearchParams(location.search).has("activacion")) UI.pantalla = "activacion";
render();
