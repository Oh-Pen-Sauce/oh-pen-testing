// Fixture: libxmljs with noent: true. Should flag.
import libxmljs from "libxmljs";

export function parseXml(xml: string) {
  return libxmljs.parseXml(xml, { noent: true });
}
