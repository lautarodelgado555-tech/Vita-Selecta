import React, { useState, useMemo, useEffect } from "react";
import { supabase } from "./supabase";
import {
  Target, Plus, Check, Minus, Flame, Droplets, Moon, Sun, Leaf, Dumbbell,
  X, TrendingUp, Smile, Meh, Frown, Heart, ChevronLeft, ChevronRight, Calendar,
  Trash2, Settings, Sparkles, Salad, Activity, ListChecks, Clock, ShoppingBag,
  Utensils, ChevronDown, Info, MapPin, Zap, Palette
} from "lucide-react";

/* ============================================================
   VITA SELECTA — App de bienestar (3 secciones integradas)
   1) Habitos  · tracker completo (logica ya definida)
   2) Alimentacion · planes por objetivo + restricciones
   3) Movimiento · planes por objetivo + nivel + lugar
   Selector de objetivo arriba de cada seccion de contenido.
   Planes armados de varios dias. Algunos items sugieren un
   suplemento de Vita Selecta (no forzado).
   Datos en memoria -> migrables a Supabase.
   ============================================================ */

/* Paleta OSCURA "botanica nocturna":
   fondo verde-negro, superficies un escalon mas claras,
   textos en crema/salvia claro, salvia y terracota como acentos vivos.
   Se mantienen los nombres de tokens para no tocar el resto del codigo. */
// C ahora referencia variables CSS, que se definen segun el tema activo (ver TEMAS).
// Asi los 140+ usos de C.x siguen funcionando, pero los colores cambian dinamicamente.
const C = {
  bg: "var(--bg)",
  card: "var(--card)",
  cardAlt: "var(--cardAlt)",
  salvia: "var(--salvia)",
  salviaD: "var(--salviaD)",
  salviaL: "var(--salviaL)",
  salviaBg: "var(--salviaBg)",
  terra: "var(--terra)",
  terraD: "var(--terraD)",
  terraL: "var(--terraL)",
  tinta: "var(--tinta)",
  gris: "var(--gris)",
  grisL: "var(--grisL)",
  borde: "var(--borde)",
  acentoTxt: "var(--acentoTxt)", // color de texto sobre acentos (antes hardcodeado #1a221a)
};

// Las dos paletas. "claro" = Verde y miel, "oscuro" = Botánica nocturna.
const TEMAS = {
  oscuro: {
    bg: "#10160f",        // fondo general (verde-negro)
    card: "#1a221a",      // superficies / tarjetas
    cardAlt: "#222c21",   // superficie un escalon mas clara
    salvia: "#8fae84",    // acento verde principal
    salviaD: "#a9c39f",   // verde claro para textos/acentos
    salviaL: "#2c3a2a",   // verde apagado para fondos sutiles
    salviaBg: "#222c21",  // fondo verde muy sutil
    terra: "#e08a63",     // terracota acento
    terraD: "#f0a884",    // terracota claro para textos
    terraL: "#3a2820",    // terracota apagado para fondos sutiles
    tinta: "#f1f4ed",     // texto principal (crema clara)
    gris: "#9aa692",      // texto secundario
    grisL: "#6b7665",     // texto terciario
    borde: "#2c3829",     // bordes
    acentoTxt: "#10160f", // texto sobre acentos
  },
  claro: {
    bg: "#fbf7ee",        // fondo general (crema cálido)
    card: "#ffffff",      // superficies / tarjetas
    cardAlt: "#f3ecdc",   // superficie un escalon distinta
    salvia: "#5c8a3f",    // acento verde principal (verde bosque vivo)
    salviaD: "#4a6b3a",   // verde más oscuro para textos
    salviaL: "#e6f0d8",   // verde apagado para fondos sutiles
    salviaBg: "#f0f7e4",  // fondo verde muy sutil
    terra: "#e8a73a",     // acento secundario (miel/dorado)
    terraD: "#c48a2b",    // miel oscuro para textos
    terraL: "#fdeecf",    // miel apagado para fondos
    tinta: "#2a3a22",     // texto principal (verde oscuro)
    gris: "#6f7e63",      // texto secundario
    grisL: "#a9b29c",     // texto terciario
    borde: "#e6dcc4",     // bordes
    acentoTxt: "#ffffff", // texto sobre acentos
  },
};

// Aplica las variables CSS de un tema al elemento raiz de la app.
function aplicarTema(nombre) {
  const t = TEMAS[nombre] || TEMAS.oscuro;
  const root = document.getElementById("vita-root");
  const target = root || document.documentElement;
  Object.keys(t).forEach((k) => target.style.setProperty(`--${k}`, t[k]));
  // Notificar a componentes que dependen del tema (ej. el logo)
  try { window.dispatchEvent(new CustomEvent("vita-tema-cambio", { detail: nombre })); } catch {}
}

// Decide que tema mostrar segun el modo elegido (claro/oscuro/auto).
function temaEfectivo(modo) {
  if (modo === "claro") return "claro";
  if (modo === "oscuro") return "oscuro";
  // automatico: claro de dia (7-19), oscuro de noche
  const h = new Date().getHours();
  return (h >= 7 && h < 19) ? "claro" : "oscuro";
}

// Aplicacion inicial sincronica (antes del primer render de React) para evitar parpadeo.
if (typeof document !== "undefined") {
  let modoInicial = "oscuro";
  try { modoInicial = localStorage.getItem("vita_tema") || "oscuro"; } catch {}
  aplicarTema(temaEfectivo(modoInicial));
}
const SERIF = "'DM Serif Display', Georgia, serif";
const SANS = "'DM Sans', system-ui, sans-serif";

/* ===================== DATOS HABITOS ===================== */
const ICONS = { agua: Droplets, suple: Leaf, entrenar: Dumbbell, dormir: Moon, sol: Sun, meta: Target, corazon: Heart };
const ICON_LIST = Object.keys(ICONS);
const HABITOS_BASE = [
  { id: "b1", nombre: "Tomar suplementos", icon: "suple", tipo: "si_no", meta: 1, frecuencia: { modo: "diario" }, base: true },
  { id: "b2", nombre: "Tomar agua", icon: "agua", tipo: "cantidad", meta: 8, unidad: "vasos", frecuencia: { modo: "diario" }, base: true },
  { id: "b3", nombre: "Moverme / entrenar", icon: "entrenar", tipo: "si_no", meta: 1, frecuencia: { modo: "x_semana", veces: 4 }, base: true },
  { id: "b4", nombre: "Dormir 7-8 hs", icon: "dormir", tipo: "si_no", meta: 1, frecuencia: { modo: "diario" }, base: true },
  { id: "b5", nombre: "Tomar sol 10 min", icon: "sol", tipo: "si_no", meta: 1, frecuencia: { modo: "dias", dias: [1, 2, 3, 4, 5] }, base: true },
];
const MOODS = [
  { v: 1, label: "Bajon", icon: Frown, color: "#c97b5a" },
  { v: 2, label: "Normal", icon: Meh, color: "#d9b96b" },
  { v: 3, label: "Bien", icon: Smile, color: "#9bb06f" },
  { v: 4, label: "Genial", icon: Heart, color: "#7a9471" },
];
const DIAS_SEM = ["D", "L", "M", "X", "J", "V", "S"];
const MAX_CORRECCION = 3;

