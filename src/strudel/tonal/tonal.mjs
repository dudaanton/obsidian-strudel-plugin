/*
tonal.mjs - <short description TODO>
Copyright (C) 2022 Strudel contributors - see <https://codeberg.org/uzu/strudel/src/branch/main/packages/tonal/tonal.mjs>
This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public License for more details. You should have received a copy of the GNU Affero General Public License along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { Note, Interval, Scale } from '@tonaljs/tonal';
import { register, _mod, silence, logger, pure, isNote } from '@strudel/core';
import { stepInNamedScale, nearestNumberIndex } from './tonleiter.mjs';
import { noteToMidi } from '../core/util.mjs';

const octavesInterval = (octaves) => (octaves <= 0 ? -1 : 1) + octaves * 7 + 'P';

function getScale(scaleName) {
  scaleName = scaleName.replaceAll(':', ' ');
  const scale = Scale.get(scaleName);
  const { tonic, empty } = scale;
  if ((empty && isNote(scaleName)) || (empty && !tonic)) {
    throw new Error(
      `Scale name ${scaleName} is incomplete. Make sure to use ":" instead of spaces, example: .scale("C:major")`,
    );
  } else if (empty) {
    throw new Error(`Invalid scale name "${scaleName}"`);
  }
  return scale;
}

function scaleStep(step, scale) {
  step = Math.ceil(step);
  let { intervals, tonic } = getScale(scale);
  tonic = tonic || 'C';
  const { pc, oct = 3 } = Note.get(tonic);
  const octaveOffset = Math.floor(step / intervals.length);
  const scaleStep = _mod(step, intervals.length);
  const interval = Interval.add(intervals[scaleStep], octavesInterval(octaveOffset));
  return Note.transpose(pc + oct, interval);
}

// transpose note inside scale by offset steps
// function scaleOffset(scale: string, offset: number, note: string) {
function scaleOffset(scale, offset, note) {
  let { notes } = getScale(scale);
  notes = notes.map((note) => Note.get(note).pc); // use only pc!
  offset = Number(offset);
  if (isNaN(offset)) {
    throw new Error(`scale offset "${offset}" not a number`);
  }
  const { pc: fromPc, oct = 3 } = Note.get(note);
  const noteIndex = notes.indexOf(fromPc);
  if (noteIndex === -1) {
    throw new Error(`note "${note}" is not in scale "${scale}"`);
  }
  let i = noteIndex,
    o = oct,
    n = fromPc;
  const direction = Math.sign(offset);
  // TODO: find way to do this smarter
  while (Math.abs(i - noteIndex) < Math.abs(offset)) {
    i += direction;
    const index = _mod(i, notes.length);
    if (direction < 0 && n[0] === 'C') {
      o += direction;
    }
    n = notes[index];
    if (direction > 0 && n[0] === 'C') {
      o += direction;
    }
  }
  return n + o;
}

// Pattern.prototype._transpose = function (intervalOrSemitones: string | number) {
/**
 * Change the pitch of each value by the given amount. Expects numbers or note strings as values.
 * The amount can be given as a number of semitones or as a string in interval short notation.
 * If you don't care about enharmonic correctness, just use numbers. Otherwise, pass the interval of
 * the form: ST where S is the degree number and T the type of interval with
 *
 * - M = major
 * - m = minor
 * - P = perfect
 * - A = augmented
 * - d = diminished
 *
 * Examples intervals:
 *
 * - 1P = unison
 * - 3M = major third
 * - 3m = minor third
 * - 4P = perfect fourth
 * - 4A = augmented fourth
 * - 5P = perfect fifth
 * - 5d = diminished fifth
 *
 * @param {string | number} amount Either number of semitones or interval string.
 * @returns Pattern
 * @memberof Pattern
 * @name transpose
 * @synonyms trans
 * @example
 * "c2 c3".fast(2).transpose("<0 -2 5 3>".slow(2)).note()
 * @example
 * "c2 c3".fast(2).transpose("<1P -2M 4P 3m>".slow(2)).note()
 */

