# Fixture: XMLParser with resolve_entities=True. Should flag.
from lxml import etree

def parse_upload(xml_bytes: bytes):
    parser = etree.XMLParser(resolve_entities=True)
    return etree.fromstring(xml_bytes, parser)
