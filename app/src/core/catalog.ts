import type { ComponentRole, MassComponent, RocketGeometry } from './types';
import type { DerivedGeometry } from '../geometry/rocketGeometry';
import type { Text } from './i18n';

// Built-in catalog of parts a first-time builder typically flies. Masses, sizes and
// currents are indicative (module + typical wiring/antenna): the UI always asks the
// user to weigh the real part, which replaces the value.

export interface CatalogItem {
  id: string;
  role: ComponentRole;
  name: Text;
  /** One-line, plain-language description. */
  summary: Text;
  specs: Text[];
  mass: number;
  length: number;
  diameter: number;
  /** Average current drawn from the on-board battery [mA]. 0 = self-powered or negligible. */
  currentMa: number;
  /** Battery only: usable capacity [mAh]. */
  capacityMah?: number;
  recommended?: boolean;
  /** Caveat shown next to the item. */
  caveat?: Text;
}

/** Same text in both languages (part numbers, units). */
const same = (s: string): Text => ({ it: s, en: s });

export const ELECTRONICS: CatalogItem[] = [
  // GPS
  {
    id: 'gps-m10', role: 'gps', name: { it: 'GPS standard (u-blox M10)', en: 'Standard GPS (u-blox M10)' },
    summary: { it: 'Piccolo e leggero: ti dice dove atterra il razzo e registra la traiettoria.', en: 'Small and light: tells you where the rocket lands and logs the trajectory.' },
    specs: [{ it: 'Precisione ~1,5 m', en: 'Accuracy ~1.5 m' }, { it: 'Fino a 10 aggiornamenti/s', en: 'Up to 10 updates/s' }, { it: 'Basso consumo', en: 'Low power' }],
    mass: 0.008, length: 0.025, diameter: 0, currentMa: 25, recommended: true,
  },
  {
    id: 'gps-f9p', role: 'gps', name: { it: 'GPS di precisione RTK/PPK (u-blox ZED-F9P)', en: 'RTK/PPK precision GPS (u-blox ZED-F9P)' },
    summary: {
      it: 'Il più preciso: registra i dati grezzi e, elaborati dopo il volo con una stazione a terra, arriva al centimetro.',
      en: 'The most accurate: it logs raw data that, processed after the flight with a ground station, reach centimetre accuracy.',
    },
    specs: [{ it: 'Precisione centimetrica (PPK)', en: 'Centimetre accuracy (PPK)' }, { it: 'Fino a 20 aggiornamenti/s', en: 'Up to 20 updates/s' }, { it: 'Doppia banda L1/L5', en: 'Dual band L1/L5' }],
    mass: 0.035, length: 0.05, diameter: 0, currentMa: 90,
    caveat: {
      it: 'Per la precisione centimetrica serve una seconda antenna fissa a terra (stazione base) e un passaggio di elaborazione dopo il volo. Durante la spinta il GPS può perdere il segnale per qualche secondo.',
      en: 'Centimetre accuracy needs a second, fixed antenna on the ground (base station) and a processing step after the flight. During the burn the GPS may lose its signal for a few seconds.',
    },
  },
  // Sensors
  {
    id: 'imu-bmi088', role: 'sensor', name: { it: 'Sensore di inclinazione e accelerazione (BMI088)', en: 'Tilt and acceleration sensor (BMI088)' },
    summary: { it: 'Misura accelerazione (fino a 24 g) e rotazione: da qui ricavi inclinazione, spinta e vibrazioni.', en: 'Measures acceleration (up to 24 g) and rotation: from these you get tilt, thrust and vibration.' },
    specs: [{ it: 'Accelerometro ±24 g', en: 'Accelerometer ±24 g' }, { it: 'Giroscopio ±2000 °/s', en: 'Gyroscope ±2000 °/s' }, { it: 'Pensato per ambienti con vibrazioni', en: 'Designed for high-vibration environments' }],
    mass: 0.002, length: 0.02, diameter: 0, currentMa: 6, recommended: true,
  },
  {
    id: 'imu-lsm6dso32', role: 'sensor', name: { it: 'Sensore di accelerazione e rotazione (LSM6DSO32)', en: 'Acceleration and rotation sensor (LSM6DSO32)' },
    summary: { it: 'Alternativa economica con scala alta, adatta anche a motori più potenti.', en: 'Low-cost alternative with a high range, also suited to more powerful motors.' },
    specs: [{ it: 'Accelerometro ±32 g', en: 'Accelerometer ±32 g' }, { it: 'Giroscopio ±2000 °/s', en: 'Gyroscope ±2000 °/s' }, { it: 'Consumo molto basso', en: 'Very low power' }],
    mass: 0.002, length: 0.02, diameter: 0, currentMa: 1,
  },
  {
    id: 'imu-bno085', role: 'sensor', name: { it: 'Sensore di orientamento "tutto in uno" (BNO085)', en: '"All-in-one" orientation sensor (BNO085)' },
    summary: { it: 'Calcola già l\'inclinazione da solo: comodo, ma l\'accelerometro arriva solo a 8 g.', en: 'Computes the tilt by itself: handy, but the accelerometer only goes up to 8 g.' },
    specs: [{ it: 'Orientamento già calcolato', en: 'Orientation computed on-chip' }, { it: 'Accelerometro ±8 g', en: 'Accelerometer ±8 g' }, { it: 'Magnetometro incluso', en: 'Magnetometer included' }],
    mass: 0.003, length: 0.025, diameter: 0, currentMa: 15,
    caveat: {
      it: 'Durante la spinta l\'accelerazione supera spesso 8 g: il sensore satura e l\'inclinazione calcolata può essere sbagliata. Abbinalo a un accelerometro ad alta scala.',
      en: 'During the burn the acceleration often exceeds 8 g: the sensor saturates and the computed tilt can be wrong. Pair it with a high-range accelerometer.',
    },
  },
  {
    id: 'baro-bmp390', role: 'sensor', name: { it: 'Barometro per l\'altitudine (BMP390)', en: 'Barometer for altitude (BMP390)' },
    summary: { it: 'Misura la pressione dell\'aria: è il modo più affidabile per sapere la quota raggiunta.', en: 'Measures air pressure: the most reliable way to know the altitude reached.' },
    specs: [{ it: 'Risoluzione ~0,1 m', en: 'Resolution ~0.1 m' }, { it: 'Fino a 200 letture/s', en: 'Up to 200 readings/s' }],
    mass: 0.002, length: 0.02, diameter: 0, currentMa: 1, recommended: true,
  },
  // Flight computers / loggers
  {
    id: 'fc-pico2', role: 'computer', name: { it: 'Raspberry Pi Pico 2 + scheda microSD', en: 'Raspberry Pi Pico 2 + microSD board' },
    summary: { it: 'Il "cervello" che legge i sensori e salva tutto su microSD. Economico, tanta documentazione.', en: 'The "brain" that reads the sensors and saves everything to microSD. Cheap, well documented.' },
    specs: [{ it: 'Programmabile in Python o C', en: 'Programmable in Python or C' }, { it: 'Registrazione su microSD', en: 'Logging to microSD' }],
    mass: 0.008, length: 0.055, diameter: 0, currentMa: 35, recommended: true,
  },
  {
    id: 'fc-esp32s3', role: 'computer', name: same('ESP32-S3 + microSD'),
    summary: { it: 'Come il Pico ma con Wi-Fi e Bluetooth: scarichi i dati dal telefono senza aprire il razzo.', en: 'Like the Pico but with Wi-Fi and Bluetooth: download the data to your phone without opening the rocket.' },
    specs: [{ it: 'Wi-Fi e Bluetooth', en: 'Wi-Fi and Bluetooth' }, { it: 'Registrazione su microSD', en: 'Logging to microSD' }],
    mass: 0.01, length: 0.055, diameter: 0, currentMa: 90,
  },
  {
    id: 'fc-teensy41', role: 'computer', name: same('Teensy 4.1'),
    summary: { it: 'Molto veloce e con microSD integrata: per registrare i sensori a frequenza alta.', en: 'Very fast, with built-in microSD: for logging sensors at a high rate.' },
    specs: [same('600 MHz'), { it: 'microSD integrata', en: 'Built-in microSD' }],
    mass: 0.006, length: 0.061, diameter: 0, currentMa: 100,
  },
  {
    id: 'fc-altimeter', role: 'computer', name: { it: 'Altimetro commerciale per il paracadute', en: 'Commercial altimeter for the parachute' },
    summary: { it: 'Già collaudato: apre il paracadute all\'apogeo. Consigliato se non usi la carica del motore.', en: 'Proven hardware: deploys the parachute at apogee. Recommended if you don\'t use the motor ejection charge.' },
    specs: [{ it: 'Espulsione all\'apogeo', en: 'Apogee deployment' }, { it: 'Registra la quota', en: 'Logs altitude' }],
    mass: 0.012, length: 0.05, diameter: 0, currentMa: 10,
  },
  // Cameras
  {
    id: 'cam-thumb', role: 'camera', name: { it: 'Mini camera (tipo RunCam Thumb)', en: 'Mini camera (RunCam Thumb type)' },
    summary: { it: 'Leggerissima, video in alta definizione. Si alimenta dalla batteria del razzo.', en: 'Very light, high-definition video. Powered by the rocket\'s battery.' },
    specs: [same('~16 g'), { it: 'Video fino a 4K', en: 'Video up to 4K' }, { it: 'Stabilizzazione a posteriori con i dati del giroscopio', en: 'Post-flight stabilisation from gyro data' }],
    mass: 0.016, length: 0.04, diameter: 0, currentMa: 450, recommended: true,
  },
  {
    id: 'cam-go', role: 'camera', name: { it: 'Action cam compatta con batteria (tipo Insta360 GO)', en: 'Compact action cam with battery (Insta360 GO type)' },
    summary: { it: 'Ha la sua batteria: non pesa sull\'autonomia dell\'elettronica.', en: 'Has its own battery: does not drain the electronics\' battery.' },
    specs: [same('~35 g'), { it: 'Batteria propria', en: 'Own battery' }, { it: 'Stabilizzazione integrata', en: 'Built-in stabilisation' }],
    mass: 0.035, length: 0.055, diameter: 0, currentMa: 0,
  },
  {
    id: 'cam-gopro', role: 'camera', name: { it: 'Action cam completa (tipo GoPro)', en: 'Full-size action cam (GoPro type)' },
    summary: { it: 'Ottima qualità ma pesante: solo per razzi grandi (diametro ≥ 75 mm).', en: 'Great quality but heavy: only for large rockets (diameter ≥ 75 mm).' },
    specs: [same('~155 g'), { it: 'Batteria propria', en: 'Own battery' }, same('Video 5K')],
    mass: 0.155, length: 0.07, diameter: 0, currentMa: 0,
  },
  // Batteries
  {
    id: 'bat-1s-450', role: 'battery', name: { it: 'Batteria LiPo 1S 450 mAh', en: 'LiPo battery 1S 450 mAh' },
    summary: { it: 'Piccola e leggera, sufficiente per GPS, sensori e microcontrollore.', en: 'Small and light, enough for GPS, sensors and microcontroller.' },
    specs: [{ it: '3,7 V', en: '3.7 V' }, same('450 mAh'), same('~12 g')],
    mass: 0.012, length: 0.04, diameter: 0, currentMa: 0, capacityMah: 450, recommended: true,
  },
  {
    id: 'bat-1s-1000', role: 'battery', name: { it: 'Batteria LiPo 1S 1000 mAh', en: 'LiPo battery 1S 1000 mAh' },
    summary: { it: 'Più autonomia: utile con camera alimentata a bordo o lunghe attese in rampa.', en: 'More runtime: useful with an on-board powered camera or long waits on the pad.' },
    specs: [{ it: '3,7 V', en: '3.7 V' }, same('1000 mAh'), same('~25 g')],
    mass: 0.025, length: 0.05, diameter: 0, currentMa: 0, capacityMah: 1000,
  },
  {
    id: 'bat-18650', role: 'battery', name: { it: 'Cella Li-ion 18650 (2500 mAh)', en: 'Li-ion 18650 cell (2500 mAh)' },
    summary: { it: 'Tanta energia in un cilindro robusto da 18 mm.', en: 'Lots of energy in a sturdy 18 mm cylinder.' },
    specs: [{ it: '3,6 V', en: '3.6 V' }, same('2500 mAh'), same('~47 g')],
    mass: 0.047, length: 0.065, diameter: 0.0185, currentMa: 0, capacityMah: 2500,
  },
  // Mounting
  {
    id: 'sled', role: 'other', name: { it: 'Slitta stampata 3D per l\'elettronica', en: '3D-printed electronics sled' },
    summary: { it: 'Supporto che tiene ferme le schede dentro il vano.', en: 'Mount that holds the boards in place inside the bay.' },
    specs: [{ it: '~20 g con viti', en: '~20 g with screws' }],
    mass: 0.02, length: 0.1, diameter: 0, currentMa: 0,
  },
];