export const { transpose, trans } = register(['transpose', 'trans'], function transposeFn(intervalOrSemitones, pat) {
  return pat.withHap((hap) => {
    const note = hap.value.note ?? hap.value;
    if (typeof note === 'number') {
      // note is a number, so just add the number semitones of the interval
      let semitones;
      if (typeof intervalOrSemitones === 'number') {
        semitones = intervalOrSemitones;
      } else if (typeof intervalOrSemitones === 'string') {
        semitones = Interval.semitones(intervalOrSemitones) || 0;
      }
      const targetNote = note + semitones;
      if (typeof hap.value === 'object') {
        return hap.withValue(() => ({ ...hap.value, note: targetNote }));
      }
      return hap.withValue(() => targetNote);
    }
    if (typeof note !== 'string' || !isNote(note)) {
      logger(`[tonal] transpose: not a note "${note}"`, 'warning');
      return hap;
    }
    // note is a string, so we might be able to preserve harmonics if interval is a string as well
    const interval = !isNaN(Number(intervalOrSemitones))
      ? Interval.fromSemitones(intervalOrSemitones)
      : String(intervalOrSemitones);
    const targetNote = Note.transpose(note, interval);
    if (typeof hap.value === 'object') {
      return hap.withValue(() => ({ ...hap.value, note: targetNote }));
    }
    return hap.withValue(() => targetNote);
  });
});

// example: transpose(3).late(0.2) will be equivalent to compose(transpose(3), late(0.2))
// e.g. `stack(c3).superimpose(transpose(slowcat(7, 5)))` or
// or even `stack(c3).superimpose(transpose.slowcat(7, 5))` or

/**
 * Transposes notes inside the scale by the number of steps.
 * Expected to be called on a Pattern which already has a {@link Pattern#scale}
 *
 * @memberof Pattern
 * @name scaleTranspose
 * @param {offset} offset number of steps inside the scale
 * @returns Pattern
 * @synonyms scaleTrans, strans
 * @example
 * "-8 [2,4,6]"
 * .scale('C4 bebop major')
 * .scaleTranspose("<0 -1 -2 -3 -4 -5 -6 -4>")
 * .note()
 */

export const { scaleTranspose, scaleTrans, strans } = register(
  ['scaleTranspose', 'scaleTrans', 'strans'],
  function (offset /* : number | string */, pat) {
    return pat.withHap((hap) => {
      if (!hap.context.scale) {
        throw new Error('can only use scaleTranspose after .scale');
      }
      if (typeof hap.value === 'object')
        return hap.withValue(() => ({
          ...hap.value,
          note: scaleOffset(hap.context.scale, Number(offset), hap.value.note),
        }));
      if (typeof hap.value !== 'string') {
        throw new Error('can only use scaleTranspose with notes');
      }
      return hap.withValue(() => scaleOffset(hap.context.scale, Number(offset), hap.value));
    });
  },
);

