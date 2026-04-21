# Fixture: defusedxml. Must NOT flag.
import defusedxml.ElementTree as ET

def parse_upload(xml_bytes: bytes):
    return ET.fromstring(xml_bytes)