/* ===================== DATOS ALIMENTACION ===================== */
const OBJ_COMIDA = [
  { id: "energia", label: "Mas energia" },
  { id: "peso", label: "Bajar de peso" },
  { id: "musc", label: "Masa muscular" },
  { id: "digest", label: "Bienestar digestivo" },
  { id: "descanso", label: "Mejor descanso" },
];
const RESTRICCIONES = [
  { id: "vegano", label: "Vegano" },
  { id: "vegetariano", label: "Vegetariano" },
  { id: "singluten", label: "Sin gluten" },
  { id: "sinlacteos", label: "Sin lacteos" },
];
const PLANES_COMIDA = [
  {
    id: "pc1", objetivo: "energia", titulo: "Energía sostenida · Clásico",
    desc: "Plan de 5 días. Carbohidratos complejos + proteína magra + grasa saludable para energía pareja, sin bajones.",
    cumple: [], suple: "Blend Energía", dias: [
      { dia: "Lunes", items: [
        { momento: "Desayuno", nombre: "Avena con banana, nueces y miel", porque: "La avena aporta carbohidratos de absorción lenta que dan energía pareja toda la mañana; las nueces suman grasas buenas y magnesio.", ingredientes: ["½ taza de avena", "1 banana", "1 puñado de nueces", "1 cdita de miel", "Leche o agua caliente"], pasos: "Cociná la avena con la leche o agua 3-4 minutos. Serví con la banana en rodajas, las nueces y un hilo de miel.", suple: "Blend Energía" },
        { momento: "Almuerzo", nombre: "Pollo a la plancha con arroz integral y ensalada", porque: "Combina carbohidrato complejo + proteína magra + grasa saludable para energía pareja, sin el bajón de media tarde.", ingredientes: ["1 pechuga de pollo (150 g)", "¾ taza de arroz integral cocido", "Tomate, zanahoria y hojas verdes", "Aceite de oliva, limón, sal"], pasos: "Cociná el pollo a la plancha. Serví con el arroz integral y la ensalada aliñada con oliva y limón." },
        { momento: "Cena", nombre: "Tortilla de papa y huevo con ensalada", porque: "Una cena nutritiva y de fácil digestión; el huevo aporta proteína de calidad para recuperar al final del día.", ingredientes: ["2 huevos", "1 papa mediana", "½ cebolla", "Hojas verdes", "Aceite de oliva"], pasos: "Herví la papa en cubos, salteá la cebolla, mezclá con los huevos batidos y cuajá la tortilla a fuego bajo. Acompañá con ensalada.", suple: "Vitamina D3 + K2" },
      ]},
      { dia: "Martes", items: [
        { momento: "Desayuno", nombre: "Yogur con granola casera y fruta", porque: "El yogur aporta proteína y la avena tostada energía sostenida; juntos evitan el hambre de media mañana.", ingredientes: ["1 yogur natural", "3 cdas de avena tostada", "1 puñado de frutos secos", "Fruta de estación"], pasos: "Tostá la avena con los frutos secos unos minutos en sartén. Serví sobre el yogur con la fruta picada.", suple: "Blend Energía" },
        { momento: "Almuerzo", nombre: "Wok de carne magra y vegetales con arroz", porque: "La carne magra aporta hierro y proteína (clave contra el cansancio), y el arroz repone energía.", ingredientes: ["150 g de carne magra en tiras", "Morrón, brócoli, zanahoria", "¾ taza de arroz", "Aceite, salsa de soja"], pasos: "Salteá la carne a fuego fuerte, retirá. Salteá los vegetales, volvé a sumar la carne con un toque de soja. Serví con arroz." },
        { momento: "Cena", nombre: "Salmón (o merluza) al horno con batata", porque: "El pescado suma omega 3 y la batata carbohidrato de buena calidad para una cena que no cae pesada.", ingredientes: ["1 filet de salmón o merluza", "1 batata", "Aceite de oliva, limón, romero"], pasos: "Horneá la batata en rodajas 20 min. Sumá el pescado con oliva, limón y romero, y cociná 12 min más." },
      ]},
      { dia: "Miércoles", items: [
        { momento: "Desayuno", nombre: "Tostadas integrales con palta y huevo", porque: "El pan integral da energía lenta, la palta grasas buenas y el huevo proteína: un desayuno que sostiene.", ingredientes: ["2 rebanadas de pan integral", "½ palta", "1 huevo", "Sal, pimienta"], pasos: "Tostá el pan, pisá la palta encima y sumá el huevo a la plancha o poché.", suple: "Maca Negra" },
        { momento: "Almuerzo", nombre: "Pasta integral con salsa de carne y verduras", porque: "La pasta integral libera energía de forma gradual, ideal para sostener la tarde activa.", ingredientes: ["80 g de pasta integral", "100 g de carne picada magra", "Tomate triturado, cebolla, morrón"], pasos: "Hacé una salsa con la carne, la cebolla y el morrón. Sumá el tomate y cociná 15 min. Mezclá con la pasta." },
        { momento: "Cena", nombre: "Revuelto de calabaza, espinaca y huevo", porque: "Liviano y nutritivo; la espinaca aporta hierro y magnesio que ayudan contra la fatiga.", ingredientes: ["1 taza de calabaza en cubos", "1 puñado de espinaca", "2 huevos", "Aceite de oliva"], pasos: "Cociná la calabaza hasta tierna, sumá la espinaca y luego los huevos. Revolvé hasta cuajar." },
      ]},
      { dia: "Jueves", items: [
        { momento: "Desayuno", nombre: "Licuado de banana, avena y leche + tostada", porque: "Rápido y energético: la banana aporta potasio y la avena carbohidrato de liberación lenta.", ingredientes: ["1 banana", "2 cdas de avena", "1 vaso de leche", "1 tostada integral con queso"], pasos: "Licuá la banana con la avena y la leche. Acompañá con la tostada.", suple: "Blend Energía" },
        { momento: "Almuerzo", nombre: "Bowl de arroz, huevo y vegetales salteados", porque: "Un plato completo y colorido que combina energía de los carbohidratos con proteína del huevo.", ingredientes: ["¾ taza de arroz integral", "2 huevos", "Zucchini, zanahoria, cebolla de verdeo"], pasos: "Salteá los vegetales, sumá el arroz cocido y coroná con huevos a la plancha." },
        { momento: "Cena", nombre: "Pollo al horno con vegetales asados", porque: "Proteína magra y vegetales para cerrar el día sin pesadez y reponer para el día siguiente.", ingredientes: ["1 muslo o pechuga de pollo", "Papa, zanahoria, cebolla", "Aceite de oliva, hierbas"], pasos: "Acomodá todo en una fuente con oliva y hierbas. Horneá 35-40 min hasta dorar." },
      ]},
      { dia: "Viernes", items: [
        { momento: "Desayuno", nombre: "Panqueques de avena con fruta", porque: "Hechos con avena y banana, dan energía sostenida y son una opción rica para cerrar la semana.", ingredientes: ["1 huevo", "½ taza de avena", "1 banana pisada", "Fruta para acompañar"], pasos: "Mezclá huevo, avena y banana. Cociná los panqueques en sartén antiadherente. Serví con fruta.", suple: "Maca Negra" },
        { momento: "Almuerzo", nombre: "Milanesa de pollo al horno con puré de calabaza", porque: "La versión al horno es más liviana; la calabaza aporta energía y vitaminas sin caer pesada.", ingredientes: ["1 milanesa de pollo", "Pan rallado, huevo", "Calabaza para el puré"], pasos: "Empaná la milanesa y horneá hasta dorar. Serví con puré de calabaza." },
        { momento: "Cena", nombre: "Ensalada completa con atún y huevo", porque: "Liviana pero completa: el atún y el huevo aportan proteína de calidad para una buena recuperación nocturna.", ingredientes: ["1 lata de atún al natural", "1 huevo duro", "Hojas verdes, tomate, choclo", "Aceite de oliva"], pasos: "Mezclá todo en un bowl y aliñá con oliva y limón. Una cena liviana pero completa." },
      ]},
    ],
  },
  {
    id: "pc2", objetivo: "energia", titulo: "Energía sostenida · Vegetariano sin gluten",
    desc: "Plan de 5 días sin carne ni gluten. Carbohidratos complejos, proteína vegetal y huevo para energía estable.",
    cumple: ["vegetariano", "singluten", "sinlacteos"], suple: "Maca Negra", dias: [
      { dia: "Lunes", items: [
        { momento: "Desayuno", nombre: "Avena (sin gluten) con banana y semillas", porque: "La avena sin gluten libera energía de forma gradual y las semillas suman magnesio, clave contra el cansancio.", ingredientes: ["½ taza de avena sin gluten certificada", "1 banana", "1 cda de semillas de chía o girasol", "Bebida vegetal"], pasos: "Cociná la avena con la bebida vegetal. Serví con la banana y las semillas.", suple: "Maca Negra" },
        { momento: "Almuerzo", nombre: "Bowl de quinoa, huevo y vegetales", porque: "La quinoa es carbohidrato y proteína a la vez; con el huevo arma un plato completo y energético.", ingredientes: ["¾ taza de quinoa cocida", "2 huevos", "Zanahoria, choclo, hojas verdes", "Aceite de oliva, limón"], pasos: "Serví la quinoa de base, sumá los vegetales y los huevos (duros o a la plancha). Aliñá con oliva y limón." },
        { momento: "Cena", nombre: "Tortilla de papa y cebolla con ensalada", porque: "Liviana y de fácil digestión; el huevo aporta proteína de calidad para cerrar el día.", ingredientes: ["2 huevos", "1 papa", "½ cebolla", "Hojas verdes"], pasos: "Herví la papa, salteá la cebolla, mezclá con huevo y cuajá la tortilla. Acompañá con ensalada.", suple: "Vitamina D3 + K2" },
      ]},
      { dia: "Martes", items: [
        { momento: "Desayuno", nombre: "Bowl de frutas con frutos secos y semillas", porque: "Energía rápida de la fruta combinada con grasas buenas de los frutos secos para que dure.", ingredientes: ["Fruta de estación picada", "1 puñado de frutos secos", "1 cda de semillas"], pasos: "Picá la fruta y serví con los frutos secos y semillas por encima." },
        { momento: "Almuerzo", nombre: "Ensalada de garbanzos y vegetales", porque: "Los garbanzos aportan proteína vegetal y fibra que dan saciedad y energía sostenida.", ingredientes: ["1 taza de garbanzos cocidos", "Tomate, pepino, morrón, cebolla", "Aceite de oliva, limón, comino"], pasos: "Mezclá los garbanzos con los vegetales picados. Aliñá con oliva, limón y comino.", suple: "Maca Negra" },
        { momento: "Cena", nombre: "Calabaza rellena con quinoa y vegetales", porque: "La calabaza aporta energía suave y la quinoa proteína: una cena nutritiva sin pesadez.", ingredientes: ["½ calabaza", "½ taza de quinoa cocida", "Cebolla, morrón, especias"], pasos: "Horneá la calabaza 30 min. Rellená con la quinoa salteada con los vegetales y gratiná unos minutos." },
      ]},
      { dia: "Miércoles", items: [
        { momento: "Desayuno", nombre: "Tostadas sin gluten con palta y tomate", porque: "El pan sin gluten da energía y la palta grasas saludables que sostienen la mañana.", ingredientes: ["2 rebanadas de pan sin gluten", "½ palta", "Tomate en rodajas", "Sal, oliva"], pasos: "Tostá el pan, pisá la palta encima y sumá el tomate con un hilo de oliva." },
        { momento: "Almuerzo", nombre: "Arroz integral con tortilla de vegetales", porque: "El arroz integral repone energía gradualmente y la tortilla suma proteína del huevo.", ingredientes: ["¾ taza de arroz integral", "2 huevos", "Zucchini, cebolla, espinaca"], pasos: "Hacé una tortilla con los vegetales y el huevo. Serví sobre el arroz integral." },
        { momento: "Cena", nombre: "Ensalada tibia de legumbres", porque: "Las legumbres aportan proteína y hierro vegetal; servida tibia es reconfortante y de buena digestión.", ingredientes: ["1 taza de lentejas cocidas", "Zanahoria, cebolla, morrón", "Aceite de oliva, perejil"], pasos: "Salteá los vegetales, sumá las lentejas, calentá y serví con perejil fresco." },
      ]},
      { dia: "Jueves", items: [
        { momento: "Desayuno", nombre: "Huevos revueltos con espinaca", porque: "Proteína y hierro desde temprano; la espinaca ayuda a sostener la energía durante la mañana.", ingredientes: ["2 huevos", "1 puñado de espinaca", "Aceite de oliva"], pasos: "Salteá la espinaca, sumá los huevos y revolvé hasta cuajar.", suple: "Maca Negra" },
        { momento: "Almuerzo", nombre: "Wok de tofu y vegetales", porque: "El tofu aporta proteína vegetal completa y los vegetales fibra y vitaminas para energía estable.", ingredientes: ["150 g de tofu firme", "Brócoli, zanahoria, morrón", "Salsa de soja sin gluten, aceite"], pasos: "Dorá el tofu en cubos, retirá. Salteá los vegetales, sumá el tofu y un toque de soja sin gluten." },
        { momento: "Cena", nombre: "Pescado al horno con vegetales", porque: "El pescado suma omega 3 y proteína magra; una cena liviana que repone sin caer pesada.", ingredientes: ["1 filet de merluza", "Calabaza, cebolla, zanahoria", "Aceite de oliva, limón"], pasos: "Acomodá los vegetales y el pescado en una fuente con oliva y limón. Horneá 20-25 min." },
      ]},
      { dia: "Viernes", items: [
        { momento: "Desayuno", nombre: "Smoothie verde con avena sin gluten", porque: "Combina fruta, hojas verdes y avena: energía rápida y sostenida en un solo vaso.", ingredientes: ["1 banana", "1 puñado de espinaca", "2 cdas de avena sin gluten", "Bebida vegetal"], pasos: "Licuá todo hasta integrar. Serví bien frío." },
        { momento: "Almuerzo", nombre: "Ensalada completa con huevo y quinoa", porque: "Un plato fresco y completo; la quinoa y el huevo dan la energía y proteína para la tarde.", ingredientes: ["½ taza de quinoa cocida", "2 huevos duros", "Hojas verdes, tomate, palta"], pasos: "Mezclá todo en un bowl y aliñá con oliva y limón.", suple: "Maca Negra" },
        { momento: "Cena", nombre: "Revuelto de vegetales y huevo", porque: "Liviano y rápido para cerrar la semana; el huevo aporta proteína de fácil digestión.", ingredientes: ["2 huevos", "Zucchini, cebolla, morrón", "Aceite de oliva"], pasos: "Salteá los vegetales, sumá los huevos y revolvé hasta cuajar." },
      ]},
    ],
  },
  {
    id: "pc3", objetivo: "energia", titulo: "Energía sostenida · Vegano sin gluten",
    desc: "Plan de 5 días 100% vegetal y sin gluten. Legumbres, cereales y semillas para energía estable.",
    cumple: ["vegano", "vegetariano", "singluten", "sinlacteos"], suple: "Blend Energía", dias: [
      { dia: "Lunes", items: [
        { momento: "Desayuno", nombre: "Avena sin gluten con banana y semillas", porque: "Energía gradual de la avena más potasio de la banana: un arranque vegetal y sostenido.", ingredientes: ["½ taza de avena sin gluten", "1 banana", "1 cda de semillas de chía", "Bebida vegetal"], pasos: "Cociná la avena con la bebida vegetal. Serví con la banana y las semillas.", suple: "Blend Energía" },
        { momento: "Almuerzo", nombre: "Bowl de quinoa, garbanzos y vegetales asados", porque: "Quinoa y garbanzos juntos dan proteína vegetal completa y energía de larga duración.", ingredientes: ["¾ taza de quinoa cocida", "1 taza de garbanzos", "Calabaza, morrón, cebolla", "Aceite de oliva"], pasos: "Asá los vegetales al horno. Serví sobre la quinoa con los garbanzos y un hilo de oliva." },
        { momento: "Cena", nombre: "Calabaza rellena con quinoa y vegetales", porque: "Reconfortante y nutritiva; la calabaza da energía suave ideal para la noche.", ingredientes: ["½ calabaza", "½ taza de quinoa", "Cebolla, morrón, especias"], pasos: "Horneá la calabaza, rellená con la quinoa salteada con los vegetales." },
      ]},
      { dia: "Martes", items: [
        { momento: "Desayuno", nombre: "Smoothie verde de frutas y semillas", porque: "Hidratante y energético; las semillas aportan grasas buenas que sostienen la mañana.", ingredientes: ["1 banana", "1 puñado de espinaca", "1 cda de semillas", "Bebida vegetal"], pasos: "Licuá todo hasta integrar." },
        { momento: "Almuerzo", nombre: "Ensalada de lentejas y verduras", porque: "Las lentejas aportan hierro vegetal y proteína: energía sostenida y saciedad.", ingredientes: ["1 taza de lentejas cocidas", "Tomate, cebolla, morrón, zanahoria", "Aceite de oliva, limón"], pasos: "Mezclá las lentejas con los vegetales picados y aliñá con oliva y limón.", suple: "Blend Energía" },
        { momento: "Cena", nombre: "Guiso liviano de lentejas", porque: "Un clásico nutritivo; las lentejas dan energía que dura y reconfortan en la noche.", ingredientes: ["1 taza de lentejas", "Papa, zanahoria, cebolla, morrón", "Caldo de verduras"], pasos: "Salteá los vegetales, sumá las lentejas y el caldo, cociná 25-30 min." },
      ]},
      { dia: "Miércoles", items: [
        { momento: "Desayuno", nombre: "Tostadas sin gluten con palta y tomate", porque: "Energía del pan sin gluten más grasas saludables de la palta para sostener la mañana.", ingredientes: ["2 rebanadas de pan sin gluten", "½ palta", "Tomate", "Sal, oliva"], pasos: "Tostá el pan, pisá la palta y sumá el tomate con oliva." },
        { momento: "Almuerzo", nombre: "Arroz integral con tofu y brócoli", porque: "El arroz integral repone energía y el tofu suma proteína vegetal completa.", ingredientes: ["¾ taza de arroz integral", "150 g de tofu", "Brócoli, zanahoria", "Salsa de soja sin gluten"], pasos: "Dorá el tofu, salteá el brócoli, mezclá con el arroz y un toque de soja sin gluten." },
        { momento: "Cena", nombre: "Ensalada tibia de garbanzos", porque: "Los garbanzos dan proteína y fibra; tibia es reconfortante y de buena digestión.", ingredientes: ["1 taza de garbanzos", "Zanahoria, cebolla, espinaca", "Aceite de oliva, comino"], pasos: "Salteá los vegetales, sumá los garbanzos, calentá y serví." },
      ]},
      { dia: "Jueves", items: [
        { momento: "Desayuno", nombre: "Bowl de frutas con semillas y frutos secos", porque: "Combinación de energía rápida de la fruta y sostenida de las grasas buenas.", ingredientes: ["Fruta de estación", "1 puñado de frutos secos", "1 cda de semillas"], pasos: "Picá la fruta y serví con frutos secos y semillas.", suple: "Blend Energía" },
        { momento: "Almuerzo", nombre: "Wok de tofu y vegetales con arroz", porque: "Tofu y arroz integral arman un plato completo, energético y 100% vegetal.", ingredientes: ["150 g de tofu", "Morrón, brócoli, zanahoria", "¾ taza de arroz integral", "Salsa de soja sin gluten"], pasos: "Dorá el tofu, salteá los vegetales, mezclá con el arroz y la soja." },
        { momento: "Cena", nombre: "Vegetales al wok con arroz", porque: "Liviano y colorido; los vegetales aportan vitaminas sin caer pesado de noche.", ingredientes: ["Zucchini, morrón, cebolla, choclo", "½ taza de arroz", "Aceite, jengibre"], pasos: "Salteá los vegetales a fuego fuerte con jengibre, serví con el arroz.", suple: "Multivitamínico Sea Moss" },
      ]},
      { dia: "Viernes", items: [
        { momento: "Desayuno", nombre: "Porridge de quinoa con frutos rojos", porque: "La quinoa da proteína y energía sostenida; los frutos rojos suman antioxidantes.", ingredientes: ["½ taza de quinoa", "Bebida vegetal", "Frutos rojos", "1 cdita de semillas"], pasos: "Cociná la quinoa en la bebida vegetal hasta cremosa. Serví con frutos rojos y semillas." },
        { momento: "Almuerzo", nombre: "Curry suave de garbanzos con arroz", porque: "Los garbanzos dan energía duradera y las especias ayudan a la digestión.", ingredientes: ["1 taza de garbanzos", "Tomate, cebolla, leche de coco", "Curry, jengibre", "Arroz para acompañar"], pasos: "Salteá la cebolla con las especias, sumá tomate, garbanzos y un poco de leche de coco. Cociná 15 min. Serví con arroz.", suple: "Blend Energía" },
        { momento: "Cena", nombre: "Sopa de verduras con quinoa", porque: "Reconfortante y liviana; la quinoa suma proteína para cerrar bien el día.", ingredientes: ["Calabaza, zanahoria, cebolla, apio", "½ taza de quinoa", "Caldo de verduras"], pasos: "Cociná los vegetales en el caldo, sumá la quinoa y cociná 15 min más." },
      ]},
    ],
  },
  {
    id: "pc4", objetivo: "peso", titulo: "Control de peso · Clásico",
    desc: "Plan de 5 días con alta proteína y fibra para saciar, cuidar el músculo y sostener un déficit sin pasar hambre.",
    cumple: [], suple: "Blend Metabolismo", dias: [
      { dia: "Lunes", items: [
        { momento: "Desayuno", nombre: "Yogur natural con fruta y avena", porque: "La proteína del yogur sacia y la fibra de la avena evita el picoteo de media mañana.", ingredientes: ["1 yogur natural descremado", "Fruta de estación", "2 cdas de avena"], pasos: "Mezclá el yogur con la avena y la fruta picada.", suple: "Blend Metabolismo" },
        { momento: "Almuerzo", nombre: "Pechuga de pollo con ensalada abundante", porque: "Proteína magra muy saciante con vegetales de bajo valor calórico que llenan el plato.", ingredientes: ["1 pechuga de pollo (150 g)", "Hojas verdes, tomate, pepino, zanahoria", "Aceite de oliva, limón"], pasos: "Cociná el pollo a la plancha y serví con la ensalada bien abundante aliñada con poco aceite y limón.", suple: "Multivitamínico Mujer" },
        { momento: "Cena", nombre: "Tortilla de claras con vegetales", porque: "Las claras aportan proteína con muy pocas calorías; ideal para una cena liviana.", ingredientes: ["3 claras + 1 huevo", "Espinaca, cebolla, tomate", "Aceite en spray"], pasos: "Salteá los vegetales y sumá los huevos batidos. Cuajá la tortilla." },
      ]},
      { dia: "Martes", items: [
        { momento: "Desayuno", nombre: "Tostada integral con huevo y palta", porque: "Combinación de proteína y grasa buena que sostiene la saciedad varias horas.", ingredientes: ["1 rebanada de pan integral", "1 huevo", "¼ palta"], pasos: "Tostá el pan, sumá el huevo a la plancha y la palta pisada." },
        { momento: "Almuerzo", nombre: "Pescado blanco con puré de calabaza y ensalada", porque: "El pescado es proteína magra y la calabaza un carbohidrato de bajo aporte calórico.", ingredientes: ["1 filet de merluza", "Calabaza para puré", "Ensalada verde"], pasos: "Cociná el pescado al horno o plancha. Serví con puré de calabaza y ensalada.", suple: "Berberina" },
        { momento: "Cena", nombre: "Wok de vegetales con pollo", porque: "Mucho volumen de vegetales con proteína magra: sacia sin sumar muchas calorías.", ingredientes: ["100 g de pollo en tiras", "Brócoli, zanahoria, morrón, cebolla", "Salsa de soja, aceite en spray"], pasos: "Salteá el pollo, sumá los vegetales y un toque de soja." },
      ]},
      { dia: "Miércoles", items: [
        { momento: "Desayuno", nombre: "Licuado de leche descremada, fruta y avena", porque: "Saciante y nutritivo; la avena aporta fibra que regula el apetito.", ingredientes: ["1 vaso de leche descremada", "1 fruta", "2 cdas de avena"], pasos: "Licuá todo hasta integrar." },
        { momento: "Almuerzo", nombre: "Bowl de lentejas y vegetales", porque: "Las legumbres combinan proteína y fibra, dando gran saciedad con pocas calorías.", ingredientes: ["1 taza de lentejas cocidas", "Tomate, cebolla, morrón, zanahoria", "Aceite de oliva, limón"], pasos: "Mezclá las lentejas con los vegetales picados y aliñá ligero." },
        { momento: "Cena", nombre: "Revuelto de espinaca y huevo", porque: "Liviano y proteico para cerrar el día sin exceso de calorías.", ingredientes: ["1 huevo + 2 claras", "Espinaca, cebolla", "Aceite en spray"], pasos: "Salteá la espinaca y la cebolla, sumá los huevos y revolvé." },
      ]},
      { dia: "Jueves", items: [
        { momento: "Desayuno", nombre: "Yogur con semillas y frutos rojos", porque: "Proteína y antioxidantes con muy buena saciedad para arrancar.", ingredientes: ["1 yogur natural descremado", "Frutos rojos", "1 cda de semillas de chía"], pasos: "Mezclá todo y dejá reposar unos minutos.", suple: "Blend Metabolismo" },
        { momento: "Almuerzo", nombre: "Carne magra a la plancha con ensalada", porque: "La proteína magra preserva el músculo durante el déficit y sacia.", ingredientes: ["150 g de carne magra (nalga, cuadril)", "Ensalada de hojas, tomate, zanahoria", "Aceite de oliva, limón"], pasos: "Cociná la carne a la plancha y serví con ensalada abundante." },
        { momento: "Cena", nombre: "Sopa de verduras con pollo desmenuzado", porque: "Mucho volumen y poca densidad calórica: sacia y reconforta de noche.", ingredientes: ["Calabaza, zanahoria, apio, cebolla", "100 g de pollo desmenuzado", "Caldo de verduras"], pasos: "Cociná los vegetales en el caldo, sumá el pollo desmenuzado." },
      ]},
      { dia: "Viernes", items: [
        { momento: "Desayuno", nombre: "Tostada integral con queso untable y tomate", porque: "Proteína del queso magro y fibra del pan integral para sostener la mañana.", ingredientes: ["1 rebanada de pan integral", "Queso untable descremado", "Tomate"], pasos: "Tostá el pan y armá con el queso y el tomate." },
        { momento: "Almuerzo", nombre: "Ensalada completa con atún y huevo", porque: "Proteína magra y vegetales: un almuerzo saciante y de pocas calorías.", ingredientes: ["1 lata de atún al natural", "1 huevo duro", "Hojas verdes, tomate, pepino, choclo (poco)", "Aceite de oliva, limón"], pasos: "Mezclá todo y aliñá con poco aceite y limón.", suple: "Berberina" },
        { momento: "Cena", nombre: "Zucchini relleno con vegetales y huevo", porque: "Liviano y nutritivo; el zucchini aporta volumen con muy pocas calorías.", ingredientes: ["2 zucchini", "Cebolla, morrón, tomate", "1 huevo"], pasos: "Ahuecá los zucchini, rellená con los vegetales salteados y el huevo, y gratiná." },
      ]},
    ],
  },
  {
    id: "pc5", objetivo: "peso", titulo: "Control de peso · Vegetariano sin gluten",
    desc: "Plan de 5 días sin carne ni gluten, con proteína vegetal y huevo, alto en fibra y saciante.",
    cumple: ["vegetariano", "singluten", "sinlacteos"], suple: "Berberina", dias: [
      { dia: "Lunes", items: [
        { momento: "Desayuno", nombre: "Avena sin gluten con fruta y semillas", porque: "La fibra de la avena y las semillas dan saciedad prolongada.", ingredientes: ["½ taza de avena sin gluten", "Fruta", "1 cda de semillas", "Bebida vegetal"], pasos: "Cociná la avena con la bebida vegetal y serví con fruta y semillas.", suple: "Berberina" },
        { momento: "Almuerzo", nombre: "Ensalada de garbanzos y vegetales", porque: "Garbanzos = proteína vegetal y fibra que sacian con pocas calorías.", ingredientes: ["1 taza de garbanzos", "Tomate, pepino, morrón, cebolla", "Aceite de oliva, limón, comino"], pasos: "Mezclá todo y aliñá ligero." },
        { momento: "Cena", nombre: "Tortilla de claras con espinaca", porque: "Las claras aportan proteína con muy pocas calorías.", ingredientes: ["3 claras + 1 huevo", "Espinaca, cebolla"], pasos: "Salteá la espinaca y cuajá con los huevos." },
      ]},
      { dia: "Martes", items: [
        { momento: "Desayuno", nombre: "Tostada sin gluten con palta y tomate", porque: "Grasa buena de la palta que sacia, sobre pan sin gluten.", ingredientes: ["1 rebanada de pan sin gluten", "¼ palta", "Tomate"], pasos: "Tostá y armá con palta pisada y tomate." },
        { momento: "Almuerzo", nombre: "Bowl de lentejas y vegetales", porque: "Proteína y fibra que llenan con pocas calorías.", ingredientes: ["1 taza de lentejas", "Zanahoria, cebolla, morrón", "Aceite de oliva, limón"], pasos: "Mezclá las lentejas con los vegetales.", suple: "Berberina" },
        { momento: "Cena", nombre: "Wok de tofu y vegetales", porque: "El tofu suma proteína vegetal saciante y los vegetales volumen.", ingredientes: ["150 g de tofu", "Brócoli, zanahoria, morrón", "Salsa de soja sin gluten"], pasos: "Dorá el tofu, salteá los vegetales y uní con soja." },
      ]},
      { dia: "Miércoles", items: [
        { momento: "Desayuno", nombre: "Smoothie verde con semillas", porque: "Hidratante y saciante; las semillas regulan el apetito.", ingredientes: ["Espinaca, ½ banana", "1 cda de semillas", "Bebida vegetal"], pasos: "Licuá todo." },
        { momento: "Almuerzo", nombre: "Ensalada tibia de quinoa y vegetales", porque: "La quinoa aporta proteína vegetal y fibra que sacian.", ingredientes: ["½ taza de quinoa", "Zucchini, morrón, cebolla", "Aceite de oliva, limón"], pasos: "Salteá los vegetales y mezclá con la quinoa." },
        { momento: "Cena", nombre: "Revuelto de vegetales y huevo", porque: "Liviano y proteico para la noche.", ingredientes: ["1 huevo + 2 claras", "Zucchini, cebolla, tomate"], pasos: "Salteá los vegetales y sumá los huevos." },
      ]},
      { dia: "Jueves", items: [
        { momento: "Desayuno", nombre: "Bowl de fruta con semillas", porque: "Liviano, con fibra que sacia sin muchas calorías.", ingredientes: ["Fruta de estación", "1 cda de semillas de chía"], pasos: "Picá la fruta y sumá las semillas.", suple: "Berberina" },
        { momento: "Almuerzo", nombre: "Ensalada de huevo, garbanzos y hojas", porque: "Proteína vegetal y del huevo con volumen de hojas verdes.", ingredientes: ["2 huevos duros", "½ taza de garbanzos", "Hojas verdes, tomate", "Aceite de oliva, limón"], pasos: "Mezclá todo y aliñá ligero." },
        { momento: "Cena", nombre: "Sopa de verduras con tofu", porque: "Mucho volumen y poca densidad calórica.", ingredientes: ["Calabaza, zanahoria, apio", "100 g de tofu en cubos", "Caldo de verduras"], pasos: "Cociná los vegetales en el caldo y sumá el tofu." },
      ]},
      { dia: "Viernes", items: [
        { momento: "Desayuno", nombre: "Tostada sin gluten con huevo", porque: "Proteína del huevo que sostiene la saciedad.", ingredientes: ["1 rebanada de pan sin gluten", "1 huevo"], pasos: "Tostá el pan y sumá el huevo a la plancha." },
        { momento: "Almuerzo", nombre: "Buddha bowl liviano", porque: "Combina proteína vegetal, vegetales y poca grasa.", ingredientes: ["½ taza de quinoa", "½ taza de garbanzos", "Vegetales crudos variados", "Aceite de oliva, limón"], pasos: "Armá el bowl con todo y aliñá ligero.", suple: "Berberina" },
        { momento: "Cena", nombre: "Zucchini relleno de vegetales", porque: "Volumen con muy pocas calorías para la noche.", ingredientes: ["2 zucchini", "Cebolla, morrón, tomate", "1 huevo"], pasos: "Rellená los zucchini con los vegetales y el huevo, y gratiná." },
      ]},
    ],
  },
  {
    id: "pc6", objetivo: "peso", titulo: "Control de peso · Vegano sin gluten",
    desc: "Plan de 5 días 100% vegetal y sin gluten, alto en fibra y proteína vegetal para saciar con pocas calorías.",
    cumple: ["vegano", "vegetariano", "singluten", "sinlacteos"], suple: "Blend Metabolismo", dias: [
      { dia: "Lunes", items: [
        { momento: "Desayuno", nombre: "Avena sin gluten con fruta y semillas", porque: "Fibra que sacia y regula el apetito durante la mañana.", ingredientes: ["½ taza de avena sin gluten", "Fruta", "1 cda de semillas", "Bebida vegetal"], pasos: "Cociná la avena con la bebida vegetal y serví con fruta y semillas.", suple: "Blend Metabolismo" },
        { momento: "Almuerzo", nombre: "Ensalada de lentejas y vegetales", porque: "Lentejas: proteína vegetal y fibra muy saciantes.", ingredientes: ["1 taza de lentejas", "Tomate, cebolla, morrón", "Aceite de oliva, limón"], pasos: "Mezclá todo y aliñá ligero." },
        { momento: "Cena", nombre: "Sopa de verduras", porque: "Mucho volumen con muy pocas calorías para la noche.", ingredientes: ["Calabaza, zanahoria, apio, cebolla", "Caldo de verduras"], pasos: "Cociná los vegetales en el caldo y procesá si te gusta cremosa." },
      ]},
      { dia: "Martes", items: [
        { momento: "Desayuno", nombre: "Smoothie verde con semillas", porque: "Saciante e hidratante para arrancar liviano.", ingredientes: ["Espinaca, ½ banana", "1 cda de semillas", "Bebida vegetal"], pasos: "Licuá todo." },
        { momento: "Almuerzo", nombre: "Bowl de garbanzos y vegetales asados", porque: "Proteína vegetal y fibra con vegetales de bajo aporte calórico.", ingredientes: ["1 taza de garbanzos", "Calabaza, morrón, cebolla", "Aceite de oliva (poco)"], pasos: "Asá los vegetales y serví con los garbanzos.", suple: "Blend Metabolismo" },
        { momento: "Cena", nombre: "Wok de tofu y vegetales", porque: "Proteína del tofu con volumen de vegetales.", ingredientes: ["150 g de tofu", "Brócoli, zanahoria, morrón", "Salsa de soja sin gluten"], pasos: "Dorá el tofu y salteá con los vegetales." },
      ]},
      { dia: "Miércoles", items: [
        { momento: "Desayuno", nombre: "Bowl de fruta con chía", porque: "Liviano y con fibra que ayuda a la saciedad.", ingredientes: ["Fruta de estación", "1 cda de chía remojada"], pasos: "Picá la fruta y sumá la chía." },
        { momento: "Almuerzo", nombre: "Ensalada tibia de quinoa y garbanzos", porque: "Proteína vegetal completa con fibra saciante.", ingredientes: ["½ taza de quinoa", "½ taza de garbanzos", "Vegetales salteados"], pasos: "Mezclá la quinoa con los garbanzos y los vegetales." },
        { momento: "Cena", nombre: "Crema de calabaza", porque: "Reconfortante y de bajo aporte calórico para la noche.", ingredientes: ["Calabaza, cebolla, zanahoria", "Caldo de verduras"], pasos: "Cociná y procesá hasta cremosa." },
      ]},
      { dia: "Jueves", items: [
        { momento: "Desayuno", nombre: "Avena sin gluten con bebida vegetal y canela", porque: "Fibra saciante con un toque de canela.", ingredientes: ["½ taza de avena sin gluten", "Bebida vegetal", "Canela"], pasos: "Cociná la avena con la bebida vegetal y canela.", suple: "Blend Metabolismo" },
        { momento: "Almuerzo", nombre: "Guiso liviano de lentejas y vegetales", porque: "Lentejas que sacian con vegetales de bajo aporte.", ingredientes: ["1 taza de lentejas", "Zanahoria, cebolla, morrón", "Caldo de verduras"], pasos: "Cociná todo junto hasta integrar." },
        { momento: "Cena", nombre: "Ensalada grande con tofu", porque: "Mucho volumen de hojas con proteína del tofu.", ingredientes: ["150 g de tofu", "Hojas verdes, tomate, pepino", "Aceite de oliva, limón"], pasos: "Dorá el tofu y sumá a la ensalada." },
      ]},
      { dia: "Viernes", items: [
        { momento: "Desayuno", nombre: "Smoothie de frutos rojos y semillas", porque: "Antioxidantes y fibra para arrancar liviano.", ingredientes: ["Frutos rojos, ½ banana", "1 cda de semillas", "Bebida vegetal"], pasos: "Licuá todo." },
        { momento: "Almuerzo", nombre: "Curry liviano de garbanzos con poco arroz", porque: "Proteína vegetal saciante con especias que dan sabor sin calorías.", ingredientes: ["1 taza de garbanzos", "Tomate, cebolla, curry", "½ taza de arroz"], pasos: "Salteá la cebolla con curry, sumá tomate y garbanzos. Serví con poco arroz.", suple: "Blend Metabolismo" },
        { momento: "Cena", nombre: "Vegetales al wok", porque: "Volumen y vitaminas con muy pocas calorías.", ingredientes: ["Zucchini, morrón, cebolla, brócoli", "Aceite en spray, jengibre"], pasos: "Salteá los vegetales a fuego fuerte con jengibre.", suple: "Multivitamínico Sea Moss" },
      ]},
    ],
  },
  {
    id: "pc7", objetivo: "musc", titulo: "Masa muscular · Clásico",
    desc: "Plan de 5 días con alta proteína distribuida y carbohidratos de calidad para apoyar el crecimiento muscular.",
    cumple: [], suple: "Maca Negra", dias: [
      { dia: "Lunes", items: [
        { momento: "Desayuno", nombre: "Avena con leche, banana y huevos", porque: "Combina proteína y carbohidratos para arrancar con energía y aporte muscular.", ingredientes: ["½ taza de avena", "1 vaso de leche", "1 banana", "2 huevos"], pasos: "Cociná la avena con leche y banana. Acompañá con huevos.", suple: "Maca Negra" },
        { momento: "Almuerzo", nombre: "Pechuga de pollo con arroz y vegetales", porque: "Proteína magra con buena base de carbohidratos para el músculo.", ingredientes: ["1 pechuga grande (180 g)", "1 taza de arroz", "Vegetales salteados"], pasos: "Cociná el pollo y serví con arroz y vegetales." },
        { momento: "Cena", nombre: "Carne magra con puré de papa", porque: "Proteína de calidad y carbohidrato para recuperar al final del día.", ingredientes: ["180 g de carne magra", "Papa para puré", "Ensalada"], pasos: "Cociná la carne y serví con puré y ensalada." },
      ]},
      { dia: "Martes", items: [
        { momento: "Desayuno", nombre: "Tostadas integrales con huevos revueltos y queso", porque: "Proteína abundante y carbohidrato para empezar el día.", ingredientes: ["2 rebanadas de pan integral", "3 huevos", "Queso"], pasos: "Hacé huevos revueltos con queso y serví sobre las tostadas." },
        { momento: "Almuerzo", nombre: "Pasta integral con carne y salsa", porque: "Carbohidrato de calidad con proteína para apoyar la masa muscular.", ingredientes: ["100 g de pasta integral", "120 g de carne picada magra", "Tomate, cebolla"], pasos: "Hacé la salsa con la carne y mezclá con la pasta.", suple: "Omega 3" },
        { momento: "Cena", nombre: "Salmón con batata", porque: "Omega 3 y proteína con carbohidrato para recuperar.", ingredientes: ["1 filet de salmón", "1 batata", "Vegetales"], pasos: "Horneá el salmón y la batata. Serví con vegetales." },
      ]},
      { dia: "Miércoles", items: [
        { momento: "Desayuno", nombre: "Yogur con granola, frutos secos y huevos", porque: "Proteína de varias fuentes para estimular la síntesis muscular.", ingredientes: ["1 yogur entero", "Granola, frutos secos", "2 huevos"], pasos: "Serví el yogur con granola y frutos secos, más los huevos aparte." },
        { momento: "Almuerzo", nombre: "Bowl de arroz, carne y vegetales", porque: "Proteína y carbohidrato en buena cantidad para el objetivo.", ingredientes: ["1 taza de arroz", "150 g de carne", "Vegetales salteados"], pasos: "Armá el bowl con todo." },
        { momento: "Cena", nombre: "Pollo al horno con papa", porque: "Proteína magra y carbohidrato para cerrar el día.", ingredientes: ["1 pechuga o muslo", "Papa, zanahoria", "Aceite de oliva"], pasos: "Horneá todo junto." },
      ]},
      { dia: "Jueves", items: [
        { momento: "Desayuno", nombre: "Panqueques de avena, huevo y banana", porque: "Proteína y carbohidrato en una opción rica y energética.", ingredientes: ["½ taza de avena", "2 huevos", "1 banana", "Miel"], pasos: "Mezclá y cociná los panqueques. Serví con miel.", suple: "Maca Negra" },
        { momento: "Almuerzo", nombre: "Milanesa de carne al horno con arroz", porque: "Proteína abundante con carbohidrato para el músculo.", ingredientes: ["1 milanesa de carne magra", "1 taza de arroz", "Ensalada"], pasos: "Horneá la milanesa y serví con arroz y ensalada." },
        { momento: "Cena", nombre: "Tortilla de papa con atún", porque: "Proteína y carbohidrato combinados para la recuperación nocturna.", ingredientes: ["3 huevos", "1 papa", "1 lata de atún"], pasos: "Hacé la tortilla integrando el atún." },
      ]},
      { dia: "Viernes", items: [
        { momento: "Desayuno", nombre: "Licuado de leche, avena, banana y mantequilla de maní", porque: "Muy energético y proteico, ideal pre o post entreno.", ingredientes: ["1 vaso de leche", "2 cdas de avena", "1 banana", "1 cda de mantequilla de maní"], pasos: "Licuá todo.", suple: "Maca Negra" },
        { momento: "Almuerzo", nombre: "Pollo con quinoa y vegetales", porque: "Proteína magra y la quinoa como carbohidrato y proteína extra.", ingredientes: ["1 pechuga (180 g)", "1 taza de quinoa", "Vegetales"], pasos: "Cociná el pollo y serví con quinoa y vegetales." },
        { momento: "Cena", nombre: "Carne con boniato y ensalada", porque: "Proteína y carbohidrato de calidad para recuperar.", ingredientes: ["180 g de carne magra", "1 boniato", "Ensalada"], pasos: "Cociná la carne y el boniato al horno. Serví con ensalada." },
      ]},
    ],
  },
  {
    id: "pc8", objetivo: "musc", titulo: "Masa muscular · Vegetariano sin gluten",
    desc: "Plan de 5 días sin carne ni gluten, con huevo, lácteos y proteína vegetal para apoyar el crecimiento muscular.",
    cumple: ["vegetariano", "singluten", "sinlacteos"], suple: "Omega 3", dias: [
      { dia: "Lunes", items: [
        { momento: "Desayuno", nombre: "Avena sin gluten con huevos y banana", porque: "Proteína y carbohidrato para arrancar el día con aporte muscular.", ingredientes: ["½ taza de avena sin gluten", "2 huevos", "1 banana", "Bebida vegetal"], pasos: "Cociná la avena y acompañá con los huevos.", suple: "Omega 3" },
        { momento: "Almuerzo", nombre: "Bowl de quinoa, huevo y legumbres", porque: "Quinoa y legumbres dan proteína vegetal con carbohidrato.", ingredientes: ["1 taza de quinoa", "2 huevos", "½ taza de garbanzos", "Vegetales"], pasos: "Armá el bowl con todo." },
        { momento: "Cena", nombre: "Tortilla de papa y queso", porque: "Proteína y carbohidrato para recuperar de noche.", ingredientes: ["3 huevos", "1 papa", "Queso"], pasos: "Hacé la tortilla con la papa y el queso." },
      ]},
      { dia: "Martes", items: [
        { momento: "Desayuno", nombre: "Yogur con granola sin gluten y frutos secos", porque: "Proteína de varias fuentes para el músculo.", ingredientes: ["Yogur", "Granola sin gluten", "Frutos secos"], pasos: "Serví el yogur con granola y frutos secos." },
        { momento: "Almuerzo", nombre: "Tortilla de papa con ensalada de legumbres", porque: "Proteína del huevo y las legumbres con carbohidrato.", ingredientes: ["3 huevos", "1 papa", "½ taza de lentejas", "Vegetales"], pasos: "Hacé la tortilla y serví con ensalada de lentejas.", suple: "Omega 3" },
        { momento: "Cena", nombre: "Pescado al horno con boniato", porque: "Omega 3 y proteína con carbohidrato.", ingredientes: ["1 filet de merluza", "1 boniato", "Vegetales"], pasos: "Horneá el pescado y el boniato." },
      ]},
      { dia: "Miércoles", items: [
        { momento: "Desayuno", nombre: "Panqueques de avena sin gluten y huevo", porque: "Proteína y carbohidrato en formato rico.", ingredientes: ["½ taza de avena sin gluten", "2 huevos", "1 banana"], pasos: "Mezclá y cociná los panqueques." },
        { momento: "Almuerzo", nombre: "Risotto de quinoa con queso y vegetales", porque: "Carbohidrato y proteína vegetal y del queso.", ingredientes: ["1 taza de quinoa", "Queso", "Hongos, cebolla"], pasos: "Cociná la quinoa tipo risotto con los vegetales y el queso." },
        { momento: "Cena", nombre: "Revuelto de huevos con papa y queso", porque: "Proteína y carbohidrato para la recuperación.", ingredientes: ["3 huevos", "1 papa", "Queso"], pasos: "Salteá la papa, sumá huevos y queso." },
      ]},
      { dia: "Jueves", items: [
        { momento: "Desayuno", nombre: "Licuado de leche, avena sin gluten y banana", porque: "Energético y proteico para el objetivo.", ingredientes: ["1 vaso de leche", "2 cdas de avena sin gluten", "1 banana", "Mantequilla de maní"], pasos: "Licuá todo.", suple: "Omega 3" },
        { momento: "Almuerzo", nombre: "Bowl de garbanzos, huevo y arroz", porque: "Proteína vegetal y del huevo con carbohidrato.", ingredientes: ["1 taza de arroz", "½ taza de garbanzos", "2 huevos", "Vegetales"], pasos: "Armá el bowl con todo." },
        { momento: "Cena", nombre: "Tarta de espinaca y queso sin masa", porque: "Proteína del huevo y el queso con vegetales.", ingredientes: ["3 huevos", "Espinaca", "Queso"], pasos: "Mezclá y horneá en molde hasta cuajar." },
      ]},
      { dia: "Viernes", items: [
        { momento: "Desayuno", nombre: "Yogur con frutos secos, semillas y fruta", porque: "Proteína y grasas buenas para el músculo.", ingredientes: ["Yogur", "Frutos secos, semillas", "Fruta"], pasos: "Mezclá todo." },
        { momento: "Almuerzo", nombre: "Quinoa con huevo y vegetales salteados", porque: "Proteína completa y carbohidrato.", ingredientes: ["1 taza de quinoa", "2 huevos", "Vegetales"], pasos: "Serví la quinoa con los vegetales y los huevos.", suple: "Omega 3" },
        { momento: "Cena", nombre: "Tortilla de papa con queso y ensalada", porque: "Proteína y carbohidrato para cerrar.", ingredientes: ["3 huevos", "1 papa", "Queso", "Ensalada"], pasos: "Hacé la tortilla y serví con ensalada." },
      ]},
    ],
  },
  {
    id: "pc9", objetivo: "musc", titulo: "Masa muscular · Vegano sin gluten",
    desc: "Plan de 5 días 100% vegetal y sin gluten, combinando legumbres, tofu y cereales para cubrir la proteína.",
    cumple: ["vegano", "vegetariano", "singluten", "sinlacteos"], suple: "Maca Negra", dias: [
      { dia: "Lunes", items: [
        { momento: "Desayuno", nombre: "Avena sin gluten con bebida de soja, banana y maní", porque: "La bebida de soja y el maní suman proteína vegetal y energía.", ingredientes: ["½ taza de avena sin gluten", "Bebida de soja", "1 banana", "1 cda de mantequilla de maní"], pasos: "Cociná la avena con la bebida de soja y serví con banana y maní.", suple: "Maca Negra" },
        { momento: "Almuerzo", nombre: "Bowl de quinoa, garbanzos y tofu", porque: "Triple fuente de proteína vegetal con carbohidrato.", ingredientes: ["1 taza de quinoa", "½ taza de garbanzos", "100 g de tofu", "Vegetales"], pasos: "Armá el bowl con todo, dorando el tofu." },
        { momento: "Cena", nombre: "Guiso de lentejas con arroz", porque: "Lentejas y arroz juntos cubren los aminoácidos esenciales.", ingredientes: ["1 taza de lentejas", "½ taza de arroz", "Zanahoria, cebolla, morrón"], pasos: "Cociná todo junto hasta integrar." },
      ]},
      { dia: "Martes", items: [
        { momento: "Desayuno", nombre: "Smoothie de soja, avena sin gluten y banana", porque: "Proteína vegetal y carbohidrato para arrancar.", ingredientes: ["Bebida de soja", "2 cdas de avena sin gluten", "1 banana", "Mantequilla de maní"], pasos: "Licuá todo." },
        { momento: "Almuerzo", nombre: "Wok de tofu, arroz y vegetales", porque: "Proteína del tofu con buena base de carbohidrato.", ingredientes: ["150 g de tofu", "1 taza de arroz", "Brócoli, zanahoria, morrón"], pasos: "Dorá el tofu, salteá los vegetales y uní con el arroz.", suple: "Omega 3" },
        { momento: "Cena", nombre: "Hamburguesas de lentejas con boniato", porque: "Proteína vegetal con carbohidrato para recuperar.", ingredientes: ["1 taza de lentejas", "Avena sin gluten para ligar", "1 boniato"], pasos: "Procesá las lentejas, formá hamburguesas y cociná. Serví con boniato al horno." },
      ]},
      { dia: "Miércoles", items: [
        { momento: "Desayuno", nombre: "Porridge de quinoa con bebida de soja y frutos secos", porque: "Proteína vegetal y energía sostenida.", ingredientes: ["½ taza de quinoa", "Bebida de soja", "Frutos secos", "Fruta"], pasos: "Cociná la quinoa en la bebida de soja hasta cremosa." },
        { momento: "Almuerzo", nombre: "Bowl de garbanzos, arroz y palta", porque: "Proteína vegetal, carbohidrato y grasas buenas.", ingredientes: ["1 taza de arroz", "1 taza de garbanzos", "½ palta", "Vegetales"], pasos: "Armá el bowl con todo." },
        { momento: "Cena", nombre: "Tofu salteado con quinoa", porque: "Proteína y carbohidrato vegetal completo.", ingredientes: ["150 g de tofu", "½ taza de quinoa", "Vegetales"], pasos: "Dorá el tofu y serví con quinoa y vegetales." },
      ]},
      { dia: "Jueves", items: [
        { momento: "Desayuno", nombre: "Avena sin gluten con soja, semillas y banana", porque: "Proteína y grasas buenas para el objetivo.", ingredientes: ["½ taza de avena sin gluten", "Bebida de soja", "Semillas", "1 banana"], pasos: "Cociná la avena con la soja y serví.", suple: "Maca Negra" },
        { momento: "Almuerzo", nombre: "Curry de garbanzos y lentejas con arroz", porque: "Doble legumbre con arroz: proteína vegetal abundante.", ingredientes: ["½ taza de garbanzos", "½ taza de lentejas", "Arroz", "Especias, leche de coco"], pasos: "Cociná las legumbres con especias y un poco de coco. Serví con arroz." },
        { momento: "Cena", nombre: "Tofu al horno con boniato", porque: "Proteína vegetal y carbohidrato de calidad.", ingredientes: ["150 g de tofu", "1 boniato", "Vegetales"], pasos: "Horneá el tofu y el boniato." },
      ]},
      { dia: "Viernes", items: [
        { momento: "Desayuno", nombre: "Smoothie de soja, maní, avena y cacao", porque: "Energético y proteico, ideal pre o post entreno.", ingredientes: ["Bebida de soja", "1 cda de mantequilla de maní", "2 cdas de avena sin gluten", "Cacao"], pasos: "Licuá todo." },
        { momento: "Almuerzo", nombre: "Buddha bowl proteico", porque: "Combina varias fuentes vegetales para cubrir proteína.", ingredientes: ["½ taza de quinoa", "½ taza de garbanzos", "100 g de tofu", "Vegetales, palta"], pasos: "Armá el bowl con todo.", suple: "Omega 3" },
        { momento: "Cena", nombre: "Guiso de porotos con arroz", porque: "Porotos y arroz: proteína vegetal completa.", ingredientes: ["1 taza de porotos", "½ taza de arroz", "Zapallo, cebolla, morrón"], pasos: "Cociná todo junto." },
      ]},
    ],
  },
  {
    id: "pc10", objetivo: "digest", titulo: "Bienestar digestivo · Clásico",
    desc: "Plan de 5 días con comidas suaves y de fácil digestión, con jengibre y cúrcuma como aliados antiinflamatorios.",
    cumple: [], suple: "Curcuma + Jengibre", dias: [
      { dia: "Lunes", items: [
        { momento: "Desayuno", nombre: "Avena cocida con manzana y canela", porque: "La avena cocida es suave para el estómago y la manzana aporta fibra amable.", ingredientes: ["½ taza de avena", "1 manzana", "Canela", "Agua o leche"], pasos: "Cociná la avena con la manzana rallada y canela.", suple: "Curcuma + Jengibre" },
        { momento: "Almuerzo", nombre: "Pollo hervido con arroz blanco y zanahoria", porque: "Comida liviana y de muy fácil digestión.", ingredientes: ["1 pechuga", "½ taza de arroz blanco", "Zanahoria hervida"], pasos: "Herví el pollo y la zanahoria. Serví con arroz." },
        { momento: "Cena", nombre: "Sopa de calabaza con jengibre", porque: "Reconfortante y antiinflamatoria, suave para la noche.", ingredientes: ["Calabaza, zanahoria, cebolla", "Jengibre", "Caldo suave"], pasos: "Cociná los vegetales con jengibre y procesá." },
      ]},
      { dia: "Martes", items: [
        { momento: "Desayuno", nombre: "Yogur natural con banana", porque: "El yogur aporta probióticos y la banana es suave para el estómago.", ingredientes: ["1 yogur natural", "1 banana"], pasos: "Mezclá el yogur con la banana en rodajas.", suple: "Multivitamínico Mujer" },
        { momento: "Almuerzo", nombre: "Merluza al vapor con puré de calabaza", porque: "Pescado suave y calabaza de fácil digestión.", ingredientes: ["1 filet de merluza", "Calabaza para puré"], pasos: "Cociná el pescado al vapor y serví con puré.", suple: "Curcuma + Jengibre" },
        { momento: "Cena", nombre: "Arroz con zanahoria y pollo desmenuzado", porque: "Liviano y amable para cerrar el día.", ingredientes: ["½ taza de arroz", "Zanahoria", "Pollo desmenuzado"], pasos: "Cociná todo junto suave." },
      ]},
      { dia: "Miércoles", items: [
        { momento: "Desayuno", nombre: "Tostada blanca con queso untable suave", porque: "Fácil de digerir para arrancar tranquilo.", ingredientes: ["1 tostada de pan blanco", "Queso untable"], pasos: "Tostá y untá el queso." },
        { momento: "Almuerzo", nombre: "Pollo al horno suave con papa", porque: "Sin frituras ni condimentos fuertes, fácil de digerir.", ingredientes: ["1 pechuga", "Papa", "Aceite de oliva suave"], pasos: "Horneá el pollo y la papa sin condimentos picantes." },
        { momento: "Cena", nombre: "Caldo de verduras con fideos", porque: "Reconfortante y liviano para la noche.", ingredientes: ["Zanahoria, cebolla, apio", "Fideos finos", "Caldo suave"], pasos: "Cociná las verduras y sumá los fideos." },
      ]},
      { dia: "Jueves", items: [
        { momento: "Desayuno", nombre: "Compota de manzana y pera con avena", porque: "Frutas cocidas, muy suaves para el sistema digestivo.", ingredientes: ["1 manzana", "1 pera", "2 cdas de avena"], pasos: "Cociná las frutas y mezclá con la avena.", suple: "Curcuma + Jengibre" },
        { momento: "Almuerzo", nombre: "Arroz con calabaza y huevo", porque: "Suave, sin grasas pesadas.", ingredientes: ["½ taza de arroz", "Calabaza", "1 huevo"], pasos: "Cociná el arroz con la calabaza y sumá el huevo." },
        { momento: "Cena", nombre: "Sopa crema de zanahoria con jengibre", porque: "Antiinflamatoria y fácil de digerir.", ingredientes: ["Zanahoria, cebolla", "Jengibre", "Caldo suave"], pasos: "Cociná y procesá hasta cremosa." },
      ]},
      { dia: "Viernes", items: [
        { momento: "Desayuno", nombre: "Yogur con avena y banana", porque: "Probióticos y fibra suave.", ingredientes: ["1 yogur natural", "2 cdas de avena", "1 banana"], pasos: "Mezclá todo." },
        { momento: "Almuerzo", nombre: "Pescado al vapor con arroz y zucchini", porque: "Liviano y de fácil digestión.", ingredientes: ["1 filet de pescado", "½ taza de arroz", "Zucchini hervido"], pasos: "Cociná al vapor y serví con arroz.", suple: "Curcuma + Jengibre" },
        { momento: "Cena", nombre: "Puré de papa y calabaza con pollo", porque: "Suave y reconfortante para la noche.", ingredientes: ["Papa, calabaza", "Pollo desmenuzado"], pasos: "Hacé el puré y sumá el pollo." },
      ]},
    ],
  },
  {
    id: "pc11", objetivo: "digest", titulo: "Bienestar digestivo · Vegetariano sin gluten",
    desc: "Plan de 5 días sin carne ni gluten, con comidas suaves, fibra amable y especias digestivas.",
    cumple: ["vegetariano", "singluten", "sinlacteos"], suple: "Liver Detox", dias: [
      { dia: "Lunes", items: [
        { momento: "Desayuno", nombre: "Avena sin gluten con manzana cocida", porque: "Suave y con fibra amable para el sistema digestivo.", ingredientes: ["½ taza de avena sin gluten", "1 manzana", "Canela", "Bebida vegetal"], pasos: "Cociná la avena con la manzana rallada.", suple: "Liver Detox" },
        { momento: "Almuerzo", nombre: "Arroz con calabaza y huevo", porque: "Liviano y de fácil digestión.", ingredientes: ["½ taza de arroz", "Calabaza", "1 huevo"], pasos: "Cociná el arroz con la calabaza y sumá el huevo." },
        { momento: "Cena", nombre: "Sopa de calabaza con jengibre", porque: "Antiinflamatoria y suave para la noche.", ingredientes: ["Calabaza, zanahoria", "Jengibre", "Caldo suave"], pasos: "Cociná y procesá." },
      ]},
      { dia: "Martes", items: [
        { momento: "Desayuno", nombre: "Yogur sin lactosa con banana", porque: "Probióticos y fruta suave.", ingredientes: ["Yogur sin lactosa", "1 banana"], pasos: "Mezclá el yogur con la banana." },
        { momento: "Almuerzo", nombre: "Tortilla suave de zucchini", porque: "Sin frituras, fácil de digerir.", ingredientes: ["2 huevos", "Zucchini", "Aceite de oliva suave"], pasos: "Hacé la tortilla a fuego bajo.", suple: "Liver Detox" },
        { momento: "Cena", nombre: "Arroz con zanahoria y calabaza", porque: "Liviano para cerrar el día.", ingredientes: ["½ taza de arroz", "Zanahoria, calabaza"], pasos: "Cociná todo junto suave." },
      ]},
      { dia: "Miércoles", items: [
        { momento: "Desayuno", nombre: "Compota de pera con avena sin gluten", porque: "Fruta cocida muy suave para el estómago.", ingredientes: ["1 pera", "2 cdas de avena sin gluten"], pasos: "Cociná la pera y mezclá con la avena." },
        { momento: "Almuerzo", nombre: "Quinoa con calabaza y zucchini", porque: "Suave y nutritiva, sin condimentos fuertes.", ingredientes: ["½ taza de quinoa", "Calabaza, zucchini"], pasos: "Cociná la quinoa con los vegetales." },
        { momento: "Cena", nombre: "Caldo de verduras suave", porque: "Reconfortante y liviano.", ingredientes: ["Zanahoria, cebolla, apio", "Caldo suave"], pasos: "Cociná las verduras en el caldo." },
      ]},
      { dia: "Jueves", items: [
        { momento: "Desayuno", nombre: "Yogur sin lactosa con avena y manzana", porque: "Probióticos y fibra amable.", ingredientes: ["Yogur sin lactosa", "2 cdas de avena sin gluten", "Manzana rallada"], pasos: "Mezclá todo.", suple: "Liver Detox" },
        { momento: "Almuerzo", nombre: "Arroz con huevo y zanahoria", porque: "Liviano y de fácil digestión.", ingredientes: ["½ taza de arroz", "1 huevo", "Zanahoria"], pasos: "Cociná el arroz con la zanahoria y sumá el huevo." },
        { momento: "Cena", nombre: "Sopa crema de calabaza", porque: "Suave y reconfortante.", ingredientes: ["Calabaza, cebolla", "Caldo suave", "Jengibre"], pasos: "Cociná y procesá." },
      ]},
      { dia: "Viernes", items: [
        { momento: "Desayuno", nombre: "Avena sin gluten con pera cocida", porque: "Suave y con fibra amable.", ingredientes: ["½ taza de avena sin gluten", "1 pera", "Canela"], pasos: "Cociná la avena con la pera." },
        { momento: "Almuerzo", nombre: "Tortilla de calabaza con ensalada cocida", porque: "Vegetales cocidos, más fáciles de digerir que crudos.", ingredientes: ["2 huevos", "Calabaza", "Zanahoria hervida"], pasos: "Hacé la tortilla y serví con los vegetales cocidos.", suple: "Liver Detox" },
        { momento: "Cena", nombre: "Puré de calabaza y zanahoria", porque: "Suave y liviano para la noche.", ingredientes: ["Calabaza, zanahoria", "Aceite de oliva suave"], pasos: "Hacé el puré con los vegetales hervidos." },
      ]},
    ],
  },
  {
    id: "pc12", objetivo: "digest", titulo: "Bienestar digestivo · Vegano sin gluten",
    desc: "Plan de 5 días 100% vegetal y sin gluten, con comidas suaves, especias digestivas y fibra amable.",
    cumple: ["vegano", "vegetariano", "singluten", "sinlacteos"], suple: "Curcuma + Jengibre", dias: [
      { dia: "Lunes", items: [
        { momento: "Desayuno", nombre: "Avena sin gluten con manzana y canela", porque: "Suave y con fibra amable para el sistema digestivo.", ingredientes: ["½ taza de avena sin gluten", "1 manzana", "Canela", "Bebida vegetal"], pasos: "Cociná la avena con la manzana rallada.", suple: "Curcuma + Jengibre" },
        { momento: "Almuerzo", nombre: "Arroz con calabaza y zucchini", porque: "Liviano y de fácil digestión.", ingredientes: ["½ taza de arroz", "Calabaza, zucchini"], pasos: "Cociná el arroz con los vegetales." },
        { momento: "Cena", nombre: "Sopa de calabaza con jengibre", porque: "Antiinflamatoria y suave para la noche.", ingredientes: ["Calabaza, zanahoria, cebolla", "Jengibre", "Caldo de verduras"], pasos: "Cociná y procesá." },
      ]},
      { dia: "Martes", items: [
        { momento: "Desayuno", nombre: "Compota de manzana con avena sin gluten", porque: "Fruta cocida muy suave.", ingredientes: ["1 manzana", "2 cdas de avena sin gluten", "Canela"], pasos: "Cociná la manzana y mezclá con la avena." },
        { momento: "Almuerzo", nombre: "Quinoa con zanahoria y calabaza", porque: "Suave y nutritiva.", ingredientes: ["½ taza de quinoa", "Zanahoria, calabaza"], pasos: "Cociná la quinoa con los vegetales.", suple: "Curcuma + Jengibre" },
        { momento: "Cena", nombre: "Crema de zanahoria con jengibre", porque: "Antiinflamatoria y de fácil digestión.", ingredientes: ["Zanahoria, cebolla", "Jengibre", "Caldo de verduras"], pasos: "Cociná y procesá." },
      ]},
      { dia: "Miércoles", items: [
        { momento: "Desayuno", nombre: "Porridge de quinoa con pera cocida", porque: "Suave y reconfortante para arrancar.", ingredientes: ["½ taza de quinoa", "Bebida vegetal", "1 pera cocida"], pasos: "Cociná la quinoa en bebida vegetal y sumá la pera." },
        { momento: "Almuerzo", nombre: "Arroz con calabaza y tofu suave", porque: "Proteína vegetal de fácil digestión.", ingredientes: ["½ taza de arroz", "Calabaza", "100 g de tofu"], pasos: "Cociná suave todo junto." },
        { momento: "Cena", nombre: "Caldo de verduras con fideos de arroz", porque: "Liviano para la noche.", ingredientes: ["Zanahoria, cebolla, apio", "Fideos de arroz", "Caldo"], pasos: "Cociná las verduras y sumá los fideos." },
      ]},
      { dia: "Jueves", items: [
        { momento: "Desayuno", nombre: "Avena sin gluten con banana", porque: "Suave y energética sin irritar.", ingredientes: ["½ taza de avena sin gluten", "1 banana", "Bebida vegetal"], pasos: "Cociná la avena y serví con banana.", suple: "Curcuma + Jengibre" },
        { momento: "Almuerzo", nombre: "Puré de calabaza con garbanzos suaves", porque: "Fibra amable y proteína vegetal.", ingredientes: ["Calabaza", "½ taza de garbanzos bien cocidos"], pasos: "Hacé el puré y sumá los garbanzos." },
        { momento: "Cena", nombre: "Sopa crema de zapallo", porque: "Reconfortante y suave.", ingredientes: ["Zapallo, cebolla", "Jengibre", "Caldo de verduras"], pasos: "Cociná y procesá." },
      ]},
      { dia: "Viernes", items: [
        { momento: "Desayuno", nombre: "Compota de pera y manzana con semillas", porque: "Frutas cocidas suaves con un toque de fibra.", ingredientes: ["1 pera", "1 manzana", "1 cdita de semillas"], pasos: "Cociná las frutas y serví con semillas." },
        { momento: "Almuerzo", nombre: "Quinoa con zucchini y zanahoria", porque: "Suave y nutritiva.", ingredientes: ["½ taza de quinoa", "Zucchini, zanahoria"], pasos: "Cociná la quinoa con los vegetales.", suple: "Curcuma + Jengibre" },
        { momento: "Cena", nombre: "Puré de calabaza y papa", porque: "Suave y liviano para la noche.", ingredientes: ["Calabaza, papa", "Aceite de oliva suave"], pasos: "Hacé el puré con los vegetales hervidos." },
      ]},
    ],
  },
  {
    id: "pc13", objetivo: "descanso", titulo: "Mejor descanso · Clásico",
    desc: "Plan de 5 días con cenas livianas y alimentos ricos en triptófano y magnesio que favorecen el sueño.",
    cumple: [], suple: "Ashwagandha", dias: [
      { dia: "Lunes", items: [
        { momento: "Desayuno", nombre: "Avena con banana y nueces", porque: "La banana y las nueces aportan triptófano y magnesio, base del buen descanso.", ingredientes: ["½ taza de avena", "1 banana", "Nueces"], pasos: "Cociná la avena y serví con banana y nueces." },
        { momento: "Almuerzo", nombre: "Pollo con arroz integral y vegetales", porque: "Comida completa al mediodía para llegar liviano a la cena.", ingredientes: ["1 pechuga", "¾ taza de arroz integral", "Vegetales"], pasos: "Cociná el pollo y serví con arroz y vegetales." },
        { momento: "Cena", nombre: "Pavo o pollo con puré de calabaza", porque: "Carnes blancas ricas en triptófano y cena de fácil digestión.", ingredientes: ["Pechuga de pavo o pollo", "Calabaza para puré"], pasos: "Cociná la carne y serví con puré. Cená al menos 3 horas antes de dormir.", suple: "Ashwagandha" },
      ]},
      { dia: "Martes", items: [
        { momento: "Desayuno", nombre: "Yogur con avena y frutos secos", porque: "Lácteo con triptófano y magnesio de los frutos secos.", ingredientes: ["1 yogur", "2 cdas de avena", "Frutos secos"], pasos: "Mezclá todo." },
        { momento: "Almuerzo", nombre: "Pescado con arroz y ensalada", porque: "Almuerzo completo y nutritivo.", ingredientes: ["1 filet de pescado", "¾ taza de arroz", "Ensalada"], pasos: "Cociná el pescado y serví con arroz." },
        { momento: "Cena", nombre: "Tortilla suave de papa con ensalada", porque: "El huevo aporta triptófano; cena liviana y temprana.", ingredientes: ["2 huevos", "1 papa", "Hojas verdes"], pasos: "Hacé la tortilla suave y serví con ensalada." },
      ]},
      { dia: "Miércoles", items: [
        { momento: "Desayuno", nombre: "Tostada integral con queso y banana", porque: "Triptófano del lácteo y la banana para el ánimo y el descanso.", ingredientes: ["1 tostada integral", "Queso", "½ banana"], pasos: "Armá la tostada con queso y banana." },
        { momento: "Almuerzo", nombre: "Pollo con pasta integral y vegetales", porque: "Comida principal del día, completa.", ingredientes: ["1 pechuga", "80 g de pasta integral", "Vegetales"], pasos: "Cociná y serví todo junto." },
        { momento: "Cena", nombre: "Sopa liviana con pollo y arroz", porque: "Reconfortante y fácil de digerir antes de dormir.", ingredientes: ["Zanahoria, cebolla, apio", "Pollo desmenuzado", "Poco arroz"], pasos: "Cociná suave y cená temprano.", suple: "Ashwagandha" },
      ]},
      { dia: "Jueves", items: [
        { momento: "Desayuno", nombre: "Avena con leche y frutos rojos", porque: "Lácteo con triptófano y antioxidantes.", ingredientes: ["½ taza de avena", "Leche", "Frutos rojos"], pasos: "Cociná la avena con leche y serví con frutos rojos." },
        { momento: "Almuerzo", nombre: "Carne magra con arroz y vegetales", porque: "Almuerzo completo para llegar liviano a la noche.", ingredientes: ["150 g de carne magra", "¾ taza de arroz", "Vegetales"], pasos: "Cociná y serví todo junto." },
        { momento: "Cena", nombre: "Merluza al horno con puré de calabaza", porque: "Pescado suave y cena de fácil digestión.", ingredientes: ["1 filet de merluza", "Calabaza"], pasos: "Horneá el pescado y serví con puré. Evitá comidas pesadas de noche." },
      ]},
      { dia: "Viernes", items: [
        { momento: "Desayuno", nombre: "Yogur con banana y avena", porque: "Triptófano y fibra para arrancar tranquilo.", ingredientes: ["1 yogur", "1 banana", "2 cdas de avena"], pasos: "Mezclá todo." },
        { momento: "Almuerzo", nombre: "Pollo al horno con papa y ensalada", porque: "Comida principal completa.", ingredientes: ["1 pechuga o muslo", "Papa", "Ensalada"], pasos: "Horneá el pollo y la papa." },
        { momento: "Cena", nombre: "Revuelto suave de huevo y zucchini", porque: "Liviano y con triptófano del huevo.", ingredientes: ["2 huevos", "Zucchini, cebolla"], pasos: "Salteá suave los vegetales y sumá los huevos. Cená temprano.", suple: "Blend Relax" },
      ]},
    ],
  },
  {
    id: "pc14", objetivo: "descanso", titulo: "Mejor descanso · Vegetariano sin gluten",
    desc: "Plan de 5 días sin carne ni gluten, con cenas livianas y alimentos ricos en triptófano y magnesio.",
    cumple: ["vegetariano", "singluten", "sinlacteos"], suple: "Resveratrol", dias: [
      { dia: "Lunes", items: [
        { momento: "Desayuno", nombre: "Avena sin gluten con banana y nueces", porque: "Triptófano y magnesio para el buen descanso.", ingredientes: ["½ taza de avena sin gluten", "1 banana", "Nueces", "Bebida vegetal"], pasos: "Cociná la avena y serví con banana y nueces." },
        { momento: "Almuerzo", nombre: "Bowl de quinoa, huevo y vegetales", porque: "Comida completa al mediodía.", ingredientes: ["1 taza de quinoa", "2 huevos", "Vegetales"], pasos: "Armá el bowl con todo." },
        { momento: "Cena", nombre: "Tortilla suave de papa", porque: "El huevo aporta triptófano; cena liviana y temprana.", ingredientes: ["2 huevos", "1 papa"], pasos: "Hacé la tortilla suave. Cená temprano.", suple: "Resveratrol" },
      ]},
      { dia: "Martes", items: [
        { momento: "Desayuno", nombre: "Yogur sin lactosa con avena y frutos secos", porque: "Triptófano y magnesio.", ingredientes: ["Yogur sin lactosa", "2 cdas de avena sin gluten", "Frutos secos"], pasos: "Mezclá todo." },
        { momento: "Almuerzo", nombre: "Ensalada de garbanzos y huevo", porque: "Proteína vegetal y del huevo.", ingredientes: ["½ taza de garbanzos", "2 huevos", "Vegetales"], pasos: "Mezclá todo y aliñá ligero." },
        { momento: "Cena", nombre: "Puré de calabaza con huevo", porque: "Suave y con triptófano para la noche.", ingredientes: ["Calabaza", "1 huevo"], pasos: "Hacé el puré y sumá el huevo. Cená temprano.", suple: "Blend Relax" },
      ]},
      { dia: "Miércoles", items: [
        { momento: "Desayuno", nombre: "Tostada sin gluten con banana y semillas", porque: "Triptófano de la banana y magnesio de las semillas.", ingredientes: ["1 tostada sin gluten", "½ banana", "Semillas"], pasos: "Armá la tostada con banana y semillas." },
        { momento: "Almuerzo", nombre: "Quinoa con vegetales y huevo", porque: "Comida completa.", ingredientes: ["1 taza de quinoa", "2 huevos", "Vegetales"], pasos: "Cociná y serví todo junto." },
        { momento: "Cena", nombre: "Sopa liviana de calabaza", porque: "Reconfortante y de fácil digestión.", ingredientes: ["Calabaza, zanahoria", "Caldo suave"], pasos: "Cociná y procesá. Cená temprano.", suple: "Resveratrol" },
      ]},
      { dia: "Jueves", items: [
        { momento: "Desayuno", nombre: "Avena sin gluten con frutos rojos", porque: "Antioxidantes y fibra suave.", ingredientes: ["½ taza de avena sin gluten", "Frutos rojos", "Bebida vegetal"], pasos: "Cociná la avena y serví con frutos rojos." },
        { momento: "Almuerzo", nombre: "Tortilla de papa con ensalada", porque: "Proteína del huevo con vegetales.", ingredientes: ["3 huevos", "1 papa", "Hojas verdes"], pasos: "Hacé la tortilla y serví con ensalada." },
        { momento: "Cena", nombre: "Revuelto suave de zucchini y huevo", porque: "Liviano y con triptófano.", ingredientes: ["2 huevos", "Zucchini"], pasos: "Salteá suave y sumá los huevos. Cená temprano." },
      ]},
      { dia: "Viernes", items: [
        { momento: "Desayuno", nombre: "Yogur sin lactosa con banana y avena", porque: "Triptófano y fibra.", ingredientes: ["Yogur sin lactosa", "1 banana", "2 cdas de avena sin gluten"], pasos: "Mezclá todo." },
        { momento: "Almuerzo", nombre: "Bowl de quinoa, garbanzos y vegetales", porque: "Comida completa vegetal.", ingredientes: ["1 taza de quinoa", "½ taza de garbanzos", "Vegetales"], pasos: "Armá el bowl con todo." },
        { momento: "Cena", nombre: "Puré de calabaza y zanahoria", porque: "Suave para cerrar el día.", ingredientes: ["Calabaza, zanahoria"], pasos: "Hacé el puré con los vegetales hervidos. Cená temprano.", suple: "Resveratrol" },
      ]},
    ],
  },
  {
    id: "pc15", objetivo: "descanso", titulo: "Mejor descanso · Vegano sin gluten",
    desc: "Plan de 5 días 100% vegetal y sin gluten, con cenas livianas y alimentos con triptófano y magnesio.",
    cumple: ["vegano", "vegetariano", "singluten", "sinlacteos"], suple: "Ashwagandha", dias: [
      { dia: "Lunes", items: [
        { momento: "Desayuno", nombre: "Avena sin gluten con banana y nueces", porque: "Triptófano y magnesio de origen vegetal para el descanso.", ingredientes: ["½ taza de avena sin gluten", "1 banana", "Nueces", "Bebida vegetal"], pasos: "Cociná la avena y serví con banana y nueces." },
        { momento: "Almuerzo", nombre: "Bowl de quinoa, garbanzos y vegetales", porque: "Comida completa al mediodía.", ingredientes: ["1 taza de quinoa", "½ taza de garbanzos", "Vegetales"], pasos: "Armá el bowl con todo." },
        { momento: "Cena", nombre: "Crema de calabaza con semillas", porque: "Suave, con magnesio de las semillas.", ingredientes: ["Calabaza, cebolla", "Semillas de calabaza", "Caldo de verduras"], pasos: "Cociná y procesá. Serví con semillas. Cená temprano.", suple: "Ashwagandha" },
      ]},
      { dia: "Martes", items: [
        { momento: "Desayuno", nombre: "Porridge de avena sin gluten con banana", porque: "Triptófano y energía suave.", ingredientes: ["½ taza de avena sin gluten", "1 banana", "Bebida vegetal"], pasos: "Cociná la avena con la bebida vegetal y la banana." },
        { momento: "Almuerzo", nombre: "Ensalada de lentejas y vegetales", porque: "Proteína vegetal y magnesio.", ingredientes: ["1 taza de lentejas", "Vegetales variados", "Aceite de oliva"], pasos: "Mezclá todo." },
        { momento: "Cena", nombre: "Puré de calabaza y zapallo", porque: "Suave y reconfortante para la noche.", ingredientes: ["Calabaza, zapallo", "Aceite de oliva"], pasos: "Hacé el puré. Cená temprano." },
      ]},
      { dia: "Miércoles", items: [
        { momento: "Desayuno", nombre: "Tostada sin gluten con palta y banana", porque: "Grasas buenas y triptófano.", ingredientes: ["1 tostada sin gluten", "¼ palta", "½ banana"], pasos: "Armá la tostada con palta y banana." },
        { momento: "Almuerzo", nombre: "Quinoa con tofu y vegetales", porque: "Proteína vegetal completa.", ingredientes: ["1 taza de quinoa", "100 g de tofu", "Vegetales"], pasos: "Cociná y serví todo junto." },
        { momento: "Cena", nombre: "Sopa liviana de verduras", porque: "De fácil digestión antes de dormir.", ingredientes: ["Zanahoria, cebolla, apio, calabaza", "Caldo de verduras"], pasos: "Cociná suave. Cená temprano.", suple: "Ashwagandha" },
      ]},
      { dia: "Jueves", items: [
        { momento: "Desayuno", nombre: "Avena sin gluten con frutos secos y semillas", porque: "Magnesio y grasas buenas para el descanso.", ingredientes: ["½ taza de avena sin gluten", "Frutos secos, semillas", "Bebida vegetal"], pasos: "Cociná la avena y serví con frutos secos y semillas." },
        { momento: "Almuerzo", nombre: "Bowl de garbanzos, arroz y vegetales", porque: "Comida completa vegetal.", ingredientes: ["½ taza de arroz", "½ taza de garbanzos", "Vegetales"], pasos: "Armá el bowl con todo." },
        { momento: "Cena", nombre: "Crema de zanahoria y calabaza", porque: "Suave y reconfortante.", ingredientes: ["Zanahoria, calabaza", "Caldo de verduras"], pasos: "Cociná y procesá. Cená temprano.", suple: "Blend Relax" },
      ]},
      { dia: "Viernes", items: [
        { momento: "Desayuno", nombre: "Smoothie de banana, avena sin gluten y semillas", porque: "Triptófano y magnesio en un vaso.", ingredientes: ["1 banana", "2 cdas de avena sin gluten", "Semillas", "Bebida vegetal"], pasos: "Licuá todo." },
        { momento: "Almuerzo", nombre: "Ensalada tibia de quinoa y lentejas", porque: "Proteína vegetal y magnesio.", ingredientes: ["½ taza de quinoa", "½ taza de lentejas", "Vegetales"], pasos: "Mezclá todo tibio." },
        { momento: "Cena", nombre: "Puré de calabaza con semillas de zapallo", porque: "Suave y con magnesio para la noche.", ingredientes: ["Calabaza", "Semillas de zapallo"], pasos: "Hacé el puré y serví con semillas. Cená temprano.", suple: "Ashwagandha" },
      ]},
    ],
  },

];

