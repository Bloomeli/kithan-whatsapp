/** Gebäude aus der Vermietungs-App (Wohnung/Einheit). */
export const OBJEKTE = [
  { id: 'adalbertstrasse-104', label: 'Adalbertstraße 104, 80798 München' },
  { id: 'adelheidstr-24', label: 'Adelheidstr. 24, 80798 München' },
  { id: 'elisabethstrasse-8', label: 'Elisabethstraße 8, 80739 München' },
  { id: 'goethestr-3', label: 'Goethestr. 3, 80336 München' },
  { id: 'guntherstr-15', label: 'Guntherstr. 15, 80639 München' },
  { id: 'herrnstrasse-44', label: 'Herrnstraße 44, 80539 München' },
  { id: 'herzogstrasse-5', label: 'Herzogstraße 5 (Lager), 80331 München' },
  { id: 'ismaninger-str-17-19', label: 'Ismaninger Str. 17-19 (Duplex), 81675 München' },
  { id: 'maximiliansplatz-12a', label: 'Maximiliansplatz 12a, 80333 München' },
  { id: 'steinstrasse-57', label: 'Steinstraße 57, 81667 München' },
  { id: 'zenettistr-26', label: 'Zenettistr. 26, 80337 München' },
  { id: 'koenigsstrasse-8', label: 'Königsstraße 8 (Lager Dach), 93047 Regensburg' },
  { id: 'despagstrasse-4-4a', label: 'Despagstraße 4-4a, 85055 Ingolstadt' },
  { id: 'spandauer-str-160b', label: 'Spandauer Str. 160b, 14612 Falkensee' },
  { id: 'spandauer-str-160c', label: 'Spandauer Str. 160c, 14612 Falkensee' },
  { id: 'berliner-str-35-55', label: 'Berliner Str. 35-55, 14612 Falkensee' },
  { id: 'aberstr-23', label: 'Aberstr. 23, 81679 München' },
  { id: 'delpstr-4', label: 'Delpstr. 4 (BüroVilla), 81679 München' },
  { id: 'georgenstrasse-3', label: 'Georgenstraße 3, 80799 München' },
  { id: 'georgenstrasse-3-rgb', label: 'Georgenstraße 3 RGB, 80799 München' },
  { id: 'goethestrasse-8', label: 'Goethestraße 8, 80336 München' },
  { id: 'seidlstrasse-8', label: 'Seidlstraße 8, 80335 München' },
  { id: 'kaufinger-strasse-17', label: 'Kaufinger Straße 17 (Einzelhandel), 80331 München' },
  { id: 'leopoldstrasse-41', label: 'Leopoldstraße 41, 80802 München' },
  { id: 'nuernberger-str-24-26', label: 'Nürnberger Str. 24-26 (Außenstellplätze), 91052 Erlangen' },
  { id: 'michael-vogel-str-1a', label: 'Michael-Vogel-Str. 1a, 91052 Erlangen' },
  { id: 'michael-vogel-str-1b', label: 'Michael-Vogel-Str. 1b, 91052 Erlangen' },
  { id: 'michael-vogel-str-1c', label: 'Michael-Vogel-Str. 1c, 91052 Erlangen' },
  { id: 'michael-vogel-str-1d', label: 'Michael-Vogel-Str. 1d, 91052 Erlangen' },
  { id: 'michael-vogel-str-1e', label: 'Michael-Vogel-Str. 1e, 91052 Erlangen' },
  { id: 'auf-dem-streitacker-32-34', label: 'Auf dem Streitacker 32-34 (Kita), 51149 Köln' },
  { id: 'hyazinthenweg-10-12', label: 'Hyazinthenweg 10-12, 51069 Köln' },
] as const

export type ObjektId = (typeof OBJEKTE)[number]['id']

export function getObjektLabel(id: string | null | undefined): string {
  if (!id) return ''
  return OBJEKTE.find((objekt) => objekt.id === id)?.label ?? id
}