export interface MotorPreset {
  id: string;
  name: Text;
  /** Impulse class letter, e.g. "D". */
  impulseClass: string;
  diameter: number;
  length: number;
  totalMass: number;
  propellantMass: number;
  avgThrust: number;
  note: Text;
}

// Rounded typical values: the exact data (thrust curve, masses) are on thrustcurve.org
// or the manufacturer's datasheet.
export const MOTORS: MotorPreset[] = [
  {
    id: 'mot-c6', name: same('Estes C6'), impulseClass: 'C', diameter: 0.018, length: 0.07, totalMass: 0.025, propellantMass: 0.012, avgThrust: 5.5,
    note: { it: 'Polvere nera, ideale per razzi piccoli e leggeri.', en: 'Black powder, ideal for small, light rockets.' },
  },
  {
    id: 'mot-d12', name: same('Estes D12'), impulseClass: 'D', diameter: 0.024, length: 0.07, totalMass: 0.044, propellantMass: 0.021, avgThrust: 11.8,
    note: { it: 'Polvere nera, facile da trovare.', en: 'Black powder, easy to find.' },
  },
  {
    id: 'mot-e12', name: same('Estes E12'), impulseClass: 'E', diameter: 0.024, length: 0.095, totalMass: 0.058, propellantMass: 0.036, avgThrust: 11.6,
    note: { it: 'Spinta bassa per la massa: va bene solo con razzi leggeri.', en: 'Low thrust for its mass: only suitable for light rockets.' },
  },
  {
    id: 'mot-f-29', name: { it: 'Classe F · 29 mm (composito)', en: 'F class · 29 mm (composite)' }, impulseClass: 'F', diameter: 0.029, length: 0.125, totalMass: 0.09, propellantMass: 0.035, avgThrust: 45,
    note: { it: 'Propellente composito: più spinta e più quota.', en: 'Composite propellant: more thrust and more altitude.' },
  },
  {
    id: 'mot-g-29', name: { it: 'Classe G · 29 mm (composito)', en: 'G class · 29 mm (composite)' }, impulseClass: 'G', diameter: 0.029, length: 0.15, totalMass: 0.125, propellantMass: 0.06, avgThrust: 80,
    note: { it: 'In molti paesi richiede di essere maggiorenni o iscritti a un\'associazione.', en: 'In many countries you must be an adult or a club member to use it.' },
  },
  {
    id: 'mot-h-38', name: { it: 'Classe H · 38 mm (composito)', en: 'H class · 38 mm (composite)' }, impulseClass: 'H', diameter: 0.038, length: 0.2, totalMass: 0.28, propellantMass: 0.12, avgThrust: 160,
    note: { it: 'Di solito serve una certificazione (es. Level 1) per acquistarlo e lanciarlo.', en: 'Usually requires a certification (e.g. Level 1) to buy and fly it.' },
  },
];