/* ===================== DATOS MOVIMIENTO ===================== */
const OBJ_EJER = [
  { id: "peso", label: "Bajar de peso" },
  { id: "musc", label: "Ganar musculo" },
  { id: "fuerza", label: "Fuerza" },
  { id: "movilidad", label: "Movilidad y bienestar" },
];
const NIVELES = [
  { id: "ppal", label: "Principiante" },
  { id: "inter", label: "Intermedio" },
  { id: "avanz", label: "Avanzado" },
];
const LUGARES = [
  { id: "casa", label: "En casa", icon: MapPin },
  { id: "gym", label: "Gimnasio", icon: Dumbbell },
];
const PLANES_EJER = [
  {
    id: "pe1", objetivo: "peso", nivel: "ppal", lugar: "casa", titulo: "Quema de grasa · Principiante (En casa)",
    desc: "3 días por semana con día de descanso entre medio. Circuitos de cuerpo completo a ritmo moderado. Descansá 45-60s entre ejercicios.", suple: "Blend Metabolismo", dias: [
      { dia: "Día 1 · Full body", items: ["Sentadillas 3x12", "Flexiones con rodillas apoyadas 3x10", "Puente de glúteos 3x15", "Plancha 3x20s", "Caminata rápida 20 min"] },
      { dia: "Día 2 · Cardio + core", items: ["Marcha elevando rodillas 3x40s", "Estocadas alternadas 3x10 por pierna", "Mountain climbers suaves 3x20s", "Plancha 3x25s", "Abdominales 3x12"] },
      { dia: "Día 3 · Full body", items: ["Sentadillas 3x12", "Puente de glúteos 3x15", "Flexiones con rodillas 3x10", "Elevación de talones 3x20", "Caminata rápida 25 min"] },
    ],
  },
  {
    id: "pe2", objetivo: "peso", nivel: "ppal", lugar: "gym", titulo: "Quema de grasa · Principiante (Gimnasio)",
    desc: "3 días por semana. Combina máquinas guiadas (seguras para empezar) con cardio. Descansá 60s entre series.", suple: "Berberina", dias: [
      { dia: "Día 1", items: ["Cinta caminando en pendiente 15 min", "Prensa de piernas 3x15", "Jalón al pecho 3x12", "Press de pecho en máquina 3x12", "Abdominales 3x15"] },
      { dia: "Día 2", items: ["Bicicleta fija 15 min", "Sentadilla en multipower 3x12", "Remo en máquina 3x12", "Elevaciones de talón 3x15", "Plancha 3x30s"] },
      { dia: "Día 3", items: ["Elíptico 20 min", "Prensa 3x15", "Jalón al pecho 3x12", "Press hombro en máquina 3x12", "Abdominales 3x15"] },
    ],
  },
  {
    id: "pe3", objetivo: "peso", nivel: "inter", lugar: "casa", titulo: "Quema de grasa · Intermedio (En casa)",
    desc: "4 días por semana. Circuitos más intensos tipo HIIT con poco descanso (20-30s) para acelerar el metabolismo.", suple: "Blend Metabolismo", dias: [
      { dia: "Día 1 · HIIT", items: ["Burpees 4x10", "Sentadillas con salto 4x12", "Mountain climbers 4x30s", "Plancha 4x40s"] },
      { dia: "Día 2 · Tren inferior", items: ["Estocadas 4x12 por pierna", "Sentadilla búlgara 3x10 por pierna", "Puente de glúteos 4x20", "Sentadilla isométrica 3x40s"] },
      { dia: "Día 3 · HIIT", items: ["Saltos de tijera 4x40s", "Flexiones 4x12", "Escaladores 4x30s", "Burpees 4x10"] },
      { dia: "Día 4 · Cardio + core", items: ["Trote o caminata rápida 30 min", "Plancha 4x45s", "Abdominales bicicleta 4x20", "Elevación de piernas 4x12"] },
    ],
  },
  {
    id: "pe4", objetivo: "peso", nivel: "inter", lugar: "gym", titulo: "Quema de grasa · Intermedio (Gimnasio)",
    desc: "4 días por semana combinando pesas con cardio. Descansá 45-60s. Mantené la intensidad alta.", suple: "Berberina", dias: [
      { dia: "Día 1 · Tren inferior", items: ["Sentadilla con barra 4x12", "Prensa 4x15", "Peso muerto rumano con mancuernas 3x12", "Cinta HIIT 15 min"] },
      { dia: "Día 2 · Tren superior", items: ["Press de pecho 4x12", "Remo con barra 4x12", "Press hombro 3x12", "Bicicleta 15 min"] },
      { dia: "Día 3 · Full body + HIIT", items: ["Sentadilla 3x12", "Jalón al pecho 3x12", "Press de pecho 3x12", "HIIT en cinta 20 min"] },
      { dia: "Día 4 · Cardio + core", items: ["Elíptico 25 min", "Abdominales en máquina 4x20", "Plancha 4x45s", "Mountain climbers 4x30s"] },
    ],
  },
  {
    id: "pe5", objetivo: "peso", nivel: "avanz", lugar: "casa", titulo: "Quema de grasa · Avanzado (En casa)",
    desc: "5 días por semana, alta intensidad. Circuitos exigentes con descanso mínimo (15-20s). Requiere buena base física.", suple: "Blend Metabolismo", dias: [
      { dia: "Día 1 · HIIT total", items: ["Burpees 5x12", "Sentadilla con salto 5x15", "Escaladores 5x40s", "Flexiones explosivas 4x10", "Plancha 5x50s"] },
      { dia: "Día 2 · Tren inferior", items: ["Sentadilla búlgara 4x12 por pierna", "Estocadas con salto 4x12", "Puente a una pierna 4x12", "Sentadilla isométrica 4x50s"] },
      { dia: "Día 3 · HIIT total", items: ["Saltos de tijera 5x45s", "Burpees 5x12", "Mountain climbers 5x40s", "Flexiones 5x15"] },
      { dia: "Día 4 · Tren superior + core", items: ["Flexiones diamante 4x12", "Fondos en silla 4x15", "Plancha lateral 4x40s por lado", "Abdominales bicicleta 5x25"] },
      { dia: "Día 5 · Cardio intenso", items: ["Trote con sprints 30 min", "Burpees 4x12", "Sentadilla con salto 4x15", "Plancha 4x60s"] },
    ],
  },
  {
    id: "pe6", objetivo: "peso", nivel: "avanz", lugar: "gym", titulo: "Quema de grasa · Avanzado (Gimnasio)",
    desc: "5 días por semana, alta intensidad combinando fuerza y cardio metabólico. Descanso corto (30-45s).", suple: "Berberina", dias: [
      { dia: "Día 1 · Tren inferior", items: ["Sentadilla con barra 4x12", "Peso muerto rumano 4x10", "Prensa 4x15", "Zancadas con mancuernas 3x12", "HIIT cinta 15 min"] },
      { dia: "Día 2 · Tren superior", items: ["Press de pecho 4x12", "Remo con barra 4x12", "Press militar 4x10", "Dominadas asistidas 3x10", "Bici HIIT 15 min"] },
      { dia: "Día 3 · Full body metabólico", items: ["Thrusters con mancuernas 4x12", "Swing con pesa rusa 4x15", "Remo 4x12", "Burpees 4x12"] },
      { dia: "Día 4 · Tren inferior + core", items: ["Sentadilla 4x12", "Hip thrust 4x15", "Prensa 4x15", "Abdominales en máquina 4x20", "Plancha 4x50s"] },
      { dia: "Día 5 · Cardio + accesorios", items: ["Elíptico o remo ergómetro 25 min", "Press de pecho 3x12", "Jalón al pecho 3x12", "HIIT 15 min"] },
    ],
  },
  {
    id: "pe7", objetivo: "musc", nivel: "ppal", lugar: "casa", titulo: "Hipertrofia · Principiante (En casa)",
    desc: "3 días por semana con descanso entre medio. Full body con peso corporal, 3 series de 10-15 reps, descanso 60-90s. Trabajá cada movimiento con control.", suple: "Maca Negra", dias: [
      { dia: "Día 1 · Full body", items: ["Sentadillas 3x15", "Flexiones (rodillas si hace falta) 3x10", "Puente de glúteos 3x15", "Estocadas 3x10 por pierna", "Plancha 3x30s"] },
      { dia: "Día 2 · Full body", items: ["Sentadilla isométrica 3x30s", "Flexiones 3x10", "Puente a una pierna 3x10 por lado", "Superman (lumbares) 3x12", "Plancha lateral 3x20s por lado"] },
      { dia: "Día 3 · Full body", items: ["Sentadillas 3x15", "Flexiones 3x12", "Estocadas 3x10 por pierna", "Elevación de talones 3x20", "Plancha 3x35s"] },
    ],
  },
  {
    id: "pe8", objetivo: "musc", nivel: "ppal", lugar: "gym", titulo: "Hipertrofia · Principiante (Gimnasio)",
    desc: "3 días por semana, full body. Patrones básicos con máquinas y mancuernas, 3 series de 8-12 reps, descanso 60-90s. Priorizá la técnica.", suple: "Maca Negra", dias: [
      { dia: "Día 1", items: ["Sentadilla con mancuernas 3x12", "Press de pecho en máquina 3x12", "Remo en máquina 3x12", "Press hombro con mancuernas 3x12", "Plancha 3x30s"] },
      { dia: "Día 2", items: ["Prensa de piernas 3x12", "Jalón al pecho 3x12", "Press de pecho 3x12", "Curl de bíceps 3x12", "Abdominales 3x15"] },
      { dia: "Día 3", items: ["Peso muerto rumano con mancuernas 3x12", "Remo en máquina 3x12", "Press hombro 3x12", "Extensión de tríceps 3x12", "Plancha 3x35s"] },
    ],
  },
  {
    id: "pe9", objetivo: "musc", nivel: "inter", lugar: "casa", titulo: "Hipertrofia · Intermedio (En casa)",
    desc: "4 días por semana, torso/pierna. Peso corporal con variantes más difíciles, 3-4 series cerca del fallo, descanso 60-90s.", suple: "Omega 3", dias: [
      { dia: "Día 1 · Torso", items: ["Flexiones 4x12", "Flexiones diamante 3x10", "Fondos en silla 4x12", "Pike push-ups (hombro) 3x10", "Plancha 4x40s"] },
      { dia: "Día 2 · Pierna", items: ["Sentadilla búlgara 4x12 por pierna", "Estocadas 4x12 por pierna", "Puente a una pierna 4x12", "Sentadilla isométrica 3x45s"] },
      { dia: "Día 3 · Torso", items: ["Flexiones inclinadas 4x12", "Pike push-ups 4x10", "Fondos 4x12", "Superman 3x15", "Plancha lateral 3x30s por lado"] },
      { dia: "Día 4 · Pierna", items: ["Sentadilla con salto 4x12", "Estocadas caminando 4x12 por pierna", "Puente de glúteos 4x20", "Elevación de talones 4x20"] },
    ],
  },
  {
    id: "pe10", objetivo: "musc", nivel: "inter", lugar: "gym", titulo: "Hipertrofia · Intermedio (Gimnasio)",
    desc: "4 días por semana, torso/pierna con frecuencia 2. Multiarticulares + accesorios, 3-4 series de 8-12 reps, descanso 60-90s.", suple: "Omega 3", dias: [
      { dia: "Día 1 · Torso (empuje)", items: ["Press de banca 4x10", "Press inclinado con mancuernas 3x12", "Press militar 3x10", "Aperturas 3x12", "Extensión de tríceps 3x12"] },
      { dia: "Día 2 · Pierna", items: ["Sentadilla con barra 4x10", "Prensa 4x12", "Peso muerto rumano 3x10", "Curl femoral 3x12", "Gemelos 4x15"] },
      { dia: "Día 3 · Torso (tracción)", items: ["Dominadas o jalón al pecho 4x10", "Remo con barra 4x10", "Remo en polea 3x12", "Curl de bíceps 4x12", "Face pull 3x15"] },
      { dia: "Día 4 · Pierna + hombro", items: ["Sentadilla frontal 4x10", "Hip thrust 4x12", "Zancadas con mancuernas 3x12", "Elevaciones laterales 4x15", "Abdominales 4x20"] },
    ],
  },
  {
    id: "pe11", objetivo: "musc", nivel: "avanz", lugar: "casa", titulo: "Hipertrofia · Avanzado (En casa)",
    desc: "5 días por semana. Calistenia avanzada con variantes unilaterales y tempo lento. 4 series cerca del fallo, descanso 90s.", suple: "Maca Negra", dias: [
      { dia: "Día 1 · Pecho/tríceps", items: ["Flexiones archer 4x10 por lado", "Flexiones diamante 4x12", "Fondos profundos 4x12", "Flexiones declinadas 4x12", "Plancha 4x60s"] },
      { dia: "Día 2 · Pierna", items: ["Sentadilla pistol asistida 4x8 por pierna", "Sentadilla búlgara 4x12", "Salto al cajón 4x10", "Puente a una pierna 4x15"] },
      { dia: "Día 3 · Espalda/bíceps", items: ["Dominadas 4x8", "Dominadas supinas 4x8", "Remo invertido 4x12", "Superman 4x15"] },
      { dia: "Día 4 · Hombro/core", items: ["Pike push-ups elevados 4x10", "Pino contra pared (isométrico) 4x20s", "Plancha con toque de hombro 4x20", "Plancha lateral 4x40s por lado"] },
      { dia: "Día 5 · Pierna", items: ["Sentadilla con salto 4x15", "Estocadas con salto 4x12", "Sentadilla isométrica 4x60s", "Elevación de talones a una pierna 4x15"] },
    ],
  },
  {
    id: "pe12", objetivo: "musc", nivel: "avanz", lugar: "gym", titulo: "Hipertrofia · Avanzado (Gimnasio)",
    desc: "5 días por semana tipo Weider (un grupo por día). Alto volumen, 4 series de 8-12 reps, descanso 60-90s, cerca del fallo.", suple: "Omega 3", dias: [
      { dia: "Día 1 · Pecho", items: ["Press de banca 4x8", "Press inclinado 4x10", "Aperturas en polea 3x12", "Fondos en paralelas 3x12", "Press declinado 3x10"] },
      { dia: "Día 2 · Espalda", items: ["Dominadas 4x8", "Remo con barra 4x10", "Jalón al pecho 4x12", "Remo en polea 3x12", "Peso muerto 3x8"] },
      { dia: "Día 3 · Pierna", items: ["Sentadilla con barra 4x8", "Prensa 4x12", "Peso muerto rumano 4x10", "Curl femoral 4x12", "Gemelos 4x20"] },
      { dia: "Día 4 · Hombro", items: ["Press militar 4x8", "Elevaciones laterales 4x15", "Pájaros 4x15", "Press Arnold 3x12", "Encogimientos 4x15"] },
      { dia: "Día 5 · Brazos", items: ["Curl con barra 4x10", "Curl martillo 3x12", "Press francés 4x10", "Extensión en polea 3x12", "Curl concentrado 3x12"] },
    ],
  },
  {
    id: "pe13", objetivo: "fuerza", nivel: "ppal", lugar: "casa", titulo: "Fuerza · Principiante (En casa)",
    desc: "3 días por semana. Foco en dominar los patrones básicos con peso corporal antes de cargar. Pocas reps, buena técnica, descanso 2 min.", suple: "Maca Negra", dias: [
      { dia: "Día 1", items: ["Sentadillas lentas 5x8", "Flexiones 5x6", "Puente de glúteos 5x10", "Plancha 4x40s"] },
      { dia: "Día 2", items: ["Estocadas 5x8 por pierna", "Flexiones inclinadas 5x8", "Superman 4x12", "Plancha lateral 4x25s por lado"] },
      { dia: "Día 3", items: ["Sentadillas lentas 5x8", "Flexiones 5x6", "Puente a una pierna 4x8 por lado", "Plancha 4x45s"] },
    ],
  },
  {
    id: "pe14", objetivo: "fuerza", nivel: "ppal", lugar: "gym", titulo: "Fuerza · Principiante (Gimnasio)",
    desc: "3 días por semana, full body con los básicos. 5 series de 5 reps con peso moderado, técnica primero. Descanso 2-3 min.", suple: "Maca Triple", dias: [
      { dia: "Día 1", items: ["Sentadilla con barra 5x5", "Press de banca 5x5", "Remo con barra 5x5", "Plancha 3x40s"] },
      { dia: "Día 2", items: ["Peso muerto 5x5", "Press militar 5x5", "Jalón al pecho 5x8", "Abdominales 3x15"] },
      { dia: "Día 3", items: ["Sentadilla con barra 5x5", "Press de banca 5x5", "Remo con barra 5x5", "Plancha 3x45s"] },
    ],
  },
  {
    id: "pe15", objetivo: "fuerza", nivel: "inter", lugar: "casa", titulo: "Fuerza · Intermedio (En casa)",
    desc: "4 días por semana. Calistenia de fuerza con progresiones difíciles y trabajo unilateral. Bajas reps, descanso 2-3 min.", suple: "Maca Triple", dias: [
      { dia: "Día 1 · Empuje", items: ["Flexiones archer 5x6 por lado", "Pike push-ups 5x8", "Fondos 5x8", "Plancha 4x50s"] },
      { dia: "Día 2 · Pierna", items: ["Sentadilla pistol asistida 5x5 por pierna", "Sentadilla búlgara 5x8", "Salto al cajón 4x6", "Puente a una pierna 4x10"] },
      { dia: "Día 3 · Tracción", items: ["Dominadas 5x5", "Dominadas supinas 4x6", "Remo invertido 5x8", "Superman 4x12"] },
      { dia: "Día 4 · Full body", items: ["Sentadilla con salto 4x8", "Flexiones explosivas 4x6", "Dominadas 4x5", "Plancha 4x60s"] },
    ],
  },
  {
    id: "pe16", objetivo: "fuerza", nivel: "inter", lugar: "gym", titulo: "Fuerza · Intermedio (Gimnasio)",
    desc: "4 días por semana enfocado en los grandes básicos. 4-5 series de 4-6 reps al 80-85%. Descanso 2-3 min.", suple: "Shilajit", dias: [
      { dia: "Día 1 · Sentadilla", items: ["Sentadilla con barra 5x5", "Prensa 4x8", "Peso muerto rumano 4x6", "Plancha 3x45s"] },
      { dia: "Día 2 · Press", items: ["Press de banca 5x5", "Press militar 4x6", "Fondos con peso 4x8", "Tríceps en polea 3x12"] },
      { dia: "Día 3 · Peso muerto", items: ["Peso muerto 5x5", "Remo con barra 4x6", "Dominadas 4x6", "Curl con barra 3x10"] },
      { dia: "Día 4 · Press + accesorios", items: ["Press de banca 5x5", "Sentadilla 4x6", "Jalón al pecho 4x8", "Face pull 3x15"] },
    ],
  },
  {
    id: "pe17", objetivo: "fuerza", nivel: "avanz", lugar: "casa", titulo: "Fuerza · Avanzado (En casa)",
    desc: "5 días por semana. Calistenia de fuerza máxima: progresiones de un brazo/una pierna y trabajo isométrico avanzado. Descanso 3 min.", suple: "Maca Triple", dias: [
      { dia: "Día 1 · Empuje", items: ["Flexiones a una mano (progresión) 5x4 por lado", "Pino flexión asistido 5x5", "Fondos con peso 5x6", "Plancha 4x60s"] },
      { dia: "Día 2 · Pierna", items: ["Sentadilla pistol 5x5 por pierna", "Salto profundo 4x5", "Sentadilla búlgara con peso 5x8", "Puente a una pierna con peso 4x10"] },
      { dia: "Día 3 · Tracción", items: ["Dominadas con peso 5x4", "Dominadas archer 4x5 por lado", "Remo invertido a una mano 4x6", "Superman con peso 4x12"] },
      { dia: "Día 4 · Isométricos", items: ["Pino contra pared 5x30s", "Plancha L-sit (progresión) 5x15s", "Sentadilla isométrica 5x60s", "Plancha frontal 5x70s"] },
      { dia: "Día 5 · Full body explosivo", items: ["Flexiones con palmada 5x6", "Sentadilla con salto 5x8", "Dominadas explosivas 5x5", "Burpees 4x10"] },
    ],
  },
  {
    id: "pe18", objetivo: "fuerza", nivel: "avanz", lugar: "gym", titulo: "Fuerza · Avanzado (Gimnasio)",
    desc: "5 días por semana, powerbuilding. Alterna días pesados (3-5 reps al 85-90%) con accesorios. Descanso 3 min en básicos.", suple: "Shilajit", dias: [
      { dia: "Día 1 · Sentadilla pesada", items: ["Sentadilla con barra 5x3", "Sentadilla pausa 3x5", "Prensa 4x8", "Plancha con peso 3x40s"] },
      { dia: "Día 2 · Press pesado", items: ["Press de banca 5x3", "Press cerrado 3x5", "Press militar 4x6", "Fondos con peso 4x8"] },
      { dia: "Día 3 · Peso muerto pesado", items: ["Peso muerto 5x3", "Peso muerto rumano 3x6", "Remo con barra 4x6", "Dominadas con peso 4x6"] },
      { dia: "Día 4 · Volumen sentadilla/press", items: ["Sentadilla frontal 4x6", "Press inclinado 4x8", "Zancadas con barra 3x10", "Elevaciones laterales 4x15"] },
      { dia: "Día 5 · Volumen tracción", items: ["Dominadas con peso 4x6", "Remo en polea 4x10", "Curl con barra 4x8", "Face pull 4x15", "Abdominales con peso 4x15"] },
    ],
  },
  {
    id: "pe19", objetivo: "movilidad", nivel: "ppal", lugar: "casa", titulo: "Movilidad y bienestar · Principiante (En casa)",
    desc: "Todos los días o cuando quieras. Movimientos suaves y estiramientos mantenidos 20-30s. Nunca fuerces hasta el dolor; respirá profundo.", suple: "Ashwagandha", dias: [
      { dia: "Día 1 · Columna y cadera", items: ["Gato-vaca 2x10", "Rotación de columna acostado 2x8 por lado", "Estiramiento de cuádriceps 2x30s por pierna", "Estiramiento de isquiotibiales sentado 2x30s"] },
      { dia: "Día 2 · Hombros y cuello", items: ["Círculos de hombros 2x10", "Estiramiento de cuello suave 2x20s por lado", "Apertura de pecho en pared 2x30s", "Gato-vaca 2x10"] },
      { dia: "Día 3 · Cuerpo completo", items: ["Estocada baja con apertura 2x30s por lado", "Postura del niño 2x40s", "Inclinación hacia adelante 2x30s", "Rotación de cadera 2x8 por lado"] },
    ],
  },
  {
    id: "pe20", objetivo: "movilidad", nivel: "ppal", lugar: "gym", titulo: "Movilidad y bienestar · Principiante (Gimnasio)",
    desc: "2-3 veces por semana. Aprovechá colchonetas, foam roller y bandas. Movimientos controlados, estiramientos de 20-30s.", suple: "Ashwagandha", dias: [
      { dia: "Día 1", items: ["Foam roller espalda y piernas 5 min", "Gato-vaca 2x10", "Estiramiento de isquios con banda 2x30s por pierna", "Movilidad de cadera en colchoneta 2x8 por lado"] },
      { dia: "Día 2", items: ["Foam roller 5 min", "Apertura de pecho con banda 2x30s", "Rotaciones de hombro con banda 2x12", "Estiramiento de cuádriceps 2x30s por pierna"] },
      { dia: "Día 3", items: ["Movilidad articular general 10 min", "Estocada baja con apoyo 2x30s por lado", "Estiramiento de espalda en máquina 2x30s", "Postura del niño 2x40s"] },
    ],
  },
  {
    id: "pe21", objetivo: "movilidad", nivel: "inter", lugar: "casa", titulo: "Movilidad y bienestar · Intermedio (En casa)",
    desc: "4 días por semana. Rutina de movilidad activa con más rango y control. Mantené los estiramientos 30-40s.", suple: "Curcuma + Jengibre", dias: [
      { dia: "Día 1 · Cadera", items: ["Sentadilla profunda sostenida 3x40s", "Estocada baja con rotación 3x30s por lado", "Movilidad 90/90 de cadera 3x8 por lado", "Puente de glúteos 3x15"] },
      { dia: "Día 2 · Columna y hombros", items: ["Gato-vaca con respiración 3x10", "Rotación torácica cuadrupedia 3x8 por lado", "Dislocaciones de hombro con palo 3x10", "Apertura de pecho 3x30s"] },
      { dia: "Día 3 · Cadena posterior", items: ["Inclinación adelante progresiva 3x40s", "Estiramiento de isquios activo 3x30s por pierna", "Postura del perro boca abajo 3x40s", "Superman 3x12"] },
      { dia: "Día 4 · Cuerpo completo", items: ["Saludo al sol (fluido) 4 rondas", "Sentadilla profunda sostenida 3x40s", "Rotación de columna 3x8 por lado", "Postura del niño 3x40s"] },
    ],
  },
  {
    id: "pe22", objetivo: "movilidad", nivel: "inter", lugar: "gym", titulo: "Movilidad y bienestar · Intermedio (Gimnasio)",
    desc: "4 días por semana. Combina movilidad con bandas, foam roller y trabajo de estabilidad. Estiramientos de 30-40s.", suple: "Curcuma + Jengibre", dias: [
      { dia: "Día 1 · Cadera/pierna", items: ["Foam roller piernas 5 min", "Sentadilla goblet profunda 3x10", "90/90 de cadera 3x8 por lado", "Estiramiento de isquios con banda 3x30s"] },
      { dia: "Día 2 · Torso/hombro", items: ["Movilidad torácica con foam roller 3x10", "Dislocaciones con banda 3x12", "Face pull 3x15", "Apertura de pecho 3x30s"] },
      { dia: "Día 3 · Estabilidad", items: ["Plancha 3x40s", "Bird-dog 3x10 por lado", "Pallof press con polea 3x12 por lado", "Puente de glúteos 3x15"] },
      { dia: "Día 4 · Cuerpo completo", items: ["Foam roller general 5 min", "Sentadilla profunda sostenida 3x40s", "Movilidad de tobillo 3x10 por lado", "Estiramiento global 10 min"] },
    ],
  },
  {
    id: "pe23", objetivo: "movilidad", nivel: "avanz", lugar: "casa", titulo: "Movilidad y bienestar · Avanzado (En casa)",
    desc: "5 días por semana. Movilidad avanzada con control de rango extremo, fuerza en flexibilidad y flujos. Estiramientos 40-60s.", suple: "Curcuma + Jengibre", dias: [
      { dia: "Día 1 · Cadera profunda", items: ["Sentadilla profunda con peso ligero 4x45s", "90/90 con elevación activa 4x8 por lado", "Split de cadera progresivo 4x40s por lado", "Puente completo (progresión) 4x20s"] },
      { dia: "Día 2 · Columna/hombros", items: ["Puente de hombros progresivo 4x20s", "Rotación torácica cargada 4x10 por lado", "Dislocaciones con palo (rango completo) 4x12", "Apertura de pecho profunda 4x40s"] },
      { dia: "Día 3 · Cadena posterior", items: ["Inclinación adelante con manos al piso 4x50s", "Isquios activos en pie 4x40s por pierna", "Perro boca abajo a plancha (flujo) 4x10", "Pica de pie (progresión) 4x30s"] },
      { dia: "Día 4 · Flujo completo", items: ["Saludo al sol completo 6 rondas", "Sentadilla cosaco 4x10 por lado", "Transición de cadera fluida 4x8", "Postura del niño extendida 4x50s"] },
      { dia: "Día 5 · Equilibrio y control", items: ["Pino contra pared con control 4x30s", "Sentadilla pistol con pausa 4x6 por pierna", "Equilibrio en una pierna con ojos cerrados 4x30s", "Estiramiento global profundo 10 min"] },
    ],
  },
  {
    id: "pe24", objetivo: "movilidad", nivel: "avanz", lugar: "gym", titulo: "Movilidad y bienestar · Avanzado (Gimnasio)",
    desc: "5 días por semana. Movilidad con cargas controladas, trabajo excéntrico en rango y estabilidad avanzada. Estiramientos 40-60s.", suple: "Curcuma + Jengibre", dias: [
      { dia: "Día 1 · Cadera cargada", items: ["Sentadilla goblet profunda con pausa 4x10", "Peso muerto rumano (rango completo, suave) 4x10", "90/90 con carga ligera 4x8 por lado", "Estiramiento de isquios con banda 4x40s"] },
      { dia: "Día 2 · Hombro/torso", items: ["Movilidad torácica con foam roller y peso 4x10", "Dislocaciones con banda lentas 4x12", "Face pull 4x15", "Apertura de pecho cargada 4x40s"] },
      { dia: "Día 3 · Estabilidad avanzada", items: ["Plancha con peso 4x40s", "Bird-dog con banda 4x10 por lado", "Pallof press 4x12 por lado", "Turkish get-up ligero 3x5 por lado"] },
      { dia: "Día 4 · Cadena posterior", items: ["Buenos días con barra ligera 4x10", "Inclinación adelante en banco 4x40s", "Hiperextensiones 4x12", "Movilidad de tobillo cargada 4x10 por lado"] },
      { dia: "Día 5 · Flujo y control", items: ["Sentadilla cosaco con peso 4x10 por lado", "Movilidad de cadera en jaula 4x8", "Equilibrio unilateral con mancuerna 4x30s", "Estiramiento global 10 min"] },
    ],
  },

];