// Converts a step value, which is a number optionally decorated with sharps and flats,
// to a number and an `offset` number of semitones
function _convertStepToNumberAndOffset(step) {
  let asNumber = Number(step);
  let offset = 0;
  if (isNaN(asNumber)) {
    step = String(step);
    // Check to see if the step matches the expected format:
    // - A number (possibly negative)
    // - Some number of sharps or flats (but not both)
    const match = /^(-?\d+)(#+|b+)?$/.exec(step);

    if (!match) {
      throw new Error(`invalid scale step "${step}", expected number or integer with optional # b suffixes`);
    }
    asNumber = Number(match[1]);
    // These decorations will determine the semitone offset based on the number of
    // sharps or flats
    const decorations = match[2] || '';
    offset = decorations[0] === '#' ? decorations.length : -decorations.length;
  }
  return [asNumber, offset];
}

let scaleToMidisAndNotes = {};
// Finds the nearest scale note to `note`
function _getNearestScaleNote(scaleName, note, preferHigher = true) {
  let noteMidi = typeof note === 'string' ? noteToMidi(note) : note;
  if (scaleToMidisAndNotes[scaleName] === undefined) {
    const { intervals, tonic } = getScale(scaleName);
    const { pc } = Note.get(tonic);
    const expandedIntervals = intervals.concat('8P'); // add the octave for wrapping
    const sNotes = expandedIntervals.map((interval) => Note.transpose(pc + '0', interval));
    const sMidi = sNotes.map(noteToMidi);
    // Cache
    scaleToMidisAndNotes[scaleName] = [sMidi, sNotes];
  }
  const [scaleMidis, scaleNotes] = scaleToMidisAndNotes[scaleName];
  const rootMidi = scaleMidis[0];
  const octaveDiff = Math.floor((noteMidi - rootMidi) / 12);
  const alignedMidis = scaleMidis.map((m) => m + 12 * octaveDiff);
  const noteIdx = nearestNumberIndex(noteMidi, alignedMidis, preferHigher);
  const noteMatch = scaleNotes[noteIdx];
  return Note.transpose(noteMatch, Interval.fromSemitones(12 * octaveDiff));
}

/**
 * Turns numbers into notes in the scale (zero indexed) or quantizes notes to a scale.
 *
 * When describing notes via numbers, note that negative numbers can be used to wrap backwards
 * in the scale as well as sharps or flats (but not both) to produce notes outside of the scale.
 *
 * Also sets scale for other scale operations, like {@link Pattern#scaleTranspose}.
 *
 * A scale consists of a root note (e.g. `c4`, `c`, `f#`, `bb4`) followed by semicolon (':') and then a [scale type](https://github.com/tonaljs/tonal/blob/main/packages/scale-type/data.ts).
 *
 * The root note defaults to octave 3, if no octave number is given.
 *
 * @name scale
 * @param {string} scale Name of scale
 * @returns Pattern
 * @example
 * n("0 2 4 6 4 2").scale("C:major")
 * @example
 * n("[0,7] 4 [2,7] 4")
 * .scale("C:<major minor>/2")
 * .s("piano")
 * @example
 * n(rand.range(0,12).segment(8))
 * .scale("C:ritusen")
 * .s("piano")
 * @example
 * n("<[0,7b] [-4# -4] [-2,7##] 4 [0,7] [-4# -4b] [-2,7###] 4b>*4")
 * .scale("C:<major minor>/2")
 * .s("piano")
 * @example
 * note("C1*16").transpose(irand(36)).scale('Cb2 major').scaleTranspose(3)
 */

export const scale = register(
  'scale',
  function (scale, pat) {
    // Supports ':' list syntax in mininotation
    if (Array.isArray(scale)) {
      scale = scale.flat().join(' ');
    }
    return (
      pat
        .fmap((value) => {
          const isObject = typeof value === 'object';
          // The case where the note has been defined via `n` or `pure`
          if (!isObject || (isObject && ('n' in value || 'value' in value))) {
            const step = isObject ? (value.n ?? value.value) : value;
            delete value.n; // remove n so it won't cause trouble
            if (isNote(step)) {
              // legacy..
              return pure(step);
            }
            try {
              const [number, offset] = _convertStepToNumberAndOffset(step);
              let note;
              if (isObject && value.anchor) {
                note = stepInNamedScale(number, scale, value.anchor);
              } else {
                note = scaleStep(number, scale);
              }
              if (offset != 0) note = Note.transpose(note, Interval.fromSemitones(offset));
              value = pure(isObject ? { ...value, note } : note);
            } catch (err) {
              logger(`[tonal] ${err.message}`, 'error');
              return silence;
            }
            return value;
          }
          // The case where the note has been defined via `note`
          else {
            const note = _getNearestScaleNote(scale, value.note);
            return pure(isObject ? { ...value, note } : note);
          }
        })
        .outerJoin()
        // legacy:
        .withHap((hap) => hap.setContext({ ...hap.context, scale }))
    );
  },
  true,
  true, // preserve step count
);
