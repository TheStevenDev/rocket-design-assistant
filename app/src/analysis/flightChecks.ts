import { chuteDiameterFor, chuteDiameterOf, descentRate, getCatalogItem, powerBudget, thrustToWeight, type PowerBudget } from '../core/catalog';
import { tr, txt } from '../core/i18n';
import { getMaterial } from '../core/materials';
import type { Project } from '../core/types';
import type { AnalysisResult } from './analyzeProject';

export type CheckStatus = 'ok' | 'warn' | 'bad' | 'todo';
export type CheckStep = 'shape' | 'electronics' | 'motor';

export interface FlightCheck {
  id: string;
  title: string;
  status: CheckStatus;
  /** Plain-language explanation for a first-time builder. */
  text: string;
  /** Where the user can fix it. */
  step: CheckStep;
}

export interface FlightChecks {
  checks: FlightCheck[];
  /** Liftoff and burnout values used by the checks. */
  liftoffMass: number;
  burnoutMass: number;
  thrustToWeight: number | null;
  descentRate: number | null;
  recommendedChute: number;
  power: PowerBudget;
}

/** Materials that block GPS signals. */
const RF_OPAQUE = new Set(['cfrp', 'al6061']);

/**
 * Beginner-oriented checklist built on top of the analysis. Thresholds are common
 * hobby rules of thumb, not safety criteria: the texts say so.
 */