/* ===================== DATOS SUPLEMENTOS ===================== */
// Catalogo de Vita Selecta con beneficios y etapas reales (segun la web).
// "preguntas" son los chequeos semanales adaptados a lo que cada producto promete.
// "duracionDias" = cuanto dura un frasco (para el aviso de recompra).
const SUPLEMENTOS = [
  {
    id: "maca_negra", nombre: "Maca Negra", emoji: "🌑", duracionDias: 30,
    beneficio: "Energia, vitalidad y libido",
    etapas: [
      { dia: 7, texto: "En la primera semana suele notarse mas energia y menos cansancio." },
      { dia: 14, texto: "Hacia las dos semanas mejora el animo y el rendimiento diario." },
      { dia: 30, texto: "Al mes: mayor vitalidad, libido y estabilidad fisica." },
    ],
    preguntaSemanal: "¿Como venis de energia esta semana?",
  },
  {
    id: "ashwagandha", nombre: "Ashwagandha", emoji: "🌿", duracionDias: 30,
    beneficio: "Calma, manejo del estres y descanso",
    etapas: [
      { dia: 7, texto: "La primera semana suele traer una sensacion de mayor calma." },
      { dia: 14, texto: "Hacia las dos semanas, mejor manejo del estres del dia." },
      { dia: 30, texto: "Al mes: descanso mas reparador y animo mas estable." },
    ],
    preguntaSemanal: "¿Como dormiste y manejaste el estres esta semana?",
  },
  {
    id: "omega3", nombre: "Omega 3", emoji: "🐟", duracionDias: 30,
    beneficio: "Recuperacion y bienestar general",
    etapas: [
      { dia: 14, texto: "Las primeras semanas apoya la recuperacion y la concentracion." },
      { dia: 30, texto: "Al mes: aporte sostenido para articulaciones y bienestar general." },
    ],
    preguntaSemanal: "¿Notas mejor recuperacion esta semana?",
  },
  {
    id: "curcuma", nombre: "Curcuma + Jengibre", emoji: "🟡", duracionDias: 30,
    beneficio: "Digestion y antiinflamatorio",
    etapas: [
      { dia: 7, texto: "La primera semana suele aliviar la pesadez digestiva." },
      { dia: 30, texto: "Al mes: apoyo antiinflamatorio y mejor digestion general." },
    ],
    preguntaSemanal: "¿Como sentis tu digestion esta semana?",
  },
  {
    id: "blend_energia", nombre: "Blend Energia", emoji: "⚡", duracionDias: 30,
    beneficio: "Energia y enfoque diario",
    etapas: [
      { dia: 7, texto: "Los primeros dias suele notarse mas impulso por la manana." },
      { dia: 30, texto: "Al mes: energia mas pareja a lo largo del dia." },
    ],
    preguntaSemanal: "¿Con cuanta energia arrancaste tus dias?",
  },
];
const RESP_SEMANAL = [
  { v: "mejor", label: "Mejor", emoji: "😊" },
  { v: "igual", label: "Igual", emoji: "😐" },
  { v: "nose", label: "No sé", emoji: "🤔" },
];