/** Round parachutes with a typical mass including shroud lines and swivel. */
export const PARACHUTES = [0.3, 0.45, 0.6, 0.75, 0.9, 1.2, 1.5].map((d) => ({
  id: `chute-${Math.round(d * 100)}`,
  diameter: d,
  mass: Math.round((8 + 55 * d * d) * 10) / 10 / 1000,
}));

export const SHOCK_CORD_MASS = 0.02;

export function getCatalogItem(id: string | undefined): CatalogItem | undefined {
  return id ? ELECTRONICS.find((e) => e.id === id) : undefined;
}

export function chuteDiameterOf(c: MassComponent): number | null {
  return PARACHUTES.find((p) => p.id === c.catalogId)?.diameter ?? null;
}

export const ROLE_LABELS: Record<ComponentRole, Text> = {
  gps: same('GPS'), sensor: { it: 'Sensori', en: 'Sensors' }, computer: { it: 'Computer di volo', en: 'Flight computer' },
  camera: { it: 'Camera', en: 'Camera' }, battery: { it: 'Batteria', en: 'Battery' }, recovery: { it: 'Recupero', en: 'Recovery' },
  other: { it: 'Altro', en: 'Other' },
};

/** Single-choice categories: picking an item replaces the previous one. */
export const SINGLE_CHOICE_ROLES: ComponentRole[] = ['gps', 'camera', 'battery', 'computer'];