export function flightChecks(p: Project, a: AnalysisResult): FlightChecks {
  const checks: FlightCheck[] = [];
  const add = (c: FlightCheck) => checks.push(c);
  const sweep = a.propellantSweep;
  const liftoffMass = sweep[0]?.mass ?? a.mass.total;
  const burnoutMass = sweep[sweep.length - 1]?.mass ?? a.mass.total;

  // Stability ---------------------------------------------------------------
  const s = a.stability;
  const stab = tr('Stabilità', 'Stability');
  if (s.reliability.status === 'unavailable') {
    add({ id: 'stability', title: stab, status: 'bad', step: 'shape', text: tr(`Non calcolabile: ${s.reliability.reasons[0] ?? 'controlla la forma'}`, `Cannot be computed: ${s.reliability.reasons[0] ?? 'check the shape'}`) });
  } else {
    const burn = a.configurations.find((c) => c.configuration.propellantFraction === 0)?.point.margin ?? s.margin;
    const min = Math.min(s.margin, burn);
    const m = tr(`${s.margin.toFixed(2)} cal al decollo, ${burn.toFixed(2)} a fine spinta`, `${s.margin.toFixed(2)} cal at lift-off, ${burn.toFixed(2)} at burnout`);
    if (min < 0) add({ id: 'stability', title: stab, status: 'bad', step: 'shape', text: `${m}. ${tr('Il centro di pressione è davanti al baricentro: il razzo andrebbe fuori controllo. Ingrandisci le pinne o aggiungi peso in punta.', 'The centre of pressure is ahead of the centre of gravity: the rocket would go out of control. Make the fins bigger or add nose weight.')}` });
    else if (min < 1) add({ id: 'stability', title: stab, status: 'warn', step: 'shape', text: `${m}. ${tr('Margine basso: con il vento può oscillare. Pinne un po\' più grandi o qualche grammo in punta lo portano a 1–2 calibri.', 'Low margin: it may wobble in the wind. Slightly bigger fins or a few grams in the nose bring it to 1–2 calibers.')}` });
    else if (s.margin > 3) add({ id: 'stability', title: stab, status: 'warn', step: 'shape', text: `${m}. ${tr('Molto stabile, forse troppo: con il vento tenderà a girarsi controvento. Puoi ridurre le pinne.', 'Very stable, maybe too much: it will tend to turn into the wind. You can make the fins smaller.')}` });
    else add({ id: 'stability', title: stab, status: 'ok', step: 'shape', text: `${m}. ${tr('Nell\'intervallo di riferimento 1–2 calibri secondo il modello di Barrowman.', 'Within the 1–2 caliber reference range according to the Barrowman model.')}` });
  }

  // Motor ---------------------------------------------------------------------
  const motor = p.components.find((c) => c.kind === 'motor');
  const thrust = tr('Spinta', 'Thrust');
  let tw: number | null = null;
  if (!motor) {
    add({ id: 'motor', title: tr('Motore', 'Motor'), status: 'todo', step: 'motor', text: tr('Scegli un motore: serve per calcolare baricentro e spinta.', 'Pick a motor: it is needed to compute the centre of gravity and thrust.') });
  } else if (!motor.avgThrust) {
    add({ id: 'motor', title: thrust, status: 'todo', step: 'motor', text: tr('Inserisci la spinta media del motore per verificare che il razzo lasci la rampa abbastanza veloce.', 'Enter the motor\'s average thrust to check that the rocket leaves the rail fast enough.') });
  } else {
    tw = thrustToWeight(motor.avgThrust, liftoffMass);
    const t = tr(`Rapporto spinta/peso ${tw.toFixed(1)} : 1.`, `Thrust-to-weight ratio ${tw.toFixed(1)} : 1.`);
    if (tw < 3) add({ id: 'motor', title: thrust, status: 'bad', step: 'motor', text: `${t} ${tr('Troppo poco: il razzo uscirebbe dalla rampa lento e instabile. Scegli un motore più potente o alleggerisci.', 'Too low: the rocket would leave the rail slow and unstable. Pick a more powerful motor or make it lighter.')}` });
    else if (tw < 5) add({ id: 'motor', title: thrust, status: 'warn', step: 'motor', text: `${t} ${tr('Al limite: la regola pratica è almeno 5 : 1, usa una rampa lunga e lancia senza vento.', 'Borderline: the rule of thumb is at least 5 : 1, use a long rail and launch with no wind.')}` });
    else add({ id: 'motor', title: thrust, status: 'ok', step: 'motor', text: `${t} ${tr('Sopra il 5 : 1 consigliato per uscire dalla rampa a velocità di sicurezza.', 'Above the recommended 5 : 1 to leave the rail at a safe speed.')}` });
  }

  // Recovery ---------------------------------------------------------------------
  const recommendedChute = chuteDiameterFor(burnoutMass);
  const chuteCm = Math.round(recommendedChute * 100);
  const chute = p.components.find((c) => c.role === 'recovery' && chuteDiameterOf(c) !== null);
  const chuteTitle = tr('Paracadute', 'Parachute');
  let rate: number | null = null;
  if (!chute) {
    add({ id: 'chute', title: chuteTitle, status: 'bad', step: 'motor', text: tr(`Manca il paracadute. Per questa massa serve un diametro di circa ${chuteCm} cm.`, `No parachute. For this mass you need a diameter of about ${chuteCm} cm.`) });
  } else {
    rate = descentRate(burnoutMass, chuteDiameterOf(chute)!);
    const t = tr(`Discesa a circa ${rate.toFixed(1)} m/s.`, `Descent at about ${rate.toFixed(1)} m/s.`);
    if (rate > 7) add({ id: 'chute', title: chuteTitle, status: 'warn', step: 'motor', text: `${t} ${tr(`Atterraggio duro: pinne ed elettronica rischiano. Prendi un paracadute da ~${chuteCm} cm.`, `Hard landing: fins and electronics are at risk. Get a ~${chuteCm} cm parachute.`)}` });
    else if (rate < 3) add({ id: 'chute', title: chuteTitle, status: 'warn', step: 'motor', text: `${t} ${tr('Molto lento: con il vento il razzo può finire lontano. Un paracadute più piccolo riduce la deriva.', 'Very slow: with wind the rocket may drift far away. A smaller parachute reduces drift.')}` });
    else add({ id: 'chute', title: chuteTitle, status: 'ok', step: 'motor', text: `${t} ${tr('Nell\'intervallo tipico 3–7 m/s.', 'Within the typical 3–7 m/s range.')}` });
  }

  // Electronics -------------------------------------------------------------------
  const power = powerBudget(p.components);
  const roles = new Set(p.components.map((c) => c.role));
  const items = p.components.map((c) => getCatalogItem(c.catalogId)).filter((x) => x !== undefined);
  const hasLoggerSensors = roles.has('gps') || roles.has('sensor');
  if (hasLoggerSensors && !roles.has('computer')) {
    add({ id: 'logger', title: tr('Computer di volo', 'Flight computer'), status: 'warn', step: 'electronics', text: tr('GPS e sensori hanno bisogno di un microcontrollore che legga e salvi i dati.', 'GPS and sensors need a microcontroller to read and save their data.') });
  }
  const battery = tr('Batteria', 'Battery');
  const current = Math.round(power.currentMa);
  if (power.currentMa > 0 && power.capacityMah === 0) {
    add({ id: 'power', title: battery, status: 'bad', step: 'electronics', text: tr(`L'elettronica consuma circa ${current} mA ma manca la batteria.`, `The electronics draw about ${current} mA but there is no battery.`) });
  } else if (power.runtimeHours !== null) {
    const min = Math.round(power.runtimeHours * 60);
    const runtime = min >= 120 ? tr(`${(min / 60).toFixed(1)} ore`, `${(min / 60).toFixed(1)} hours`) : `${min} min`;
    const t = tr(`Autonomia stimata ${runtime} (consumo ~${current} mA).`, `Estimated runtime ${runtime} (draw ~${current} mA).`);
    if (power.runtimeHours < 1) add({ id: 'power', title: battery, status: 'warn', step: 'electronics', text: `${t} ${tr('L\'attesa in rampa dura spesso 30–60 minuti: scegli una batteria più capiente o accendi la camera all\'ultimo.', 'Waiting on the pad often takes 30–60 minutes: pick a bigger battery or switch the camera on at the last moment.')}` });
    else add({ id: 'power', title: battery, status: 'ok', step: 'electronics', text: `${t} ${tr('Basta per l\'attesa in rampa.', 'Enough for the wait on the pad.')}` });
  }

  if (roles.has('gps')) {
    const gps = p.components.find((c) => c.role === 'gps')!;
    const inNose = gps.cgX <= p.geometry.nose.length;
    const shell = inNose ? p.geometry.nose.materialId : p.geometry.body.materialId;
    const mat = getMaterial(shell);
    const matName = mat ? txt(mat.name).toLowerCase() : null;
    const title = tr('Antenna GPS', 'GPS antenna');
    if (RF_OPAQUE.has(shell)) {
      add({ id: 'gps', title, status: 'bad', step: 'electronics', text: tr(`Il GPS è dentro ${matName ?? 'un materiale conduttivo'}: il segnale non passa. Spostalo in un'ogiva di plastica o vetroresina.`, `The GPS is inside ${matName ?? 'a conductive material'}: the signal cannot get through. Move it to a plastic or fibreglass nose cone.`) });
    } else {
      const where = inNose ? tr('L\'ogiva', 'A nose cone') : tr('Il tubo', 'A body tube');
      add({ id: 'gps', title, status: 'ok', step: 'electronics', text: tr(`${where} in ${matName ?? '—'} lascia passare il segnale. Imposta il modello dinamico "Airborne" e aspetta il fix prima del lancio.`, `${where} made of ${matName ?? '—'} lets the signal through. Set the "Airborne" dynamic model and wait for a fix before launch.`) });
    }
  }
  if (items.some((i) => i.id === 'imu-bno085') && !items.some((i) => i.id === 'imu-bmi088' || i.id === 'imu-lsm6dso32')) {
    add({ id: 'imu', title: tr('Sensore di accelerazione', 'Acceleration sensor'), status: 'warn', step: 'electronics', text: tr('Il BNO085 satura a 8 g: durante la spinta l\'inclinazione calcolata sarà sbagliata. Aggiungi un accelerometro da 24–32 g.', 'The BNO085 saturates at 8 g: during the burn the computed tilt will be wrong. Add a 24–32 g accelerometer.') });
  }
  if (items.some((i) => i.id === 'baro-bmp390')) {
    add({ id: 'baro', title: tr('Fori per il barometro', 'Barometer vent holes'), status: 'todo', step: 'electronics', text: tr('Pratica 3–4 fori da 2–3 mm nel vano elettronica, lontani da spigoli: senza, il barometro legge una quota sbagliata.', 'Drill 3–4 holes of 2–3 mm in the electronics bay, away from edges: without them the barometer reads the wrong altitude.') });
  }
  const cam = p.components.find((c) => c.role === 'camera');
  if (cam && cam.mass > 0.15 * liftoffMass) {
    const pct = Math.round((cam.mass / liftoffMass) * 100);
    add({ id: 'camera', title: tr('Peso della camera', 'Camera weight'), status: 'warn', step: 'electronics', text: tr(`La camera è il ${pct}% della massa al decollo: valuta un modello più leggero.`, `The camera is ${pct}% of the lift-off mass: consider a lighter model.`) });
  }
  if (motor && !items.some((i) => i.id === 'fc-altimeter')) {
    add({ id: 'deploy', title: tr('Apertura del paracadute', 'Parachute deployment'), status: 'todo', step: 'motor', text: tr('Per il primo razzo usa la carica di espulsione del motore (scegli il ritardo giusto) o un altimetro commerciale: lascia l\'elettronica fatta in casa solo alla registrazione dei dati.', 'For your first rocket use the motor ejection charge (pick the right delay) or a commercial altimeter: keep home-made electronics for data logging only.') });
  }

  return {
    checks, liftoffMass, burnoutMass, thrustToWeight: tw, descentRate: rate,
    recommendedChute, power,
  };
}