/* ===================== UTILES HABITOS ===================== */
const dayKey = (d) => d.toISOString().slice(0, 10);
const todayKey = () => dayKey(new Date());
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
const diffDays = (key) => Math.round((new Date(todayKey()) - new Date(key)) / 86400000);
function tocaEnFecha(hab, date) {
  const f = hab.frecuencia;
  if (f.modo === "diario") return true;
  if (f.modo === "dias") return f.dias.includes(date.getDay());
  return true;
}
function estadoRegistro(hab, reg) {
  if (!reg) return "nada";
  if (hab.tipo === "si_no") return reg.cumplido ? "completo" : "nada";
  const val = reg.valor || 0;
  if (val >= hab.meta) return "completo";
  if (val > hab.meta * 0.5) return "parcial";
  return "nada";
}
const mantieneRacha = (e) => e === "completo" || e === "parcial";

/* ===================== APP ===================== */
// Logo Vita Selecta recreado en SVG (vectorial, liviano, fiel al original):
// monograma "VS" entrelazado con "VITA SELECTA" arriba, en crema.
// Logo de Vita Selecta. Usa el PNG real, eligiendo blanco o negro segun el tema activo.
// Se suscribe a cambios del tema escuchando un evento custom 'vita-tema-cambio'.
function LogoVitaSelecta({ height = 90 }) {
  const [esOscuro, setEsOscuro] = useState(() => {
    if (typeof document === "undefined") return true;
    // El tema efectivo se aplica como variable CSS --bg al documentElement.
    // Si el fondo es claro, --bg sera claro. Detectamos por luminancia.
    const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
    return esColorOscuro(bg);
  });
  useEffect(() => {
    const handler = () => {
      const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
      setEsOscuro(esColorOscuro(bg));
    };
    window.addEventListener("vita-tema-cambio", handler);
    return () => window.removeEventListener("vita-tema-cambio", handler);
  }, []);
  const src = esOscuro ? "/logo-blanco.png" : "/logo-negro.png";
  return <img src={src} alt="Vita Selecta" className="vs-logo" style={{ height, width: "auto", display: "block" }} />;
}

// Devuelve true si el color hex es oscuro (luminancia baja).
function esColorOscuro(hex) {
  if (!hex) return true;
  const h = hex.replace("#", "");
  if (h.length < 6) return true;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // luminancia aproximada
  return (r * 0.299 + g * 0.587 + b * 0.114) < 128;
}

export default function App() {
  // Fases: "cargando" -> "registro" -> "onboarding" -> "app"
  const [fase, setFase] = useState("cargando");
  const [usuario, setUsuario] = useState(null);

  // Modo de tema: "claro" | "oscuro" | "auto" (persistido en el navegador)
  const [modoTema, setModoTema] = useState(() => {
    try { return localStorage.getItem("vita_tema") || "oscuro"; } catch { return "oscuro"; }
  });

  // Aplicar el tema cada vez que cambia el modo. En "auto", re-chequear cada 10 min.
  useEffect(() => {
    aplicarTema(temaEfectivo(modoTema));
    try { localStorage.setItem("vita_tema", modoTema); } catch {}
    if (modoTema === "auto") {
      const id = setInterval(() => aplicarTema(temaEfectivo("auto")), 600000);
      return () => clearInterval(id);
    }
  }, [modoTema]);

  // Al cargar, revisar si ya hay una sesión activa en Supabase
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        const u = data.session.user;
        setUsuario({ nombre: u.user_metadata?.nombre || "amigo/a", email: u.email, id: u.id });
        setFase("app");
      } else {
        setFase("registro");
      }
    });
    // Escuchar cambios de sesión (login/logout)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) { setUsuario(null); setFase("registro"); }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    setUsuario(null);
    setFase("registro");
  };

  // Guardar el suplemento elegido en el onboarding (si eligió uno)
  const finalizarOnboarding = async (sup) => {
    if (sup) {
      const { data: sesion } = await supabase.auth.getUser();
      const uid = sesion?.user?.id;
      if (uid) {
        await supabase.from("suplementos_usuario").insert({
          usuario_id: uid, suplemento_id: sup.id, inicio: sup.inicio, activo: true,
        });
      }
    }
    setFase("app");
  };

  if (fase === "cargando") {
    return (
      <div style={{ ...s.authWrap }}>
        <style>{CSS}</style>
        <div style={{ color: C.salviaD, fontFamily: SANS }}>Cargando…</div>
      </div>
    );
  }
  if (fase === "registro") {
    return <PantallaRegistro onListo={(u, esNuevo) => { setUsuario(u); setFase(esNuevo ? "onboarding" : "app"); }} />;
  }
  if (fase === "onboarding") {
    return <Onboarding usuario={usuario} onListo={finalizarOnboarding} />;
  }
  return <AppPrincipal usuario={usuario} onSalir={cerrarSesion} modoTema={modoTema} setModoTema={setModoTema} />;
}

function AppPrincipal({ usuario, onSalir, modoTema, setModoTema }) {
  const [tab, setTab] = useState("habitos");
  const [restricciones, setRestricciones] = useState([]);
  const [temaModal, setTemaModal] = useState(false);
  const NAV = [
    { id: "habitos", label: "Habitos", icon: ListChecks },
    { id: "comida", label: "Comida", icon: Salad },
    { id: "movimiento", label: "Movimiento", icon: Activity },
    { id: "suplemento", label: "Suplemento", icon: Leaf },
  ];
  return (
    <div style={s.app}>
      <style>{CSS}</style>
      <header style={s.header}>
        <LogoVitaSelecta height={130} />
        <span style={s.appName} className="vs-app-name">Vita Plus</span>
        <div style={s.appSep} className="vs-app-sep"></div>
        <span style={s.appTag} className="vs-app-tag">El hábito de cuidarte</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button style={s.salirBtn} onClick={() => setTemaModal(true)} title="Cambiar tema"><Palette size={18} /></button>
          <button style={s.salirBtn} onClick={onSalir} title="Volver al inicio (demo)"><X size={18} /></button>
        </div>
      </header>

      <main style={s.main}>
        {tab === "habitos" && <SeccionHabitos />}
        {tab === "comida" && <SeccionComida restricciones={restricciones} setRestricciones={setRestricciones} />}
        {tab === "movimiento" && <SeccionMovimiento />}
        {tab === "suplemento" && <SeccionSuplemento />}
      </main>

      {temaModal && <TemaModal modo={modoTema} onPick={(m) => { setModoTema(m); }} onClose={() => setTemaModal(false)} />}

      <nav style={s.bottomNav}>
        {NAV.map((n) => { const I = n.icon; const on = tab === n.id; return (
          <button key={n.id} onClick={() => setTab(n.id)} style={{ ...s.navBtn, color: on ? C.salviaD : C.grisL }}>
            <I size={21} />
            <span style={{ ...s.navLbl, fontWeight: on ? 700 : 500 }}>{n.label}</span>
            {on && <span style={s.navDot} />}
          </button>
        ); })}
      </nav>
    </div>
  );
}

/* ===================== PANTALLA: REGISTRO ===================== */
function PantallaRegistro({ onListo }) {
  const [modo, setModo] = useState("registro"); // registro | login
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const puede = modo === "login" ? (email && pass) : (nombre && email && pass);

  const manejar = async () => {
    setError(""); setCargando(true);
    try {
      if (modo === "registro") {
        const { data, error } = await supabase.auth.signUp({
          email, password: pass,
          options: { data: { nombre } },
        });
        if (error) throw error;
        onListo({ nombre: nombre || "amigo/a", email, id: data.user?.id }, true);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
        const u = data.user;
        onListo({ nombre: u.user_metadata?.nombre || "amigo/a", email: u.email, id: u.id }, false);
      }
    } catch (e) {
      // Mensajes mas claros para los errores mas comunes
      const msg = (e?.message || "").toLowerCase();
      if (msg.includes("already registered") || msg.includes("already been registered")) setError("Ese email ya tiene una cuenta. Probá ingresar.");
      else if (msg.includes("invalid login")) setError("Email o contraseña incorrectos.");
      else if (msg.includes("password") && msg.includes("6")) setError("La contraseña debe tener al menos 6 caracteres.");
      else setError(e?.message || "Ocurrió un error. Intentá de nuevo.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={s.authWrap}>
      <style>{CSS}</style>
      <div style={s.authInner}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}><LogoVitaSelecta height={66} /></div>
        <h1 style={s.authTitle}>{modo === "login" ? "Hola de nuevo" : "Tu bienestar empieza acá"}</h1>
        <p style={s.authSub}>{modo === "login" ? "Ingresá para seguir cultivando tus hábitos." : "Creá tu cuenta y empezá a cuidar tus hábitos con Vita Selecta."}</p>

        <div style={s.authForm}>
          {modo === "registro" && (
            <div>
              <label style={s.lbl}>Nombre</label>
              <input style={s.input} placeholder="¿Cómo te llamás?" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
          )}
          <div>
            <label style={s.lbl}>Email</label>
            <input style={s.input} type="email" placeholder="Usá el mismo mail de tu cuenta de Vita Selecta" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label style={s.lbl}>Contraseña</label>
            <input style={s.input} type="password" placeholder="••••••••" value={pass} onChange={(e) => setPass(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && puede && !cargando) manejar(); }} />
          </div>
          {error && <div style={s.authError}>{error}</div>}
          <button style={{ ...s.crearBtn, opacity: (puede && !cargando) ? 1 : 0.5, marginTop: 18 }} disabled={!puede || cargando}
            onClick={manejar}>
            {cargando ? "Un momento…" : (modo === "login" ? "Ingresar" : "Crear mi cuenta")}
          </button>
        </div>

        <div style={s.authToggle}>
          {modo === "login" ? "¿No tenés cuenta?" : "¿Ya tenés cuenta?"}{" "}
          <button style={s.authToggleBtn} onClick={() => { setModo(modo === "login" ? "registro" : "login"); setError(""); }}>
            {modo === "login" ? "Creá una" : "Ingresá"}
          </button>
        </div>
        <p style={s.authDemo}>Usá el mismo email con el que comprás en Vita Selecta.</p>
      </div>
    </div>
  );
}

