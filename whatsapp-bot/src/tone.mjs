/**
 * Who is on the other end, and how they want to be spoken to.
 *
 * Parents write in constantly ("mera beta 12th me fail ho gaya"), and a bot
 * that answers a father with "aapki 12th kis board se hai?" loses him in one
 * line. Detected from words first; AI only refines it when it is being called
 * for something else anyway.
 */

import { normalize } from './nlu.mjs'

const PARENT = /\b(mera beta|meri beti|mere bete|mere beti|mera bachcha|meri bachchi|mera ladka|meri ladki|beta ka|beti ka|bete ka|bachche ka|bachche ki|my son|my daughter|my child|my kid|mere bachche|hamare bachche|ward)\b/
const FORMAL = /\b(sir|madam|mam|ma'am|ji|aap|kripya|kindly|please|pls|plz|dhanyavad|thank you|thanks)\b/
const ANGRY = /\b(bakwas|fraud|cheat|dhokha|scam|bekar|bekaar|pagal|stop|mat bhejo|band karo|useless|worst|spam)\b/

/** Update persona from one message; returns the (possibly unchanged) persona. */
export function detectPersona(text, current = {}) {
  const t = normalize(text)
  return {
    who: current.who === 'parent' || PARENT.test(t) ? 'parent' : current.who ?? 'student',
    formal: current.formal || FORMAL.test(t),
    upset: ANGRY.test(t),
  }
}

/**
 * Say the same thing to a student or to a parent.
 * `student` is used when no parent variant is given.
 */
export function say(persona, student, parent) {
  return persona?.who === 'parent' && parent ? parent : student
}