export type Zone = 'nose' | 'bay';

/** CG position for a part placed in a zone. `nose` = inside the nose cone, `bay` = just below it. */
export function zonePosition(zone: Zone, g: RocketGeometry, d: DerivedGeometry): number {
  if (zone === 'nose') return g.nose.length * 0.65;
  return Math.min(d.bodyStartX + Math.min(0.06, g.body.length * 0.15), d.totalLength);
}

export interface PowerBudget {
  /** Total current from the on-board battery [mA]. */
  currentMa: number;
  capacityMah: number;
  /** Estimated runtime with 80% usable capacity [h]; null without battery or load. */
  runtimeHours: number | null;
}

export function powerBudget(components: MassComponent[]): PowerBudget {
  let currentMa = 0, capacityMah = 0;
  for (const c of components) {
    const item = getCatalogItem(c.catalogId);
    if (!item) continue;
    currentMa += item.currentMa;
    capacityMah += item.capacityMah ?? 0;
  }
  const runtimeHours = currentMa > 0 && capacityMah > 0 ? (capacityMah * 0.8) / currentMa : null;
  return { currentMa, capacityMah, runtimeHours };
}

const G0 = 9.81;
const RHO = 1.225;
/** Conservative drag coefficient for a flat round hobby parachute. */
export const CHUTE_CD = 0.8;

/** Steady descent rate under a round parachute [m/s]. */
export function descentRate(mass: number, chuteDiameter: number, cd = CHUTE_CD): number {
  if (!(mass > 0) || !(chuteDiameter > 0)) return NaN;
  return Math.sqrt((8 * mass * G0) / (Math.PI * RHO * cd * chuteDiameter ** 2));
}

/** Parachute diameter giving the target descent rate [m]. */
export function chuteDiameterFor(mass: number, targetRate = 5, cd = CHUTE_CD): number {
  return Math.sqrt((8 * mass * G0) / (Math.PI * RHO * cd * targetRate ** 2));
}

export function thrustToWeight(avgThrust: number, mass: number): number {
  return mass > 0 ? avgThrust / (mass * G0) : NaN;
}