/* ===================== ONBOARDING ===================== */
function Onboarding({ usuario, onListo }) {
  const [paso, setPaso] = useState(0);
  const [tomaSuple, setTomaSuple] = useState(null); // true/false
  const [supleId, setSupleId] = useState(null);
  const [hace, setHace] = useState(null); // "hoy" | "semana" | "mes"

  const finalizar = () => {
    if (tomaSuple && supleId) {
      const dias = hace === "hoy" ? 0 : hace === "semana" ? 7 : 25;
      onListo({ id: supleId, inicio: dayKey(addDays(-dias)) });
    } else {
      onListo(null);
    }
  };

  return (
    <div style={s.authWrap}>
      <style>{CSS}</style>
      <div style={s.authInner}>
        <div style={s.onbDots}>
          {[0, 1, 2].map((i) => <span key={i} style={{ ...s.onbDot, ...(i <= paso ? { background: C.salvia, width: 22 } : {}) }} />)}
        </div>

        {paso === 0 && (
          <div className="vs-fade">
            <h1 style={s.authTitle}>¡Bienvenido/a, {usuario?.nombre}! 🌱</h1>
            <p style={s.authSub}>Esta es tu app de bienestar. Acá vas a poder seguir tus hábitos, encontrar planes de comida y movimiento, y ver crecer tu jardín de constancia.</p>
            <button style={{ ...s.crearBtn, marginTop: 22 }} onClick={() => setPaso(1)}>Empezar</button>
          </div>
        )}

        {paso === 1 && (
          <div className="vs-fade">
            <h1 style={s.authTitle}>¿Estás tomando algún suplemento de Vita Selecta?</h1>
            <p style={s.authSub}>Si querés, te acompañamos en el seguimiento para que aproveches al máximo tu producto. Podés saltar esto y cargarlo después.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 18 }}>
              <button style={{ ...s.onbOpt, ...(tomaSuple === true ? s.onbOptOn : {}) }} onClick={() => { setTomaSuple(true); setPaso(2); }}>
                <Leaf size={18} /> Sí, estoy tomando uno
              </button>
              <button style={{ ...s.onbOpt, ...(tomaSuple === false ? s.onbOptOn : {}) }} onClick={() => { setTomaSuple(false); finalizar(); }}>
                Todavía no / prefiero saltar
              </button>
            </div>
          </div>
        )}

        {paso === 2 && (
          <div className="vs-fade">
            <h1 style={s.authTitle}>¿Cuál tomás y hace cuánto?</h1>
            <p style={s.authSub}>Elegí tu suplemento y cuándo lo empezaste.</p>
            <label style={s.lbl}>Suplemento</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
              {SUPLEMENTOS.map((sup) => (
                <button key={sup.id} style={{ ...s.onbOpt, ...(supleId === sup.id ? s.onbOptOn : {}) }} onClick={() => setSupleId(sup.id)}>
                  <span style={{ fontSize: 18 }}>{sup.emoji}</span> {sup.nombre}
                  <span style={s.onbOptHint}>{sup.beneficio}</span>
                </button>
              ))}
            </div>
            <label style={s.lbl}>¿Hace cuánto lo empezaste?</label>
            <div style={s.segRow}>
              {[["hoy", "Hoy"], ["semana", "Esta semana"], ["mes", "~Un mes"]].map(([v, l]) => (
                <button key={v} style={{ ...s.seg, ...(hace === v ? s.segOn : {}) }} onClick={() => setHace(v)}>{l}</button>
              ))}
            </div>
            <button style={{ ...s.crearBtn, opacity: (supleId && hace) ? 1 : 0.5, marginTop: 20 }} disabled={!(supleId && hace)} onClick={finalizar}>
              Listo, entrar a la app
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ===================== SECCION: SUPLEMENTO ===================== */
function SeccionSuplemento() {
  const [respuestas, setRespuestas] = useState({}); // semana -> valor
  const [eligiendo, setEligiendo] = useState(false);
  const [supleActivo, setSupleActivo] = useState(null); // { id, inicio }
  const [cargando, setCargando] = useState(true);

  // Cargar el suplemento activo del usuario desde Supabase
  useEffect(() => {
    let activo = true;
    (async () => {
      const { data: sesion } = await supabase.auth.getUser();
      const uid = sesion?.user?.id;
      if (!uid) { setCargando(false); return; }
      const { data } = await supabase.from("suplementos_usuario")
        .select("*").eq("usuario_id", uid).eq("activo", true)
        .order("creado_en", { ascending: false }).limit(1);
      if (!activo) return;
      if (data && data.length > 0) {
        setSupleActivo({ id: data[0].suplemento_id, inicio: data[0].inicio, filaId: data[0].id });
      }
      setCargando(false);
    })();
    return () => { activo = false; };
  }, []);

  // Guardar (o cambiar) el suplemento activo en la base
  const guardarSuple = async (id, dias) => {
    const { data: sesion } = await supabase.auth.getUser();
    const uid = sesion?.user?.id;
    if (!uid) return;
    // desactivar cualquier suplemento previo
    await supabase.from("suplementos_usuario").update({ activo: false }).eq("usuario_id", uid).eq("activo", true);
    // insertar el nuevo
    const inicio = dayKey(addDays(-dias));
    const { data } = await supabase.from("suplementos_usuario")
      .insert({ usuario_id: uid, suplemento_id: id, inicio, activo: true }).select().single();
    setSupleActivo({ id, inicio, filaId: data?.id });
    setRespuestas({});
    setEligiendo(false);
  };

  // Quitar el suplemento activo
  const quitarSuple = async () => {
    const { data: sesion } = await supabase.auth.getUser();
    const uid = sesion?.user?.id;
    if (uid) await supabase.from("suplementos_usuario").update({ activo: false }).eq("usuario_id", uid).eq("activo", true);
    setSupleActivo(null);
    setEligiendo(false);
  };

  const sup = supleActivo ? SUPLEMENTOS.find((x) => x.id === supleActivo.id) : null;
  const diasTomando = supleActivo ? diffDays(supleActivo.inicio) : 0;
  const semanaActual = Math.floor(diasTomando / 7) + 1;
  const diasRestantes = sup ? sup.duracionDias - diasTomando : 0;
  const porPct = sup ? Math.min(100, Math.round((diasTomando / sup.duracionDias) * 100)) : 0;
  const seAcaba = sup && diasRestantes <= 5;

  // etapa alcanzada mas reciente
  const etapaActual = sup ? [...sup.etapas].reverse().find((e) => diasTomando >= e.dia) : null;
  const respondioEstaSemana = respuestas[semanaActual] != null;

  if (cargando) {
    return <div className="vs-fade" style={{ padding: "40px 0", textAlign: "center", color: C.gris }}>Cargando…</div>;
  }

  if (!sup) {
    return (
      <div className="vs-fade">
        <div style={s.secTop}><h1 style={s.secTitle}>Mi suplemento</h1></div>
        <p style={s.secSub}>Seguí tu suplemento de Vita Selecta y aprovechalo al máximo.</p>
        <div style={s.empty}>
          Todavía no cargaste ningún suplemento.
          <div style={{ marginTop: 12 }}>
            <button style={s.crearBtnSm} onClick={() => setEligiendo(true)}>Cargar mi suplemento</button>
          </div>
        </div>
        {eligiendo && <ElegirSuple onClose={() => setEligiendo(false)} onElegir={(id, dias) => guardarSuple(id, dias)} />}
      </div>
    );
  }

  return (
    <div className="vs-fade">
      <div style={s.secTop}><h1 style={s.secTitle}>Mi suplemento</h1>
        <button style={s.iconBtnSm} onClick={() => setEligiendo(true)}><Settings size={18} /></button>
      </div>

      {/* Tarjeta producto */}
      <div style={s.supHero}>
        <div style={s.supHeroTop}>
          <span style={{ fontSize: 34 }}>{sup.emoji}</span>
          <div style={{ flex: 1 }}>
            <div style={s.supNombre}>{sup.nombre}</div>
            <div style={s.supBenef}>{sup.beneficio}</div>
          </div>
        </div>
        <div style={s.supProgWrap}>
          <div style={s.supProgBar}><div style={{ ...s.supProgFill, width: porPct + "%" }} /></div>
          <div style={s.supProgLbl}><span>Día {diasTomando} de {sup.duracionDias}</span><span>{diasRestantes > 0 ? `${diasRestantes} días restantes` : "frasco terminado"}</span></div>
        </div>
      </div>

      {/* Etapa actual (lo que deberia estar sintiendo segun la web) */}
      {etapaActual && (
        <div style={s.supEtapa}>
          <Sparkles size={15} color={C.terra} />
          <span>{etapaActual.texto}</span>
        </div>
      )}

      {/* Check semanal */}
      {!seAcaba && (
        <div style={s.supCheck}>
          <div style={s.supCheckTitle}>Tu chequeo de la semana {semanaActual}</div>
          <div style={s.supCheckQ}>{sup.preguntaSemanal}</div>
          {respondioEstaSemana ? (
            <div style={s.supCheckDone}><Check size={15} /> ¡Gracias! Registramos cómo venís. Nos vemos la semana que viene.</div>
          ) : (
            <div style={s.supRespRow}>
              {RESP_SEMANAL.map((r) => (
                <button key={r.v} style={s.supRespBtn} onClick={() => setRespuestas((p) => ({ ...p, [semanaActual]: r.v }))}>
                  <span style={{ fontSize: 22 }}>{r.emoji}</span>
                  <span style={s.supRespLbl}>{r.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Aviso de recompra */}
      {seAcaba && (
        <div style={s.supRecompra}>
          <div style={s.supRecompraTitle}><ShoppingBag size={17} /> Se te está por terminar</div>
          <p style={s.supRecompraTxt}>
            {diasRestantes > 0
              ? `Te quedan unos ${diasRestantes} días de ${sup.nombre}. Para no cortar tu progreso, reponé tu frasco a tiempo.`
              : `Tu frasco de ${sup.nombre} se terminó. Si venís notando los cambios, seguí la racha reponiéndolo.`}
          </p>
          <a href="https://vitaselecta.com" target="_blank" rel="noopener noreferrer" style={s.supRecompraBtn}>
            Reponer mi {sup.nombre} <ChevronRight size={16} />
          </a>
        </div>
      )}

      {/* Historial de respuestas (demo) */}
      {Object.keys(respuestas).length > 0 && (
        <div style={{ marginTop: 22 }}>
          <span style={s.subTitle}>Cómo venís sintiéndote</span>
          <div style={s.supHist}>
            {Object.entries(respuestas).sort((a, b) => a[0] - b[0]).map(([sem, val]) => {
              const r = RESP_SEMANAL.find((x) => x.v === val);
              return <div key={sem} style={s.supHistRow}><span>Semana {sem}</span><span>{r?.emoji} {r?.label}</span></div>;
            })}
          </div>
        </div>
      )}

      {eligiendo && <ElegirSuple actual={sup.id} onClose={() => setEligiendo(false)} onElegir={(id, dias) => guardarSuple(id, dias)} onQuitar={quitarSuple} />}
    </div>
  );
}

function ElegirSuple({ actual, onClose, onElegir, onQuitar }) {
  const [id, setId] = useState(actual || null);
  const [hace, setHace] = useState("hoy");
  return (
    <div style={s.modalBg} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.modalHead}><b style={s.modalTitle}>Mi suplemento</b><button style={s.iconBtn} onClick={onClose}><X size={20} /></button></div>
        <label style={s.lbl}>¿Cuál estás tomando?</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {SUPLEMENTOS.map((sup) => (
            <button key={sup.id} style={{ ...s.onbOpt, ...(id === sup.id ? s.onbOptOn : {}) }} onClick={() => setId(sup.id)}>
              <span style={{ fontSize: 18 }}>{sup.emoji}</span> {sup.nombre}
              <span style={s.onbOptHint}>{sup.beneficio}</span>
            </button>
          ))}
        </div>
        <label style={s.lbl}>¿Hace cuánto?</label>
        <div style={s.segRow}>
          {[["hoy", "Hoy", 0], ["semana", "Esta semana", 7], ["mes", "~Un mes", 25]].map(([v, l]) => (
            <button key={v} style={{ ...s.seg, ...(hace === v ? s.segOn : {}) }} onClick={() => setHace(v)}>{l}</button>
          ))}
        </div>
        <button style={{ ...s.crearBtn, opacity: id ? 1 : 0.5, marginTop: 18 }} disabled={!id}
          onClick={() => { const dias = hace === "hoy" ? 0 : hace === "semana" ? 7 : 25; onElegir(id, dias); }}>
          Guardar
        </button>
        {onQuitar && <button style={s.supQuitar} onClick={onQuitar}>Ya no lo estoy tomando</button>}
      </div>
    </div>
  );
}

/* ===================== SECCION: HABITOS ===================== */
function SeccionHabitos() {
  const [habitos, setHabitos] = useState([]);
  const [regs, setRegs] = useState({});       // { habitoId: { fecha: {cumplido/valor} } }
  const [moods, setMoods] = useState({});      // { fecha: valor }
  const [fechaSel, setFechaSel] = useState(todayKey());
  const [modal, setModal] = useState(null);
  const [cargando, setCargando] = useState(true);

  // Cargar datos del usuario desde Supabase al entrar
  useEffect(() => {
    let activo = true;
    (async () => {
      const { data: sesion } = await supabase.auth.getUser();
      const uid = sesion?.user?.id;
      if (!uid) return;

      // traer habitos del usuario
      let { data: habs } = await supabase.from("habitos").select("*").eq("usuario_id", uid).order("creado_en");

      // si es usuario nuevo (sin habitos), sembrar los habitos base sugeridos
      if (!habs || habs.length === 0) {
        const aInsertar = HABITOS_BASE.map((h) => ({
          usuario_id: uid, nombre: h.nombre, icono: h.icon, tipo: h.tipo,
          meta: h.meta, unidad: h.unidad || "veces", frecuencia: h.frecuencia, es_base: true,
        }));
        const { data: insertados } = await supabase.from("habitos").insert(aInsertar).select();
        habs = insertados || [];
      }

      // traer registros del usuario
      const { data: registros } = await supabase.from("registros").select("*").eq("usuario_id", uid);
      // traer moods del usuario
      const { data: moodsData } = await supabase.from("moods").select("*").eq("usuario_id", uid);

      if (!activo) return;

      // mapear habitos al formato que usa la app
      const habitosApp = (habs || []).map((h) => ({
        id: h.id, nombre: h.nombre, icon: h.icono, tipo: h.tipo,
        meta: h.meta, unidad: h.unidad, frecuencia: h.frecuencia, base: h.es_base,
      }));
      // mapear registros a la estructura { habitoId: { fecha: {...} } }
      const regsApp = {};
      habitosApp.forEach((h) => { regsApp[h.id] = {}; });
      (registros || []).forEach((r) => {
        if (!regsApp[r.habito_id]) regsApp[r.habito_id] = {};
        regsApp[r.habito_id][r.fecha] = { cumplido: r.cumplido, valor: r.valor };
      });
      // mapear moods a { fecha: valor }
      const moodsApp = {};
      (moodsData || []).forEach((m) => { moodsApp[m.fecha] = m.valor; });

      setHabitos(habitosApp);
      setRegs(regsApp);
      setMoods(moodsApp);
      setCargando(false);
    })();
    return () => { activo = false; };
  }, []);

  const fechaDate = new Date(fechaSel);
  const esEditable = diffDays(fechaSel) >= 0 && diffDays(fechaSel) <= MAX_CORRECCION;
  const esHoy = fechaSel === todayKey();
  const habitosDelDia = habitos.filter((h) => tocaEnFecha(h, fechaDate));

  // Guardar un registro en la base (insertar o actualizar)
  const guardarRegistro = async (habitoId, data) => {
    const { data: sesion } = await supabase.auth.getUser();
    const uid = sesion?.user?.id;
    if (!uid) return;
    await supabase.from("registros").upsert({
      habito_id: habitoId, usuario_id: uid, fecha: fechaSel,
      cumplido: data.cumplido ?? false, valor: data.valor ?? 0,
    }, { onConflict: "habito_id,fecha" });
  };

  const setRegistro = (id, data) => {
    if (!esEditable) return;
    setRegs((p) => ({ ...p, [id]: { ...(p[id] || {}), [fechaSel]: data } }));
    guardarRegistro(id, data);
  };
  const toggleSiNo = (h) => setRegistro(h.id, { cumplido: !regs[h.id]?.[fechaSel]?.cumplido });
  const setCantidad = (h, v) => setRegistro(h.id, { valor: Math.max(0, Math.min(h.meta * 2, v)) });
  const setMood = (v) => {
    if (!esEditable) return;
    setMoods((m) => ({ ...m, [fechaSel]: v }));
    (async () => {
      const { data: sesion } = await supabase.auth.getUser();
      const uid = sesion?.user?.id;
      if (!uid) return;
      await supabase.from("moods").upsert({
        usuario_id: uid, fecha: fechaSel, valor: v,
      }, { onConflict: "usuario_id,fecha" });
    })();
  };

  const completos = habitosDelDia.filter((h) => estadoRegistro(h, regs[h.id]?.[fechaSel]) === "completo").length;
  const progreso = habitosDelDia.length ? Math.round((completos / habitosDelDia.length) * 100) : 0;

  const racha = useMemo(() => {
    let st = 0;
    for (let i = 0; i < 90; i++) {
      const d = addDays(-i); const k = dayKey(d);
      const hb = habitos.filter((h) => tocaEnFecha(h, d));
      const algo = hb.some((h) => mantieneRacha(estadoRegistro(h, regs[h.id]?.[k])));
      if (algo) st++; else if (i > 0) break;
    }
    return st;
  }, [regs, habitos]);

  const corr = useMemo(() => {
    let hiSum = 0, hiN = 0, loSum = 0, loN = 0;
    Object.keys(moods).forEach((k) => {
      const d = new Date(k); const hb = habitos.filter((h) => tocaEnFecha(h, d)); if (!hb.length) return;
      const comp = hb.filter((h) => estadoRegistro(h, regs[h.id]?.[k]) === "completo").length; const ratio = comp / hb.length;
      if (ratio >= 0.7) { hiSum += moods[k]; hiN++; } else if (ratio <= 0.4) { loSum += moods[k]; loN++; }
    });
    return { hi: hiN ? hiSum / hiN : 0, lo: loN ? loSum / loN : 0, hiN, loN };
  }, [moods, regs, habitos]);

  // Agregar un habito nuevo (lo guarda en la base)
  const agregar = async (h) => {
    const { data: sesion } = await supabase.auth.getUser();
    const uid = sesion?.user?.id;
    if (!uid) return;
    const { data: nuevo } = await supabase.from("habitos").insert({
      usuario_id: uid, nombre: h.nombre, icono: h.icon, tipo: h.tipo,
      meta: h.meta, unidad: h.unidad || "veces", frecuencia: h.frecuencia, es_base: false,
    }).select().single();
    if (nuevo) {
      setHabitos((hs) => [...hs, { id: nuevo.id, nombre: nuevo.nombre, icon: nuevo.icono, tipo: nuevo.tipo, meta: nuevo.meta, unidad: nuevo.unidad, frecuencia: nuevo.frecuencia, base: false }]);
      setRegs((r) => ({ ...r, [nuevo.id]: {} }));
    }
    setModal(null);
  };
  // Borrar un habito (lo elimina de la base)
  const borrar = async (id) => {
    await supabase.from("habitos").delete().eq("id", id);
    setHabitos((hs) => hs.filter((h) => h.id !== id));
  };

  if (cargando) {
    return <div className="vs-fade" style={{ padding: "40px 0", textAlign: "center", color: C.gris }}>Cargando tus hábitos…</div>;
  }

  return (
    <div className="vs-fade">
      <div style={s.secTop}>
        <h1 style={s.secTitle}>Habitos</h1>
        <button style={s.iconBtnSm} onClick={() => setModal("config")}><Settings size={18} /></button>
      </div>

      <div style={s.daySelector}>
        <button style={s.dayArrow} onClick={() => setFechaSel(dayKey(addDays(-diffDays(fechaSel) - 1)))}><ChevronLeft size={18} /></button>
        <div style={s.dayLabel}><Calendar size={14} />{esHoy ? "Hoy" : fechaDate.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "short" })}{!esEditable && <span style={s.dayLocked}> - solo lectura</span>}</div>
        <button style={{ ...s.dayArrow, opacity: esHoy ? .3 : 1 }} disabled={esHoy} onClick={() => { if (!esHoy) setFechaSel(dayKey(addDays(-diffDays(fechaSel) + 1))); }}><ChevronRight size={18} /></button>
      </div>

      <div style={s.topGrid} className="vs-topgrid">
        <div style={s.ringCard}>
          <div style={s.ringWrap}>
            <svg width="104" height="104" viewBox="0 0 104 104">
              <circle cx="52" cy="52" r="44" fill="none" stroke={C.borde} strokeWidth="9" />
              <circle cx="52" cy="52" r="44" fill="none" stroke={C.salvia} strokeWidth="9" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 44} strokeDashoffset={2 * Math.PI * 44 * (1 - progreso / 100)}
                transform="rotate(-90 52 52)" style={{ transition: "stroke-dashoffset .6s ease" }} />
            </svg>
            <div style={s.ringCenter}><b style={s.ringPct}>{progreso}%</b><span style={s.ringSub}>{completos}/{habitosDelDia.length}</span></div>
          </div>
          <div style={s.streakBadge}><Flame size={15} /> {racha} dias</div>
        </div>
        <div style={s.sideCol} className="vs-sidecol">
          <MoodPicker value={moods[fechaSel]} onPick={setMood} disabled={!esEditable} />
          <CorrCard corr={corr} />
        </div>
      </div>

      <div style={s.listHead}><span style={s.subTitle}>Habitos {esHoy ? "de hoy" : "del dia"}</span><button style={s.addLink} onClick={() => setModal("nuevo")}><Plus size={15} /> Agregar</button></div>
      <div style={s.list}>
        {habitosDelDia.length === 0 && <div style={s.empty}>No hay habitos programados para este dia.</div>}
        {habitosDelDia.map((h) => <HabitoRow key={h.id} hab={h} reg={regs[h.id]?.[fechaSel]} editable={esEditable} onToggle={() => toggleSiNo(h)} onCantidad={(v) => setCantidad(h, v)} />)}
      </div>

      <span style={s.subTitle}>Tu jardín de constancia</span>
      <Jardin habitos={habitos} regs={regs} onPickDay={(k) => { if (diffDays(k) <= MAX_CORRECCION) setFechaSel(k); }} />

      {modal === "nuevo" && <NuevoHabito onClose={() => setModal(null)} onCrear={agregar} />}
      {modal === "config" && <ConfigHabitos habitos={habitos} onClose={() => setModal(null)} onBorrar={borrar} onNuevo={() => setModal("nuevo")} />}
    </div>
  );
}

/* ===================== SECCION: ALIMENTACION ===================== */
function SeccionComida({ restricciones, setRestricciones }) {
  const [objetivo, setObjetivo] = useState("energia");
  const [planAbierto, setPlanAbierto] = useState(null);
  const [restrModal, setRestrModal] = useState(false);

  const planes = PLANES_COMIDA.filter((p) => {
    if (p.objetivo !== objetivo) return false;
    return restricciones.every((r) => p.cumple.includes(r));
  });
  const ocultos = PLANES_COMIDA.filter((p) => p.objetivo === objetivo).length - planes.length;

  return (
    <div className="vs-fade">
      <div style={s.secTop}>
        <h1 style={s.secTitle}>Alimentacion</h1>
        <button style={s.iconBtnSm} onClick={() => setRestrModal(true)}><Settings size={18} /></button>
      </div>
      <p style={s.secSub}>Planes de comidas segun lo que queres lograr, adaptados a tus preferencias.</p>

      <ObjetivoSelector objetivos={OBJ_COMIDA} value={objetivo} onChange={setObjetivo} />

      <div style={s.avisoOrientativo}>
        <Info size={15} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>Estos planes son una <b>guía general</b> para inspirarte, no un plan nutricional a medida. Para algo personalizado según tus necesidades, te recomendamos consultar a un nutricionista.</span>
      </div>

      {restricciones.length > 0 && (
        <div style={s.restrChips}>
          {restricciones.map((r) => { const o = RESTRICCIONES.find((x) => x.id === r); return <span key={r} style={s.restrChip}>{o?.label}</span>; })}
          <button style={s.restrEdit} onClick={() => setRestrModal(true)}>editar</button>
        </div>
      )}

      <div style={s.planList}>
        {planes.length === 0 && <div style={s.empty}>No hay planes para esta combinacion. Proba quitar alguna restriccion o cambiar de objetivo.</div>}
        {planes.map((p) => <PlanCard key={p.id} plan={p} abierto={planAbierto === p.id} onToggle={() => setPlanAbierto(planAbierto === p.id ? null : p.id)} tipoComida />)}
      </div>
      {ocultos > 0 && <p style={s.tip}><Info size={13} style={{ verticalAlign: -2, marginRight: 4, color: C.gris }} />{ocultos} plan{ocultos > 1 ? "es" : ""} oculto{ocultos > 1 ? "s" : ""} por tus restricciones.</p>}

      {restrModal && <RestrModal sel={restricciones} onSave={(r) => { setRestricciones(r); setRestrModal(false); }} onClose={() => setRestrModal(false)} />}
    </div>
  );
}

/* ===================== SECCION: MOVIMIENTO ===================== */
function SeccionMovimiento() {
  const [objetivo, setObjetivo] = useState("peso");
  const [nivel, setNivel] = useState("ppal");
  const [lugar, setLugar] = useState("casa");
  const [planAbierto, setPlanAbierto] = useState(null);

  const planes = PLANES_EJER.filter((p) => p.objetivo === objetivo && p.nivel === nivel && p.lugar === lugar);
  const porObjetivo = PLANES_EJER.filter((p) => p.objetivo === objetivo);

  return (
    <div className="vs-fade">
      <div style={s.secTop}><h1 style={s.secTitle}>Movimiento</h1></div>
      <p style={s.secSub}>Rutinas armadas segun tu objetivo, tu nivel y donde entrenas.</p>

      <ObjetivoSelector objetivos={OBJ_EJER} value={objetivo} onChange={setObjetivo} />

      <div style={s.filtRow}>
        <div style={s.filtGroup}>
          <span style={s.filtLbl}>Nivel</span>
          <div style={s.segRowSm}>
            {NIVELES.map((n) => <button key={n.id} onClick={() => setNivel(n.id)} style={{ ...s.segSm, ...(nivel === n.id ? s.segSmOn : {}) }}>{n.label}</button>)}
          </div>
        </div>
        <div style={s.filtGroup}>
          <span style={s.filtLbl}>Lugar</span>
          <div style={s.segRowSm}>
            {LUGARES.map((l) => { const I = l.icon; return <button key={l.id} onClick={() => setLugar(l.id)} style={{ ...s.segSm, ...(lugar === l.id ? s.segSmOn : {}) }}><I size={13} style={{ verticalAlign: -2, marginRight: 4 }} />{l.label}</button>; })}
          </div>
        </div>
      </div>

      <div style={s.avisoOrientativo}>
        <Info size={15} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>Estas rutinas son una <b>guía general</b>. Si tenés alguna lesión o condición de salud, o sos principiante, consultá a un profesor o profesional antes de empezar.</span>
      </div>

      <div style={s.planList}>
        {planes.length === 0 && (
          <div style={s.empty}>
            No hay rutinas para esa combinacion exacta.
            {porObjetivo.length > 0 && <div style={{ marginTop: 8, fontSize: 13 }}>Proba otro nivel o lugar - hay {porObjetivo.length} rutina{porObjetivo.length > 1 ? "s" : ""} para este objetivo.</div>}
          </div>
        )}
        {planes.map((p) => <PlanCard key={p.id} plan={p} abierto={planAbierto === p.id} onToggle={() => setPlanAbierto(planAbierto === p.id ? null : p.id)} />)}
      </div>
    </div>
  );
}

/* ===================== COMPONENTES COMPARTIDOS ===================== */
function ObjetivoSelector({ objetivos, value, onChange }) {
  return (
    <div>
      <span style={s.filtLbl}>Tu objetivo</span>
      <div style={s.objRow}>
        {objetivos.map((o) => (
          <button key={o.id} onClick={() => onChange(o.id)} style={{ ...s.objBtn, ...(value === o.id ? s.objBtnOn : {}) }}>
            {value === o.id && <Target size={13} style={{ verticalAlign: -2, marginRight: 5 }} />}{o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PlanCard({ plan, abierto, onToggle, tipoComida }) {
  const Icon = tipoComida ? Utensils : Activity;
  return (
    <div style={{ ...s.planCard, borderColor: abierto ? C.salvia : C.borde }}>
      <button style={s.planHead} onClick={onToggle}>
        <div style={s.planIcon}><Icon size={19} color={C.acentoTxt} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.planTitle}>{plan.titulo}</div>
          <div style={s.planDesc}>{plan.desc}</div>
        </div>
        <ChevronDown size={20} color={C.gris} style={{ transform: abierto ? "rotate(180deg)" : "none", transition: ".2s", flexShrink: 0 }} />
      </button>

      {plan.suple && (
        <div style={s.supleTag}><ShoppingBag size={13} /> Potenciá este plan con <b style={{ marginLeft: 3 }}>{plan.suple}</b></div>
      )}

      {abierto && (
        <div style={s.planBody}>
          {plan.dias.map((d, i) => (
            <div key={i} style={s.planDia}>
              <div style={s.planDiaHead}>{tipoComida ? <Clock size={13} /> : <Zap size={13} />}{d.dia}</div>
              <div style={s.comidaList}>
                {d.items.map((it, j) => <ComidaItem key={j} item={it} tipoComida={tipoComida} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Cada comida/ejercicio: si es string, lo muestra plano (compatibilidad).
// Si es objeto { nombre, porque, ingredientes, pasos, suple }, lo muestra expandible y lindo.
function ComidaItem({ item, tipoComida }) {
  const [open, setOpen] = useState(false);
  // formato viejo (string): se muestra como antes, sin expandir
  if (typeof item === "string") {
    return <div style={s.comidaPlana}>{item}</div>;
  }
  // formato nuevo (objeto detallado): expandible
  const tieneDetalle = (item.ingredientes && item.ingredientes.length) || item.pasos;
  return (
    <div style={{ ...s.comidaCard, borderColor: open ? C.salvia : C.borde }}>
      <button style={s.comidaHead} onClick={() => tieneDetalle && setOpen(!open)}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {item.momento && <span style={s.comidaMomento}>{item.momento}</span>}
          <div style={s.comidaNombre}>{item.nombre}</div>
        </div>
        {tieneDetalle && <ChevronDown size={17} color={C.gris} style={{ transform: open ? "rotate(180deg)" : "none", transition: ".2s", flexShrink: 0 }} />}
      </button>
      {open && tieneDetalle && (
        <div style={s.comidaDetalle}>
          {item.porque && <div style={s.comidaPorque}>{item.porque}</div>}
          {item.ingredientes && item.ingredientes.length > 0 && (
            <>
              <div style={s.comidaSubt}>Ingredientes</div>
              <ul style={s.comidaUl}>
                {item.ingredientes.map((ing, k) => <li key={k} style={s.comidaIng}>{ing}</li>)}
              </ul>
            </>
          )}
          {item.pasos && (
            <>
              <div style={s.comidaSubt}>Preparación</div>
              <div style={s.comidaPasos}>{item.pasos}</div>
            </>
          )}
          {item.suple && (
            <div style={s.comidaSuple}>
              <ShoppingBag size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>Potenciá este plan con <b>{item.suple}</b> de Vita Selecta.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TemaModal({ modo, onPick, onClose }) {
  const OPCIONES = [
    { id: "claro", label: "Claro", desc: "Tonos cálidos y luminosos", icon: Sun },
    { id: "oscuro", label: "Oscuro", desc: "Tonos violeta de noche", icon: Moon },
    { id: "auto", label: "Automático", desc: "Claro de día, oscuro de noche", icon: Sparkles },
  ];
  return (
    <div style={s.modalBg} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.modalHead}><b style={s.modalTitle}>Tema de la app</b><button style={s.iconBtn} onClick={onClose}><X size={20} /></button></div>
        <p style={s.modalSub}>Elegí cómo querés ver la app. Tu preferencia queda guardada.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 8 }}>
          {OPCIONES.map((o) => { const I = o.icon; const on = modo === o.id; return (
            <button key={o.id} onClick={() => onPick(o.id)} style={{ ...s.restrOpt, ...(on ? s.restrOptOn : {}), alignItems: "center" }}>
              <span style={{ ...s.restrCheck, ...(on ? { background: C.salvia, borderColor: C.salvia } : {}) }}>{on && <Check size={13} color={C.acentoTxt} />}</span>
              <I size={18} style={{ color: C.salviaD, flexShrink: 0 }} />
              <span style={{ display: "flex", flexDirection: "column", textAlign: "left" }}>
                <span style={{ fontWeight: 600 }}>{o.label}</span>
                <span style={{ fontSize: 12, color: C.gris }}>{o.desc}</span>
              </span>
            </button>
          ); })}
        </div>
      </div>
    </div>
  );
}

function RestrModal({ sel, onSave, onClose }) {
  const [local, setLocal] = useState(sel);
  const toggle = (id) => setLocal((l) => l.includes(id) ? l.filter((x) => x !== id) : [...l, id]);
  return (
    <div style={s.modalBg} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.modalHead}><b style={s.modalTitle}>Tus preferencias</b><button style={s.iconBtn} onClick={onClose}><X size={20} /></button></div>
        <p style={s.modalSub}>Elegi tus restricciones o preferencias. Los planes que no las cumplan se ocultan automaticamente.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 8 }}>
          {RESTRICCIONES.map((r) => { const on = local.includes(r.id); return (
            <button key={r.id} onClick={() => toggle(r.id)} style={{ ...s.restrOpt, ...(on ? s.restrOptOn : {}) }}>
              <span style={{ ...s.restrCheck, ...(on ? { background: C.salvia, borderColor: C.salvia } : {}) }}>{on && <Check size={13} color={C.acentoTxt} />}</span>
              {r.label}
            </button>
          ); })}
        </div>
        <button style={s.crearBtn} onClick={() => onSave(local)}>Guardar preferencias</button>
      </div>
    </div>
  );
}

/* ---- componentes de habitos ---- */
function HabitoRow({ hab, reg, editable, onToggle, onCantidad }) {
  const Icon = ICONS[hab.icon] || Target; const estado = estadoRegistro(hab, reg);
  const bg = estado === "completo" ? C.salviaL : estado === "parcial" ? "#26331f" : C.card;
  const bd = estado === "completo" ? "#3d5238" : estado === "parcial" ? "#34401f" : C.borde;
  return (
    <div style={{ ...s.habRow, background: bg, borderColor: bd, opacity: editable ? 1 : .7 }}>
      <div style={{ ...s.habIcon, background: estado === "completo" ? C.salvia : estado === "parcial" ? "#5c7053" : C.salviaBg, color: estado === "nada" ? C.salviaD : C.acentoTxt }}><Icon size={18} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...s.habName, textDecoration: estado === "completo" ? "line-through" : "none", opacity: estado === "completo" ? .65 : 1 }}>{hab.nombre}</div>
        <div style={s.habMeta}><FreqBadge f={hab.frecuencia} />{hab.tipo === "cantidad" && <span style={s.habMetaTxt}>{reg?.valor || 0}/{hab.meta} {hab.unidad}{estado === "parcial" ? " - parcial" : ""}</span>}</div>
      </div>
      {hab.tipo === "si_no" ? (
        <button style={{ ...s.chk, ...(estado === "completo" ? s.chkDone : {}) }} onClick={onToggle} disabled={!editable}>{estado === "completo" && <Check size={15} />}</button>
      ) : (
        <div style={s.stepper}><button style={s.stepBtn} onClick={() => onCantidad((reg?.valor || 0) - 1)} disabled={!editable}><Minus size={13} /></button><b style={s.stepVal}>{reg?.valor || 0}</b><button style={s.stepBtn} onClick={() => onCantidad((reg?.valor || 0) + 1)} disabled={!editable}><Plus size={13} /></button></div>
      )}
    </div>
  );
}
function FreqBadge({ f }) {
  let txt = "Diario";
  if (f.modo === "dias") txt = f.dias.length === 7 ? "Diario" : f.dias.map((d) => DIAS_SEM[d]).join("-");
  if (f.modo === "x_semana") txt = `${f.veces}x semana`;
  return <span style={s.freqBadge}>{txt}</span>;
}
function MoodPicker({ value, onPick, disabled }) {
  return (
    <div style={s.moodCard}>
      <div style={s.moodTitle}>Como te sentis?</div>
      <div style={s.moodRow}>
        {MOODS.map((m) => { const Icon = m.icon; const on = value === m.v; return (
          <button key={m.v} onClick={() => onPick(m.v)} disabled={disabled} style={{ ...s.moodBtn, ...(on ? { background: m.color, borderColor: m.color, color: C.acentoTxt } : {}), opacity: disabled ? .5 : 1 }} title={m.label}><Icon size={18} /></button>
        ); })}
      </div>
    </div>
  );
}
function CorrCard({ corr }) {
  const has = corr.hiN >= 2 && corr.loN >= 2 && (corr.hi - corr.lo) > 0.1;
  return (
    <div style={s.corrCard}>
      <div style={s.corrHead}><TrendingUp size={15} color={C.terra} /><span style={s.corrTitle}>Animo y habitos</span></div>
      {has ? <p style={s.corrText}>Los dias que cumplis tus habitos, tu animo promedia <b style={{ color: C.salviaD }}>{corr.hi.toFixed(1)}/4</b> - contra <b style={{ color: C.terra }}>{corr.lo.toFixed(1)}/4</b> los dias flojos.</p>
        : <p style={s.corrText}>Registra tu animo unos dias y vas a ver aca como tu rutina influye en como te sentis.</p>}
    </div>
  );
}
function Jardin({ habitos, regs, onPickDay }) {
  // Jardin PAREJO: la racha define UNA etapa de madurez global (todas las plantas
  // en la misma etapa) y ademas cuantas plantas hay. A mas racha -> jardin mas
  // maduro Y mas poblado, pero siempre uniforme. Si se corta, se marchita.
  const diaCumplido = (date) => {
    const hb = habitos.filter((h) => tocaEnFecha(h, date));
    if (!hb.length) return false;
    return hb.some((h) => { const e = estadoRegistro(h, regs[h.id]?.[dayKey(date)]); return e === "completo" || e === "parcial"; });
  };

  let rachaActual = 0;
  for (let i = 0; i < 200; i++) {
    if (diaCumplido(addDays(-i))) rachaActual++;
    else { if (i === 0) { /* hoy sin marcar aun no corta */ } else break; }
  }
  let cortada = false;
  if (rachaActual === 0 && !diaCumplido(addDays(-1))) {
    for (let i = 2; i < 200; i++) { if (diaCumplido(addDays(-i))) { cortada = true; break; } }
  }
  // si esta cortada, recuperar la ultima racha para mostrarla marchita
  let rachaVisual = rachaActual;
  if (cortada) {
    let r = 0;
    for (let i = 2; i < 200; i++) { if (diaCumplido(addDays(-i))) r++; else if (r > 0) break; }
    rachaVisual = r;
  }
  const marchito = cortada;

  // 5 etapas de madurez segun umbrales de racha (dias):
  // 0: <1 (vacio) | 1: 1-3 semilla | 2: 4-7 brote | 3: 8-14 planta | 4: 15-24 floreced | 5: 25+ frondoso
  const etapaDe = (r) => r >= 25 ? 5 : r >= 15 ? 4 : r >= 8 ? 3 : r >= 4 ? 2 : r >= 1 ? 1 : 0;
  const etapa = etapaDe(rachaVisual);
  // cantidad de plantas segun racha (crece y se llena el cantero)
  const cantDe = (r) => r >= 25 ? 12 : r >= 15 ? 10 : r >= 8 ? 8 : r >= 4 ? 6 : r >= 1 ? Math.max(r, 2) : 0;
  const cant = cantDe(rachaVisual);

  const ETAPA_NOMBRE = ["", "Semillas", "Brotes", "Plantas", "En flor", "Jardín frondoso"];
  const ETAPA_EMOJI = ["", "🌱", "🌿", "🪴", "🌷", "🌳"];

  const W = 660, H = 230, baseY = 200; // mas alto: espacio de cielo arriba
  const gap = W / Math.max(cant, 1);
  const R = marchito ? 0 : rachaVisual; // para decoraciones: si esta marchito, dia gris

  // --- DECORACIONES GRADUALES (aparecen segun la racha R) ---
  // Cielo: interpola de gris apagado (R=0) a celeste claro (R alto)
  const t = Math.min(R / 26, 1); // 0..1
  const lerp = (a, b) => Math.round(a + (b - a) * t);
  const cieloTop = `rgb(${lerp(28,150)},${lerp(34,200)},${lerp(28,225)})`;
  const cieloBot = `rgb(${lerp(20,205)},${lerp(28,228)},${lerp(20,210)})`;

  // Sol: aparece desde R>=3, sube y se agranda con la racha
  const solVisible = R >= 3;
  const solProg = Math.min((R - 3) / 22, 1); // 0..1 desde dia 3
  const solR = 14 + solProg * 12;
  const solX = W - 80;
  const solY = 70 - solProg * 28; // sube
  const solColor = `rgb(${lerp(180,255)},${lerp(180,210)},${lerp(150,90)})`;

  // Nubes: empiezan grises y tapadas, se aclaran y reducen con la racha
  const nubeColor = `rgb(${lerp(120,255)},${lerp(125,255)},${lerp(120,255)})`;
  const nubeOp = 0.85 - t * 0.35;
  const nubes = R >= 1 ? [{ x: 140, y: 48, s: 1 }, ...(R < 12 ? [{ x: 380, y: 38, s: 0.8 }] : []), ...(R >= 6 && R < 18 ? [{ x: 520, y: 60, s: 0.7 }] : [])] : [];

  // Pajaritos: aparecen de a uno (dia 3, 9, 14, 20, 26)
  const pajaritoDias = [3, 9, 14, 20, 26];
  const pajaritos = pajaritoDias.filter((d) => R >= d).map((d, idx) => ({
    x: 90 + idx * 120 + (idx % 2) * 30, y: 30 + (idx % 3) * 14,
  }));

  // Mariposas: aparecen cuando hay flores (etapa>=4), una a los 16 y otra a los 22
  const mariposas = [];
  if (R >= 16) mariposas.push({ x: 150, y: baseY - 70, c: C.terra });
  if (R >= 22) mariposas.push({ x: 420, y: baseY - 80, c: "#d4a857" });

  // Pasto/florcitas en el suelo: densidad crece con la racha
  const matas = R >= 2 ? Math.min(Math.floor(R / 2), 14) : 0;

  // Brillos (etapa maxima): toque magico a partir de R>=25
  const brillos = R >= 25 ? [{ x: 200, y: 90 }, { x: 470, y: 110 }, { x: 330, y: 70 }] : [];

  // dibuja una planta en la etapa global (parametrica). Todas iguales.
  const dibujarPlanta = (x, et, mar) => {
    const cVivo = { tallo: "#6f8a64", hoja: C.salvia, flor: C.terra, centro: "#f6d9a0", tree: "#5f7d54" };
    const cMar = { tallo: "#6b5d42", hoja: "#7d8a6a", flor: "#8a7550", centro: "#a89770", tree: "#6b5d42" };
    const c = mar ? cMar : cVivo;
    const op = mar ? 0.6 : 1;
    const droop = mar ? 7 : 0;

    if (et === 1) {
      return (
        <g opacity={op}>
          <ellipse cx={x} cy={baseY - 3} rx="9" ry="4" fill={mar ? "#3a3320" : "#2e3a24"} />
          <line x1={x} y1={baseY - 4} x2={x + droop} y2={baseY - 16} stroke={c.hoja} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx={x + droop} cy={baseY - 17} r="3" fill={c.hoja} />
        </g>
      );
    }
    if (et === 2) {
      const top = baseY - 30;
      return (
        <g opacity={op}>
          <line x1={x} y1={baseY} x2={x + droop} y2={top} stroke={c.tallo} strokeWidth="3" strokeLinecap="round" />
          <path d={`M${x} ${baseY - 15} q -11 -5 -14 -14 q 11 2 14 11 z`} fill={c.hoja} />
          <path d={`M${x} ${baseY - 22} q 11 -5 14 -14 q -11 2 -14 11 z`} fill={c.hoja} />
        </g>
      );
    }
    if (et === 3) {
      const top = baseY - 50;
      return (
        <g opacity={op}>
          <line x1={x} y1={baseY} x2={x + droop} y2={top} stroke={c.tallo} strokeWidth="3.5" strokeLinecap="round" />
          <path d={`M${x} ${baseY - 16} q -13 -6 -17 -16 q 13 2 17 13 z`} fill={c.hoja} />
          <path d={`M${x} ${baseY - 26} q 13 -6 17 -16 q -13 2 -17 13 z`} fill={c.hoja} />
          <path d={`M${x} ${baseY - 38} q -12 -5 -15 -14 q 12 2 15 11 z`} fill={c.hoja} />
          <circle cx={x + droop} cy={top} r="4.5" fill={c.hoja} />
        </g>
      );
    }
    if (et === 4) {
      const top = baseY - 56;
      return (
        <g opacity={op}>
          <line x1={x} y1={baseY} x2={x + droop} y2={top} stroke={c.tallo} strokeWidth="3.5" strokeLinecap="round" />
          <path d={`M${x} ${baseY - 18} q -14 -6 -18 -17 q 14 2 18 14 z`} fill={c.hoja} />
          <path d={`M${x} ${baseY - 30} q 14 -6 18 -17 q -14 2 -18 14 z`} fill={c.hoja} />
          <circle cx={x + droop} cy={top} r="9" fill={c.flor} />
          <circle cx={x + droop} cy={top} r="4" fill={c.centro} />
        </g>
      );
    }
    const top = baseY - 64;
    return (
      <g opacity={op}>
        <line x1={x} y1={baseY} x2={x + droop} y2={top + 12} stroke={c.tallo} strokeWidth="4.5" strokeLinecap="round" />
        <circle cx={x + droop - 9} cy={top + 10} r="13" fill={c.tree} />
        <circle cx={x + droop + 9} cy={top + 10} r="13" fill={c.tree} />
        <circle cx={x + droop} cy={top} r="16" fill={c.hoja} />
        {!mar && <>
          <circle cx={x - 6} cy={top + 6} r="3.5" fill={c.flor} />
          <circle cx={x + 8} cy={top - 2} r="3.5" fill={c.flor} />
          <circle cx={x + 2} cy={top + 12} r="3.5" fill={c.flor} />
        </>}
      </g>
    );
  };

  return (
    <div style={s.gardenCard}>
      <div style={s.gardenHead}>
        <div>
          <div style={s.gardenRacha}><Flame size={17} color={marchito ? C.grisL : C.terra} /> {rachaActual} {rachaActual === 1 ? "día" : "días"} de racha</div>
          <div style={s.gardenHint}>
            {marchito
              ? "Tu jardín se marchitó… ¡retomá hoy para revivirlo! 🌱"
              : etapa === 0
                ? "Tu jardín está esperando… ¡plantá tu primera semilla hoy! 🌱"
                : `${ETAPA_EMOJI[etapa]} ${ETAPA_NOMBRE[etapa]}${etapa === 5 ? " · ¡máximo esplendor!" : ""}`}
          </div>
        </div>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", borderRadius: 12 }} onClick={() => onPickDay(todayKey())}>
        <defs>
          <linearGradient id="cielo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={cieloTop} />
            <stop offset="100%" stopColor={cieloBot} />
          </linearGradient>
        </defs>
        {/* cielo */}
        <rect x="0" y="0" width={W} height={baseY} fill="url(#cielo)" />
        {/* sol */}
        {solVisible && (
          <g>
            <circle className="g-sol" cx={solX} cy={solY} r={solR + 6} fill={solColor} opacity={0.25} />
            <circle cx={solX} cy={solY} r={solR} fill={solColor} />
          </g>
        )}
        {/* brillos magicos */}
        {brillos.map((b, i) => (
          <g key={"br" + i} className="g-brillo" style={{ animationDelay: `${i * 0.7}s` }}>
            <path d={`M${b.x} ${b.y - 5} L${b.x + 1.5} ${b.y - 1.5} L${b.x + 5} ${b.y} L${b.x + 1.5} ${b.y + 1.5} L${b.x} ${b.y + 5} L${b.x - 1.5} ${b.y + 1.5} L${b.x - 5} ${b.y} L${b.x - 1.5} ${b.y - 1.5} Z`} fill="#fff5d6" />
          </g>
        ))}
        {/* nubes */}
        {nubes.map((nb, i) => (
          <g key={"nube" + i} opacity={nubeOp} transform={`translate(${nb.x},${nb.y}) scale(${nb.s})`}>
            <g className="g-nube" style={{ animationDelay: `${i * 4}s` }}>
              <ellipse cx="0" cy="0" rx="26" ry="14" fill={nubeColor} />
              <ellipse cx="20" cy="4" rx="20" ry="12" fill={nubeColor} />
              <ellipse cx="-20" cy="4" rx="18" ry="11" fill={nubeColor} />
            </g>
          </g>
        ))}
        {/* pajaritos (simples "M" estilizadas) */}
        {pajaritos.map((pj, i) => (
          <path key={"paj" + i} className="g-paj" style={{ animationDelay: `${i * 0.5}s` }} d={`M${pj.x} ${pj.y} q 6 -7 12 0 q 6 -7 12 0`} stroke={t > 0.4 ? "#3a4a36" : "#5a6356"} strokeWidth="2.2" fill="none" strokeLinecap="round" />
        ))}
        {/* suelo */}
        <rect x="0" y={baseY} width={W} height={H - baseY} fill={marchito ? "#2a2618" : "#243018"} />
        <line x1="0" y1={baseY} x2={W} y2={baseY} stroke={marchito ? "#3a3320" : "#34471f"} strokeWidth="2" />
        {/* pasto y florcitas */}
        {Array.from({ length: matas }).map((_, i) => {
          const gx = (W / (matas + 1)) * (i + 1) + ((i % 2) * 14 - 7);
          const gc = marchito ? "#5a5038" : "#4e6b32";
          const flor = !marchito && i % 3 === 0;
          return (
            <g key={"mata" + i}>
              <path d={`M${gx} ${baseY + 14} q -4 -10 -2 -16 M${gx} ${baseY + 14} q 0 -12 0 -18 M${gx} ${baseY + 14} q 4 -10 3 -16`} stroke={gc} strokeWidth="1.6" fill="none" strokeLinecap="round" />
              {flor && <circle cx={gx} cy={baseY + 2} r="2.6" fill={i % 2 ? C.terra : "#e8c25a"} />}
            </g>
          );
        })}
        {/* mariposas */}
        {mariposas.map((mp, i) => (
          <g key={"mar" + i} transform={`translate(${mp.x},${mp.y})`}>
            <g className="g-mari" style={{ animationDelay: `${i * 1.3}s` }}>
              <ellipse className="g-mari-ala" cx="-4" cy="0" rx="4.5" ry="6" fill={mp.c} opacity="0.9" />
              <ellipse className="g-mari-ala" cx="4" cy="0" rx="4.5" ry="6" fill={mp.c} opacity="0.9" />
              <line x1="0" y1="-5" x2="0" y2="5" stroke="#3a2820" strokeWidth="1.5" />
            </g>
          </g>
        ))}
        {/* mensaje vacio */}
        {cant === 0 && (
          <text x={W / 2} y={baseY - 35} textAnchor="middle" fill={C.grisL} style={{ fontSize: 14, fontFamily: SANS }}>
            Cumplí tus hábitos hoy para plantar tu primera semilla
          </text>
        )}
        {/* plantas */}
        {Array.from({ length: cant }).map((_, i) => {
          const x = gap * i + gap / 2;
          return <g key={i} className={marchito ? undefined : "g-planta"} style={marchito ? undefined : { animationDelay: `${(i % 5) * 0.6}s` }}>{dibujarPlanta(x, etapa, marchito)}</g>;
        })}
      </svg>
      <div style={s.gardenFoot}>
        <span style={s.gardenLegend}>
          {etapa === 0 && !marchito
            ? "Cada día que cumplís tus hábitos, tu jardín crece: primero semillas, después brotes, plantas y flores. Cuanto más larga la racha, más lleno y vivo se pone, con sol, pájaros y mariposas. ¡Empezá hoy y vení a verlo florecer! 🌱"
            : "Tu jardín madura parejo y cobra vida a medida que sostenés la racha: aparecen sol, pájaros, mariposas y flores. Si la cortás, se marchita… pero revive cuando volvés."}
        </span>
      </div>
    </div>
  );
}
function NuevoHabito({ onClose, onCrear }) {
  const [nombre, setNombre] = useState(""); const [icon, setIcon] = useState("meta"); const [tipo, setTipo] = useState("si_no");
  const [meta, setMeta] = useState(8); const [unidad, setUnidad] = useState("veces"); const [freqModo, setFreqModo] = useState("diario");
  const [dias, setDias] = useState([1, 2, 3, 4, 5]); const [veces, setVeces] = useState(3);
  const crear = () => { if (!nombre.trim()) return; const frecuencia = freqModo === "diario" ? { modo: "diario" } : freqModo === "dias" ? { modo: "dias", dias } : { modo: "x_semana", veces }; onCrear({ nombre: nombre.trim(), icon, tipo, meta: tipo === "cantidad" ? meta : 1, unidad, frecuencia }); };
  const toggleDia = (d) => setDias((ds) => ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d].sort());
  return (
    <div style={s.modalBg} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.modalHead}><b style={s.modalTitle}>Nuevo habito</b><button style={s.iconBtn} onClick={onClose}><X size={20} /></button></div>
        <label style={s.lbl}>Que queres seguir?</label>
        <input style={s.input} placeholder="Ej: meditar 10 minutos" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <label style={s.lbl}>Icono</label>
        <div style={s.iconPick}>{ICON_LIST.map((ic) => { const I = ICONS[ic]; return <button key={ic} onClick={() => setIcon(ic)} style={{ ...s.iconOpt, ...(icon === ic ? { background: C.salvia, color: C.acentoTxt, borderColor: C.salvia } : {}) }}><I size={18} /></button>; })}</div>
        <label style={s.lbl}>Como se marca?</label>
        <div style={s.segRow}><button style={{ ...s.seg, ...(tipo === "si_no" ? s.segOn : {}) }} onClick={() => setTipo("si_no")}>Si / No</button><button style={{ ...s.seg, ...(tipo === "cantidad" ? s.segOn : {}) }} onClick={() => setTipo("cantidad")}>Cantidad</button></div>
        {tipo === "cantidad" && <div style={s.metaRow}><span style={s.metaLbl}>Meta:</span><div style={s.stepperSm}><button style={s.stepBtn} onClick={() => setMeta((m) => Math.max(1, m - 1))}><Minus size={13} /></button><b>{meta}</b><button style={s.stepBtn} onClick={() => setMeta((m) => m + 1)}><Plus size={13} /></button></div><input style={s.unitInput} value={unidad} onChange={(e) => setUnidad(e.target.value)} placeholder="unidad" /></div>}
        <label style={s.lbl}>Con que frecuencia?</label>
        <div style={s.segRow}><button style={{ ...s.seg, ...(freqModo === "diario" ? s.segOn : {}) }} onClick={() => setFreqModo("diario")}>Diario</button><button style={{ ...s.seg, ...(freqModo === "dias" ? s.segOn : {}) }} onClick={() => setFreqModo("dias")}>Dias</button><button style={{ ...s.seg, ...(freqModo === "x_semana" ? s.segOn : {}) }} onClick={() => setFreqModo("x_semana")}>X/sem</button></div>
        {freqModo === "dias" && <div style={s.diasRow}>{DIAS_SEM.map((d, i) => <button key={i} onClick={() => toggleDia(i)} style={{ ...s.diaBtn, ...(dias.includes(i) ? { background: C.salvia, color: C.acentoTxt, borderColor: C.salvia } : {}) }}>{d}</button>)}</div>}
        {freqModo === "x_semana" && <div style={s.metaRow}><span style={s.metaLbl}>Veces/semana:</span><div style={s.stepperSm}><button style={s.stepBtn} onClick={() => setVeces((v) => Math.max(1, v - 1))}><Minus size={13} /></button><b>{veces}</b><button style={s.stepBtn} onClick={() => setVeces((v) => Math.min(7, v + 1))}><Plus size={13} /></button></div></div>}
        <button style={s.crearBtn} onClick={crear}>Crear habito</button>
      </div>
    </div>
  );
}
function ConfigHabitos({ habitos, onClose, onBorrar, onNuevo }) {
  return (
    <div style={s.modalBg} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.modalHead}><b style={s.modalTitle}>Mis habitos</b><button style={s.iconBtn} onClick={onClose}><X size={20} /></button></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {habitos.map((h) => { const I = ICONS[h.icon] || Target; return (
            <div key={h.id} style={s.configRow}><div style={s.configIcon}><I size={16} /></div><div style={{ flex: 1 }}><div style={s.configName}>{h.nombre} {h.base && <span style={s.baseTag}>sugerido</span>}</div><div style={s.configMeta}>{h.tipo === "cantidad" ? `${h.meta} ${h.unidad}` : "Si/No"} - <FreqBadge f={h.frecuencia} /></div></div><button style={s.delBtn} onClick={() => onBorrar(h.id)}><Trash2 size={15} /></button></div>
          ); })}
        </div>
        <button style={s.crearBtn} onClick={onNuevo}><Plus size={16} /> Agregar habito</button>
      </div>
    </div>
  );
}

/* ===================== ESTILOS ===================== */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
* { box-sizing: border-box; margin: 0; }
.vs-fade { animation: vsf .35s ease; }
@keyframes vsf { from { opacity: 0; transform: translateY(8px);} to { opacity: 1; transform: none;} }
@media (max-width: 720px) { .vs-topgrid { grid-template-columns: 1fr !important; } .vs-sidecol { grid-template-columns: 1fr 1fr !important; } }

/* Header responsive: en celular achicamos el logo, el nombre, y ocultamos el subtitulo */
@media (max-width: 720px) {
  .vs-logo { height: 56px !important; }
  .vs-app-name { font-size: 20px !important; margin-left: 10px !important; letter-spacing: 0.5px !important; }
  .vs-app-sep { display: none !important; }
  .vs-app-tag { display: none !important; }
}
@media (max-width: 480px) {
  .vs-logo { height: 44px !important; }
  .vs-app-name { font-size: 17px !important; margin-left: 8px !important; }
}

/* --- animaciones del jardin (suaves) --- */
.g-planta { transform-box: fill-box; transform-origin: bottom center; animation: gsway 5s ease-in-out infinite; }
@keyframes gsway { 0%,100% { transform: rotate(-1.2deg);} 50% { transform: rotate(1.2deg);} }
.g-nube { animation: gdrift 22s ease-in-out infinite; }
@keyframes gdrift { 0%,100% { transform: translateX(0);} 50% { transform: translateX(26px);} }
.g-sol { transform-box: fill-box; transform-origin: center; animation: gpulse 6s ease-in-out infinite; }
@keyframes gpulse { 0%,100% { transform: scale(1); opacity: .25;} 50% { transform: scale(1.12); opacity: .4;} }
.g-paj { transform-box: fill-box; transform-origin: center; animation: gfly 3.5s ease-in-out infinite; }
@keyframes gfly { 0%,100% { transform: translateY(0);} 50% { transform: translateY(-6px);} }
.g-mari { animation: gflutter 4s ease-in-out infinite; }
@keyframes gflutter { 0% { transform: translate(0,0);} 25% { transform: translate(10px,-8px);} 50% { transform: translate(4px,-14px);} 75% { transform: translate(-8px,-6px);} 100% { transform: translate(0,0);} }
.g-mari-ala { transform-box: fill-box; transform-origin: center; animation: gwing 0.4s ease-in-out infinite; }
@keyframes gwing { 0%,100% { transform: scaleX(1);} 50% { transform: scaleX(0.55);} }
.g-brillo { transform-box: fill-box; transform-origin: center; animation: gtwinkle 2.2s ease-in-out infinite; }
@keyframes gtwinkle { 0%,100% { opacity: .3; transform: scale(.7);} 50% { opacity: 1; transform: scale(1.15);} }
@media (prefers-reduced-motion: reduce) {
  .g-planta,.g-nube,.g-sol,.g-paj,.g-mari,.g-mari-ala,.g-brillo { animation: none !important; }
}
`;
const s = {
  app: { background: C.bg, fontFamily: SANS, color: C.tinta, minHeight: "100vh", paddingBottom: 72 },
  header: { display: "flex", justifyContent: "flex-start", alignItems: "center", padding: "12px 20px", borderBottom: `1px solid ${C.borde}`, background: C.card, position: "sticky", top: 0, zIndex: 10 },
  appName: { marginLeft: 18, fontFamily: SERIF, fontSize: 28, color: C.tinta, letterSpacing: 1.5 },
  appSep: { width: 1, height: 24, background: C.borde, marginLeft: 14 },
  appTag: { marginLeft: 14, fontSize: 13, color: C.gris, letterSpacing: 0.5 },
  logoImg: { height: 46, width: "auto", borderRadius: 10, display: "block" },
  main: { maxWidth: 720, margin: "0 auto", padding: "20px 16px 30px" },

  secTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  secTitle: { fontFamily: SERIF, fontSize: 28, fontWeight: 400, color: C.tinta },
  secSub: { fontSize: 13.5, color: C.gris, marginBottom: 18, lineHeight: 1.4 },
  avisoOrientativo: { display: "flex", alignItems: "flex-start", gap: 9, background: C.cardAlt, border: `1px solid ${C.borde}`, borderRadius: 12, padding: "11px 14px", margin: "14px 0", fontSize: 12.5, color: C.gris, lineHeight: 1.5 },
  iconBtnSm: { background: "none", border: `1px solid ${C.borde}`, borderRadius: 10, padding: 8, cursor: "pointer", color: C.salviaD, display: "flex" },

  daySelector: { display: "flex", alignItems: "center", justifyContent: "space-between", background: C.card, border: `1px solid ${C.borde}`, borderRadius: 14, padding: "8px 12px", marginTop: 12, marginBottom: 6 },
  dayArrow: { background: "none", border: "none", color: C.salviaD, cursor: "pointer", padding: 6, display: "flex" },
  dayLabel: { display: "flex", alignItems: "center", gap: 7, fontSize: 14, fontWeight: 600, color: C.tinta, textTransform: "capitalize" },
  dayLocked: { color: C.grisL, fontWeight: 500, fontSize: 12, textTransform: "none" },

  topGrid: { display: "grid", gridTemplateColumns: "230px 1fr", gap: 14, marginTop: 14, marginBottom: 8 },
  ringCard: { background: C.card, border: `1px solid ${C.borde}`, borderRadius: 22, padding: 18, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 },
  ringWrap: { position: "relative", width: 104, height: 104 },
  ringCenter: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: C.tinta },
  ringPct: { fontFamily: SERIF, fontSize: 28, lineHeight: 1 },
  ringSub: { fontSize: 12, opacity: .9 },
  streakBadge: { display: "flex", alignItems: "center", gap: 6, background: C.terra, color: "#241813", padding: "7px 14px", borderRadius: 22, fontWeight: 700, fontSize: 14 },
  sideCol: { display: "grid", gridTemplateRows: "auto auto", gap: 14 },
  moodCard: { background: C.card, border: `1px solid ${C.borde}`, borderRadius: 18, padding: "13px 15px" },
  moodTitle: { fontFamily: SERIF, fontSize: 16, marginBottom: 9, color: C.tinta },
  moodRow: { display: "flex", gap: 7 },
  moodBtn: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "10px 0", borderRadius: 12, border: `1.5px solid ${C.borde}`, background: C.cardAlt, color: C.gris, cursor: "pointer" },
  corrCard: { background: C.terraL, borderRadius: 18, padding: "13px 15px" },
  corrHead: { display: "flex", alignItems: "center", gap: 7, marginBottom: 7 },
  corrTitle: { fontFamily: SERIF, fontSize: 16, color: C.terraD },
  corrText: { fontSize: 12.5, lineHeight: 1.5, color: C.terraD, margin: 0 },

  listHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, marginBottom: 12 },
  subTitle: { fontFamily: SANS, fontSize: 12.5, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: C.gris, display: "block" },
  addLink: { display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", color: C.terra, fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: SANS },
  list: { display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 },
  empty: { color: C.gris, fontSize: 14, padding: "18px", textAlign: "center", background: C.card, borderRadius: 14, border: `1px solid ${C.borde}`, lineHeight: 1.5 },

  habRow: { display: "flex", alignItems: "center", gap: 13, border: "1px solid", borderRadius: 16, padding: "13px 15px", transition: ".2s" },
  habIcon: { width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: ".2s" },
  habName: { fontSize: 15, fontWeight: 600, color: C.tinta },
  habMeta: { display: "flex", alignItems: "center", gap: 8, marginTop: 3 },
  habMetaTxt: { fontSize: 12, color: C.gris },
  freqBadge: { fontSize: 11, fontWeight: 700, color: C.salviaD, background: C.salviaBg, padding: "2px 7px", borderRadius: 6 },
  chk: { width: 30, height: 30, borderRadius: "50%", border: `2px solid ${C.borde}`, background: "none", color: C.acentoTxt, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" },
  chkDone: { background: C.salvia, borderColor: C.salvia },
  stepper: { display: "flex", alignItems: "center", gap: 11, background: C.cardAlt, border: `1px solid ${C.borde}`, borderRadius: 11, padding: "5px 11px" },
  stepBtn: { background: "none", border: "none", color: C.salviaD, cursor: "pointer", display: "flex", padding: 2 },
  stepVal: { fontSize: 15, minWidth: 18, textAlign: "center" },

  gardenCard: { background: C.card, border: `1px solid ${C.borde}`, borderRadius: 16, padding: "18px 16px 14px", marginTop: 12 },
  gardenFoot: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, flexWrap: "wrap", gap: 6 },
  gardenStat: { fontSize: 13, fontWeight: 700, color: C.salviaD },
  gardenLegend: { fontSize: 11.5, color: C.grisL },

  filtLbl: { display: "block", fontSize: 11.5, fontWeight: 700, color: C.gris, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, marginTop: 4, textAlign: "center" },
  objRow: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, justifyContent: "center" },
  objBtn: { padding: "9px 15px", borderRadius: 22, border: `1.5px solid ${C.borde}`, background: C.card, color: C.salviaD, fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: SANS },
  objBtnOn: { background: C.salvia, color: C.acentoTxt, borderColor: C.salvia },
  filtRow: { display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 18, justifyContent: "center" },
  filtGroup: { flex: 1, minWidth: 200 },
  segRowSm: { display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" },
  segSm: { padding: "8px 12px", borderRadius: 10, border: `1.5px solid ${C.borde}`, background: C.card, color: C.salviaD, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: SANS },
  segSmOn: { background: C.salvia, color: C.acentoTxt, borderColor: C.salvia },

  restrChips: { display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center", marginBottom: 14 },
  restrChip: { fontSize: 12, fontWeight: 700, color: C.terraD, background: C.terraL, padding: "4px 11px", borderRadius: 16 },
  restrEdit: { fontSize: 12, color: C.gris, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: SANS },

  planList: { display: "flex", flexDirection: "column", gap: 12 },
  planCard: { background: C.card, border: "1px solid", borderRadius: 18, overflow: "hidden", transition: ".2s" },
  planHead: { display: "flex", alignItems: "center", gap: 13, padding: "15px 16px", background: "none", border: "none", width: "100%", cursor: "pointer", textAlign: "left", fontFamily: SANS },
  planIcon: { width: 40, height: 40, borderRadius: 12, background: C.salvia, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  planTitle: { fontFamily: SERIF, fontSize: 17.5, color: C.tinta, lineHeight: 1.15 },
  planDesc: { fontSize: 12.5, color: C.gris, marginTop: 3 },
  supleTag: { display: "flex", alignItems: "center", gap: 7, background: C.terraL, color: C.terraD, fontSize: 12.5, padding: "8px 16px" },
  planBody: { padding: "4px 16px 16px", display: "flex", flexDirection: "column", gap: 12 },
  planDia: { background: C.cardAlt, borderRadius: 12, padding: "12px 14px" },
  planDiaHead: { display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, color: C.salviaD, marginBottom: 8 },
  planUl: { listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 },
  planLi: { fontSize: 13.5, color: C.tinta, lineHeight: 1.4 },
  comidaList: { display: "flex", flexDirection: "column", gap: 7 },
  comidaPlana: { fontSize: 13.5, color: C.tinta, lineHeight: 1.4 },
  comidaCard: { background: C.card, border: `1px solid ${C.borde}`, borderRadius: 10, overflow: "hidden" },
  comidaHead: { width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 11px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: SANS },
  comidaMomento: { fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: C.salviaD, display: "block" },
  comidaNombre: { fontSize: 13.5, color: C.tinta, lineHeight: 1.35, marginTop: 1 },
  comidaDetalle: { padding: "0 12px 12px", borderTop: `1px solid ${C.borde}` },
  comidaPorque: { fontSize: 12.5, color: C.gris, lineHeight: 1.5, marginTop: 10, fontStyle: "italic" },
  comidaSubt: { fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: C.terraD, marginTop: 11, marginBottom: 5 },
  comidaUl: { listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 3 },
  comidaIng: { fontSize: 13, color: C.tinta, lineHeight: 1.4, paddingLeft: 13, position: "relative" },
  comidaPasos: { fontSize: 13, color: C.gris, lineHeight: 1.5 },
  comidaSuple: { display: "flex", alignItems: "flex-start", gap: 8, marginTop: 12, background: C.terraL, borderLeft: `3px solid ${C.terra}`, borderRadius: 8, padding: "10px 12px", fontSize: 12.5, color: C.terraD, lineHeight: 1.45 },
  planTip: { color: C.terraD, fontWeight: 600, background: C.terraL, padding: "6px 10px", borderRadius: 8 },

  tip: { fontSize: 12.5, color: C.gris, marginTop: 14, lineHeight: 1.5 },

  bottomNav: { position: "fixed", bottom: 0, left: 0, right: 0, height: 64, background: C.card, borderTop: `1px solid ${C.borde}`, display: "flex", zIndex: 20 },
  navBtn: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, background: "none", border: "none", cursor: "pointer", position: "relative", fontFamily: SANS },
  navLbl: { fontSize: 11 },
  navDot: { position: "absolute", top: 8, width: 5, height: 5, borderRadius: "50%", background: C.terra },

  modalBg: { position: "fixed", inset: 0, background: "rgba(44,53,42,.5)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 },
  modal: { background: C.card, width: "min(440px,100%)", maxHeight: "90vh", overflowY: "auto", borderRadius: 22, padding: 22, border: `1px solid ${C.borde}` },
  modalHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  modalTitle: { fontFamily: SERIF, fontSize: 22, fontWeight: 400, color: C.tinta },
  modalSub: { fontSize: 13, color: C.gris, lineHeight: 1.5, marginBottom: 6 },
  iconBtn: { background: C.cardAlt, border: "none", borderRadius: 10, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.gris },
  lbl: { display: "block", fontSize: 12.5, fontWeight: 700, color: C.gris, textTransform: "uppercase", letterSpacing: .5, margin: "16px 0 8px" },
  input: { width: "100%", padding: "12px 14px", border: `1.5px solid ${C.borde}`, borderRadius: 12, fontSize: 14, outline: "none", fontFamily: SANS, color: C.tinta },
  iconPick: { display: "flex", gap: 8, flexWrap: "wrap" },
  iconOpt: { width: 42, height: 42, borderRadius: 12, border: `1.5px solid ${C.borde}`, background: C.cardAlt, color: C.salviaD, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  segRow: { display: "flex", gap: 8 },
  seg: { flex: 1, padding: "11px", borderRadius: 11, border: `1.5px solid ${C.borde}`, background: C.cardAlt, color: C.salviaD, fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: SANS },
  segOn: { background: C.salvia, color: C.acentoTxt, borderColor: C.salvia },
  metaRow: { display: "flex", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" },
  metaLbl: { fontSize: 13.5, color: C.tinta, fontWeight: 600 },
  stepperSm: { display: "flex", alignItems: "center", gap: 12, background: C.cardAlt, border: `1px solid ${C.borde}`, borderRadius: 11, padding: "7px 13px" },
  unitInput: { width: 90, padding: "9px 11px", border: `1.5px solid ${C.borde}`, borderRadius: 10, fontSize: 13, outline: "none", fontFamily: SANS },
  diasRow: { display: "flex", gap: 6, marginTop: 10 },
  diaBtn: { width: 38, height: 38, borderRadius: 10, border: `1.5px solid ${C.borde}`, background: C.cardAlt, color: C.salviaD, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: SANS },
  crearBtn: { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 22, padding: 14, background: C.salvia, color: C.acentoTxt, border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: SANS },

  restrOpt: { display: "flex", alignItems: "center", gap: 11, padding: "13px 15px", borderRadius: 13, border: `1.5px solid ${C.borde}`, background: C.cardAlt, color: C.tinta, fontSize: 14.5, fontWeight: 600, cursor: "pointer", fontFamily: SANS, textAlign: "left", width: "100%" },
  restrOptOn: { borderColor: C.salvia, background: C.salviaBg },
  restrCheck: { width: 22, height: 22, borderRadius: 7, border: `2px solid ${C.borde}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },

  configRow: { display: "flex", alignItems: "center", gap: 12, padding: "11px 13px", background: C.cardAlt, borderRadius: 13 },
  configIcon: { width: 36, height: 36, borderRadius: 10, background: C.salviaBg, color: C.salviaD, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  configName: { fontSize: 14.5, fontWeight: 600, color: C.tinta, display: "flex", alignItems: "center", gap: 7 },
  baseTag: { fontSize: 10, fontWeight: 700, color: C.salviaD, background: C.salviaL, padding: "2px 7px", borderRadius: 6, textTransform: "uppercase" },
  configMeta: { fontSize: 12, color: C.gris, marginTop: 2, display: "flex", alignItems: "center", gap: 6 },
  delBtn: { background: "none", border: "none", color: C.grisL, cursor: "pointer", padding: 6, display: "flex" },

  /* auth / registro / onboarding */
  authWrap: { background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: SANS, color: C.tinta },
  authInner: { width: "min(420px, 100%)" },
  authTitle: { fontFamily: SERIF, fontSize: 27, fontWeight: 400, color: C.tinta, textAlign: "center", lineHeight: 1.15, marginTop: 10 },
  authSub: { fontSize: 14, color: C.gris, textAlign: "center", lineHeight: 1.5, marginTop: 10 },
  authForm: { display: "flex", flexDirection: "column", gap: 12, marginTop: 22 },
  authToggle: { textAlign: "center", fontSize: 13.5, color: C.gris, marginTop: 18 },
  authToggleBtn: { background: "none", border: "none", color: C.salviaD, fontWeight: 700, cursor: "pointer", fontFamily: SANS, fontSize: 13.5 },
  authDemo: { textAlign: "center", fontSize: 11, color: C.grisL, marginTop: 18 },
  authError: { background: "#3a2018", color: "#f0a884", fontSize: 13, padding: "10px 14px", borderRadius: 10, lineHeight: 1.4, border: "1px solid #5a3020" },
  onbDots: { display: "flex", gap: 6, justifyContent: "center", marginBottom: 22 },
  onbDot: { width: 8, height: 8, borderRadius: 4, background: C.borde, transition: ".3s" },
  onbOpt: { display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderRadius: 13, border: `1.5px solid ${C.borde}`, background: C.card, color: C.tinta, fontSize: 14.5, fontWeight: 600, cursor: "pointer", fontFamily: SANS, textAlign: "left", width: "100%", flexWrap: "wrap" },
  onbOptOn: { borderColor: C.salvia, background: C.salviaBg },
  onbOptHint: { width: "100%", fontSize: 12, fontWeight: 400, color: C.gris, marginTop: 2 },
  salirBtn: { marginLeft: "auto", background: "none", border: `1px solid ${C.borde}`, borderRadius: 9, padding: 7, color: C.grisL, cursor: "pointer", display: "flex" },
  crearBtnSm: { display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 18px", background: C.salvia, color: C.acentoTxt, border: "none", borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: SANS },

  /* seccion suplemento */
  supHero: { background: C.card, border: `1px solid ${C.borde}`, borderRadius: 18, padding: 18, marginTop: 14 },
  supHeroTop: { display: "flex", alignItems: "center", gap: 14 },
  supNombre: { fontFamily: SERIF, fontSize: 22, color: C.tinta },
  supBenef: { fontSize: 13, color: C.gris, marginTop: 2 },
  supProgWrap: { marginTop: 16 },
  supProgBar: { height: 9, borderRadius: 6, background: C.cardAlt, overflow: "hidden" },
  supProgFill: { height: "100%", background: C.salvia, borderRadius: 6, transition: "width .5s" },
  supProgLbl: { display: "flex", justifyContent: "space-between", fontSize: 12, color: C.gris, marginTop: 7 },
  supEtapa: { display: "flex", alignItems: "flex-start", gap: 9, background: C.terraL, color: C.terraD, borderRadius: 14, padding: "12px 15px", marginTop: 12, fontSize: 13, lineHeight: 1.45 },
  supCheck: { background: C.card, border: `1px solid ${C.borde}`, borderRadius: 18, padding: 18, marginTop: 12 },
  supCheckTitle: { fontSize: 11.5, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: C.salviaD },
  supCheckQ: { fontFamily: SERIF, fontSize: 18, color: C.tinta, marginTop: 8, marginBottom: 14, lineHeight: 1.2 },
  supRespRow: { display: "flex", gap: 9 },
  supRespBtn: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "13px 0", borderRadius: 13, border: `1.5px solid ${C.borde}`, background: C.cardAlt, color: C.tinta, cursor: "pointer", fontFamily: SANS },
  supRespLbl: { fontSize: 12.5, fontWeight: 600 },
  supCheckDone: { display: "flex", alignItems: "center", gap: 8, color: C.salviaD, fontSize: 13.5, background: C.salviaBg, padding: "12px 14px", borderRadius: 12, lineHeight: 1.4 },
  supRecompra: { background: C.terraL, border: `1px solid ${C.terra}`, borderRadius: 18, padding: 18, marginTop: 12 },
  supRecompraTitle: { display: "flex", alignItems: "center", gap: 8, fontFamily: SERIF, fontSize: 18, color: C.terraD },
  supRecompraTxt: { fontSize: 13.5, color: C.terraD, lineHeight: 1.5, margin: "8px 0 14px" },
  supRecompraBtn: { display: "inline-flex", alignItems: "center", gap: 6, padding: "11px 18px", background: C.terra, color: "#241813", borderRadius: 11, fontSize: 14, fontWeight: 700, textDecoration: "none", fontFamily: SANS },
  supHist: { display: "flex", flexDirection: "column", gap: 7, marginTop: 12 },
  supHistRow: { display: "flex", justifyContent: "space-between", fontSize: 13.5, color: C.tinta, background: C.card, border: `1px solid ${C.borde}`, borderRadius: 11, padding: "10px 14px" },
  supQuitar: { width: "100%", marginTop: 10, padding: 11, background: "none", border: "none", color: C.grisL, fontSize: 13, cursor: "pointer", textDecoration: "underline", fontFamily: SANS },

  /* jardin poblado */
  gardenHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  gardenRacha: { display: "flex", alignItems: "center", gap: 7, fontFamily: SERIF, fontSize: 18, color: C.tinta },
  gardenHint: { fontSize: 12.5, color: C.gris, marginTop: 3 },
};
